-- Exclusão de mensagens (soft delete) e de conversas (hard delete)
-- + capacidades granulares no catálogo de permissões

-- ============================================================
-- 1. Coluna excluida em scrap_mensagens (soft delete)
-- ============================================================
ALTER TABLE public.scrap_mensagens
  ADD COLUMN excluida BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 2. Policy de UPDATE: soft delete de própria mensagem
--    (já existe scrap_mensagens_update com is_scrap_participante.
--     Vamos substituir para exigir can() + ser remetente quando o update
--     mexer em excluida)
-- ============================================================
-- A policy atual (scrap_mensagens_update) permite UPDATE para qualquer
-- participante. Isso está OK — mas precisamos garantir que excluida=TRUE
-- só seja setado pelo remetente com a capacidade.
-- Como policies do Postgres não conseguem diferenciar colunas, vamos
-- usar um trigger de validação.

CREATE OR REPLACE FUNCTION public.validar_update_scrap_mensagem()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se excluida mudou de FALSE para TRUE, precisa ser remetente + ter capacidade
  IF OLD.excluida = FALSE AND NEW.excluida = TRUE THEN
    IF NEW.remetente_id <> current_user_id() THEN
      RAISE EXCEPTION 'Você só pode excluir suas próprias mensagens.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NOT can('scrap.excluir_mensagem') THEN
      RAISE EXCEPTION 'Sem permissão para excluir mensagens.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- Limpa o corpo ao excluir para não deixar conteúdo residual
    NEW.corpo = '';
  END IF;

  -- Não permite reverter (excluida TRUE → FALSE)
  IF OLD.excluida = TRUE AND NEW.excluida = FALSE THEN
    RAISE EXCEPTION 'Não é possível restaurar mensagem excluída.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER scrap_mensagem_validate_update
BEFORE UPDATE ON public.scrap_mensagens
FOR EACH ROW EXECUTE FUNCTION public.validar_update_scrap_mensagem();

-- ============================================================
-- 3. Anexos associados à mensagem excluída devem ser removidos
--    (cascade já cobre DELETE, mas aqui é UPDATE. Trigger apaga anexos)
-- ============================================================
CREATE OR REPLACE FUNCTION public.scrap_remover_anexos_ao_excluir()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.excluida = FALSE AND NEW.excluida = TRUE THEN
    DELETE FROM public.scrap_anexos WHERE mensagem_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER scrap_mensagem_apaga_anexos
AFTER UPDATE ON public.scrap_mensagens
FOR EACH ROW EXECUTE FUNCTION public.scrap_remover_anexos_ao_excluir();

-- ============================================================
-- 4. Policy DELETE em scrap_conversas (hard delete)
--    Qualquer participante da conversa pode excluí-la.
-- ============================================================
CREATE POLICY "scrap_conversas_delete" ON public.scrap_conversas
  FOR DELETE USING (
    current_user_id() IN (usuario_a_id, usuario_b_id)
    AND can('scrap.excluir_conversa')
  );

-- ============================================================
-- 5. Seed: adiciona novas capacidades a todos os perfis existentes
--    (para manter o comportamento atual — todo mundo pode usar Talk)
-- ============================================================
UPDATE public.permissoes
SET capacidades = ARRAY(
  SELECT DISTINCT unnest(capacidades || ARRAY['scrap.excluir_mensagem', 'scrap.excluir_conversa'])
)
WHERE ativo = TRUE;
