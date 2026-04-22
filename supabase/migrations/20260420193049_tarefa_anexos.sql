-- Tabela de anexos de tarefas (armazenados no Cloudinary)
CREATE TABLE tarefa_anexos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id       UUID        NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
  nome_arquivo    TEXT        NOT NULL,
  public_id       TEXT        NOT NULL,
  url             TEXT        NOT NULL,
  tipo_mime       TEXT,
  tamanho_bytes   BIGINT,
  criado_por_id   UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tarefa_anexos_tarefa ON tarefa_anexos(tarefa_id);

ALTER TABLE tarefa_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tarefa_anexos_select" ON tarefa_anexos
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tarefa_anexos_insert" ON tarefa_anexos
  FOR INSERT TO authenticated
  WITH CHECK (is_tarefa_editor(tarefa_id) OR can('tarefa.criar'));

CREATE POLICY "tarefa_anexos_delete" ON tarefa_anexos
  FOR DELETE TO authenticated
  USING (criado_por_id = current_user_id() OR can('tarefa.excluir'));
