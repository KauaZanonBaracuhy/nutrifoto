"""Teste automatizado da interface NutriFoto com Playwright."""
import sys
import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 414, "height": 896})
        errors = []
        page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error","warning") else None)
        page.on("pageerror", lambda err: errors.append(f"[PAGEERROR] {err}"))

        await page.goto(BASE, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        print("=== TESTE 1: Dashboard carregou ===")
        await page.screenshot(path="test_dashboard.png")
        print("Screenshot dashboard salvo")

        # Verificar donut chart
        donut = await page.query_selector("#donut-hero")
        print(f"Donut canvas: {'OK' if donut else 'FALHA'}")

        # Verificar Lucide icons
        icons = await page.query_selector_all("i[data-lucide]")
        print(f"Ícones Lucide encontrados: {len(icons)}")

        # Verificar Chart.js
        chart = await page.evaluate("() => typeof Chart !== 'undefined' && typeof window.chartInstances !== 'undefined'")
        print(f"Chart.js carregado: {chart}")

        # Verificar navegação
        print("\n=== TESTE 2: Navegação ===")
        for btn in await page.query_selector_all(".nav-btn"):
            screen = await btn.get_attribute("data-screen")
            await btn.click()
            await page.wait_for_timeout(500)
            active = await page.query_selector(f"#screen-{screen}.screen.active")
            print(f"  Navegação para {screen}: {'OK' if active else 'FALHA'}")

        # Ir para Captura
        await page.click(".nav-btn[data-screen='dashboard']")
        await page.wait_for_timeout(300)
        await page.click("#btn-add-meal")
        await page.wait_for_timeout(500)
        print("\n=== TESTE 3: Tela Captura ===")
        capture = await page.query_selector("#screen-capture.screen.active")
        print(f"  Tela captura aberta: {'OK' if capture else 'FALHA'}")
        await page.screenshot(path="test_capture.png")

        # Verificar botões câmera/galeria
        cam = await page.query_selector("#btn-camera")
        gal = await page.query_selector("#btn-gallery")
        print(f"  Botão câmera: {'OK' if cam else 'FALHA'}")
        print(f"  Botão galeria: {'OK' if gal else 'FALHA'}")

        # Voltar
        await page.click("#btn-cancel-capture")
        await page.wait_for_timeout(500)

        # Configurações
        print("\n=== TESTE 4: Configurações ===")
        await page.click(".nav-btn[data-screen='settings']")
        await page.wait_for_timeout(500)
        settings = await page.query_selector("#screen-settings.screen.active")
        print(f"  Tela configurações: {'OK' if settings else 'FALHA'}")
        await page.screenshot(path="test_settings.png")

        # Verificar campos
        for field_id in ["cfg-endpoint","cfg-apikey","cfg-model","goal-calories","goal-protein","goal-carb","goal-fat"]:
            el = await page.query_selector(f"#{field_id}")
            print(f"  Campo {field_id}: {'OK' if el else 'FALHA'}")

        # Expandir advanced
        adv = await page.query_selector("#btn-toggle-advanced")
        if adv:
            await adv.click()
            await page.wait_for_timeout(300)
            adv_fields = await page.query_selector("#advanced-fields")
            visible = await adv_fields.is_visible() if adv_fields else False
            print(f"  Advanced fields visíveis: {visible}")

        # Histórico
        print("\n=== TESTE 5: Histórico ===")
        await page.click(".nav-btn[data-screen='history']")
        await page.wait_for_timeout(500)
        hist = await page.query_selector("#screen-history.screen.active")
        print(f"  Tela histórico: {'OK' if hist else 'FALHA'}")

        # Theme toggle
        print("\n=== TESTE 6: Toggle tema ===")
        theme_btn = await page.query_selector("#btn-toggle-theme")
        if theme_btn:
            await theme_btn.click()
            await page.wait_for_timeout(500)
            html = await page.query_selector("html")
            theme = await html.get_attribute("data-theme")
            print(f"  Tema após toggle: {theme}")

        # Resultados
        print("\n=== TESTE 7: Tela Resultado ===")
        await page.click(".nav-btn[data-screen='dashboard']")
        await page.wait_for_timeout(300)
        await page.click("#btn-add-meal")
        await page.wait_for_timeout(300)
        await page.click("#btn-cancel-capture")
        await page.wait_for_timeout(300)
        # Simular ir para resultados
        await page.evaluate("() => showScreen('results')")
        await page.wait_for_timeout(500)
        res = await page.query_selector("#screen-results.screen.active")
        print(f"  Tela resultados: {'OK' if res else 'FALHA'}")

        print("\n=== ERROS DE CONSOLE ===")
        if errors:
            for e in errors:
                print(f"  {e}")
        else:
            print("  Nenhum erro!")

        await browser.close()
        return len(errors)

if __name__ == "__main__":
    n = asyncio.run(test())
    print(f"\nTeste finalizado. {n} erro(s) de console.")
    sys.exit(0 if n == 0 else 1)