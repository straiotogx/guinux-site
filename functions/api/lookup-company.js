export async function onRequestPost(context) {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const { domain } = await context.request.json();
        if (!domain) return new Response(JSON.stringify({ error: 'No domain' }), { status: 400, headers: cors });

        // Fetch MULTIPLE pages for better analysis
        let allTexts = [];
        let title = '', description = '', mainBodyText = '', mainHtml = '';

        const fetchPage = async (url, timeout = 8000) => {
            try {
                const res = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                    redirect: 'follow',
                    cf: { cacheTtl: 3600 },
                    signal: AbortSignal.timeout(timeout)
                });
                if (!res.ok) return null;
                return await res.text();
            } catch (e) { return null; }
        };

        // Fetch main page first
        mainHtml = await fetchPage(`https://${domain}`);
        if (!mainHtml) mainHtml = await fetchPage(`https://www.${domain}`);

        if (mainHtml) {
            // Extract title
            const titleMatch = mainHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) title = titleMatch[1].trim();

            // Extract meta description
            const descMatch = mainHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
                || mainHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
            if (descMatch) description = descMatch[1].trim();

            if (!description) {
                const ogMatch = mainHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
                if (ogMatch) description = ogMatch[1].trim();
            }

            // Extract ALL visible text (up to 12000 chars for deeper analysis)
            mainBodyText = mainHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 12000);
            allTexts.push(mainBodyText);
        }

        // Fetch about/institutional pages AND additional pages in parallel
        const pagesToFetch = [
            `https://${domain}/sobre`,
            `https://${domain}/about`,
            `https://${domain}/quem-somos`,
            `https://${domain}/a-empresa`,
            `https://${domain}/institucional`,
            `https://${domain}/servicos`,
            `https://${domain}/services`,
            `https://${domain}/produtos`,
            `https://${domain}/contato`,
            `https://${domain}/contact`,
            `https://${domain}/trabalhe-conosco`,
            `https://${domain}/carreiras`,
            `https://${domain}/clientes`,
        ];
        const pageResults = await Promise.allSettled(pagesToFetch.map(u => fetchPage(u, 6000)));
        for (const r of pageResults) {
            if (r.status === 'fulfilled' && r.value) {
                const pageText = r.value
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/&nbsp;/gi, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 6000);
                if (pageText.length > 100) allTexts.push(pageText);
            }
        }

        const allText = (title + ' ' + description + ' ' + allTexts.join(' ')).toLowerCase();

        // ========= EXTRACT JSON-LD STRUCTURED DATA =========
        let jsonLdData = {};
        if (mainHtml) {
            const jsonLdMatches = mainHtml.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
            for (const match of jsonLdMatches) {
                try {
                    const jsonContent = match.replace(/<script[^>]*>/, '').replace(/<\/script>/i, '').trim();
                    const parsed = JSON.parse(jsonContent);
                    const items = Array.isArray(parsed) ? parsed : [parsed];
                    for (const item of items) {
                        if (item['@type'] === 'Organization' || item['@type'] === 'LocalBusiness' || item['@type'] === 'Corporation') {
                            jsonLdData = { ...jsonLdData, ...item };
                        }
                        if (item['@graph']) {
                            for (const g of item['@graph']) {
                                if (g['@type'] === 'Organization' || g['@type'] === 'LocalBusiness') {
                                    jsonLdData = { ...jsonLdData, ...g };
                                }
                            }
                        }
                    }
                } catch (e) { /* invalid JSON-LD */ }
            }
        }

        // ========= EXTRACT CNPJ FROM WEBSITE =========
        let extractedCnpj = null;
        let cnpjData = null;

        // Try multiple CNPJ patterns
        const cnpjPatterns = [
            /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g,
            /cnpj[:\s]*(\d{2}\.?\d{3}\.?\d{3}\/?\.?\d{4}-?\d{2})/gi,
            /\b(\d{14})\b/g, // raw 14-digit (less reliable, only match near "cnpj" context)
        ];

        // Search in the raw HTML (not just text) for CNPJ in footer etc
        const htmlToSearch = mainHtml ? mainHtml.substring(Math.max(0, mainHtml.length - 15000)) : '';
        const textToSearch = allText;

        for (const pat of cnpjPatterns) {
            pat.lastIndex = 0;
            const sources = pat.source.includes('cnpj') ? [textToSearch] : [htmlToSearch, textToSearch];
            for (const src of sources) {
                pat.lastIndex = 0;
                let m;
                while ((m = pat.exec(src)) !== null) {
                    const raw = m[1].replace(/[.\-\/]/g, '');
                    if (raw.length === 14 && raw !== '00000000000000') {
                        // Basic CNPJ validation (check digit)
                        if (validateCnpj(raw)) {
                            extractedCnpj = raw;
                            break;
                        }
                    }
                }
                if (extractedCnpj) break;
            }
            if (extractedCnpj) break;
        }

        // ========= QUERY CNPJ APIs FOR DEEP COMPANY DATA =========
        if (extractedCnpj) {
            // Try multiple free CNPJ APIs in parallel
            const cnpjApis = [
                { url: `https://brasilapi.com.br/api/cnpj/v1/${extractedCnpj}`, parser: parseBrasilApi },
                { url: `https://publica.cnpj.ws/cnpj/${extractedCnpj}`, parser: parseCnpjWs },
            ];

            const cnpjResults = await Promise.allSettled(
                cnpjApis.map(async api => {
                    try {
                        const res = await fetch(api.url, {
                            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
                            signal: AbortSignal.timeout(8000)
                        });
                        if (!res.ok) return null;
                        const data = await res.json();
                        return api.parser(data);
                    } catch (e) { return null; }
                })
            );

            for (const r of cnpjResults) {
                if (r.status === 'fulfilled' && r.value) {
                    cnpjData = r.value;
                    break;
                }
            }
        }

        // ========= EXTRACT SOCIAL MEDIA LINKS =========
        const socialMedia = {};
        if (mainHtml) {
            const socialPatterns = [
                { name: 'linkedin', pattern: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"'\s]+)["']/gi },
                { name: 'instagram', pattern: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s]+)["']/gi },
                { name: 'facebook', pattern: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)["']/gi },
                { name: 'youtube', pattern: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|@)[^"'\s]+)["']/gi },
                { name: 'twitter', pattern: /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"'\s]+)["']/gi },
                { name: 'github', pattern: /href=["'](https?:\/\/(?:www\.)?github\.com\/[^"'\s]+)["']/gi },
                { name: 'tiktok', pattern: /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/@[^"'\s]+)["']/gi },
            ];
            for (const sp of socialPatterns) {
                sp.pattern.lastIndex = 0;
                const m = sp.pattern.exec(mainHtml);
                if (m) socialMedia[sp.name] = m[1].replace(/["']/g, '');
            }
        }

        // ========= DETECT TECH FROM HTTP HEADERS =========
        const headerTech = [];
        if (mainHtml) {
            // Check for common platforms via HTML signatures
            if (mainHtml.includes('wp-content') || mainHtml.includes('wordpress')) headerTech.push({ name: 'WordPress', category: 'CMS' });
            if (mainHtml.includes('Shopify')) headerTech.push({ name: 'Shopify', category: 'E-commerce' });
            if (mainHtml.includes('vtex') || mainHtml.includes('VTEX')) headerTech.push({ name: 'VTEX', category: 'E-commerce' });
            if (mainHtml.includes('wix.com')) headerTech.push({ name: 'Wix', category: 'CMS' });
            if (mainHtml.includes('squarespace')) headerTech.push({ name: 'Squarespace', category: 'CMS' });
            if (mainHtml.includes('react') || mainHtml.includes('__NEXT')) headerTech.push({ name: 'React/Next.js', category: 'Framework' });
            if (mainHtml.includes('angular')) headerTech.push({ name: 'Angular', category: 'Framework' });
            if (mainHtml.includes('vue') || mainHtml.includes('nuxt')) headerTech.push({ name: 'Vue/Nuxt', category: 'Framework' });
            if (mainHtml.includes('gtag') || mainHtml.includes('google-analytics') || mainHtml.includes('googletagmanager')) headerTech.push({ name: 'Google Analytics', category: 'Analytics' });
            if (mainHtml.includes('fbq(') || mainHtml.includes('facebook.com/tr')) headerTech.push({ name: 'Meta Pixel', category: 'Analytics' });
            if (mainHtml.includes('hotjar')) headerTech.push({ name: 'Hotjar', category: 'Analytics' });
            if (mainHtml.includes('rdstation') || mainHtml.includes('rd-station')) headerTech.push({ name: 'RD Station', category: 'Marketing' });
            if (mainHtml.includes('hubspot')) headerTech.push({ name: 'HubSpot', category: 'CRM/Marketing' });
            if (mainHtml.includes('intercom')) headerTech.push({ name: 'Intercom', category: 'Atendimento' });
            if (mainHtml.includes('zendesk')) headerTech.push({ name: 'Zendesk', category: 'Atendimento' });
            if (mainHtml.includes('freshdesk') || mainHtml.includes('freshchat')) headerTech.push({ name: 'Freshworks', category: 'Atendimento' });
            if (mainHtml.includes('drift')) headerTech.push({ name: 'Drift', category: 'Chat' });
            if (mainHtml.includes('tawk.to') || mainHtml.includes('tawk')) headerTech.push({ name: 'Tawk.to', category: 'Chat' });
            if (mainHtml.includes('jivochat') || mainHtml.includes('jivosite')) headerTech.push({ name: 'JivoChat', category: 'Chat' });
            if (mainHtml.includes('recaptcha') || mainHtml.includes('hcaptcha')) headerTech.push({ name: 'CAPTCHA', category: 'Segurança' });
            if (mainHtml.includes('cloudflare')) headerTech.push({ name: 'Cloudflare', category: 'CDN/Segurança' });
            if (mainHtml.includes('bootstrap')) headerTech.push({ name: 'Bootstrap', category: 'CSS Framework' });
            if (mainHtml.includes('tailwind')) headerTech.push({ name: 'Tailwind CSS', category: 'CSS Framework' });
            if (mainHtml.includes('jquery')) headerTech.push({ name: 'jQuery', category: 'JS Library' });
            if (mainHtml.includes('stripe')) headerTech.push({ name: 'Stripe', category: 'Pagamento' });
            if (mainHtml.includes('pagseguro') || mainHtml.includes('pag-seguro')) headerTech.push({ name: 'PagSeguro', category: 'Pagamento' });
            if (mainHtml.includes('mercadopago') || mainHtml.includes('mercado pago')) headerTech.push({ name: 'Mercado Pago', category: 'Pagamento' });
            if (mainHtml.includes('schema.org')) headerTech.push({ name: 'Schema.org', category: 'SEO' });
            if (mainHtml.includes('cookiebot') || mainHtml.includes('cookie-consent') || mainHtml.includes('lgpd')) headerTech.push({ name: 'Cookie Consent/LGPD', category: 'Compliance' });
        }

        // ========= EXTRACT REAL NUMBERS FROM TEXT =========

        // Try to find actual employee count mentioned on the site
        let extractedEmployees = null;
        const empPatterns = [
            /(?:mais de |over |acima de |cerca de |aproximadamente )?(\d[\d.,]*)\s*(?:\+\s*)?(?:colaborador|funcionário|funcionario|empregado|profission|pessoa|membro|servidor|advogado|associado)/gi,
            /(?:equipe|time|staff|team)\s+(?:de|com|with)\s+(?:mais de |over )?(\d[\d.,]*)/gi,
            /(\d[\d.,]*)\s*(?:\+\s*)?(?:colaborador|funcionário|funcionario|empregado|profission)/gi,
            /quadro\s+(?:de\s+)?(\d[\d.,]*)/gi,
            /"numberOfEmployees"[^}]*"value"\s*:\s*"?(\d[\d.,]*)/gi,
        ];

        for (const pat of empPatterns) {
            pat.lastIndex = 0;
            const m = pat.exec(allText);
            if (m) {
                const num = parseInt(m[1].replace(/[.,]/g, ''));
                if (num >= 5 && num <= 500000) {
                    extractedEmployees = num;
                    break;
                }
            }
        }

        // Use CNPJ data to refine employee/size info
        if (!extractedEmployees && cnpjData && cnpjData.porte) {
            const porteMap = {
                'ME': { size: 'micro', emp: '5-15' },
                'MICRO EMPRESA': { size: 'micro', emp: '5-15' },
                'EPP': { size: 'pequena', emp: '15-50' },
                'EMPRESA DE PEQUENO PORTE': { size: 'pequena', emp: '15-50' },
                'DEMAIS': { size: 'media', emp: '50-150' },
            };
            const porte = cnpjData.porte.toUpperCase();
            for (const [key, val] of Object.entries(porteMap)) {
                if (porte.includes(key)) {
                    // Don't override if we already have a higher estimate from heuristics
                    break;
                }
            }
        }

        // Try to find revenue/faturamento mentioned
        let extractedRevenue = null;
        const revPatterns = [
            /(?:fatura|receita|billing|revenue)[^.]*?(?:R\$\s*)?(\d[\d.,]*)\s*(?:milh|bilh|mi\b|bi\b|million|billion)/gi,
            /R\$\s*(\d[\d.,]*)\s*(?:milh|bilh|mi\b|bi\b)/gi,
            /(\d[\d.,]*)\s*(?:milh|bilh|mi\b|bi\b)[^.]*(?:fatura|receita|billing|revenue)/gi,
        ];

        for (const pat of revPatterns) {
            pat.lastIndex = 0;
            const m = pat.exec(allText);
            if (m) {
                const numStr = m[1].replace(/[.,]/g, '');
                const num = parseInt(numStr);
                const isBillion = /bilh|bi\b|billion/i.test(m[0]);
                extractedRevenue = isBillion ? num * 1000000000 : num * 1000000;
                break;
            }
        }

        // Try to find founding year for age-based estimation
        let foundingYear = null;
        const yearPatterns = [
            /(?:fundad|criada?|desde|established|founded|nasceu|surgiu|iniciou)[^.]*?(\d{4})/gi,
            /(\d{4})[^.]*(?:fundad|criada?|nasceu|surgiu)/gi,
            /desde\s+(\d{4})/gi,
        ];
        for (const pat of yearPatterns) {
            pat.lastIndex = 0;
            const m = pat.exec(allText);
            if (m) {
                const year = parseInt(m[1]);
                if (year >= 1900 && year <= 2026) {
                    foundingYear = year;
                    break;
                }
            }
        }

        // Use CNPJ opening date as fallback for founding year
        if (!foundingYear && cnpjData && cnpjData.data_abertura) {
            const parts = cnpjData.data_abertura.split(/[-\/]/);
            const year = parseInt(parts[0].length === 4 ? parts[0] : parts[2]);
            if (year >= 1900 && year <= 2026) foundingYear = year;
        }

        // Count unique office/branch mentions for size signal
        const branchSignals = (allText.match(/(?:filial|unidade|sede|escritório|escritorio|office|branch|loja|agência|agencia)/gi) || []).length;

        // ========= EXTRACT CLIENT NAMES / PARTNERS =========
        const clients = [];
        if (mainHtml) {
            // Look for client/partner sections with img alt texts
            const clientImgPattern = /(?:clientes?|parceiros?|partners?|cases?)[^]*?<img[^>]*alt=["']([^"']{3,60})["']/gi;
            let cm;
            const seenClients = new Set();
            clientImgPattern.lastIndex = 0;
            while ((cm = clientImgPattern.exec(mainHtml)) !== null && clients.length < 10) {
                const name = cm[1].trim();
                if (!seenClients.has(name.toLowerCase()) && name.length > 2 && name.length < 60) {
                    seenClients.add(name.toLowerCase());
                    clients.push(name);
                }
            }
            // Also look for text mentions "nossos clientes: X, Y, Z"
            const clientTextPat = /(?:nossos?\s+clientes?|clientes?\s+atendidos?|cases?\s+de\s+sucesso)[:\s]*([^.]{10,300})/gi;
            clientTextPat.lastIndex = 0;
            while ((cm = clientTextPat.exec(allText)) !== null && clients.length < 10) {
                const chunk = cm[1].split(/[,;•·|]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 50);
                for (const c of chunk) {
                    if (clients.length < 10 && !seenClients.has(c.toLowerCase())) {
                        seenClients.add(c.toLowerCase());
                        clients.push(c);
                    }
                }
            }
        }

        // ========= SEGMENT DETECTION (improved) =========
        let segment = 'outro', segmentLabel = '';

        // Use CNPJ activity data for better segment detection
        const cnpjActivity = cnpjData ? (cnpjData.atividade_principal || '').toLowerCase() : '';

        const segmentMap = [
            { keys: ['advog', 'jurídic', 'juridic', 'direito', 'escritório de advocacia', 'law firm', 'lawyer', 'oab', 'ordem dos advogados', 'seccional'], cnae: ['6911', '6912', '9411'], seg: 'juridico', label: 'Advocacia / Jurídico' },
            { keys: ['imobili', 'real estate', 'construção', 'construcao', 'incorpora', 'empreendimento', 'condomíni', 'condominiu'], cnae: ['4110', '4120', '4299', '6810', '6821', '6822'], seg: 'imobiliario', label: 'Imobiliário / Construção' },
            { keys: ['indústri', 'industri', 'fábrica', 'fabrica', 'manufatura', 'produção industrial', 'embalage', 'metalúrgic'], cnae: ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32'], seg: 'industria', label: 'Indústria' },
            { keys: ['hospital', 'clínica', 'clinica', 'médic', 'medic', 'farmácia', 'farmacia', 'saúde', 'saude', 'laborat'], cnae: ['8610', '8620', '8630', '8640', '8650', '4771'], seg: 'saude', label: 'Saúde' },
            { keys: ['varejo', 'loja', 'comércio', 'comercio', 'shop', 'store', 'e-commerce', 'ecommerce', 'marketplace'], cnae: ['47'], seg: 'varejo', label: 'Varejo / Comércio' },
            { keys: ['tecnologia', 'software', 'tech', 'saas', 'startup', 'plataforma digital', 'desenvolvimento de'], cnae: ['6201', '6202', '6203', '6204', '6209', '6311', '6319'], seg: 'tecnologia', label: 'Tecnologia' },
            { keys: ['educação', 'educacao', 'escola', 'universidade', 'faculdade', 'ensino', 'curso', 'colégio', 'colegio'], cnae: ['85'], seg: 'educacao', label: 'Educação' },
            { keys: ['contábil', 'contabil', 'contabilidade', 'fiscal', 'tributár', 'tributar', 'auditoria'], cnae: ['6920', '6911'], seg: 'contabil', label: 'Contabilidade' },
            { keys: ['agro', 'agrícol', 'agricol', 'fazenda', 'pecuári', 'pecuari', 'rural', 'semente'], cnae: ['01', '02', '03'], seg: 'agro', label: 'Agronegócio' },
            { keys: ['logísti', 'logisti', 'transport', 'frete', 'entrega', 'distribuição', 'distribuicao'], cnae: ['49', '50', '51', '52'], seg: 'logistica', label: 'Logística / Transporte' },
            { keys: ['financ', 'banco', 'crédito', 'credito', 'fintech', 'investiment', 'seguro', 'previdên'], cnae: ['64', '65', '66'], seg: 'financeiro', label: 'Financeiro / Seguros' },
            { keys: ['aliment', 'food', 'restaurante', 'gastronom', 'bebida', 'frigoríf'], cnae: ['10', '56'], seg: 'alimenticio', label: 'Alimentício' },
            { keys: ['consult', 'assessor', 'outsourc', 'terceiriz'], cnae: ['70', '7020', '7490'], seg: 'servicos', label: 'Serviços / Consultoria' },
        ];

        // First try CNAE-based detection (more accurate)
        if (cnpjData && cnpjData.cnae_codigo) {
            for (const s of segmentMap) {
                if (s.cnae && s.cnae.some(c => cnpjData.cnae_codigo.startsWith(c))) {
                    segment = s.seg;
                    segmentLabel = s.label;
                    break;
                }
            }
        }
        // Fallback to text-based detection
        if (segment === 'outro') {
            for (const s of segmentMap) {
                if (s.keys.some(k => allText.includes(k))) {
                    segment = s.seg;
                    segmentLabel = s.label;
                    break;
                }
            }
        }

        // ========= SMART SIZE ESTIMATION =========
        let sizeEstimate = 'media';
        let employeeEstimate = '';
        let revenueEstimate = '';
        let estimateSource = 'heurística';

        if (extractedEmployees) {
            estimateSource = 'dados do site';
            if (extractedEmployees < 15) sizeEstimate = 'micro';
            else if (extractedEmployees < 50) sizeEstimate = 'pequena';
            else if (extractedEmployees < 150) sizeEstimate = 'media';
            else if (extractedEmployees < 500) sizeEstimate = 'media_grande';
            else sizeEstimate = 'grande';

            if (extractedEmployees < 15) employeeEstimate = `~${extractedEmployees}`;
            else if (extractedEmployees < 30) employeeEstimate = '15-30';
            else if (extractedEmployees < 60) employeeEstimate = '30-60';
            else if (extractedEmployees < 100) employeeEstimate = '60-100';
            else if (extractedEmployees < 200) employeeEstimate = '100-200';
            else if (extractedEmployees < 500) employeeEstimate = '200-500';
            else if (extractedEmployees < 1000) employeeEstimate = '500-1.000';
            else employeeEstimate = `${Math.round(extractedEmployees / 1000)}K+`;
        } else {
            let sizeScore = 0;

            if (allText.match(/multinacional|global|international|worldwide/)) sizeScore += 5;
            if (allText.match(/listada|bolsa|ações|acoes|b3|bovespa|nyse|nasdaq/)) sizeScore += 5;
            if (branchSignals >= 5) sizeScore += 3;
            if (allText.match(/milhares de|thousands of/)) sizeScore += 3;

            if (allText.match(/grupo\s|holding|conglomerado/)) sizeScore += 2;
            if (allText.match(/líder|lider|referência|referencia|maior|largest|leading/)) sizeScore += 2;
            if (allText.match(/mais de \d{2,} anos|over \d{2,} years/)) sizeScore += 1;
            if (branchSignals >= 2) sizeScore += 1;
            if (allText.match(/seccional|conselho|entidade de classe|autarquia|governo|público|publica/)) sizeScore += 3;

            if (allText.match(/equipe|time|staff|team|colaborador|profission|especialista/)) sizeScore += 1;
            if (foundingYear && (2026 - foundingYear) > 20) sizeScore += 1;
            if (foundingYear && (2026 - foundingYear) > 40) sizeScore += 1;

            if (segment === 'juridico' && allText.match(/oab|ordem|seccional|conselho/)) sizeScore += 3;
            if (segment === 'industria') sizeScore += 1;
            if (segment === 'financeiro') sizeScore += 1;

            // CNPJ-based size boost
            if (cnpjData) {
                estimateSource = 'dados públicos (CNPJ + site)';
                const porte = (cnpjData.porte || '').toUpperCase();
                if (porte.includes('DEMAIS') || porte.includes('GRANDE')) sizeScore += 3;
                if (cnpjData.capital_social) {
                    const cap = parseFloat(cnpjData.capital_social);
                    if (cap >= 10000000) sizeScore += 4;
                    else if (cap >= 1000000) sizeScore += 3;
                    else if (cap >= 500000) sizeScore += 2;
                    else if (cap >= 100000) sizeScore += 1;
                }
                // Number of QSA members (partners)
                if (cnpjData.socios_count >= 5) sizeScore += 2;
                else if (cnpjData.socios_count >= 3) sizeScore += 1;
            }

            // Social media presence boost
            const socialCount = Object.keys(socialMedia).length;
            if (socialCount >= 4) sizeScore += 2;
            else if (socialCount >= 2) sizeScore += 1;

            // Clients/partners boost
            if (clients.length >= 5) sizeScore += 2;
            else if (clients.length >= 2) sizeScore += 1;

            if (sizeScore >= 6) sizeEstimate = 'grande';
            else if (sizeScore >= 4) sizeEstimate = 'media_grande';
            else if (sizeScore >= 2) sizeEstimate = 'media';
            else if (sizeScore >= 1) sizeEstimate = 'pequena';
            else sizeEstimate = 'pequena';

            const employeeRanges = {
                'micro': '5-15',
                'pequena': '15-50',
                'media': '50-150',
                'media_grande': '150-500',
                'grande': '500+'
            };
            employeeEstimate = employeeRanges[sizeEstimate];
        }

        // Revenue estimation
        if (extractedRevenue) {
            estimateSource = 'dados do site';
            if (extractedRevenue >= 1000000000) revenueEstimate = `R$ ${(extractedRevenue / 1000000000).toFixed(1)}B+/ano`;
            else if (extractedRevenue >= 1000000) revenueEstimate = `R$ ${Math.round(extractedRevenue / 1000000)}M+/ano`;
            else revenueEstimate = `R$ ${Math.round(extractedRevenue / 1000)}K+/ano`;
        } else {
            const revMap = {
                'micro': 'R$ 500K – R$ 2M/ano',
                'pequena': 'R$ 2M – R$ 10M/ano',
                'media': 'R$ 10M – R$ 30M/ano',
                'media_grande': 'R$ 30M – R$ 100M/ano',
                'grande': 'R$ 100M+/ano'
            };
            if (segment === 'financeiro' || segment === 'juridico') {
                const revMapHigh = {
                    'micro': 'R$ 1M – R$ 5M/ano',
                    'pequena': 'R$ 5M – R$ 20M/ano',
                    'media': 'R$ 20M – R$ 60M/ano',
                    'media_grande': 'R$ 60M – R$ 200M/ano',
                    'grande': 'R$ 200M+/ano'
                };
                revenueEstimate = revMapHigh[sizeEstimate] || revMap[sizeEstimate];
            } else if (segment === 'industria' || segment === 'varejo') {
                const revMapMed = {
                    'micro': 'R$ 1M – R$ 3M/ano',
                    'pequena': 'R$ 3M – R$ 15M/ano',
                    'media': 'R$ 15M – R$ 50M/ano',
                    'media_grande': 'R$ 50M – R$ 150M/ano',
                    'grande': 'R$ 150M+/ano'
                };
                revenueEstimate = revMapMed[sizeEstimate] || revMap[sizeEstimate];
            } else {
                revenueEstimate = revMap[sizeEstimate] || 'R$ 2M – R$ 10M/ano';
            }

            // Refine with CNPJ capital social
            if (cnpjData && cnpjData.capital_social) {
                const cap = parseFloat(cnpjData.capital_social);
                // Capital social is usually 10-30% of annual revenue
                const estRevFromCap = cap * 5; // conservative 5x multiplier
                if (estRevFromCap >= 1000000000) revenueEstimate = `R$ ${(estRevFromCap / 1000000000).toFixed(1)}B+ (est.)`;
                else if (estRevFromCap >= 100000000) revenueEstimate = `R$ ${Math.round(estRevFromCap / 1000000)}M+ (est.)`;
                else if (estRevFromCap >= 10000000) revenueEstimate = `R$ ${Math.round(estRevFromCap / 1000000)}M – R$ ${Math.round(estRevFromCap * 2 / 1000000)}M/ano`;
            }
        }

        // ========= EXTRACT COMPANY SERVICES/PRODUCTS =========
        const companyServices = [];
        const servicePatterns = [
            /(?:nossos?\s+serviços|nossas?\s+soluções|o\s+que\s+fazemos|áreas?\s+de\s+atuação|serviços|soluções|produtos|what\s+we\s+do|our\s+services|our\s+solutions)[:\s]*([^.]{10,300})/gi,
            /(?:serviços|soluções|atuação|oferecemos|fornecemos|realizamos|especializ)[^.]*?(?:em|de|:)\s*([^.]{10,200})/gi,
        ];

        const serviceKeywords = [
            'consultoria', 'assessoria', 'auditoria', 'desenvolvimento', 'manutenção', 'suporte',
            'treinamento', 'capacitação', 'gestão', 'planejamento', 'projeto', 'implementação',
            'integração', 'terceirização', 'outsourcing', 'atendimento', 'venda', 'distribuição',
            'fabricação', 'produção', 'montagem', 'instalação', 'reforma', 'construção',
            'locação', 'importação', 'exportação', 'transporte', 'logística', 'armazenagem',
            'contabilidade', 'advocacia', 'engenharia', 'arquitetura', 'design', 'marketing',
            'publicidade', 'comunicação', 'pesquisa', 'análise', 'monitoramento', 'segurança',
            'limpeza', 'alimentação', 'catering', 'educação', 'ensino', 'certificação',
            'licenciamento', 'franchising', 'franchis', 'e-commerce', 'marketplace',
            'recrutamento', 'seleção', 'rh', 'folha de pagamento', 'benefícios',
        ];

        for (const pat of servicePatterns) {
            pat.lastIndex = 0;
            let m;
            while ((m = pat.exec(allText)) !== null && companyServices.length < 8) {
                const chunk = m[1].trim();
                const parts = chunk.split(/[,;•·|]/).map(s => s.trim()).filter(s => s.length > 3 && s.length < 80);
                for (const p of parts) {
                    if (companyServices.length < 8 && !companyServices.some(e => e === p)) {
                        companyServices.push(p);
                    }
                }
            }
        }

        if (companyServices.length < 3) {
            for (const kw of serviceKeywords) {
                if (allText.includes(kw) && companyServices.length < 5) {
                    const idx = allText.indexOf(kw);
                    const start = Math.max(0, allText.lastIndexOf(' ', Math.max(0, idx - 30)));
                    const end = Math.min(allText.length, allText.indexOf(' ', idx + kw.length + 30) || idx + 60);
                    let phrase = allText.substring(start, end).trim();
                    if (phrase.length > 5 && phrase.length < 80 && !companyServices.some(e => e.includes(kw))) {
                        companyServices.push(phrase);
                    }
                }
            }
        }

        const uniqueServices = [...new Set(companyServices)].slice(0, 5);

        // ========= EXTRACT TECH STACK =========
        const techPatterns = [
            { pattern: /\b(sap|totvs|protheus|oracle|salesforce|hubspot|pipedrive|dynamics|netsuite|senior|sankhya|omie|bling|tiny)\b/gi, category: 'ERP/CRM' },
            { pattern: /\b(aws|amazon web services|azure|google cloud|gcp|cloud|nuvem)\b/gi, category: 'Cloud' },
            { pattern: /\b(microsoft 365|office 365|google workspace|teams|slack|zoom|whatsapp business|zendesk|freshdesk|intercom)\b/gi, category: 'Comunicação' },
            { pattern: /\b(wordpress|shopify|vtex|magento|woocommerce|power bi|tableau|looker|qlik|metabase)\b/gi, category: 'Plataforma' },
            { pattern: /\b(rpa|robotic process|automação|automation|zapier|make\.com|n8n|power automate|integromat)\b/gi, category: 'Automação' },
            { pattern: /\b(inteligência artificial|machine learning|ia\b|ai\b|chatbot|openai|gpt|deep learning|nlp)\b/gi, category: 'IA' },
            { pattern: /\b(erp|crm|scm|wms|tms|mes|bi\b|bpm|ged|ecm|lgpd)\b/gi, category: 'Sistema' },
        ];

        const techStack = [];
        const seenTech = new Set();
        for (const tp of techPatterns) {
            tp.pattern.lastIndex = 0;
            let m;
            while ((m = tp.pattern.exec(allText)) !== null) {
                const tech = m[1].toLowerCase().trim();
                if (!seenTech.has(tech) && tech.length > 1) {
                    seenTech.add(tech);
                    techStack.push({ name: m[1].trim(), category: tp.category });
                }
            }
        }

        // Merge headerTech into techStack (avoid duplicates)
        for (const ht of headerTech) {
            if (!seenTech.has(ht.name.toLowerCase())) {
                seenTech.add(ht.name.toLowerCase());
                techStack.push(ht);
            }
        }

        // ========= EXTRACT OPERATIONAL KEYWORDS =========
        const operationalKeywordList = [
            { keyword: 'atendimento ao cliente', label: 'Atendimento ao cliente' },
            { keyword: 'atendimento', label: 'Atendimento' },
            { keyword: 'suporte', label: 'Suporte' },
            { keyword: 'vendas', label: 'Vendas' },
            { keyword: 'comercial', label: 'Comercial' },
            { keyword: 'financeiro', label: 'Financeiro' },
            { keyword: 'contábil', label: 'Contábil' },
            { keyword: 'fiscal', label: 'Fiscal' },
            { keyword: 'tributári', label: 'Tributário' },
            { keyword: 'rh', label: 'Recursos Humanos' },
            { keyword: 'recursos humanos', label: 'Recursos Humanos' },
            { keyword: 'recrutamento', label: 'Recrutamento' },
            { keyword: 'folha de pagamento', label: 'Folha de pagamento' },
            { keyword: 'logística', label: 'Logística' },
            { keyword: 'logistica', label: 'Logística' },
            { keyword: 'estoque', label: 'Estoque' },
            { keyword: 'compras', label: 'Compras' },
            { keyword: 'procurement', label: 'Compras' },
            { keyword: 'supply chain', label: 'Supply Chain' },
            { keyword: 'produção', label: 'Produção' },
            { keyword: 'manufatura', label: 'Manufatura' },
            { keyword: 'qualidade', label: 'Qualidade' },
            { keyword: 'marketing', label: 'Marketing' },
            { keyword: 'comunicação', label: 'Comunicação' },
            { keyword: 'jurídic', label: 'Jurídico' },
            { keyword: 'compliance', label: 'Compliance' },
            { keyword: 'contrato', label: 'Contratos' },
            { keyword: 'documento', label: 'Documentos' },
            { keyword: 'relatório', label: 'Relatórios' },
            { keyword: 'dados', label: 'Dados/Analytics' },
            { keyword: 'faturamento', label: 'Faturamento' },
            { keyword: 'cobrança', label: 'Cobrança' },
            { keyword: 'nota fiscal', label: 'Notas Fiscais' },
            { keyword: 'agendamento', label: 'Agendamento' },
            { keyword: 'agenda', label: 'Agenda' },
            { keyword: 'projeto', label: 'Projetos' },
            { keyword: 'obra', label: 'Obras' },
            { keyword: 'manutenção', label: 'Manutenção' },
            { keyword: 'entrega', label: 'Entregas' },
            { keyword: 'expedição', label: 'Expedição' },
            { keyword: 'ti', label: 'TI' },
            { keyword: 'tecnologia da informação', label: 'TI' },
            { keyword: 'treinamento', label: 'Treinamento' },
            { keyword: 'capacitação', label: 'Capacitação' },
        ];

        const operationalKeywords = [];
        const seenOps = new Set();
        for (const op of operationalKeywordList) {
            if (allText.includes(op.keyword) && !seenOps.has(op.label)) {
                seenOps.add(op.label);
                operationalKeywords.push(op.label);
            }
        }

        // ========= DIGITAL MATURITY SIGNALS =========
        const digitalMaturitySignals = [];

        const positiveSignals = [
            { pattern: /\b(transformação digital|digital transformation)\b/i, signal: 'Menciona transformação digital', score: 2 },
            { pattern: /\b(inteligência artificial|machine learning|ia\b|ai\b)\b/i, signal: 'Referência a IA/ML', score: 3 },
            { pattern: /\b(automação|automation|rpa|robotic)\b/i, signal: 'Menciona automação', score: 2 },
            { pattern: /\b(cloud|nuvem|aws|azure|google cloud)\b/i, signal: 'Uso de cloud', score: 2 },
            { pattern: /\b(api|integração|integration|microserviço|microservice)\b/i, signal: 'Integrações/APIs', score: 2 },
            { pattern: /\b(data driven|data-driven|dados|analytics|business intelligence|bi\b)\b/i, signal: 'Cultura de dados', score: 2 },
            { pattern: /\b(devops|ci\/cd|agile|ágil|scrum|kanban)\b/i, signal: 'Metodologias ágeis', score: 2 },
            { pattern: /\b(lgpd|gdpr|proteção de dados|privacidade)\b/i, signal: 'Compliance de dados (LGPD)', score: 1 },
            { pattern: /\b(e-commerce|loja virtual|loja online|marketplace)\b/i, signal: 'Presença digital (e-commerce)', score: 1 },
            { pattern: /\b(app|aplicativo|mobile|responsivo)\b/i, signal: 'Presença mobile', score: 1 },
            { pattern: /\b(chatbot|chat online|atendimento online|whatsapp)\b/i, signal: 'Atendimento digital', score: 1 },
            { pattern: /\b(portal do cliente|área do cliente|self.?service)\b/i, signal: 'Portal self-service', score: 2 },
        ];

        const negativeSignals = [
            { pattern: /\b(fale conosco|ligue|telefone|whatsapp)\b.*\b(atendimento|contato)\b/i, signal: 'Atendimento primariamente telefônico', score: -1 },
            { pattern: /\b(formulário|preencha|cadastr)\b/i, signal: 'Processos baseados em formulários', score: -1 },
            { pattern: /\b(tradição|tradicional|há \d+ anos|desde \d{4})\b/i, signal: 'Empresa tradicional (possível gap digital)', score: -1 },
        ];

        let maturityScore = 0;
        for (const ps of positiveSignals) {
            ps.pattern.lastIndex = 0;
            if (ps.pattern.test(allText)) {
                digitalMaturitySignals.push({ signal: ps.signal, type: 'positive' });
                maturityScore += ps.score;
            }
        }
        for (const ns of negativeSignals) {
            ns.pattern.lastIndex = 0;
            if (ns.pattern.test(allText)) {
                digitalMaturitySignals.push({ signal: ns.signal, type: 'opportunity' });
                maturityScore += ns.score;
            }
        }

        // Boost maturity from detected tech
        if (headerTech.length >= 5) maturityScore += 2;
        else if (headerTech.length >= 3) maturityScore += 1;

        // ========= COMPANY VALUES / DIFFERENTIALS =========
        const companyValues = [];
        const valuePatterns = [
            { pattern: /\b(iso\s*\d{3,5})/gi, label: null },
            { pattern: /\b(certificação|certificado|certified|certification)\s+([a-záàâãéêíóôõúç\s]{3,30})/gi, label: null },
            { pattern: /\b(great place to work|gptw)\b/gi, label: 'Great Place to Work' },
            { pattern: /\b(prêmio|award|premiada?|reconheciment)\b/gi, label: 'Empresa premiada' },
            { pattern: /\b(sustentabilidade|sustentável|esg|responsabilidade social|ambiental)\b/gi, label: 'Sustentabilidade/ESG' },
            { pattern: /\b(inovação|innovation|inovadora?)\b/gi, label: 'Foco em inovação' },
            { pattern: /\b(excelência|excellence|qualidade total)\b/gi, label: 'Excelência operacional' },
            { pattern: /\b(líder de mercado|market leader|referência no|referencia no)\b/gi, label: 'Líder de mercado' },
            { pattern: /\b(selo|stamp|acreditação|acreditada)\b/gi, label: 'Acreditação/Selo' },
        ];

        const seenValues = new Set();
        for (const vp of valuePatterns) {
            vp.pattern.lastIndex = 0;
            let m;
            while ((m = vp.pattern.exec(allText)) !== null) {
                const label = vp.label || m[0].trim();
                const normalized = label.toLowerCase();
                if (!seenValues.has(normalized)) {
                    seenValues.add(normalized);
                    companyValues.push(label);
                }
            }
        }

        // ========= MAP AUTOMATION OPPORTUNITIES =========
        const automationOpportunities = [];
        const opportunityMap = [
            { triggers: ['atendimento ao cliente', 'atendimento', 'suporte', 'sac', 'call center', 'central de atendimento'], opportunity: 'Chatbot IA para atendimento 24/7', priority: 'alta' },
            { triggers: ['relatório', 'relatorio', 'report', 'dados', 'analytics', 'indicador', 'kpi', 'métrica'], opportunity: 'Dashboards inteligentes com IA', priority: 'alta' },
            { triggers: ['contrato', 'documento', 'documental', 'arquivo', 'protocolo', 'ged'], opportunity: 'Gestão documental inteligente com IA', priority: 'alta' },
            { triggers: ['vendas', 'comercial', 'prospecção', 'lead', 'pipeline', 'funil'], opportunity: 'CRM com IA para prospecção e vendas', priority: 'alta' },
            { triggers: ['nota fiscal', 'nfe', 'nf-e', 'fiscal', 'tributári', 'tributar', 'imposto'], opportunity: 'Automação fiscal e tributária', priority: 'media' },
            { triggers: ['rh', 'recursos humanos', 'recrutamento', 'seleção', 'folha de pagamento', 'admiss'], opportunity: 'IA para RH: triagem de currículos e onboarding', priority: 'media' },
            { triggers: ['marketing', 'comunicação', 'conteúdo', 'redes sociais', 'social media', 'campanha'], opportunity: 'IA para geração de conteúdo e marketing', priority: 'media' },
            { triggers: ['logística', 'logistica', 'entrega', 'transporte', 'frete', 'rota', 'expedição'], opportunity: 'Otimização logística com IA (rotas e previsão)', priority: 'alta' },
            { triggers: ['estoque', 'inventário', 'inventario', 'armazém', 'armazem', 'wms'], opportunity: 'Gestão de estoque preditiva com IA', priority: 'media' },
            { triggers: ['compras', 'procurement', 'fornecedor', 'cotação', 'cotacao', 'licitação'], opportunity: 'Automação de compras e cotações', priority: 'media' },
            { triggers: ['agendamento', 'agenda', 'horário', 'horario', 'consulta', 'reserva'], opportunity: 'Agendamento inteligente automatizado', priority: 'media' },
            { triggers: ['cobrança', 'inadimplência', 'inadimplencia', 'pagamento', 'boleto', 'financeiro'], opportunity: 'Automação de cobranças e conciliação financeira', priority: 'alta' },
            { triggers: ['qualidade', 'inspeção', 'inspecao', 'auditoria', 'conformidade'], opportunity: 'IA para controle de qualidade e compliance', priority: 'media' },
            { triggers: ['treinamento', 'capacitação', 'educação', 'ensino', 'curso'], opportunity: 'Plataforma de treinamento com IA adaptativa', priority: 'baixa' },
            { triggers: ['e-mail', 'email', 'correio', 'correspondência', 'correspondencia'], opportunity: 'Triagem e resposta automática de e-mails com IA', priority: 'media' },
            { triggers: ['jurídic', 'juridic', 'advog', 'processo', 'petição', 'peticao', 'prazo'], opportunity: 'IA jurídica para análise de documentos e prazos', priority: 'alta' },
            { triggers: ['produção', 'manufatura', 'fábrica', 'fabrica', 'industrial', 'chão de fábrica'], opportunity: 'IA para planejamento e otimização de produção', priority: 'alta' },
            { triggers: ['projeto', 'obra', 'cronograma', 'planejamento'], opportunity: 'Gestão de projetos inteligente com IA', priority: 'media' },
            { triggers: ['segurança', 'monitoramento', 'vigilância', 'cftv', 'câmera'], opportunity: 'Monitoramento inteligente com visão computacional', priority: 'baixa' },
            { triggers: ['manutenção', 'preventiva', 'corretiva', 'preditiva', 'equipamento'], opportunity: 'Manutenção preditiva com IA', priority: 'media' },
        ];

        const seenOpportunities = new Set();
        for (const opp of opportunityMap) {
            if (opp.triggers.some(t => allText.includes(t)) && !seenOpportunities.has(opp.opportunity)) {
                seenOpportunities.add(opp.opportunity);
                automationOpportunities.push({ opportunity: opp.opportunity, priority: opp.priority });
            }
        }

        const priorityOrder = { alta: 0, media: 1, baixa: 2 };
        automationOpportunities.sort((a, b) => (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1));

        // ========= BUILD COMPANY DESCRIPTION (for PDF) =========
        let companyDescription = '';
        if (cnpjData && cnpjData.razao_social) {
            companyDescription = `${cnpjData.razao_social}`;
            if (cnpjData.atividade_principal) companyDescription += ` — ${cnpjData.atividade_principal}`;
            if (cnpjData.municipio) companyDescription += `. Localizada em ${cnpjData.municipio}${cnpjData.uf ? '-' + cnpjData.uf : ''}`;
            if (foundingYear) companyDescription += `, atuando desde ${foundingYear} (~${2026 - foundingYear} anos no mercado)`;
            companyDescription += '.';
            if (description) companyDescription += ' ' + description;
        } else if (description) {
            companyDescription = description;
        }

        // ========= COMPILE INSIGHTS =========
        const insights = [];
        if (foundingYear) insights.push(`Fundada em ${foundingYear} (~${2026 - foundingYear} anos)`);
        if (branchSignals >= 2) insights.push(`${branchSignals}+ unidades/escritórios detectados`);
        if (extractedEmployees) insights.push(`${extractedEmployees.toLocaleString('pt-BR')} colaboradores (mencionado no site)`);
        if (extractedRevenue) insights.push(`Faturamento declarado no site`);
        if (cnpjData) insights.push(`CNPJ verificado na Receita Federal`);
        if (cnpjData && cnpjData.situacao === 'ATIVA') insights.push(`Situação cadastral: ATIVA`);
        if (cnpjData && cnpjData.capital_social) {
            const cap = parseFloat(cnpjData.capital_social);
            if (cap >= 1000000) insights.push(`Capital social: R$ ${(cap / 1000000).toFixed(1)}M`);
            else if (cap >= 1000) insights.push(`Capital social: R$ ${Math.round(cap / 1000)}K`);
        }
        if (Object.keys(socialMedia).length > 0) {
            insights.push(`Presença digital: ${Object.keys(socialMedia).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}`);
        }
        if (headerTech.length > 0) {
            insights.push(`${headerTech.length} tecnologias detectadas no site`);
        }
        if (clients.length > 0) {
            insights.push(`${clients.length} clientes/parceiros identificados`);
        }

        return new Response(JSON.stringify({
            success: true,
            domain,
            companyName: title ? title.split(/[|\-–—]/)[0].trim() : domain.split('.')[0],
            title,
            description: description.substring(0, 300),
            companyDescription: companyDescription.substring(0, 500),
            segment,
            segmentLabel,
            sizeEstimate,
            employeeEstimate,
            revenueEstimate,
            estimateSource,
            foundingYear,
            extractedEmployees,
            extractedRevenue,
            insights,
            companyServices: uniqueServices,
            techStack,
            operationalKeywords,
            digitalMaturitySignals,
            digitalMaturityScore: maturityScore,
            companyValues,
            automationOpportunities,
            // NEW deep analysis fields
            cnpjData,
            socialMedia,
            clients: clients.slice(0, 8),
            headerTech,
            jsonLdData: Object.keys(jsonLdData).length > 0 ? {
                name: jsonLdData.name,
                description: jsonLdData.description,
                telephone: jsonLdData.telephone,
                email: jsonLdData.email,
                address: jsonLdData.address,
                url: jsonLdData.url,
                logo: jsonLdData.logo,
                sameAs: jsonLdData.sameAs,
            } : null,
            hasWebsite: !!title,
            isEstimate: !extractedEmployees && !cnpjData
        }), { status: 200, headers: cors });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
    }
}

// ========= CNPJ VALIDATION =========
function validateCnpj(cnpj) {
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false; // all same digits

    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(cnpj[i]) * weights1[i];
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;
    if (parseInt(cnpj[12]) !== digit1) return false;

    sum = 0;
    for (let i = 0; i < 13; i++) sum += parseInt(cnpj[i]) * weights2[i];
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;
    if (parseInt(cnpj[13]) !== digit2) return false;

    return true;
}

// ========= CNPJ API PARSERS =========
function parseBrasilApi(data) {
    if (!data || data.status === 404) return null;
    const socios = data.qsa || [];
    return {
        cnpj: formatCnpj(data.cnpj || ''),
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || '',
        porte: data.porte || data.descricao_porte || '',
        capital_social: data.capital_social || 0,
        natureza_juridica: data.natureza_juridica || '',
        situacao: data.descricao_situacao_cadastral || data.situacao_cadastral || '',
        atividade_principal: (data.cnae_fiscal_descricao || ''),
        cnae_codigo: String(data.cnae_fiscal || ''),
        data_abertura: data.data_inicio_atividade || '',
        municipio: data.municipio || '',
        uf: data.uf || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        bairro: data.bairro || '',
        cep: data.cep || '',
        socios: socios.slice(0, 5).map(s => ({
            nome: s.nome_socio || s.nome || '',
            qualificacao: s.qualificacao_socio || s.qualificacao || ''
        })),
        socios_count: socios.length,
    };
}

function parseCnpjWs(data) {
    if (!data || !data.razao_social) return null;
    const socios = data.socios || [];
    const atividadePrincipal = data.estabelecimento?.atividade_principal || data.atividade_principal || {};
    return {
        cnpj: formatCnpj(data.estabelecimento?.cnpj || ''),
        razao_social: data.razao_social || '',
        nome_fantasia: data.estabelecimento?.nome_fantasia || '',
        porte: data.porte?.descricao || '',
        capital_social: data.capital_social || 0,
        natureza_juridica: data.natureza_juridica?.descricao || '',
        situacao: data.estabelecimento?.situacao_cadastral || '',
        atividade_principal: atividadePrincipal.descricao || '',
        cnae_codigo: String(atividadePrincipal.id || ''),
        data_abertura: data.estabelecimento?.data_inicio_atividade || '',
        municipio: data.estabelecimento?.cidade?.nome || '',
        uf: data.estabelecimento?.estado?.sigla || '',
        logradouro: data.estabelecimento?.logradouro || '',
        numero: data.estabelecimento?.numero || '',
        bairro: data.estabelecimento?.bairro || '',
        cep: data.estabelecimento?.cep || '',
        socios: socios.slice(0, 5).map(s => ({
            nome: s.nome || '',
            qualificacao: s.qualificacao_socio?.descricao || ''
        })),
        socios_count: socios.length,
    };
}

function formatCnpj(cnpj) {
    const raw = cnpj.replace(/\D/g, '');
    if (raw.length !== 14) return cnpj;
    return `${raw.substr(0, 2)}.${raw.substr(2, 3)}.${raw.substr(5, 3)}/${raw.substr(8, 4)}-${raw.substr(12, 2)}`;
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
