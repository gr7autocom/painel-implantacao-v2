import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from './Toast'

function Trigger({ onMounted }: { onMounted: (api: ReturnType<typeof useToast>) => void }) {
  const api = useToast()
  onMounted(api)
  return null
}

describe('Toast', () => {
  it('renderiza mensagem e fecha ao clicar no X', () => {
    let api!: ReturnType<typeof useToast>
    render(
      <ToastProvider>
        <Trigger onMounted={(a) => { api = a }} />
      </ToastProvider>
    )
    act(() => { api.toast('mensagem teste', 'success') })
    expect(screen.getByText('mensagem teste')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Fechar notificação'))
    expect(screen.queryByText('mensagem teste')).not.toBeInTheDocument()
  })

  it('action "Desfazer" chama callback e cancela onDismiss (padrão Undo da Sprint Talk)', () => {
    let api!: ReturnType<typeof useToast>
    const onUndo = vi.fn()
    const onCommit = vi.fn()
    render(
      <ToastProvider>
        <Trigger onMounted={(a) => { api = a }} />
      </ToastProvider>
    )
    act(() => {
      api.toast('Mensagem excluída', 'error', {
        action: { label: 'Desfazer', onClick: onUndo },
        onDismiss: onCommit,
      })
    })
    fireEvent.click(screen.getByText('Desfazer'))
    expect(onUndo).toHaveBeenCalledOnce()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('onDismiss é chamado se o toast expira sem ação clicada', () => {
    vi.useFakeTimers()
    let api!: ReturnType<typeof useToast>
    const onCommit = vi.fn()
    render(
      <ToastProvider>
        <Trigger onMounted={(a) => { api = a }} />
      </ToastProvider>
    )
    act(() => {
      api.toast('m', 'error', {
        action: { label: 'Desfazer', onClick: vi.fn() },
        onDismiss: onCommit,
      })
    })
    act(() => { vi.advanceTimersByTime(5500) })
    expect(onCommit).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('dismissByTag remove apenas toasts daquela tag', () => {
    let api!: ReturnType<typeof useToast>
    render(
      <ToastProvider>
        <Trigger onMounted={(a) => { api = a }} />
      </ToastProvider>
    )
    act(() => {
      api.toast('a', 'info', { tag: 'grupo-1' })
      api.toast('b', 'info', { tag: 'grupo-2' })
    })
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
    act(() => { api.dismissByTag('grupo-1') })
    expect(screen.queryByText('a')).not.toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
  })
})
