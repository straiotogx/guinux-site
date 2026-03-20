// Freshchat Outbound WhatsApp API
// Env vars required:
//   FRESHCHAT_TOKEN        — API token from Freshchat Settings > API Tokens
//   FRESHCHAT_WA_TEMPLATE  — approved WhatsApp template name (default: "proposal_link")
//   FRESHCHAT_WA_LANG      — language code (default: "pt_BR")
//
// Template expected params (body): {{1}} = name, {{2}} = company, {{3}} = pdf_url

export async function onRequestPost(context) {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const token = context.env.FRESHCHAT_TOKEN;
        if (!token) {
            return new Response(JSON.stringify({ skipped: true, reason: 'FRESHCHAT_TOKEN not configured' }), { headers: cors });
        }

        const { phone, name, company, pdfUrl } = await context.request.json();
        if (!phone || !pdfUrl) {
            return new Response(JSON.stringify({ error: 'Missing phone or pdfUrl' }), { status: 400, headers: cors });
        }

        // Normalize phone to E.164 format (+55...)
        const digits = phone.replace(/\D/g, '');
        let e164;
        if (digits.startsWith('55') && digits.length >= 12) {
            e164 = '+' + digits;
        } else if (digits.length >= 10) {
            e164 = '+55' + digits;
        } else {
            return new Response(JSON.stringify({ error: 'Invalid phone number' }), { status: 400, headers: cors });
        }

        const templateName = context.env.FRESHCHAT_WA_TEMPLATE || 'proposal_link';
        const langCode = context.env.FRESHCHAT_WA_LANG || 'pt_BR';

        const payload = {
            from: { alias: 'Guinux TI' },
            to: { phone_numbers: [e164] },
            messages: [{
                template: {
                    name: templateName,
                    language: { code: langCode },
                    components: [{
                        type: 'body',
                        parameters: [
                            { type: 'text', text: name || 'Cliente' },
                            { type: 'text', text: company || 'sua empresa' },
                            { type: 'text', text: pdfUrl }
                        ]
                    }]
                }
            }]
        };

        const res = await fetch('https://api.freshchat.com/v2/outbound-messages/whatsapp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const body = await res.text();
        console.log('Freshchat WA status:', res.status, body);

        if (res.status === 200 || res.status === 201 || res.status === 202) {
            return new Response(JSON.stringify({ success: true }), { headers: cors });
        } else {
            return new Response(JSON.stringify({ error: 'Freshchat API error', status: res.status, details: body }), { status: 500, headers: cors });
        }
    } catch (err) {
        console.error('whatsapp error:', err.message);
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
