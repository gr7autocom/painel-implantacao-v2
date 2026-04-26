import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NomeProjetoModal } from './NomeProjetoModal'

describe('NomeProjetoModal', () => {
  it('não renderiza quando open=false', () => {
    render(<NomeProjetoModal open={false} onClose={() => {}} onConfirmar={() => {}} />)
    expect(screen.queryByText('Nome do projeto')).not.toBeInTheDocument()
  })

  it('renderiza com defaultNome pré-preenchido e descricao', () => {
    render(
      <NomeProjetoModal
        open
        onClose={() => {}}
        defaultNome="Implantação ACME"
        descricao="Cria com tarefas iniciais."
        onConfirmar={() => {}}
      />
    )
    expect(screen.getByDisplayValue('Implantação ACME')).toBeInTheDocument()
    expect(screen.getByText('Cria com tarefas iniciais.')).toBeInTheDocument()
  })

  it('chama onConfirmar com nome trimado ao clicar Criar projeto', () => {
    const onConfirmar = vi.fn()
    render(
      <NomeProjetoModal
        open
        onClose={() => {}}
        defaultNome="  Implantação X  "
        onConfirmar={onConfirmar}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))
    expect(onConfirmar).toHaveBeenCalledWith('Implantação X')
  })

  it('faz fallback para "Novo projeto" quando input está vazio', () => {
    const onConfirmar = vi.fn()
    render(<NomeProjetoModal open onClose={() => {}} defaultNome="" onConfirmar={onConfirmar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }))
    expect(onConfirmar).toHaveBeenCalledWith('Novo projeto')
  })

  it('Enter no input dispara onConfirmar', () => {
    const onConfirmar = vi.fn()
    render(<NomeProjetoModal open onClose={() => {}} defaultNome="X" onConfirmar={onConfirmar} />)
    // "Nome do projeto" aparece duas vezes (título do modal + label do input);
    // selecionamos via role textbox pra evitar ambiguidade
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onConfirmar).toHaveBeenCalledWith('X')
  })

  it('botão fica disabled e mostra "Criando..." quando saving=true', () => {
    render(<NomeProjetoModal open onClose={() => {}} saving onConfirmar={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Criando...' })
    expect(btn).toBeDisabled()
  })

  it('respeita labelConfirmar customizado', () => {
    render(
      <NomeProjetoModal open onClose={() => {}} labelConfirmar="Salvar" onConfirmar={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
  })
})
