// Edge Function: notify-assignment
// Envia email ao usuário quando uma tarefa é atribuída a ele.
// Deploy: `npx supabase functions deploy notify-assignment --no-verify-jwt`

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type Payload = {
  tarefa_id: string
  responsavel_id: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function emailHtml(nomeUsuario: string, tituloTarefa: string, tarefaUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background-color:#1e1e1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e1e1e;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <tr>
          <td align="center" style="padding-bottom:28px;">
            <span style="font-size:20px;font-weight:700;color:#e8e8e8;">GR7 Automação</span>
            <span style="font-size:13px;color:#9a9a9a;padding-left:8px;">Implantação Clientes</span>
          </td>
        </tr>

        <tr>
          <td style="background-color:#3a3a3a;border:1px solid #515151;border-radius:12px;padding:36px 32px;">
            <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:#e8e8e8;text-align:center;">
              Nova tarefa atribuída
            </h1>
            <p style="margin:0 0 24px 0;font-size:14px;color:#b0b0b0;text-align:center;line-height:1.6;">
              Olá, <strong style="color:#e8e8e8;">${nomeUsuario}</strong>.<br />
              A seguinte tarefa foi atribuída a você:
            </p>

            <div style="background-color:#2d2d2d;border:1px solid #515151;border-radius:8px;padding:14px 18px;margin-bottom:28px;">
              <p style="margin:0;font-size:15px;font-weight:600;color:#e8e8e8;">${tituloTarefa}</p>
            </div>

            <div style="border-top:1px solid #515151;margin:0 0 28px 0;"></div>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="${tarefaUrl}"
                     style="display:inline-block;background-color:#0078d4;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 28px;border-radius:8px;">
                    Ver tarefa
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:12px;color:#666666;text-align:center;line-height:1.6;">
              Se o botão não funcionar, acesse o painel diretamente:<br />
              <a href="${tarefaUrl}" style="color:#569cd6;word-break:break-all;font-size:11px;">${tarefaUrl}</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding-top:20px;">
            <p style="margin:0;font-size:12px;color:#666666;text-align:center;line-height:1.6;">
              Você recebeu esta notificação porque uma tarefa foi atribuída a você no painel GR7 Automação.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não suportado.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')!
  const appUrl = Deno.env.get('APP_URL') ?? 'https://painel-implantacao-gr7.vercel.app'

  const admin = createClient(supabaseUrl, serviceKey)

  // Valida JWT do chamador — apenas usuários autenticados podem disparar
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) return json({ error: 'Não autorizado.' }, 401)
  const { error: authErr } = await admin.auth.getUser(jwt)
  if (authErr) return json({ error: 'Não autorizado.' }, 401)

  const body = await req.json() as Payload
  if (!body.tarefa_id || !body.responsavel_id) {
    return json({ error: 'tarefa_id e responsavel_id são obrigatórios.' }, 400)
  }

  // Busca dados da tarefa e do responsável
  const [{ data: tarefa }, { data: usuario }] = await Promise.all([
    admin.from('tarefas').select('id, titulo').eq('id', body.tarefa_id).single(),
    admin.from('usuarios').select('id, nome, email').eq('id', body.responsavel_id).single(),
  ])

  if (!tarefa || !usuario) return json({ error: 'Tarefa ou usuário não encontrado.' }, 404)

  const tarefaUrl = `${appUrl}/tarefas`

  // Envia email via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'GR7 Automação <suporte@gr7autocom.com.br>',
      to: [usuario.email],
      subject: `Nova tarefa atribuída: ${tarefa.titulo}`,
      html: emailHtml(usuario.nome, tarefa.titulo, tarefaUrl),
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.text()
    console.error('Resend error:', err)
    return json({ error: 'Falha ao enviar email.' }, 500)
  }

  // Marca email_enviado na notificação correspondente
  await admin
    .from('notificacoes')
    .update({ email_enviado: true })
    .eq('tarefa_id', body.tarefa_id)
    .eq('usuario_id', body.responsavel_id)
    .eq('tipo', 'tarefa_atribuida')
    .eq('email_enviado', false)

  return json({ ok: true })
})
