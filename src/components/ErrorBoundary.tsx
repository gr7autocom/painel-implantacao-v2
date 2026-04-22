import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-400/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Algo deu errado</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm">
            {this.state.error.message || 'Erro inesperado na aplicação.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 text-sm font-medium text-[#ffffff] bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
