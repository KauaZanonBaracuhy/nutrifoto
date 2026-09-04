"""
Test the 'Meu Plano' feature end-to-end:
- Loads the page
- Switches to 'Meu Plano' tab
- Fills the form
- Clicks 'Gerar meu plano'
- Waits for the plan to render
- Verifies the plan view shows TDEE, metaCalorica, macros, refeicoes
- Takes a screenshot of the form and of the plan view
- Tests 'Aplicar às metas diárias' (apply to daily goals)
- Tests 'Editar formulário' button
"""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

URL = "http://localhost:5500/"
SCREENSHOT_DIR = Path(r"C:\Users\kauaz\Desktop\projetos\ia dieta\nutrifoto")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def log(msg):
    print(f"[test] {msg}", flush=True)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 412, "height": 915},
            device_scale_factor=2,
        )
        page = ctx.new_page()

        # Surface page console for diagnostics
        page.on("console", lambda m: log(f"console.{m.type}: {m.text}"))
        page.on("pageerror", lambda e: log(f"pageerror: {e}"))

        log(f"Opening {URL}")
        page.goto(URL, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1500)  # let lucide and module graph settle

        # 1. Initial dashboard
        page.screenshot(path=str(SCREENSHOT_DIR / "test_diet_01_dashboard.png"), full_page=True)
        log("Dashboard screenshot saved")

        # 2. Click "Meu Plano" tab
        page.locator(".nav-btn[data-screen='diet']").click()
        page.wait_for_timeout(800)
        page.screenshot(path=str(SCREENSHOT_DIR / "test_diet_02_form_empty.png"), full_page=True)
        log("Empty form screenshot saved")

        # 3. Fill the form
        page.fill("#dp-idade", "32")
        page.select_option("#dp-sexo", "masculino")
        page.fill("#dp-peso", "82")
        page.fill("#dp-altura", "178")
        page.select_option("#dp-atividade", "moderado")
        page.select_option("#dp-objetivo", "perder_peso")
        page.fill("#dp-peso-desejado", "75")
        page.fill("#dp-prazo", "4 meses")

        # chips: click "sem_gluten" + "sem_lactose"
        page.locator(".diet-chip[data-value='nenhuma']").click()  # deselect default
        page.locator(".diet-chip[data-value='sem_gluten']").click()
        page.locator(".diet-chip[data-value='sem_lactose']").click()

        page.fill("#dp-alergias", "castanha do para")
        page.fill("#dp-nao-gosta", "figado, beterraba")
        page.fill("#dp-favoritos", "frango, batata-doce, ovos, aveia")

        page.select_option("#dp-refeicoes", "5")
        page.fill("#dp-acorda", "06:30")
        page.fill("#dp-dorme", "23:00")
        page.fill("#dp-rotina", "almoco so depois das 13h por causa do trabalho")
        page.fill("#dp-condicoes", "nenhuma")

        page.wait_for_timeout(400)
        page.screenshot(path=str(SCREENSHOT_DIR / "test_diet_03_form_filled.png"), full_page=True)
        log("Filled form screenshot saved")

        # 4. Click "Gerar meu plano"
        log("Clicking 'Gerar meu plano'...")
        page.locator("#btn-generate-plan").click()
        # The plan view should appear after the API call
        try:
            page.locator("#diet-plan-view").wait_for(state="visible", timeout=90000)
        except PWTimeout:
            page.screenshot(path=str(SCREENSHOT_DIR / "test_diet_ERROR_timeout.png"), full_page=True)
            log("ERROR: Plan did not appear within 90s")
            sys.exit(1)

        page.wait_for_timeout(500)
        tdee = page.locator("#plan-tdee-val").text_content().strip()
        meta = page.locator("#plan-meta-val").text_content().strip()
        objetivo = page.locator("#plan-objective").text_content().strip()
        meal_cards = page.locator(".plan-meal-card").count()
        log(f"TDEE={tdee} meta={meta} objetivo='{objetivo}' meals={meal_cards}")

        if not tdee:
            log("TDEE vazio, falhou")
            sys.exit(1)
        if int(tdee) <= 0 or int(meta) <= 0:
            log(f"Valores invalidos TDEE={tdee} meta={meta}")
            sys.exit(1)
        if meal_cards < 3:
            log(f"Refeicoes insuficientes: {meal_cards}")
            sys.exit(1)

        page.screenshot(path=str(SCREENSHOT_DIR / "test_diet_04_plan.png"), full_page=True)
        log("Plan view screenshot saved")

        # 5. Click "Aplicar às metas diárias"
        log("Clicking 'Aplicar às metas diárias'...")
        page.locator("#btn-apply-goals").click()
        # Should show confirmation overlay then redirect to settings after 1.5s
        try:
            page.locator("#confirm-overlay").wait_for(state="visible", timeout=3000)
        except PWTimeout:
            pass
        page.wait_for_timeout(2000)
        # Now should be on settings
        page.screenshot(path=str(SCREENSHOT_DIR / "test_diet_05_settings.png"), full_page=True)
        log("Settings after apply screenshot saved")

        cal = page.locator("#goal-calories").input_value()
        prot = page.locator("#goal-protein").input_value()
        carb = page.locator("#goal-carb").input_value()
        fat = page.locator("#goal-fat").input_value()
        log(f"Metas diarias: cal={cal} prot={prot} carb={carb} fat={fat}")
        if int(cal) != int(meta):
            log(f"Calorias aplicadas NAO batem com meta: {cal} vs {meta}")
            sys.exit(1)

        # 6. Go back to Meu Plano, verify plan persisted
        page.locator(".nav-btn[data-screen='diet']").click()
        page.wait_for_timeout(500)
        tdee2 = page.locator("#plan-tdee-val").text_content().strip()
        log(f"Persisted TDEE on revisit: {tdee2}")
        if tdee2 != tdee:
            log("Plan nao persistiu")
            sys.exit(1)

        # 7. Click "Editar formulário" — should show form pre-filled
        page.locator("#btn-edit-form").click()
        page.wait_for_timeout(500)
        idade = page.locator("#dp-idade").input_value()
        peso = page.locator("#dp-peso").input_value()
        log(f"Form re-filled values: idade={idade} peso={peso}")
        if int(idade) != 32 or float(peso) != 82.0:
            log("Form nao foi pre-preenchido corretamente")
            sys.exit(1)
        page.screenshot(path=str(SCREENSHOT_DIR / "test_diet_06_form_refilled.png"), full_page=True)
        log("Re-filled form screenshot saved")

        log("ALL CHECKS PASSED")
        browser.close()


if __name__ == "__main__":
    main()
