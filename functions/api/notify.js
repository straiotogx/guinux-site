export async function onRequestPost(context) {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const data = await context.request.json();
        const { name, email, phone, company, employees, revenue, risk, maturity, potential, hoursSaved, services, pain, segment } = data;

        // 1. Google Chat Webhook (instant notification)
        const GCHAT_WEBHOOK = context.env.GCHAT_WEBHOOK || '';
        if (GCHAT_WEBHOOK) {
            const waLink = `https://wa.me/554140639294?text=${encodeURIComponent('Simulação recebida de ' + (name||'?') + ' - ' + (company||'?'))}`;
            const message = {
                text: `🔔 *Nova Simulação — Guinux.IA*\n\n` +
                      `👤 *Contato:* ${name || '?'} — ${email || 'N/A'}\n` +
                      `📱 *Telefone:* ${phone || 'N/A'}\n` +
                      `🏢 *Empresa:* ${company || '?'}\n` +
                      `📊 *Segmento:* ${segment || '?'}\n` +
                      `👥 *Colaboradores:* ~${employees || '?'}\n` +
                      `💰 *Faturamento:* ${revenue || '?'}\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━\n` +
                      `📈 *Scores da Análise:*\n` +
                      `   ⚠️ Risco: ${risk || '?'}\n` +
                      `   🧠 Maturidade: ${maturity || '?'}\n` +
                      `   🚀 Potencial: ${potential || '?'}\n` +
                      `   ⏱️ Horas automatizáveis: ${hoursSaved || 0}+/mês\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━\n` +
                      `🛠️ *Serviços Sugeridos:*\n${services || 'Nenhum'}\n` +
                      (pain ? `\n😣 *Maior dor:* ${pain}\n` : '') +
                      `\n📞 WhatsApp: ${waLink}`
            };

            try {
                const payload = JSON.stringify(message);
                console.log('Sending to Google Chat webhook, URL length:', GCHAT_WEBHOOK.length, 'payload:', payload.substring(0, 200));
                const gchatRes = await fetch(GCHAT_WEBHOOK, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
                    body: payload
                });
                const gchatBody = await gchatRes.text();
                console.log('Google Chat webhook response:', gchatRes.status, gchatRes.statusText, 'body:', gchatBody);
                if (!gchatRes.ok) {
                    console.error('Google Chat webhook FAILED:', gchatRes.status, gchatBody);
                }
            } catch (e) {
                console.error('Google Chat webhook error:', e.message, e.stack);
            }
        }

        // 2. Email notification (backup)
        try {
            const emailHtml = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                <div style="background:#1A7A7A;color:#fff;padding:16px 24px;border-radius:12px 12px 0 0">
                    <h2 style="margin:0;font-size:18px">🔔 Nova Simulação — Guinux.IA</h2>
                </div>
                <div style="background:#fff;padding:24px;border:1px solid #eee;border-radius:0 0 12px 12px">
                    <p style="margin:0 0 16px;font-size:15px"><strong>${name||'?'}</strong> da <strong>${company||'?'}</strong></p>
                    <table style="width:100%;border-collapse:collapse;font-size:14px">
                        <tr><td style="padding:6px 0;color:#666;width:40%">E-mail:</td><td style="padding:6px 0"><strong>${email||'N/A'}</strong></td></tr>
                        <tr><td style="padding:6px 0;color:#666">Telefone:</td><td style="padding:6px 0"><strong>${phone||'N/A'}</strong></td></tr>
                        <tr><td style="padding:6px 0;color:#666">Colaboradores:</td><td style="padding:6px 0">~${employees||'?'}</td></tr>
                        <tr><td style="padding:6px 0;color:#666">Faturamento:</td><td style="padding:6px 0">${revenue||'?'}</td></tr>
                        <tr><td style="padding:6px 0;color:#666">Risco:</td><td style="padding:6px 0;font-weight:700">${risk||'?'}</td></tr>
                        <tr><td style="padding:6px 0;color:#666">Maturidade:</td><td style="padding:6px 0">${maturity||'?'}</td></tr>
                        <tr><td style="padding:6px 0;color:#666">Potencial:</td><td style="padding:6px 0">${potential||'?'}</td></tr>
                        <tr><td style="padding:6px 0;color:#666">Horas automatizáveis:</td><td style="padding:6px 0">${hoursSaved||0}+/mês</td></tr>
                        <tr><td style="padding:6px 0;color:#666">Serviços:</td><td style="padding:6px 0">${services||'?'}</td></tr>
                        ${pain ? `<tr><td style="padding:6px 0;color:#666">Maior dor:</td><td style="padding:6px 0"><em>${pain}</em></td></tr>` : ''}
                    </table>
                    <p style="margin:16px 0 0;font-size:12px;color:#999">${new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>`;

            const emailPayload = {
                personalizations: [{ to: [{ email: 'hq@guinux.com.br', name: 'Guinux HQ' }] }],
                from: { email: 'ia@guinux.com.br', name: 'Guinux.IA' },
                subject: `🔔 Simulação: ${name||'?'} — ${company||'?'} (~${employees||'?'} colab.)`,
                content: [{ type: 'text/html', value: emailHtml }]
            };

            const emailRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailPayload)
            });
            console.log('Notification email status:', emailRes.status);
        } catch (e) {
            console.error('Notification email error:', e.message);
        }

        return new Response(JSON.stringify({ success: true }), { headers: cors });
    } catch (err) {
        console.error('Notify error:', err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}
