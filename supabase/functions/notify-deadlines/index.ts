// Edge Function: notify-deadlines
// Roda diariamente (cron) para criar notificações de prazo vencendo amanhã + enviar emails.
// Deploy: `npx supabase functions deploy notify-deadlines --no-verify-jwt`
// Agendar no Supabase Dashboard: Functions → notify-deadlines → Schedule → "0 8 * * *"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function emailHtml(nomeUsuario: string, tituloTarefa: string, prazo: string, tarefaUrl: string): string {
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
            <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:#dcdcaa;text-align:center;">
              ⏰ Prazo vencendo amanhã
            </h1>
            <p style="margin:0 0 24px 0;font-size:14px;color:#b0b0b0;text-align:center;line-height:1.6;">
              Olá, <strong style="color:#e8e8e8;">${nomeUsuario}</strong>.<br />
              A seguinte tarefa vence <strong style="color:#dcdcaa;">amanhã (${prazo})</strong>:
            </p>

            <div style="background-color:#2d2d2d;border:1px solid #515151;border-left:3px solid #dcdcaa;border-radius:8px;padding:14px 18px;margin-bottom:28px;">
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
              Você recebeu esta notificação porque é responsável por esta tarefa no painel GR7 Automação.
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')!
  const appUrl = Deno.env.get('APP_URL') ?? 'https://painel-implantacao-gr7.vercel.app'

  const admin = createClient(supabaseUrl, serviceKey)

  // Cria notificações no banco para tarefas que vencem amanhã
  const { data: qtd } = await admin.rpc('criar_notificacoes_prazo_vencendo')
  console.log(`Notificações de prazo criadas: ${qtd}`)

  // Busca notificações de prazo_vencendo com email pendente
  const { data: pendentes } = await admin
    .from('notificacoes')
    .select(`
      id,
      tarefa_id,
      mensagem,
      usuario:usuarios!notificacoes_usuario_id_fkey(id, nome, email),
      tarefa:tarefas!notificacoes_tarefa_id_fkey(id, titulo, prazo_entrega)
    `)
    .eq('tipo', 'prazo_vencendo')
    .eq('email_enviado', false)

  if (!pendentes?.length) return json({ ok: true, enviados: 0 })

  let enviados = 0
  const amanha = new Date()
  amanha.setDate(amanha.getDate() + 1)
  const prazoFormatado = amanha.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  for (const n of pendentes) {
    const usuario = n.usuario as { id: string; nome: string; email: string } | null
    const tarefa = n.tarefa as { id: string; titulo: string } | null
    if (!usuario?.email || !tarefa?.titulo) continue

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GR7 Automação <suporte@gr7autocom.com.br>',
        to: [usuario.email],
        subject: `⏰ Prazo vencendo amanhã: ${tarefa.titulo}`,
        html: emailHtml(usuario.nome, tarefa.titulo, prazoFormatado, `${appUrl}/tarefas`),
      }),
    })

    if (emailRes.ok) {
      await admin.from('notificacoes').update({ email_enviado: true }).eq('id', n.id)
      enviados++
    } else {
      console.error(`Falha ao enviar email para ${usuario.email}:`, await emailRes.text())
    }
  }

  return json({ ok: true, enviados })
})
