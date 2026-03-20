export async function onRequestGet(context) {
    try {
        const KV = context.env.PDF_STORE;
        if (!KV) {
            return new Response('PDF_STORE KV not configured', { status: 503 });
        }

        const { id } = context.params;
        const raw = await KV.get(id, 'text');
        if (!raw) {
            return new Response('PDF not found or expired', { status: 404 });
        }

        const record = JSON.parse(raw);
        const binary = atob(record.pdfBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const safeFilename = encodeURIComponent(record.filename || 'Guinux_Proposta.pdf');
        return new Response(bytes, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${safeFilename}"`,
                'Cache-Control': 'public, max-age=2592000',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err) {
        console.error('pdf serve error:', err.message);
        return new Response('Error serving PDF', { status: 500 });
    }
}
