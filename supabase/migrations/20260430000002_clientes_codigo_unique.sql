-- Garante unicidade do codigo_cliente.
-- NULLs são permitidos em múltiplos registros (comportamento padrão do PostgreSQL).

-- Remove duplicatas: mantém o registro mais antigo e anula os demais.
WITH dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY codigo_cliente ORDER BY created_at) AS rn
  FROM public.clientes
  WHERE codigo_cliente IS NOT NULL
)
UPDATE public.clientes c
SET codigo_cliente = NULL
FROM dupes d
WHERE c.id = d.id AND d.rn > 1;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_codigo_cliente_key UNIQUE (codigo_cliente);
