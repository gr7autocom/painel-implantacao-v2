import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { RequireRole } from './components/RequireRole'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Inicio } from './pages/Inicio'
import { Clientes } from './pages/Clientes'
import { Projetos } from './pages/Projetos'
import { ProjetoDetalhe } from './pages/ProjetoDetalhe'
import { ProjetoMonitor } from './pages/ProjetoMonitor'
import { Tarefas } from './pages/Tarefas'
import { Scrap } from './pages/Scrap'
import { Configuracoes } from './pages/Configuracoes'
import { Login } from './pages/Login'
import { DefinirSenha } from './pages/DefinirSenha'
import { AuthProvider } from './lib/auth'
import { TarefaListasProvider } from './lib/tarefa-listas-context'
import { PresenceProvider } from './lib/usePresence'
import { ToastProvider } from './components/Toast'

function ScrapRedirect() {
  const location = useLocation()
  return <Navigate to={`/talk${location.search}`} replace />
}

function App() {
  return (
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/definir-senha" element={<DefinirSenha />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<PresenceProvider><TarefaListasProvider><Layout /></TarefaListasProvider></PresenceProvider>}>
              <Route index element={<ErrorBoundary><Inicio /></ErrorBoundary>} />
              <Route path="clientes" element={<ErrorBoundary><Clientes /></ErrorBoundary>} />
              <Route path="projetos" element={<ErrorBoundary><Projetos /></ErrorBoundary>} />
              <Route path="projetos/:id" element={<ErrorBoundary><ProjetoDetalhe /></ErrorBoundary>} />
              <Route path="projetos/:id/tarefas/:codigo" element={<ErrorBoundary><ProjetoDetalhe /></ErrorBoundary>} />
              <Route path="projetos/:id/monitor" element={<ErrorBoundary><ProjetoMonitor /></ErrorBoundary>} />
              <Route path="tarefas" element={<ErrorBoundary><Tarefas /></ErrorBoundary>} />
              <Route path="tarefas/:codigo" element={<ErrorBoundary><Tarefas /></ErrorBoundary>} />
              <Route path="talk" element={<ErrorBoundary><Scrap /></ErrorBoundary>} />
              <Route path="scrap" element={<ScrapRedirect />} />
              <Route element={<RequireRole acao="configuracoes.acessar" />}>
                <Route path="configuracoes" element={<ErrorBoundary><Configuracoes /></ErrorBoundary>} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
  )
}

export default App
