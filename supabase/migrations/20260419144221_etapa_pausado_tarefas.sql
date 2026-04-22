-- Adiciona etapa "Pausado" nas etapas de tarefa (entre Em Andamento e Concluído)
-- Seeds atuais: Pendente(1), Em Andamento(2), Concluído(3), Cancelado(4)
-- Abre espaço: Concluído passa para ordem 4, Cancelado para 5

UPDATE public.etapas SET ordem = 4 WHERE nome ILIKE '%conclu%' AND ordem = 3;
UPDATE public.etapas SET ordem = 5 WHERE nome ILIKE '%cancel%' AND ordem = 4;

INSERT INTO public.etapas (nome, ordem, cor, ativo)
VALUES ('Pausado', 3, '#8B5CF6', true)
ON CONFLICT (nome) DO NOTHING;
