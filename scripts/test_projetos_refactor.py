from playwright.sync_api import sync_playwright
import sys

BASE = "http://localhost:5174"
errors = []
console_errors = []

def log(msg):
    print(msg, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda err: console_errors.append(f"[pageerror] {err}"))

    # --- LOGIN ---
    log("=== LOGIN ===")
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.screenshot(path="/tmp/01_login.png")
    page.fill('input[type="email"]', "suporte@gr7autocom.com.br")
    page.fill('input[type="password"]', "admin123")
    page.click('button[type="submit"]')
    page.wait_for_load_state("networkidle")
    page.screenshot(path="/tmp/02_after_login.png")
    log(f"URL após login: {page.url}")

    # --- PROJETOS ---
    log("\n=== PÁGINA /projetos ===")
    page.goto(f"{BASE}/projetos")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    page.screenshot(path="/tmp/03_projetos.png", full_page=True)

    cards = page.locator('[aria-label^="Abrir projeto"]').all()
    log(f"Cards de projetos encontrados: {len(cards)}")
    if len(cards) == 0:
        # Tenta sem aria-label
        cards_alt = page.locator('.group.relative.bg-white').all()
        log(f"Cards alternativos: {len(cards_alt)}")

    # Verifica se tem erro visível
    erros_na_pagina = page.locator('[role="alert"]').all()
    if erros_na_pagina:
        for e in erros_na_pagina:
            log(f"  ERRO NA PÁGINA: {e.text_content()}")
        errors.append("Erro visível na página /projetos")

    # --- DETALHE DO PROJETO ---
    log("\n=== CLICANDO NO PRIMEIRO CARD ===")
    if len(cards) > 0:
        cards[0].click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        page.screenshot(path="/tmp/04_projeto_detalhe.png", full_page=True)
        log(f"URL após clique: {page.url}")

        # Verifica header do projeto
        h1 = page.locator("h1").first
        log(f"Título do projeto: {h1.text_content()}")

        # Verifica badge de etapa
        etapa_badges = page.locator('[data-etapa-popover], span[class*="rounded-full"][class*="border"]').all()
        log(f"Badges encontrados: {len(etapa_badges)}")

        erros_detalhe = page.locator('[role="alert"]').all()
        if erros_detalhe:
            for e in erros_detalhe:
                log(f"  ERRO NO DETALHE: {e.text_content()}")
            errors.append("Erro visível em /projetos/:id")

        # --- MONITOR ---
        log("\n=== BOTÃO MONITOR ===")
        monitor_btn = page.locator('a:has-text("Monitor")')
        if monitor_btn.count() > 0:
            monitor_btn.first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            page.screenshot(path="/tmp/05_monitor.png", full_page=True)
            log(f"URL monitor: {page.url}")

            h1_monitor = page.locator("h1").first
            log(f"Título monitor: {h1_monitor.text_content()}")

            erros_monitor = page.locator('[role="alert"]').all()
            if erros_monitor:
                for e in erros_monitor:
                    log(f"  ERRO NO MONITOR: {e.text_content()}")
                errors.append("Erro visível em /projetos/:id/monitor")

            # Verifica KPI cards
            kpi_cards = page.locator('p:has-text("Total"), p:has-text("Atrasadas"), p:has-text("Em aberto")').all()
            log(f"KPI cards encontrados: {len(kpi_cards)}")
        else:
            log("Botão Monitor não encontrado")
            errors.append("Botão Monitor não encontrado")
    else:
        log("Nenhum card encontrado — pulando testes de detalhe e monitor")
        errors.append("Nenhum card de projeto encontrado")

    # --- CLIENTES ---
    log("\n=== PÁGINA /clientes ===")
    page.goto(f"{BASE}/clientes")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    page.screenshot(path="/tmp/06_clientes.png", full_page=True)
    log(f"URL: {page.url}")

    erros_clientes = page.locator('[role="alert"]').all()
    if erros_clientes:
        for e in erros_clientes:
            log(f"  ERRO EM CLIENTES: {e.text_content()}")
        errors.append("Erro visível em /clientes")

    # Verifica badges de etapa na tabela
    etapa_col = page.locator('td').filter(has=page.locator('span[class*="rounded-full"]')).all()
    log(f"Células com badges de etapa em /clientes: {len(etapa_col)}")

    browser.close()

# --- RELATÓRIO ---
print("\n" + "="*50)
print("RELATÓRIO FINAL")
print("="*50)
if errors:
    print(f"FALHAS ({len(errors)}):")
    for e in errors:
        print(f"  ✗ {e}")
else:
    print("TODOS OS TESTES PASSARAM ✓")

relevant_console = [e for e in console_errors if "supabase" not in e.lower() and "favicon" not in e.lower()]
if relevant_console:
    print(f"\nErros de console ({len(relevant_console)}):")
    for e in relevant_console[:10]:
        print(f"  {e}")
else:
    print("\nNenhum erro de console relevante.")

print("\nScreenshots salvas em /tmp/0*.png")
sys.exit(1 if errors else 0)
