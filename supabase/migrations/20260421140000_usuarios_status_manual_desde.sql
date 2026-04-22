-- Marca o instante em que o status_manual foi ativado.
-- Usado para contar mensagens recebidas enquanto o usuário estava em "Não incomodar".
-- NULL quando o usuário não está em nenhum status manual.
ALTER TABLE public.usuarios
  ADD COLUMN status_manual_desde TIMESTAMPTZ;
