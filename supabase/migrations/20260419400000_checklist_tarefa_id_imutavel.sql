-- Torna tarefa_checklist.tarefa_id imutável: impede mover item entre tarefas.
-- Adiciona a verificação ao trigger existente (enforce_checklist_update).

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

  -- Edição de texto/ordem requer editor da tarefa
  IF NEW.texto IS DISTINCT FROM OLD.texto OR NEW.ordem IS DISTINCT FROM OLD.ordem THEN
    IF NOT is_tarefa_editor(NEW.tarefa_id) THEN
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
