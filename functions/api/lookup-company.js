export async function onRequestPost(context) {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    try {
        const body = await context.request.json();
        const domain = body.domain;
        const clientHtml = body.html || ''; // HTML fetched by the browser (bypasses CF challenges)
        const clientName = body.companyName || ''; // Company name provided by chat context
        if (!domain) return new Response(JSON.stringify({ error: 'No domain' }), { status: 400, headers: cors });

        const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*/, '').trim().toLowerCase();

        // ========= UTILITY: Fetch with timeout (CF-to-CF aware) =========
        const isChallengePage = (html) => {
            if (!html) return true;
            // Detect Cloudflare challenge, DuckDuckGo CAPTCHA, or other bot blocks
            return html.includes('challenge-platform') || html.includes('cf-challenge')
                || (html.includes('Just a moment') && html.includes('cloudflare'))
                || html.includes('Checking if the site connection is secure')
                || html.includes('Please complete the following challenge')
                || html.includes('Access denied')
                || html.includes('Enable JavaScript and cookies to continue');
        };

        const fetchPage = async (url, timeout = 10000) => {
            try {
                // Use minimal headers — CF Workers with too many headers get flagged
                const res = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
                    redirect: 'follow',
                    signal: AbortSignal.timeout(timeout)
                });
                if (!res.ok) return null;
                const html = await res.text();

                // Reject challenge/captcha pages
                if (isChallengePage(html)) {
                    console.log(`Challenge page detected for ${url}`);
                    return null;
                }

                return html;
            } catch (e) {
                console.log(`Fetch failed for ${url}: ${e.message}`);
                return null;
            }
        };

        // Dedicated DuckDuckGo search — needs special handling
        const searchDDG = async (query, timeout = 10000) => {
            try {
                const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible)',
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `q=${encodeURIComponent(query)}`,
                    redirect: 'follow',
                    signal: AbortSignal.timeout(timeout)
                });
                if (!res.ok) return null;
                const html = await res.text();
                if (isChallengePage(html)) return null;
                return html;
            } catch (e) { return null; }
        };

        const fetchJSON = async (url, timeout = 8000) => {
            try {
                const res = await fetch(url, {
                    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
                    signal: AbortSignal.timeout(timeout)
                });
                if (!res.ok) return null;
                return await res.json();
            } catch (e) { return null; }
        };

        const stripHtml = (html) => {
            return html
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/&#?\w+;/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        };

        // ====================================================================
        //  PHASE 1: PARALLEL MEGA-FETCH — Website + External Sources
        // ====================================================================
        let allTexts = [];
        let title = '', description = '', mainBodyText = '', mainHtml = '';

        // Use client-provided HTML first (browser bypasses CF challenges), then try server fetch
        if (clientHtml && clientHtml.length > 500) {
            mainHtml = clientHtml;
            console.log(`Using client-provided HTML (${clientHtml.length} chars)`);
        } else {
            mainHtml = await fetchPage(`https://${cleanDomain}`);
            if (!mainHtml) mainHtml = await fetchPage(`https://www.${cleanDomain}`);
        }

        if (mainHtml) {
            const titleMatch = mainHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
                const rawTitle = titleMatch[1].trim();
                // Reject bogus titles from challenge pages
                if (!rawTitle.match(/^(Google Search|Just a moment|Checking|Access denied|403|Attention Required)/i)) {
                    title = rawTitle;
                }
            }

            const descMatch = mainHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
                || mainHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
            if (descMatch) description = descMatch[1].trim();
            if (!description) {
                const ogMatch = mainHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
                if (ogMatch) description = ogMatch[1].trim();
            }

            mainBodyText = stripHtml(mainHtml).substring(0, 15000);
            // Only add if it's real content (not a challenge page)
            if (mainBodyText.length > 200) allTexts.push(mainBodyText);
        }

        // Smart company name: clientName > title > domain
        const companyName = clientName
            || (title ? title.split(/[|\-–—·]/)[0].trim() : '')
            || cleanDomain.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        // ========= Extract CNPJ early (needed for API queries) =========
        let extractedCnpj = null;
        const cnpjPatterns = [
            /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g,
            /cnpj[:\s]*(\d{2}\.?\d{3}\.?\d{3}\/?\.?\d{4}-?\d{2})/gi,
        ];
        const htmlToSearch = mainHtml ? mainHtml.substring(Math.max(0, mainHtml.length - 20000)) : '';
        for (const pat of cnpjPatterns) {
            pat.lastIndex = 0;
            let m;
            while ((m = pat.exec(htmlToSearch)) !== null) {
                const raw = m[1].replace(/[.\-\/]/g, '');
                if (raw.length === 14 && raw !== '00000000000000' && validateCnpj(raw)) {
                    extractedCnpj = raw;
                    break;
                }
            }
            if (extractedCnpj) break;
        }

        // ====================================================================
        //  PHASE 2: MASSIVE PARALLEL FETCH — All sources at once
        // ====================================================================
        const companyNameEncoded = encodeURIComponent(companyName);
        const domainEncoded = encodeURIComponent(cleanDomain);

        // Build all fetch promises
        const fetchPromises = {};

        // --- Website internal pages (expanded list) ---
        const pagePaths = [
            '/sobre', '/about', '/quem-somos', '/a-empresa', '/institucional',
            '/servicos', '/services', '/produtos', '/products', '/solucoes', '/solutions',
            '/contato', '/contact', '/fale-conosco',
            '/trabalhe-conosco', '/carreiras', '/careers', '/vagas',
            '/clientes', '/cases', '/portfolio', '/projetos',
            '/blog', '/noticias', '/news',
            '/equipe', '/time', '/team', '/nosso-time',
            '/parceiros', '/partners',
            '/tecnologia', '/plataforma',
            '/metodologia', '/como-funciona',
            '/historia', '/timeline',
            '/responsabilidade-social', '/sustentabilidade', '/esg',
        ];
        const pagePromises = pagePaths.map(p => fetchPage(`https://${cleanDomain}${p}`, 5000));
        fetchPromises.pages = Promise.allSettled(pagePromises);

        // --- CNPJ APIs ---
        if (extractedCnpj) {
            fetchPromises.cnpjBrasil = fetchJSON(`https://brasilapi.com.br/api/cnpj/v1/${extractedCnpj}`, 10000);
            fetchPromises.cnpjWs = fetchJSON(`https://publica.cnpj.ws/cnpj/${extractedCnpj}`, 10000);
        }

        // --- DuckDuckGo Search (1 consolidated search to avoid rate limits) ---
        fetchPromises.ddgSearch = searchDDG(`${companyName} ${cleanDomain} CNPJ empresa`, 12000);

        // --- ReclameAqui (reputation & complaints) ---
        const raSlug = companyName.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        fetchPromises.reclameAqui = fetchPage(`https://www.reclameaqui.com.br/empresa/${raSlug}/`, 8000);
        const raDomainSlug = cleanDomain.split('.')[0].toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-');
        if (raDomainSlug !== raSlug) {
            fetchPromises.reclameAqui2 = fetchPage(`https://www.reclameaqui.com.br/empresa/${raDomainSlug}/`, 8000);
        }

        // --- Glassdoor ---
        fetchPromises.glassdoor = fetchPage(
            `https://www.glassdoor.com.br/Avalia%C3%A7%C3%B5es/${companyNameEncoded}-avalia%C3%A7%C3%B5es-E0.htm`, 6000
        );

        // --- Domain DNS info (Google DNS API - always works) ---
        fetchPromises.dnsInfo = fetchJSON(`https://dns.google/resolve?name=${cleanDomain}&type=A`, 5000);
        fetchPromises.dnsInfo2 = fetchJSON(`https://dns.google/resolve?name=${cleanDomain}&type=MX`, 5000);

        // --- CNPJ search (only 1 DDG request to avoid rate limiting) ---
        if (!extractedCnpj) {
            fetchPromises.cnpjSearch = searchDDG(`CNPJ "${companyName}" ${cleanDomain}`, 12000);
        }

        // --- BuiltWith-style tech detection (via Wappalyzer-like headers) ---
        fetchPromises.securityHeaders = (async () => {
            try {
                const res = await fetch(`https://${cleanDomain}`, {
                    method: 'HEAD',
                    signal: AbortSignal.timeout(5000),
                    redirect: 'follow'
                });
                const headers = {};
                for (const [k, v] of res.headers.entries()) headers[k] = v;
                return headers;
            } catch (e) { return null; }
        })();

        // --- Wait for ALL parallel fetches ---
        const results = {};
        const keys = Object.keys(fetchPromises);
        const settled = await Promise.allSettled(keys.map(k => fetchPromises[k]));
        keys.forEach((k, i) => {
            results[k] = settled[i].status === 'fulfilled' ? settled[i].value : null;
        });

        // ====================================================================
        //  PHASE 3: PROCESS WEBSITE PAGES
        // ====================================================================
        if (results.pages) {
            for (const r of results.pages) {
                if (r.status === 'fulfilled' && r.value) {
                    const pageText = stripHtml(r.value).substring(0, 8000);
                    if (pageText.length > 100) allTexts.push(pageText);
                }
            }
        }

        const allText = (title + ' ' + description + ' ' + allTexts.join(' ')).toLowerCase();

        // ====================================================================
        //  PHASE 4: PROCESS CNPJ DATA
        // ====================================================================
        let cnpjData = null;
        if (results.cnpjBrasil) cnpjData = parseBrasilApi(results.cnpjBrasil);
        if (!cnpjData && results.cnpjWs) cnpjData = parseCnpjWs(results.cnpjWs);

        // If no CNPJ was found on website, try multiple search strategies
        if (!cnpjData) {
            let foundCnpjRaw = null;

            // Strategy 1: DuckDuckGo search results (most reliable from Workers)
            const searchSources = [results.cnpjSearch, results.cnpjSearchDomain, results.cnpjReceitaWS].filter(Boolean);
            for (const src of searchSources) {
                if (foundCnpjRaw) break;
                const searchText = stripHtml(src);
                // Find ALL CNPJs in the search results, prioritize ones near the company name
                const allCnpjs = [...searchText.matchAll(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g)];
                for (const match of allCnpjs) {
                    const raw = match[1].replace(/[.\-\/]/g, '');
                    if (raw.length === 14 && validateCnpj(raw)) {
                        foundCnpjRaw = raw;
                        console.log(`CNPJ found via search: ${raw}`);
                        break;
                    }
                }
            }

            // Strategy 3: Search the allText + all fetched pages for CNPJ (sometimes in subpages)
            if (!foundCnpjRaw) {
                const fullContent = allTexts.join(' ');
                const cnpjInPages = fullContent.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
                if (cnpjInPages) {
                    const raw = cnpjInPages[1].replace(/[.\-\/]/g, '');
                    if (validateCnpj(raw)) {
                        foundCnpjRaw = raw;
                        console.log(`CNPJ found in subpages: ${raw}`);
                    }
                }
            }

            // If we found a CNPJ, fetch full data
            if (foundCnpjRaw) {
                extractedCnpj = foundCnpjRaw;
                const [br, ws] = await Promise.allSettled([
                    fetchJSON(`https://brasilapi.com.br/api/cnpj/v1/${foundCnpjRaw}`, 8000),
                    fetchJSON(`https://publica.cnpj.ws/cnpj/${foundCnpjRaw}`, 8000)
                ]);
                if (br.status === 'fulfilled' && br.value) cnpjData = parseBrasilApi(br.value);
                if (!cnpjData && ws.status === 'fulfilled' && ws.value) cnpjData = parseCnpjWs(ws.value);
            }
        }

        // ====================================================================
        //  PHASE 5: PROCESS DUCKDUCKGO SEARCH RESULTS
        // ====================================================================
        let googleMentions = [];
        let linkedinUrl = '';
        let linkedinEmployees = null;

        if (results.ddgSearch) {
            const gText = stripHtml(results.ddgSearch);
            // Extract search result snippets for market intelligence
            const snippets = gText.match(/[^.]{30,200}(?:empresa|company|líder|mercado|cliente|solução|tecnologia|fundad|crescimento|faturamento|colaborador|funcionário|prêmio|award|advogado|advocacia|seccional)[^.]{0,150}\./gi) || [];
            googleMentions = snippets.slice(0, 10).map(s => s.trim());

            // Also extract employee mentions from search results
            const empMatch = gText.match(/(\d[\d.,]*)\s*(?:funcionários|colaboradores|employees|seguidores|followers|advogados|associados|membros)/i);
            if (empMatch) {
                const num = parseInt(empMatch[1].replace(/[.,]/g, ''));
                if (num >= 5 && num <= 500000) linkedinEmployees = num;
            }
        }

        if (results.ddgLinkedin) {
            const liText = stripHtml(results.ddgLinkedin);
            const empMatch2 = liText.match(/(\d[\d.,]*)\s*(?:funcionários|colaboradores|employees|followers)/i);
            if (empMatch2 && !linkedinEmployees) {
                const num = parseInt(empMatch2[1].replace(/[.,]/g, ''));
                if (num >= 5 && num <= 500000) linkedinEmployees = num;
            }
        }

        // Extract LinkedIn company URL from DuckDuckGo results
        if (results.linkedinSearch) {
            const liMatch = results.linkedinSearch.match(/https:\/\/(?:www\.)?linkedin\.com\/company\/[a-z0-9\-]+/i);
            if (liMatch) linkedinUrl = liMatch[0];
        }

        // ====================================================================
        //  PHASE 6: RECLAME AQUI — Customer Reputation Analysis
        // ====================================================================
        let reclameAquiData = null;
        const raHtml = results.reclameAqui || results.reclameAqui2;
        if (raHtml && !raHtml.includes('Empresa não encontrada') && !raHtml.includes('404')) {
            try {
                const raText = stripHtml(raHtml);

                // Extract reputation score
                const scoreMatch = raHtml.match(/(?:nota|score|avaliação|reputação)[^>]*?(\d[.,]\d)/i)
                    || raHtml.match(/"score"[:\s]*(\d[.,]\d)/i)
                    || raText.match(/(?:Nota do consumidor|Nota geral|Reputação)[:\s]*(\d[.,]\d)/i);
                const score = scoreMatch ? parseFloat(scoreMatch[1].replace(',', '.')) : null;

                // Extract complaint categories/count
                const complaintsMatch = raText.match(/(\d[\d.,]*)\s*(?:reclamações?|reclama)/i);
                const complaints = complaintsMatch ? parseInt(complaintsMatch[1].replace(/[.,]/g, '')) : null;

                // Extract response rate
                const responseMatch = raText.match(/(\d{1,3}[.,]?\d?)\s*%?\s*(?:respondida|resolvid|resposta|response)/i);
                const responseRate = responseMatch ? responseMatch[1] : null;

                // Extract reputation label
                const repLabels = ['ótimo', 'ótima', 'bom', 'boa', 'regular', 'ruim', 'não recomendada', 'não recomendado'];
                let reputationLabel = '';
                for (const label of repLabels) {
                    if (raText.toLowerCase().includes(label)) {
                        reputationLabel = label.charAt(0).toUpperCase() + label.slice(1);
                        break;
                    }
                }

                // Top complaint themes
                const themes = [];
                const themePatterns = raText.match(/(?:Problemas? (?:com|de|no)|Categoria)[:\s]*([^.\n]{5,60})/gi) || [];
                for (const t of themePatterns.slice(0, 5)) {
                    const clean = t.replace(/(?:Problemas? (?:com|de|no)|Categoria)[:\s]*/i, '').trim();
                    if (clean.length > 3 && clean.length < 60) themes.push(clean);
                }

                if (score || complaints || reputationLabel) {
                    reclameAquiData = {
                        score,
                        complaints,
                        responseRate,
                        reputationLabel,
                        themes: themes.slice(0, 5),
                        url: `https://www.reclameaqui.com.br/empresa/${raSlug}/`
                    };
                }
            } catch (e) { /* ReclameAqui parsing failed */ }
        }

        // ====================================================================
        //  PHASE 7: GLASSDOOR — Employer Reputation
        // ====================================================================
        let glassdoorData = null;
        if (results.glassdoor && !results.glassdoor.includes('não encontrada')) {
            try {
                const gdText = stripHtml(results.glassdoor);
                const gdScore = gdText.match(/(\d[.,]\d)\s*(?:de\s*5|\/\s*5|estrela)/i);
                const gdReviews = gdText.match(/(\d[\d.,]*)\s*(?:avaliações?|reviews?)/i);

                if (gdScore || gdReviews) {
                    glassdoorData = {
                        score: gdScore ? parseFloat(gdScore[1].replace(',', '.')) : null,
                        reviewCount: gdReviews ? parseInt(gdReviews[1].replace(/[.,]/g, '')) : null,
                    };
                }
            } catch (e) { /* Glassdoor parsing failed */ }
        }

        // ====================================================================
        //  PHASE 8: DNS/SECURITY ANALYSIS — Infrastructure Maturity
        // ====================================================================
        let infraData = {
            hasSSL: mainHtml !== null, // if we got the page via HTTPS
            emailProvider: 'Desconhecido',
            cdn: null,
            securityScore: 0,
            dnsProvider: null,
        };

        // MX records → email provider
        if (results.dnsInfo2 && results.dnsInfo2.Answer) {
            const mxRecords = results.dnsInfo2.Answer.map(a => a.data || '').join(' ').toLowerCase();
            if (mxRecords.includes('google') || mxRecords.includes('googlemail')) {
                infraData.emailProvider = 'Google Workspace';
                infraData.securityScore += 2;
            } else if (mxRecords.includes('outlook') || mxRecords.includes('microsoft')) {
                infraData.emailProvider = 'Microsoft 365';
                infraData.securityScore += 2;
            } else if (mxRecords.includes('zoho')) {
                infraData.emailProvider = 'Zoho Mail';
                infraData.securityScore += 1;
            } else if (mxRecords.includes('locaweb') || mxRecords.includes('hostgator') || mxRecords.includes('uol')) {
                infraData.emailProvider = 'Hospedagem compartilhada';
                infraData.securityScore -= 1;
            } else if (mxRecords.includes('secureserver') || mxRecords.includes('godaddy')) {
                infraData.emailProvider = 'GoDaddy';
            }
        }

        // Security headers analysis
        if (results.securityHeaders) {
            const h = results.securityHeaders;
            if (h['strict-transport-security']) infraData.securityScore += 2;
            if (h['content-security-policy']) infraData.securityScore += 2;
            if (h['x-frame-options']) infraData.securityScore += 1;
            if (h['x-content-type-options']) infraData.securityScore += 1;
            if (h['x-xss-protection']) infraData.securityScore += 1;
            if (h['referrer-policy']) infraData.securityScore += 1;

            // CDN detection
            const server = (h['server'] || '').toLowerCase();
            const via = (h['via'] || '').toLowerCase();
            const powered = (h['x-powered-by'] || '').toLowerCase();
            if (h['cf-ray'] || server.includes('cloudflare')) { infraData.cdn = 'Cloudflare'; infraData.securityScore += 2; }
            else if (via.includes('cloudfront') || server.includes('cloudfront')) { infraData.cdn = 'AWS CloudFront'; infraData.securityScore += 2; }
            else if (h['x-azure-ref'] || server.includes('azure')) { infraData.cdn = 'Azure CDN'; infraData.securityScore += 2; }
            else if (server.includes('nginx')) infraData.cdn = 'Nginx';
            else if (server.includes('apache')) infraData.cdn = 'Apache';
            else if (via.includes('akamai')) { infraData.cdn = 'Akamai'; infraData.securityScore += 2; }
            else if (server.includes('vercel')) { infraData.cdn = 'Vercel'; infraData.securityScore += 1; }
            else if (server.includes('netlify')) { infraData.cdn = 'Netlify'; infraData.securityScore += 1; }

            if (powered.includes('php')) infraData.backend = 'PHP';
            else if (powered.includes('asp')) infraData.backend = 'ASP.NET';
            else if (powered.includes('express')) infraData.backend = 'Node.js/Express';
        }

        // ====================================================================
        //  PHASE 9: JSON-LD & SOCIAL MEDIA EXTRACTION
        // ====================================================================
        let jsonLdData = {};
        if (mainHtml) {
            const jsonLdMatches = mainHtml.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
            for (const match of jsonLdMatches) {
                try {
                    const jsonContent = match.replace(/<script[^>]*>/, '').replace(/<\/script>/i, '').trim();
                    const parsed = JSON.parse(jsonContent);
                    const items = Array.isArray(parsed) ? parsed : [parsed];
                    for (const item of items) {
                        if (['Organization', 'LocalBusiness', 'Corporation', 'ProfessionalService'].includes(item['@type'])) {
                            jsonLdData = { ...jsonLdData, ...item };
                        }
                        if (item['@graph']) {
                            for (const g of item['@graph']) {
                                if (['Organization', 'LocalBusiness', 'Corporation', 'ProfessionalService'].includes(g['@type'])) {
                                    jsonLdData = { ...jsonLdData, ...g };
                                }
                            }
                        }
                    }
                } catch (e) { /* invalid JSON-LD */ }
            }
        }

        // Social Media extraction (from all HTML pages)
        const socialMedia = {};
        const allHtml = mainHtml || '';
        const socialPatterns = [
            { name: 'linkedin', pattern: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"'\s]+)["']/gi },
            { name: 'instagram', pattern: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s]+)["']/gi },
            { name: 'facebook', pattern: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)["']/gi },
            { name: 'youtube', pattern: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|@|user)[^"'\s]+)["']/gi },
            { name: 'twitter', pattern: /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"'\s]+)["']/gi },
            { name: 'github', pattern: /href=["'](https?:\/\/(?:www\.)?github\.com\/[^"'\s]+)["']/gi },
            { name: 'tiktok', pattern: /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/@[^"'\s]+)["']/gi },
            { name: 'pinterest', pattern: /href=["'](https?:\/\/(?:www\.)?pinterest\.com\/[^"'\s]+)["']/gi },
        ];
        for (const sp of socialPatterns) {
            sp.pattern.lastIndex = 0;
            const m = sp.pattern.exec(allHtml);
            if (m) socialMedia[sp.name] = m[1].replace(/["']/g, '');
        }
        // Add LinkedIn from search
        if (!socialMedia.linkedin && linkedinUrl) socialMedia.linkedin = linkedinUrl;

        // ====================================================================
        //  PHASE 10: TECH STACK — Deep Detection from HTML + Headers
        // ====================================================================
        const headerTech = [];
        if (mainHtml) {
            const techChecks = [
                [/wp-content|wp-includes|wordpress/i, 'WordPress', 'CMS'],
                [/Shopify/i, 'Shopify', 'E-commerce'],
                [/vtex|VTEX/i, 'VTEX', 'E-commerce'],
                [/wix\.com/i, 'Wix', 'CMS'],
                [/squarespace/i, 'Squarespace', 'CMS'],
                [/__NEXT|next\.js|_next\//i, 'Next.js', 'Framework'],
                [/react|__react/i, 'React', 'Framework'],
                [/angular/i, 'Angular', 'Framework'],
                [/vue\.js|nuxt|__nuxt/i, 'Vue/Nuxt', 'Framework'],
                [/svelte/i, 'Svelte', 'Framework'],
                [/laravel/i, 'Laravel', 'Framework'],
                [/django/i, 'Django', 'Framework'],
                [/ruby on rails|rails/i, 'Ruby on Rails', 'Framework'],
                [/gtag|google-analytics|googletagmanager|gtm\.js/i, 'Google Analytics/GTM', 'Analytics'],
                [/fbq\(|facebook\.com\/tr/i, 'Meta Pixel', 'Analytics'],
                [/hotjar/i, 'Hotjar', 'Analytics'],
                [/clarity\.ms/i, 'Microsoft Clarity', 'Analytics'],
                [/mixpanel/i, 'Mixpanel', 'Analytics'],
                [/amplitude/i, 'Amplitude', 'Analytics'],
                [/segment\.com|analytics\.js/i, 'Segment', 'Analytics'],
                [/rdstation|rd-station/i, 'RD Station', 'Marketing'],
                [/hubspot/i, 'HubSpot', 'CRM/Marketing'],
                [/mailchimp/i, 'Mailchimp', 'Email Marketing'],
                [/activecampaign/i, 'ActiveCampaign', 'Email Marketing'],
                [/intercom/i, 'Intercom', 'Atendimento'],
                [/zendesk/i, 'Zendesk', 'Atendimento'],
                [/freshdesk|freshchat|freshworks/i, 'Freshworks', 'Atendimento'],
                [/drift/i, 'Drift', 'Chat'],
                [/tawk\.to|tawk/i, 'Tawk.to', 'Chat'],
                [/jivochat|jivosite/i, 'JivoChat', 'Chat'],
                [/crisp\.chat/i, 'Crisp', 'Chat'],
                [/livechat/i, 'LiveChat', 'Chat'],
                [/recaptcha|hcaptcha/i, 'CAPTCHA', 'Segurança'],
                [/cloudflare/i, 'Cloudflare', 'CDN/Segurança'],
                [/bootstrap/i, 'Bootstrap', 'CSS Framework'],
                [/tailwind/i, 'Tailwind CSS', 'CSS Framework'],
                [/material-ui|mui/i, 'Material UI', 'CSS Framework'],
                [/jquery/i, 'jQuery', 'JS Library'],
                [/stripe/i, 'Stripe', 'Pagamento'],
                [/pagseguro|pag-seguro/i, 'PagSeguro', 'Pagamento'],
                [/mercadopago|mercado.?pago/i, 'Mercado Pago', 'Pagamento'],
                [/iugu/i, 'Iugu', 'Pagamento'],
                [/pagar\.me|pagarme/i, 'Pagar.me', 'Pagamento'],
                [/schema\.org/i, 'Schema.org', 'SEO'],
                [/yoast/i, 'Yoast SEO', 'SEO'],
                [/ahrefs/i, 'Ahrefs', 'SEO'],
                [/semrush/i, 'SEMrush', 'SEO'],
                [/cookiebot|cookie-consent|lgpd|onetrust|termly/i, 'Cookie Consent/LGPD', 'Compliance'],
                [/salesforce/i, 'Salesforce', 'CRM'],
                [/pipedrive/i, 'Pipedrive', 'CRM'],
                [/google.?maps/i, 'Google Maps', 'Mapa'],
                [/mapbox/i, 'Mapbox', 'Mapa'],
                [/typeform/i, 'Typeform', 'Formulário'],
                [/jotform/i, 'JotForm', 'Formulário'],
                [/wufoo/i, 'Wufoo', 'Formulário'],
                [/elementor/i, 'Elementor', 'Page Builder'],
                [/webflow/i, 'Webflow', 'CMS/Builder'],
                [/magento/i, 'Magento', 'E-commerce'],
                [/woocommerce/i, 'WooCommerce', 'E-commerce'],
                [/nuvemshop|nuvem.?shop/i, 'Nuvemshop', 'E-commerce'],
                [/loja.?integrada/i, 'Loja Integrada', 'E-commerce'],
                [/tray\.com/i, 'Tray', 'E-commerce'],
                [/aws|amazonaws/i, 'AWS', 'Cloud'],
                [/azure/i, 'Azure', 'Cloud'],
                [/google.?cloud|gcp/i, 'Google Cloud', 'Cloud'],
                [/firebase/i, 'Firebase', 'Backend'],
                [/supabase/i, 'Supabase', 'Backend'],
                [/twilio/i, 'Twilio', 'Comunicação'],
            ];
            const seenHT = new Set();
            for (const [re, name, cat] of techChecks) {
                if (re.test(mainHtml) && !seenHT.has(name)) {
                    seenHT.add(name);
                    headerTech.push({ name, category: cat });
                }
            }

            // Add infra tech
            if (infraData.cdn && !seenHT.has(infraData.cdn)) {
                headerTech.push({ name: infraData.cdn, category: 'Servidor/CDN' });
            }
            if (infraData.emailProvider && infraData.emailProvider !== 'Desconhecido') {
                headerTech.push({ name: infraData.emailProvider, category: 'E-mail corporativo' });
            }
        }

        // ====================================================================
        //  PHASE 11: EXTRACT ALL TEXT-BASED DATA
        // ====================================================================

        // --- Employees ---
        let extractedEmployees = linkedinEmployees; // LinkedIn data is most reliable
        if (!extractedEmployees) {
            const empPatterns = [
                /(?:mais de |over |acima de |cerca de |aproximadamente )?(\d[\d.,]*)\s*(?:\+\s*)?(?:colaborador|funcionário|funcionario|empregado|profission|pessoa|membro)/gi,
                /(?:equipe|time|staff|team)\s+(?:de|com|with)\s+(?:mais de |over )?(\d[\d.,]*)/gi,
                /(\d[\d.,]*)\s*(?:\+\s*)?(?:colaborador|funcionário|funcionario)/gi,
                /"numberOfEmployees"[^}]*"value"\s*:\s*"?(\d[\d.,]*)/gi,
            ];
            for (const pat of empPatterns) {
                pat.lastIndex = 0;
                const m = pat.exec(allText);
                if (m) {
                    const num = parseInt(m[1].replace(/[.,]/g, ''));
                    if (num >= 5 && num <= 500000) { extractedEmployees = num; break; }
                }
            }
        }

        // --- Revenue ---
        let extractedRevenue = null;
        const revPatterns = [
            /(?:fatura|receita|billing|revenue)[^.]*?(?:R\$\s*)?(\d[\d.,]*)\s*(?:milh|bilh|mi\b|bi\b|million|billion)/gi,
            /R\$\s*(\d[\d.,]*)\s*(?:milh|bilh|mi\b|bi\b)/gi,
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

        // --- Founding Year ---
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
                if (year >= 1900 && year <= 2026) { foundingYear = year; break; }
            }
        }
        if (!foundingYear && cnpjData && cnpjData.data_abertura) {
            const parts = cnpjData.data_abertura.split(/[-\/]/);
            const year = parseInt(parts[0].length === 4 ? parts[0] : parts[2]);
            if (year >= 1900 && year <= 2026) foundingYear = year;
        }

        // --- Branch signals ---
        const branchSignals = (allText.match(/(?:filial|unidade|sede|escritório|escritorio|office|branch|loja|agência|agencia)/gi) || []).length;

        // --- Clients ---
        const clients = [];
        if (mainHtml) {
            const clientImgPattern = /(?:clientes?|parceiros?|partners?|cases?)[^]*?<img[^>]*alt=["']([^"']{3,60})["']/gi;
            let cm;
            const seenClients = new Set();
            while ((cm = clientImgPattern.exec(mainHtml)) !== null && clients.length < 15) {
                const name = cm[1].trim();
                if (!seenClients.has(name.toLowerCase()) && name.length > 2 && name.length < 60) {
                    seenClients.add(name.toLowerCase());
                    clients.push(name);
                }
            }
            const clientTextPat = /(?:nossos?\s+clientes?|clientes?\s+atendidos?|cases?\s+de\s+sucesso)[:\s]*([^.]{10,300})/gi;
            while ((cm = clientTextPat.exec(allText)) !== null && clients.length < 15) {
                const chunk = cm[1].split(/[,;•·|]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 50);
                for (const c of chunk) {
                    if (clients.length < 15 && !seenClients.has(c.toLowerCase())) {
                        seenClients.add(c.toLowerCase());
                        clients.push(c);
                    }
                }
            }
        }

        // ====================================================================
        //  PHASE 12: SEGMENT DETECTION
        // ====================================================================
        let segment = 'outro', segmentLabel = '';
        const segmentMap = [
            { keys: ['advog', 'jurídic', 'juridic', 'direito', 'escritório de advocacia', 'law firm', 'oab', 'ordem dos advogados'], cnae: ['6911', '6912', '9411'], seg: 'juridico', label: 'Advocacia / Jurídico' },
            { keys: ['imobili', 'real estate', 'construção', 'construcao', 'incorpora', 'empreendimento', 'condomíni'], cnae: ['4110', '4120', '4299', '6810', '6821', '6822'], seg: 'imobiliario', label: 'Imobiliário / Construção' },
            { keys: ['indústri', 'industri', 'fábrica', 'fabrica', 'manufatura', 'produção industrial', 'embalage', 'metalúrgic', 'siderúrgic'], cnae: ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32'], seg: 'industria', label: 'Indústria' },
            { keys: ['hospital', 'clínica', 'clinica', 'médic', 'medic', 'farmácia', 'saúde', 'saude', 'laborat', 'odont', 'veterinár'], cnae: ['8610', '8620', '8630', '8640', '8650', '4771'], seg: 'saude', label: 'Saúde' },
            { keys: ['varejo', 'loja', 'comércio', 'comercio', 'shop', 'store', 'e-commerce', 'ecommerce', 'marketplace'], cnae: ['47'], seg: 'varejo', label: 'Varejo / Comércio' },
            { keys: ['tecnologia', 'software', 'tech', 'saas', 'startup', 'plataforma digital', 'desenvolvimento de'], cnae: ['6201', '6202', '6203', '6204', '6209', '6311', '6319'], seg: 'tecnologia', label: 'Tecnologia' },
            { keys: ['educação', 'educacao', 'escola', 'universidade', 'faculdade', 'ensino', 'curso', 'colégio'], cnae: ['85'], seg: 'educacao', label: 'Educação' },
            { keys: ['contábil', 'contabil', 'contabilidade', 'fiscal', 'tributár', 'auditoria'], cnae: ['6920'], seg: 'contabil', label: 'Contabilidade' },
            { keys: ['agro', 'agrícol', 'agricol', 'fazenda', 'pecuári', 'rural', 'semente'], cnae: ['01', '02', '03'], seg: 'agro', label: 'Agronegócio' },
            { keys: ['logísti', 'logisti', 'transport', 'frete', 'entrega', 'distribuição'], cnae: ['49', '50', '51', '52'], seg: 'logistica', label: 'Logística / Transporte' },
            { keys: ['financ', 'banco', 'crédito', 'fintech', 'investiment', 'seguro', 'previdên'], cnae: ['64', '65', '66'], seg: 'financeiro', label: 'Financeiro / Seguros' },
            { keys: ['aliment', 'food', 'restaurante', 'gastronom', 'bebida', 'frigoríf'], cnae: ['10', '56'], seg: 'alimenticio', label: 'Alimentício' },
            { keys: ['consult', 'assessor', 'outsourc', 'terceiriz'], cnae: ['70', '7020', '7490'], seg: 'servicos', label: 'Serviços / Consultoria' },
            { keys: ['marketing', 'publicidade', 'propaganda', 'agência digital', 'agencia digital', 'comunicação visual'], cnae: ['7311', '7312', '7319', '7320'], seg: 'marketing', label: 'Marketing / Publicidade' },
            { keys: ['engenharia', 'project', 'infraestrutura', 'saneamento', 'energia', 'elétric'], cnae: ['71', '42'], seg: 'engenharia', label: 'Engenharia' },
        ];

        if (cnpjData && cnpjData.cnae_codigo) {
            for (const s of segmentMap) {
                if (s.cnae && s.cnae.some(c => cnpjData.cnae_codigo.startsWith(c))) {
                    segment = s.seg; segmentLabel = s.label; break;
                }
            }
        }
        if (segment === 'outro') {
            for (const s of segmentMap) {
                if (s.keys.some(k => allText.includes(k))) {
                    segment = s.seg; segmentLabel = s.label; break;
                }
            }
        }

        // ====================================================================
        //  PHASE 13: SIZE & REVENUE ESTIMATION
        // ====================================================================
        let sizeEstimate = 'media';
        let employeeEstimate = '';
        let revenueEstimate = '';
        let estimateSource = 'heurística';

        if (extractedEmployees) {
            estimateSource = linkedinEmployees ? 'dados do LinkedIn' : 'dados do site';
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
            if (allText.match(/listada|bolsa|ações|b3|bovespa|nyse|nasdaq/)) sizeScore += 5;
            if (branchSignals >= 5) sizeScore += 3;
            if (allText.match(/milhares de|thousands of/)) sizeScore += 3;
            if (allText.match(/grupo\s|holding|conglomerado/)) sizeScore += 2;
            if (allText.match(/líder|lider|referência|referencia|maior|largest|leading/)) sizeScore += 2;
            if (allText.match(/mais de \d{2,} anos|over \d{2,} years/)) sizeScore += 1;
            if (branchSignals >= 2) sizeScore += 1;
            if (allText.match(/seccional|conselho|entidade de classe|autarquia|governo|público/)) sizeScore += 3;
            if (foundingYear && (2026 - foundingYear) > 20) sizeScore += 1;
            if (foundingYear && (2026 - foundingYear) > 40) sizeScore += 1;
            if (segment === 'juridico' && allText.match(/oab|ordem|seccional/)) sizeScore += 3;
            if (segment === 'industria') sizeScore += 1;
            if (segment === 'financeiro') sizeScore += 1;

            if (cnpjData) {
                estimateSource = 'dados públicos (CNPJ + site + DNS)';
                const porte = (cnpjData.porte || '').toUpperCase();
                if (porte.includes('DEMAIS') || porte.includes('GRANDE')) sizeScore += 3;
                if (cnpjData.capital_social) {
                    const cap = parseFloat(cnpjData.capital_social);
                    if (cap >= 10000000) sizeScore += 4;
                    else if (cap >= 1000000) sizeScore += 3;
                    else if (cap >= 500000) sizeScore += 2;
                    else if (cap >= 100000) sizeScore += 1;
                }
                if (cnpjData.socios_count >= 5) sizeScore += 2;
                else if (cnpjData.socios_count >= 3) sizeScore += 1;
            }

            const socialCount = Object.keys(socialMedia).length;
            if (socialCount >= 4) sizeScore += 2;
            else if (socialCount >= 2) sizeScore += 1;
            if (clients.length >= 5) sizeScore += 2;
            else if (clients.length >= 2) sizeScore += 1;

            // ReclameAqui complaints volume as size indicator
            if (reclameAquiData && reclameAquiData.complaints) {
                if (reclameAquiData.complaints >= 1000) sizeScore += 3;
                else if (reclameAquiData.complaints >= 100) sizeScore += 2;
                else if (reclameAquiData.complaints >= 10) sizeScore += 1;
            }

            if (sizeScore >= 6) sizeEstimate = 'grande';
            else if (sizeScore >= 4) sizeEstimate = 'media_grande';
            else if (sizeScore >= 2) sizeEstimate = 'media';
            else sizeEstimate = 'pequena';

            const employeeRanges = {
                'micro': '5-15', 'pequena': '15-50', 'media': '50-150',
                'media_grande': '150-500', 'grande': '500+'
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
                'micro': 'R$ 500K – R$ 2M/ano', 'pequena': 'R$ 2M – R$ 10M/ano',
                'media': 'R$ 10M – R$ 30M/ano', 'media_grande': 'R$ 30M – R$ 100M/ano', 'grande': 'R$ 100M+/ano'
            };
            const segRevMap = {
                financeiro: { 'micro': 'R$ 1M – R$ 5M/ano', 'pequena': 'R$ 5M – R$ 20M/ano', 'media': 'R$ 20M – R$ 60M/ano', 'media_grande': 'R$ 60M – R$ 200M/ano', 'grande': 'R$ 200M+/ano' },
                juridico: { 'micro': 'R$ 1M – R$ 5M/ano', 'pequena': 'R$ 5M – R$ 20M/ano', 'media': 'R$ 20M – R$ 60M/ano', 'media_grande': 'R$ 60M – R$ 200M/ano', 'grande': 'R$ 200M+/ano' },
                industria: { 'micro': 'R$ 1M – R$ 3M/ano', 'pequena': 'R$ 3M – R$ 15M/ano', 'media': 'R$ 15M – R$ 50M/ano', 'media_grande': 'R$ 50M – R$ 150M/ano', 'grande': 'R$ 150M+/ano' },
                varejo: { 'micro': 'R$ 1M – R$ 3M/ano', 'pequena': 'R$ 3M – R$ 15M/ano', 'media': 'R$ 15M – R$ 50M/ano', 'media_grande': 'R$ 50M – R$ 150M/ano', 'grande': 'R$ 150M+/ano' },
            };
            revenueEstimate = (segRevMap[segment] || {})[sizeEstimate] || revMap[sizeEstimate] || 'R$ 2M – R$ 10M/ano';

            if (cnpjData && cnpjData.capital_social) {
                const cap = parseFloat(cnpjData.capital_social);
                const estRevFromCap = cap * 5;
                if (estRevFromCap >= 1000000000) revenueEstimate = `R$ ${(estRevFromCap / 1000000000).toFixed(1)}B+ (est.)`;
                else if (estRevFromCap >= 100000000) revenueEstimate = `R$ ${Math.round(estRevFromCap / 1000000)}M+ (est.)`;
                else if (estRevFromCap >= 10000000) revenueEstimate = `R$ ${Math.round(estRevFromCap / 1000000)}M – R$ ${Math.round(estRevFromCap * 2 / 1000000)}M/ano`;
            }
        }

        // ====================================================================
        //  PHASE 14: SERVICES, TECH STACK, OPERATIONAL KEYWORDS
        // ====================================================================

        // --- Company Services ---
        const companyServices = [];
        const servicePatterns = [
            /(?:nossos?\s+serviços|nossas?\s+soluções|o\s+que\s+fazemos|áreas?\s+de\s+atuação|serviços|soluções|what\s+we\s+do)[:\s]*([^.]{10,300})/gi,
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
            'educação', 'ensino', 'certificação', 'e-commerce', 'marketplace',
            'recrutamento', 'seleção', 'rh', 'folha de pagamento',
        ];

        for (const pat of servicePatterns) {
            pat.lastIndex = 0;
            let m;
            while ((m = pat.exec(allText)) !== null && companyServices.length < 8) {
                const parts = m[1].trim().split(/[,;•·|]/).map(s => s.trim()).filter(s => s.length > 3 && s.length < 80);
                for (const p of parts) {
                    if (companyServices.length < 8 && !companyServices.some(e => e === p)) companyServices.push(p);
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
        // Add CNPJ activity as service if very few detected
        if (companyServices.length < 2 && cnpjData && cnpjData.atividade_principal) {
            companyServices.unshift(cnpjData.atividade_principal);
        }
        const uniqueServices = [...new Set(companyServices)].slice(0, 6);

        // --- Tech Stack from text ---
        const techPatterns = [
            { pattern: /\b(sap|totvs|protheus|oracle|salesforce|hubspot|pipedrive|dynamics|netsuite|senior|sankhya|omie|bling|tiny)\b/gi, category: 'ERP/CRM' },
            { pattern: /\b(aws|amazon web services|azure|google cloud|gcp)\b/gi, category: 'Cloud' },
            { pattern: /\b(microsoft 365|office 365|google workspace|teams|slack|zoom|whatsapp business)\b/gi, category: 'Comunicação' },
            { pattern: /\b(power bi|tableau|looker|qlik|metabase|data studio|looker studio)\b/gi, category: 'BI/Analytics' },
            { pattern: /\b(rpa|robotic process|zapier|make\.com|n8n|power automate|integromat)\b/gi, category: 'Automação' },
            { pattern: /\b(inteligência artificial|machine learning|chatbot|openai|gpt|gemini|claude|deep learning|nlp)\b/gi, category: 'IA' },
            { pattern: /\b(erp|crm|scm|wms|tms|mes|bpm|ged|ecm)\b/gi, category: 'Sistema' },
            { pattern: /\b(docker|kubernetes|terraform|ansible|jenkins|github actions|gitlab ci)\b/gi, category: 'DevOps' },
            { pattern: /\b(mongodb|postgresql|mysql|redis|elasticsearch|dynamodb)\b/gi, category: 'Banco de Dados' },
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
        for (const ht of headerTech) {
            if (!seenTech.has(ht.name.toLowerCase())) {
                seenTech.add(ht.name.toLowerCase());
                techStack.push(ht);
            }
        }

        // --- Operational Keywords ---
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
            { keyword: 'estoque', label: 'Estoque' },
            { keyword: 'compras', label: 'Compras' },
            { keyword: 'supply chain', label: 'Supply Chain' },
            { keyword: 'produção', label: 'Produção' },
            { keyword: 'qualidade', label: 'Qualidade' },
            { keyword: 'marketing', label: 'Marketing' },
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
            { keyword: 'projeto', label: 'Projetos' },
            { keyword: 'manutenção', label: 'Manutenção' },
            { keyword: 'ti', label: 'TI' },
            { keyword: 'treinamento', label: 'Treinamento' },
        ];
        const operationalKeywords = [];
        const seenOps = new Set();
        for (const op of operationalKeywordList) {
            if (allText.includes(op.keyword) && !seenOps.has(op.label)) {
                seenOps.add(op.label);
                operationalKeywords.push(op.label);
            }
        }

        // ====================================================================
        //  PHASE 15: DIGITAL MATURITY SCORING (enhanced)
        // ====================================================================
        const digitalMaturitySignals = [];
        const positiveSignals = [
            { pattern: /\b(transformação digital|digital transformation)\b/i, signal: 'Menciona transformação digital', score: 2 },
            { pattern: /\b(inteligência artificial|machine learning|ia\b|ai\b)\b/i, signal: 'Referência a IA/ML', score: 3 },
            { pattern: /\b(automação|automation|rpa|robotic)\b/i, signal: 'Menciona automação', score: 2 },
            { pattern: /\b(cloud|nuvem|aws|azure|google cloud)\b/i, signal: 'Uso de cloud', score: 2 },
            { pattern: /\b(api|integração|integration|microserviço)\b/i, signal: 'Integrações/APIs', score: 2 },
            { pattern: /\b(data driven|data-driven|analytics|business intelligence)\b/i, signal: 'Cultura de dados', score: 2 },
            { pattern: /\b(devops|ci\/cd|agile|ágil|scrum|kanban)\b/i, signal: 'Metodologias ágeis', score: 2 },
            { pattern: /\b(lgpd|gdpr|proteção de dados)\b/i, signal: 'Compliance de dados (LGPD)', score: 1 },
            { pattern: /\b(e-commerce|loja virtual|marketplace)\b/i, signal: 'Presença digital (e-commerce)', score: 1 },
            { pattern: /\b(app|aplicativo|mobile)\b/i, signal: 'Presença mobile', score: 1 },
            { pattern: /\b(chatbot|chat online|atendimento online)\b/i, signal: 'Atendimento digital', score: 1 },
            { pattern: /\b(portal do cliente|área do cliente|self.?service)\b/i, signal: 'Portal self-service', score: 2 },
        ];
        const negativeSignals = [
            { pattern: /\b(fale conosco|ligue|telefone)\b.*\b(atendimento|contato)\b/i, signal: 'Atendimento primariamente telefônico', score: -1 },
            { pattern: /\b(formulário|preencha|cadastr)\b/i, signal: 'Processos baseados em formulários', score: -1 },
            { pattern: /\b(tradição|tradicional)\b/i, signal: 'Empresa tradicional (possível gap digital)', score: -1 },
        ];

        let maturityScore = 0;
        for (const ps of positiveSignals) {
            if (ps.pattern.test(allText)) {
                digitalMaturitySignals.push({ signal: ps.signal, type: 'positive' });
                maturityScore += ps.score;
            }
        }
        for (const ns of negativeSignals) {
            if (ns.pattern.test(allText)) {
                digitalMaturitySignals.push({ signal: ns.signal, type: 'opportunity' });
                maturityScore += ns.score;
            }
        }

        // Boost from detected tech
        if (headerTech.length >= 8) maturityScore += 3;
        else if (headerTech.length >= 5) maturityScore += 2;
        else if (headerTech.length >= 3) maturityScore += 1;

        // Boost from infrastructure analysis
        maturityScore += infraData.securityScore;

        // Modern email provider boost
        if (infraData.emailProvider === 'Google Workspace' || infraData.emailProvider === 'Microsoft 365') {
            digitalMaturitySignals.push({ signal: `Email corporativo: ${infraData.emailProvider}`, type: 'positive' });
        } else if (infraData.emailProvider === 'Hospedagem compartilhada') {
            digitalMaturitySignals.push({ signal: 'Email em hospedagem compartilhada (risco)', type: 'opportunity' });
        }

        // CDN/Security boost
        if (infraData.cdn && ['Cloudflare', 'AWS CloudFront', 'Azure CDN', 'Akamai'].includes(infraData.cdn)) {
            digitalMaturitySignals.push({ signal: `CDN profissional: ${infraData.cdn}`, type: 'positive' });
        }

        // ====================================================================
        //  PHASE 16: COMPANY VALUES & DIFFERENTIALS
        // ====================================================================
        const companyValues = [];
        const valuePatterns = [
            { pattern: /\b(iso\s*\d{3,5})/gi, label: null },
            { pattern: /\b(great place to work|gptw)\b/gi, label: 'Great Place to Work' },
            { pattern: /\b(prêmio|award|premiada?|reconheciment)\b/gi, label: 'Empresa premiada' },
            { pattern: /\b(sustentabilidade|sustentável|esg|responsabilidade social)\b/gi, label: 'Sustentabilidade/ESG' },
            { pattern: /\b(inovação|innovation|inovadora?)\b/gi, label: 'Foco em inovação' },
            { pattern: /\b(excelência|excellence|qualidade total)\b/gi, label: 'Excelência operacional' },
            { pattern: /\b(líder de mercado|market leader|referência no)\b/gi, label: 'Líder de mercado' },
            { pattern: /\b(selo|stamp|acreditação|acreditada)\b/gi, label: 'Acreditação/Selo' },
            { pattern: /\b(b.?corp|empresa b)\b/gi, label: 'B Corp' },
            { pattern: /\b(top\s+\d+|ranking|melhor|best)\b/gi, label: 'Ranking/Top' },
        ];
        const seenValues = new Set();
        for (const vp of valuePatterns) {
            vp.pattern.lastIndex = 0;
            let m;
            while ((m = vp.pattern.exec(allText)) !== null) {
                const label = vp.label || m[0].trim();
                if (!seenValues.has(label.toLowerCase())) {
                    seenValues.add(label.toLowerCase());
                    companyValues.push(label);
                }
            }
        }

        // ====================================================================
        //  PHASE 17: AUTOMATION OPPORTUNITIES (enhanced with ReclameAqui data)
        // ====================================================================
        const automationOpportunities = [];
        const opportunityMap = [
            { triggers: ['atendimento ao cliente', 'atendimento', 'suporte', 'sac', 'call center'], opportunity: 'Chatbot IA para atendimento 24/7', priority: 'alta' },
            { triggers: ['relatório', 'relatorio', 'report', 'dados', 'analytics', 'kpi'], opportunity: 'Dashboards inteligentes com IA', priority: 'alta' },
            { triggers: ['contrato', 'documento', 'documental', 'arquivo', 'protocolo'], opportunity: 'Gestão documental inteligente com IA', priority: 'alta' },
            { triggers: ['vendas', 'comercial', 'prospecção', 'lead', 'pipeline', 'funil'], opportunity: 'CRM com IA para prospecção e vendas', priority: 'alta' },
            { triggers: ['nota fiscal', 'nfe', 'fiscal', 'tributári', 'tributar', 'imposto'], opportunity: 'Automação fiscal e tributária', priority: 'media' },
            { triggers: ['rh', 'recursos humanos', 'recrutamento', 'seleção', 'folha de pagamento'], opportunity: 'IA para RH: triagem de currículos e onboarding', priority: 'media' },
            { triggers: ['marketing', 'comunicação', 'conteúdo', 'redes sociais', 'campanha'], opportunity: 'IA para geração de conteúdo e marketing', priority: 'media' },
            { triggers: ['logística', 'logistica', 'entrega', 'transporte', 'frete', 'rota'], opportunity: 'Otimização logística com IA (rotas e previsão)', priority: 'alta' },
            { triggers: ['estoque', 'inventário', 'armazém', 'wms'], opportunity: 'Gestão de estoque preditiva com IA', priority: 'media' },
            { triggers: ['compras', 'procurement', 'fornecedor', 'cotação', 'licitação'], opportunity: 'Automação de compras e cotações', priority: 'media' },
            { triggers: ['agendamento', 'agenda', 'consulta', 'reserva'], opportunity: 'Agendamento inteligente automatizado', priority: 'media' },
            { triggers: ['cobrança', 'inadimplência', 'pagamento', 'boleto', 'financeiro'], opportunity: 'Automação de cobranças e conciliação financeira', priority: 'alta' },
            { triggers: ['qualidade', 'inspeção', 'auditoria', 'conformidade'], opportunity: 'IA para controle de qualidade e compliance', priority: 'media' },
            { triggers: ['treinamento', 'capacitação', 'educação', 'ensino', 'curso'], opportunity: 'Plataforma de treinamento com IA adaptativa', priority: 'baixa' },
            { triggers: ['e-mail', 'email', 'correspondência'], opportunity: 'Triagem e resposta automática de e-mails com IA', priority: 'media' },
            { triggers: ['jurídic', 'juridic', 'advog', 'processo', 'petição', 'prazo'], opportunity: 'IA jurídica para análise de documentos e prazos', priority: 'alta' },
            { triggers: ['produção', 'manufatura', 'fábrica', 'industrial'], opportunity: 'IA para planejamento e otimização de produção', priority: 'alta' },
            { triggers: ['projeto', 'obra', 'cronograma', 'planejamento'], opportunity: 'Gestão de projetos inteligente com IA', priority: 'media' },
            { triggers: ['segurança', 'monitoramento', 'vigilância', 'cftv'], opportunity: 'Monitoramento inteligente com visão computacional', priority: 'baixa' },
            { triggers: ['manutenção', 'preventiva', 'corretiva', 'equipamento'], opportunity: 'Manutenção preditiva com IA', priority: 'media' },
        ];

        const seenOpportunities = new Set();
        for (const opp of opportunityMap) {
            if (opp.triggers.some(t => allText.includes(t)) && !seenOpportunities.has(opp.opportunity)) {
                seenOpportunities.add(opp.opportunity);
                automationOpportunities.push({ opportunity: opp.opportunity, priority: opp.priority });
            }
        }

        // Add opportunities based on ReclameAqui complaint themes
        if (reclameAquiData && reclameAquiData.themes.length > 0) {
            const complaintOpps = {
                'atendimento': 'Chatbot IA para resolver reclamações de atendimento',
                'entrega': 'Automação de tracking e comunicação de entregas',
                'cobrança': 'Automação de cobranças transparentes',
                'qualidade': 'IA para controle de qualidade de produtos/serviços',
                'prazo': 'Automação de gestão de prazos e alertas',
                'cancelamento': 'IA para retenção de clientes (churn prediction)',
                'estorno': 'Automação de processos de estorno/reembolso',
                'produto': 'IA para controle de qualidade de produtos',
            };
            for (const theme of reclameAquiData.themes) {
                const themeLower = theme.toLowerCase();
                for (const [key, opp] of Object.entries(complaintOpps)) {
                    if (themeLower.includes(key) && !seenOpportunities.has(opp)) {
                        seenOpportunities.add(opp);
                        automationOpportunities.push({ opportunity: opp, priority: 'alta', source: 'ReclameAqui' });
                    }
                }
            }
        }

        automationOpportunities.sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.priority] || 1) - ({ alta: 0, media: 1, baixa: 2 }[b.priority] || 1));

        // ====================================================================
        //  PHASE 18: BUILD COMPANY DESCRIPTION
        // ====================================================================
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

        // ====================================================================
        //  PHASE 19: COMPILE ALL INSIGHTS
        // ====================================================================
        const insights = [];

        // Core facts
        if (foundingYear) insights.push(`Fundada em ${foundingYear} (~${2026 - foundingYear} anos)`);
        if (extractedEmployees) {
            const src = linkedinEmployees ? 'LinkedIn' : 'site';
            insights.push(`${extractedEmployees.toLocaleString('pt-BR')} colaboradores (fonte: ${src})`);
        }
        if (extractedRevenue) insights.push(`Faturamento declarado no site`);
        if (branchSignals >= 2) insights.push(`${branchSignals}+ unidades/escritórios detectados`);

        // CNPJ data
        if (cnpjData) {
            insights.push(`✅ CNPJ verificado na Receita Federal`);
            if (cnpjData.situacao) insights.push(`Situação cadastral: ${cnpjData.situacao}`);
            if (cnpjData.capital_social) {
                const cap = parseFloat(cnpjData.capital_social);
                if (cap >= 1000000) insights.push(`Capital social: R$ ${(cap / 1000000).toFixed(1)}M`);
                else if (cap >= 1000) insights.push(`Capital social: R$ ${Math.round(cap / 1000)}K`);
            }
            if (cnpjData.socios && cnpjData.socios.length > 0) {
                insights.push(`Sócios: ${cnpjData.socios.map(s => s.nome).join(', ')}`);
            }
        }

        // Digital presence
        const socialKeys = Object.keys(socialMedia);
        if (socialKeys.length > 0) {
            insights.push(`Presença digital: ${socialKeys.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}`);
        }

        // Infrastructure
        if (infraData.emailProvider !== 'Desconhecido') {
            insights.push(`📧 E-mail corporativo: ${infraData.emailProvider}`);
        }
        if (infraData.cdn) {
            insights.push(`🌐 Servidor/CDN: ${infraData.cdn}`);
        }
        if (infraData.securityScore >= 5) {
            insights.push(`🔒 Segurança web: Excelente (${infraData.securityScore}/10)`);
        } else if (infraData.securityScore >= 3) {
            insights.push(`⚠️ Segurança web: Moderada (${infraData.securityScore}/10)`);
        } else {
            insights.push(`🔴 Segurança web: Fraca (${infraData.securityScore}/10) — oportunidade de melhoria`);
        }

        // ReclameAqui
        if (reclameAquiData) {
            let raInsight = `📊 ReclameAqui:`;
            if (reclameAquiData.reputationLabel) raInsight += ` ${reclameAquiData.reputationLabel}`;
            if (reclameAquiData.score) raInsight += ` (${reclameAquiData.score}/10)`;
            if (reclameAquiData.complaints) raInsight += ` — ${reclameAquiData.complaints.toLocaleString('pt-BR')} reclamações`;
            insights.push(raInsight);
        }

        // Glassdoor
        if (glassdoorData) {
            let gdInsight = `👥 Glassdoor:`;
            if (glassdoorData.score) gdInsight += ` ${glassdoorData.score}/5`;
            if (glassdoorData.reviewCount) gdInsight += ` (${glassdoorData.reviewCount} avaliações)`;
            insights.push(gdInsight);
        }

        // Tech & clients counts
        if (techStack.length > 0) insights.push(`${techStack.length} tecnologias detectadas`);
        if (clients.length > 0) insights.push(`${clients.length} clientes/parceiros identificados`);

        // Google mentions
        if (googleMentions.length > 0) {
            insights.push(`${googleMentions.length} menções encontradas no Google`);
        }

        // ====================================================================
        //  FINAL RESPONSE — All data compiled
        // ====================================================================
        return new Response(JSON.stringify({
            success: true,
            domain: cleanDomain,
            companyName,
            title,
            description: description.substring(0, 300),
            companyDescription: companyDescription.substring(0, 600),
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
            automationOpportunities: automationOpportunities.slice(0, 20),
            // Deep analysis fields
            cnpjData,
            socialMedia,
            clients: clients.slice(0, 12),
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
            // NEW: External reputation data
            reclameAquiData,
            glassdoorData,
            infraData: {
                emailProvider: infraData.emailProvider,
                cdn: infraData.cdn,
                securityScore: infraData.securityScore,
                hasSSL: infraData.hasSSL,
                backend: infraData.backend || null,
            },
            googleMentions: googleMentions.slice(0, 5),
            hasWebsite: !!title,
            isEstimate: !extractedEmployees && !cnpjData,
            // Metadata
            sourcesQueried: [
                'Website (30+ páginas internas)',
                extractedCnpj ? 'Receita Federal (CNPJ)' : null,
                'DuckDuckGo Search',
                reclameAquiData ? 'ReclameAqui' : null,
                glassdoorData ? 'Glassdoor' : null,
                'DNS/MX Records (Google DNS)',
                'Security Headers Analysis',
                Object.keys(socialMedia).length > 0 ? 'Redes Sociais' : null,
                'JSON-LD/Schema.org',
                headerTech.length > 0 ? `Tech Stack (${headerTech.length} tecnologias)` : null,
            ].filter(Boolean),
        }), { status: 200, headers: cors });

    } catch (err) {
        console.error('Lookup error:', err.message, err.stack);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
    }
}

// ========= CNPJ VALIDATION =========
function validateCnpj(cnpj) {
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false;
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
