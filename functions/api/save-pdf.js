export async function onRequestPost(context) {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const KV = context.env.PDF_STORE;
        if (!KV) {
            return new Response(JSON.stringify({ error: 'PDF_STORE KV not configured' }), { status: 503, headers: cors });
        }

        const { pdfBase64, filename, company, email, name } = await context.request.json();
        if (!pdfBase64 || !filename) {
            return new Response(JSON.stringify({ error: 'Missing pdfBase64 or filename' }), { status: 400, headers: cors });
        }

        const id = crypto.randomUUID();
        const record = JSON.stringify({ pdfBase64, filename, company: company || '', email: email || '', name: name || '', createdAt: new Date().toISOString() });

        // Store for 30 days
        await KV.put(id, record, { expirationTtl: 60 * 60 * 24 * 30 });

        const origin = new URL(context.request.url).origin;
        const url = `${origin}/api/pdf/${id}`;

        return new Response(JSON.stringify({ success: true, url, id }), { headers: cors });
    } catch (err) {
        console.error('save-pdf error:', err.message);
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
