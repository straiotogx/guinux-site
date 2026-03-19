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

        // MailChannels (SPF/DKIM already configured)
        const isNotification = type === 'notification';
        const personalization = {
            to: [{ email: to, name: name || '' }]
        };
        // Only BCC on non-notification emails (notifications already go to contato@)
        if (!isNotification) {
            personalization.bcc = [{ email: 'contato@guinux.com.br', name: 'Guinux TI' }];
        }
        const payload = {
            personalizations: [personalization],
            from: {
                email: 'ia@guinux.com.br',
                name: 'Guinux.IA'
            },
            subject: subject || `Análise & Proposta — ${company} | Guinux.IA`,
            content: [{
                type: 'text/html',
                value: htmlContent
            }]
        };

        console.log('Sending email to:', to, 'subject:', subject);

        const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseText = await emailResponse.text();
        console.log('MailChannels status:', emailResponse.status, 'response:', responseText);

        if (emailResponse.status === 202 || emailResponse.status === 200) {
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: cors });
        } else {
            return new Response(JSON.stringify({
                error: 'Email send failed',
                status: emailResponse.status,
                details: responseText
            }), { status: 500, headers: cors });
        }
    } catch (err) {
        console.error('Send report error:', err.message, err.stack);
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
