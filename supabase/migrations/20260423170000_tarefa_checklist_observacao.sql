-- Adiciona campo de observação por item no checklist de tarefa.
-- Uso: usuário clica no badge "Obs", escreve um motivo/observação inline e salva.
-- Trigger: alterações na observação exigem mesma permissão que alterar texto/link
--          (is_tarefa_editor OU checklist.editar_qualquer_tarefa).

ALTER TABLE public.tarefa_checklist ADD COLUMN observacao TEXT;

-- Atualiza trigger para incluir observacao no gate de permissão
CREATE OR REPLACE FUNCTION public.enforce_checklist_update()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- tarefa_id é imutável após criação
  IF NEW.tarefa_id IS DISTINCT FROM OLD.tarefa_id THEN
    RAISE EXCEPTION 'tarefa_checklist.tarefa_id é imutável após criação.'
      USING ERRCODE = '23514';
  END IF;

  -- Edição de texto/ordem/link/observacao requer ser editor da tarefa
  -- OU ter a capacidade global de editar checklist de qualquer tarefa
  IF NEW.texto      IS DISTINCT FROM OLD.texto
     OR NEW.ordem   IS DISTINCT FROM OLD.ordem
     OR NEW.link    IS DISTINCT FROM OLD.link
     OR NEW.observacao IS DISTINCT FROM OLD.observacao THEN
    IF NOT is_tarefa_editor(NEW.tarefa_id)
       AND NOT can('checklist.editar_qualquer_tarefa') THEN
      RAISE EXCEPTION 'Sem permissão para editar itens do checklist.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Marcar como concluído: qualquer autenticado; força autor e timestamp
  IF NEW.concluido AND NOT OLD.concluido THEN
    NEW.concluido_por_id := current_user_id();
    NEW.concluido_em := NOW();
  END IF;

  -- Desmarcar: só quem marcou (ou admin)
  IF NOT NEW.concluido AND OLD.concluido THEN
    IF OLD.concluido_por_id IS DISTINCT FROM current_user_id() AND NOT is_admin() THEN
      RAISE EXCEPTION 'Apenas quem marcou o item pode desmarcá-lo.'
        USING ERRCODE = '42501';
    END IF;
    NEW.concluido_por_id := NULL;
    NEW.concluido_em := NULL;
  END IF;

  RETURN NEW;
END;
$$;
