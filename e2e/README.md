# Testes E2E (Playwright)

Testes ponta-a-ponta que sobem o app real (`vite preview`) e dirigem o browser
(Chromium + emulação Pixel 7).

## Comandos

```bash
npm run build            # gera dist/ (Playwright usa preview)
npm run e2e              # roda todos os specs (headless)
npm run e2e:ui           # UI interativa (passo-a-passo, time-travel)
npm run e2e:headed       # vê o browser abrir
npm run e2e:report       # abre o último relatório HTML
```

O `vite preview` é levantado automaticamente pelo Playwright (config
`webServer`) na porta `4173`. Se já estiver rodando, é reusado.

## Estrutura

- `login.spec.ts` — fluxo público: redirects de route guards, render do form
  de login, navegação por teclado, alias `/scrap` → `/talk`. **Não autentica.**

## Adicionar testes autenticados

O app exige Supabase real para login. Para testar fluxos protegidos
(`/clientes`, `/projetos`, `TarefaModal` etc.), o caminho recomendado:

1. **Criar um usuário de teste** no Supabase de QA com permissão `admin` ou
   `vendas`. Guardar credenciais em variáveis de ambiente:
   - `E2E_EMAIL`, `E2E_PASSWORD`
2. **Auth setup file** (`e2e/auth.setup.ts`) que faz login via UI uma única vez
   e salva o `storageState` em `e2e/.auth/user.json`.
3. **Specs autenticados** importam o storageState:
   ```ts
   test.use({ storageState: 'e2e/.auth/user.json' })
   ```

Exemplo de auth.setup.ts (não criado ainda — só ative quando for usar):

```ts
import { test as setup, expect } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/e-?mail/i).fill(process.env.E2E_EMAIL!)
  await page.getByLabel(/senha/i).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: /entrar/i }).click()
  await expect(page).toHaveURL(/^(?!.*\/login).+/)
  await page.context().storageState({ path: authFile })
})
```

Aí em `playwright.config.ts` adiciona um project `setup` e os outros projects
ficam `dependencies: ['setup']`.

## ⚠️ Observação importante

**Não rode E2E autenticado contra o Supabase de produção.** Use sempre um
projeto Supabase separado (QA) com dados descartáveis — os testes podem
criar/excluir clientes, projetos, tarefas, mensagens de chat etc.
