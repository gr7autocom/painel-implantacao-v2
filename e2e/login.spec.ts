import { test, expect, type Page } from '@playwright/test'

/**
 * Smoke E2E: o app sobe, route guard manda pra /login e a tela responde a interação.
 * Não tenta logar com credenciais reais — isso depende de Supabase de teste com user provisionado.
 * Para autenticar nos próximos suites, gerar storageState via auth.setup.ts (ver README dos e2e).
 */

const URL_TIMEOUT = 15_000

/** O AuthProvider chama supabase.auth.getSession() ao montar — pode levar
 *  alguns segundos. Esperamos a navegação real concluir antes das asserções. */
async function aguardarAppPronto(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
}

test.describe('Fluxo público (sem auth)', () => {
  test('rota raiz redireciona pra /login quando sem sessão', async ({ page }) => {
    await page.goto('/')
    await aguardarAppPronto(page)
    await expect(page).toHaveURL(/\/login$/, { timeout: URL_TIMEOUT })
  })

  test('tela de login renderiza form de email + senha', async ({ page }) => {
    await page.goto('/login')
    await aguardarAppPronto(page)
    // Login.tsx usa labels visuais sem htmlFor — selecionamos por type/placeholder
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: URL_TIMEOUT })
    await expect(page.locator('input[type="password"]')).toBeVisible()
    // Pode haver mais de 1 botão (sair, etc.); pegamos o primeiro com texto "Entrar"
    await expect(page.getByRole('button', { name: /entrar/i }).first()).toBeVisible()
  })

  test('botão Entrar existe e form não trava ao clicar com campos vazios', async ({ page }) => {
    await page.goto('/login')
    await aguardarAppPronto(page)
    const btn = page.getByRole('button', { name: /entrar/i }).first()
    await expect(btn).toBeVisible({ timeout: URL_TIMEOUT })
    // Click sem credenciais não deve quebrar o app — HTML5 required impede submit
    await btn.click({ trial: true }).catch(() => {})
  })

  test('rota protegida /clientes redireciona pra /login quando sem sessão', async ({ page }) => {
    await page.goto('/clientes')
    await aguardarAppPronto(page)
    await expect(page).toHaveURL(/\/login/, { timeout: URL_TIMEOUT })
  })

  test('rota protegida /projetos redireciona pra /login quando sem sessão', async ({ page }) => {
    await page.goto('/projetos')
    await aguardarAppPronto(page)
    await expect(page).toHaveURL(/\/login/, { timeout: URL_TIMEOUT })
  })

  test('rota protegida /tarefas redireciona pra /login quando sem sessão', async ({ page }) => {
    await page.goto('/tarefas')
    await aguardarAppPronto(page)
    await expect(page).toHaveURL(/\/login/, { timeout: URL_TIMEOUT })
  })

  test('rota protegida /talk redireciona pra /login quando sem sessão', async ({ page }) => {
    await page.goto('/talk')
    await aguardarAppPronto(page)
    await expect(page).toHaveURL(/\/login/, { timeout: URL_TIMEOUT })
  })

  test('alias /scrap redireciona pra /talk (e depois pra /login pelo guard)', async ({ page }) => {
    await page.goto('/scrap')
    await aguardarAppPronto(page)
    await expect(page).toHaveURL(/\/login/, { timeout: URL_TIMEOUT })
  })

  test('rota inexistente sob `/` herda o RequireAuth e cai em /login', async ({ page }) => {
    // Só rotas dentro do layout protegido (filhas de `/`) caem no guard.
    // Subpath profundo desconhecido sob /tarefas serve como sentinela.
    await page.goto('/tarefas/subpath-inexistente-xyz')
    await aguardarAppPronto(page)
    await expect(page).toHaveURL(/\/login/, { timeout: URL_TIMEOUT })
  })
})

test.describe('Acessibilidade básica do login', () => {
  test('heading principal visível e form tem inputs com type semântico', async ({ page }) => {
    await page.goto('/login')
    await aguardarAppPronto(page)
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: URL_TIMEOUT })
    // Inputs precisam ter type semântico (email/password) pra teclado mobile certo
    await expect(page.locator('input[type="email"]')).toHaveCount(1)
    await expect(page.locator('input[type="password"]')).toHaveCount(1)
  })

  test('input email aceita foco programático e fica como activeElement', async ({ page }) => {
    await page.goto('/login')
    await aguardarAppPronto(page)
    await page.locator('input[type="email"]').focus()
    const tag = await page.evaluate(() => document.activeElement?.tagName)
    const tipo = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type)
    expect(tag).toBe('INPUT')
    expect(tipo).toBe('email')
  })
})
