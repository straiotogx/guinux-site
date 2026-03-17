export async function onRequestPost(context) {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const { to, name, company, subject, htmlContent, type } = await context.request.json();

        if (!to || !htmlContent) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: cors });
        }

        // Send via MailChannels (free with Cloudflare Workers)
        const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                personalizations: [{
                    to: [{ email: to, name: name || '' }],
                    bcc: [{ email: 'contato@guinux.com.br', name: 'Guinux TI' }]
                }],
                from: {
                    email: 'ia@guinux.com.br',
                    name: 'Guinux.IA'
                },
                subject: subject || `${type === 'diagnostico' ? 'Diagnóstico Digital' : 'Cotação Personalizada'} — ${company} | Guinux`,
                content: [{
                    type: 'text/html',
                    value: htmlContent
                }]
            })
        });

        if (emailResponse.status === 202 || emailResponse.status === 200) {
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: cors });
        } else {
            const errText = await emailResponse.text();
            console.error('MailChannels error:', errText);
            return new Response(JSON.stringify({ error: 'Email send failed', details: errText }), { status: 500, headers: cors });
        }
    } catch (err) {
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
