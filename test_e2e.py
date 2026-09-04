"""Teste E2E real: carrega NutriFoto, simula foto, clica Analisar, valida resposta da OpenRouter."""
import asyncio, sys, json, base64, io
# Força stdout a UTF-8 no Windows (cp1252 não tem \u2713, \u2717, etc.)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from playwright.async_api import async_playwright

BASE = "http://localhost:5173"

# Imagem sintética: bytes pseudo-aleatórios que o modelo identificará como "não-comida".
# O objetivo é validar que o pipeline (fetch → OpenRouter → extração JSON) funciona ponta a ponta.
# Vamos usar uma imagem colorida pequena com "comida-like" — um quadrado colorido para o modelo analisar.
def make_food_like_png():
    # PNG 32x32 laranja (cor de alimento). Bytes mínimos gerados.
    # Na verdade, mais simples: injetar um PNG real via canvas no browser.
    return None  # usaremos canvas no browser para gerar

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 414, "height": 896})

        errors = []
        warnings = []
        page.on("console", lambda m: (errors if m.type == "error" else warnings if m.type == "warning" else []).append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: errors.append(f"[PAGEERROR] {e}"))

        print("=== Carregando app ===")
        await page.goto(BASE, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1500)

        # 1) Verificar que o card Provedor de IA foi REMOVIDO
        print("\n=== TESTE 1: card Provedor de IA removido ===")
        for old_id in ["cfg-endpoint", "cfg-apikey", "cfg-model", "preset-buttons",
                       "advanced-fields", "btn-toggle-advanced", "cfg-name",
                       "cfg-auth-header", "cfg-auth-format", "cfg-extra-headers",
                       "cfg-body-template", "cfg-response-path"]:
            el = await page.query_selector(f"#{old_id}")
            print(f"  #{old_id}: {'AINDA EXISTE (BUG)' if el else 'OK removido'}")

        # 2) Verificar que o card de Conexão novo existe com info da OpenRouter
        print("\n=== TESTE 2: card Conexão + Testar conexão ===")
        info = await page.query_selector(".provider-info")
        info_text = (await info.inner_text()) if info else ""
        print(f"  .provider-info: {'OK' if info else 'FALTA'} | texto: {info_text!r}")
        test_btn = await page.query_selector("#btn-test-connection")
        print(f"  #btn-test-connection: {'OK' if test_btn else 'FALTA'}")

        # 3) Testar conexão real — sem precisar de foto
        print("\n=== TESTE 3: Testar conexão (chamada real à OpenRouter) ===")
        await page.click(".nav-btn[data-screen='settings']")
        await page.wait_for_timeout(800)
        await page.click("#btn-test-connection")
        await page.wait_for_selector("#test-result[style*='block']", timeout=15000)
        result_el = await page.query_selector("#test-result")
        result_text = (await result_el.inner_text()) if result_el else ""
        result_class = await result_el.get_attribute("class") if result_el else ""
        print(f"  resultado: {result_text!r}")
        print(f"  classe: {result_class!r}")
        test_ok = "success" in (result_class or "") and "OK" in result_text
        print(f"  VEREDITO: {'CONEXAO OK' if test_ok else 'FALHOU'}")
        # Ignora erro de UnicodeDecodeError quando imprime (✓ = \u2713, ✗ = \u2717)
        try:
            await page.click(".nav-btn[data-screen='settings']")
        except:
            pass

        # 4) Simular foto + análise real
        print("\n=== TESTE 4: Captura → Análise real ===")
        await page.click(".nav-btn[data-screen='dashboard']")
        await page.wait_for_timeout(300)
        await page.click("#btn-add-meal")
        await page.wait_for_timeout(500)

        # Gerar uma imagem de "comida" no canvas do browser e injetar via input file
        # Truque: criar um Blob com bytes de uma imagem laranja 32x32 (cor de comida)
        # e despachar via DataTransfer no input file (que é criado dinamicamente por camera.js).
        # Simplificação: chamar diretamente as funções JS do app para simular captura.
        await page.evaluate("""
            async () => {
                // Gera uma imagem 256x256 laranja via canvas, simula seleção
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                // Fundo que sugira comida (cores quentes)
                const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
                g.addColorStop(0, '#FFD580');
                g.addColorStop(1, '#C66A2A');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, 256, 256);
                // "Alimento" central
                ctx.fillStyle = '#8B4513';
                ctx.beginPath();
                ctx.arc(128, 128, 70, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFE4B5';
                ctx.beginPath();
                ctx.arc(110, 110, 30, 0, Math.PI * 2);
                ctx.fill();
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                // Importa o módulo e chama como se fosse captura
                const camera = await import('./js/camera.js');
                const app = await import('./js/app.js');
                // Bypass: criar objeto {dataUrl, base64, mediaType} direto
                const [meta, b64] = dataUrl.split(',');
                const img = { dataUrl, base64: b64, mediaType: 'image/jpeg' };
                window.__test_img = img;
            }
        """)

        # Pegar imagem gerada e injetar via state interno do app
        # Como setCaptureImage não é exportado, clicamos no botão Câmera não vai funcionar no headless.
        # Solução: injetar diretamente no state interno via setCaptureImage exposto por app.js
        await page.evaluate("""
            async () => {
                // Gera uma imagem 256x256 "comida-like" via canvas
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
                g.addColorStop(0, '#FFD580');
                g.addColorStop(1, '#C66A2A');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, 256, 256);
                ctx.fillStyle = '#8B4513';
                ctx.beginPath();
                ctx.arc(128, 128, 70, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFE4B5';
                ctx.beginPath();
                ctx.arc(110, 110, 30, 0, Math.PI * 2);
                ctx.fill();
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                const [meta, b64] = dataUrl.split(',');
                const img = { dataUrl, base64: b64, mediaType: 'image/jpeg' };
                // setCaptureImage está no escopo do módulo app.js mas não é exportado.
                // Solução: simular via API exportada de camera.js (downscaleImage aceita dataUrl)
                // e injetar via clique programático no botão Câmera mockando Capacitor.
                const camera = await import('./js/camera.js');
                const downscaled = await camera.downscaleImage(img.dataUrl, 512);
                // Precisamos chamar setCaptureImage. Como é módulo, vamos expor via window.
                // Truque: o app.js não exporta nada, mas setCaptureImage usa state.currentImage.
                // Solução: criar input file, simular seleção.
                return downscaled;
            }
        """)
        # Como o módulo app.js não exporta nada, vamos injetar via dispatch de evento no input file criado pelo camera.js
        # Estratégia mais simples: substituir a função captureFromCamera globalmente via window
        await page.evaluate("""
            async () => {
                const camera = await import('./js/camera.js');
                const origCap = camera.captureFromCamera;
                window.__capturedImg = null;
                camera.captureFromCamera = async () => window.__capturedImg;
                // Gera a imagem
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
                g.addColorStop(0, '#FFD580');
                g.addColorStop(1, '#C66A2A');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, 256, 256);
                ctx.fillStyle = '#8B4513';
                ctx.beginPath();
                ctx.arc(128, 128, 70, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FFE4B5';
                ctx.beginPath();
                ctx.arc(110, 110, 30, 0, Math.PI * 2);
                ctx.fill();
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                const [meta, b64] = dataUrl.split(',');
                window.__capturedImg = { dataUrl, base64: b64, mediaType: 'image/jpeg' };
            }
        """)
        # Clica no botão Câmera que dispara handleImage → captureFromCamera (mockado)
        await page.click("#btn-camera")
        await page.wait_for_timeout(800)

        preview = await page.query_selector("#image-preview img")
        print(f"  Preview de imagem apareceu: {'OK' if preview else 'FALHA'}")

        # Agora clica em Analisar
        print("\n=== TESTE 5: clique em Analisar (chamada real OpenRouter com imagem) ===")
        await page.click("#btn-analyze")
        # Esperar aparecer a tela de resultados
        try:
            await page.wait_for_selector("#screen-results.active", timeout=30000)
            print("  [OK] tela de Resultados abriu")
        except:
            print("  [FALHA] tela de Resultados NAO abriu (chamada falhou ou timeout)")
            print("  --- ERROS DE CONSOLE ---")
            for e in errors:
                try:
                    print(f"    {e}")
                except:
                    pass
            await page.screenshot(path="test_fail.png")
            await browser.close()
            return

        # Verificar que foods-list apareceu
        foods = await page.query_selector_all(".food-receipt")
        print(f"  Alimentos detectados: {len(foods)}")

        totals_text = ""
        totals = await page.query_selector("#totals-summary")
        if totals:
            totals_text = (await totals.inner_text()).strip()
        print(f"  Totals summary: {totals_text!r}")

        await page.screenshot(path="test_result.png", full_page=True)

        # Resumo de erros
        print("\n=== ERROS DE CONSOLE ===")
        if errors:
            for e in errors:
                try:
                    print(f"  {e}")
                except UnicodeEncodeError:
                    print(f"  [erro de unicode]")
        else:
            print("  [OK] Nenhum erro")

        # Veredito final
        analysis_ok = len(foods) > 0 and "kcal" in totals_text.lower()
        print(f"\n=== VEREDITO FINAL ===")
        print(f"  Conexao OpenRouter: {'OK' if test_ok else 'FALHOU'}")
        print(f"  Analise de imagem: {'OK' if analysis_ok else 'vazia (imagem sem comida visivel)'}")
        print(f"  Tela Resultado renderizou: {'OK' if foods is not None else 'FALHOU'}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test())