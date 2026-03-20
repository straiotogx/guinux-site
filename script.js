document.addEventListener('DOMContentLoaded',()=>{
    // Nav
    const nav=document.getElementById('nav'),burger=document.getElementById('burger'),links=document.getElementById('navLinks');
    window.addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>40),{passive:true});
    burger.addEventListener('click',()=>{burger.classList.toggle('open');links.classList.toggle('open');document.body.style.overflow=links.classList.contains('open')?'hidden':''});
    links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{burger.classList.remove('open');links.classList.remove('open');document.body.style.overflow=''}));
    document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const t=document.querySelector(a.getAttribute('href'));if(t){e.preventDefault();window.scrollTo({top:t.getBoundingClientRect().top+scrollY-nav.offsetHeight-20,behavior:'smooth'})}}));

    // Reveal
    const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){const sibs=e.target.parentElement.querySelectorAll('.reveal');let i=Array.from(sibs).indexOf(e.target);setTimeout(()=>e.target.classList.add('visible'),i*80);obs.unobserve(e.target)}}),{threshold:.1,rootMargin:'0px 0px -40px 0px'});
    document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

    // Terminal
    const term=document.getElementById('aiTerminal');
    if(term){let p=false;new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&!p){p=true;term.querySelectorAll('.tl').forEach(l=>setTimeout(()=>l.classList.add('visible'),+l.dataset.delay||0))}}),{threshold:.3}).observe(term)}

    // Hero prompt → open chat modal with welcome menu
    const heroPromptBox=document.getElementById('heroPromptBox');
    if(heroPromptBox){
        heroPromptBox.addEventListener('click',()=>openChat('welcome'));
    }

    // Chat modal controls
    const chatModal=document.getElementById('chatModal');
    const chatModalClose=document.getElementById('chatModalClose');
    const chatModalBackdrop=document.getElementById('chatModalBackdrop');
    if(chatModalClose) chatModalClose.addEventListener('click',closeChat);
    if(chatModalBackdrop) chatModalBackdrop.addEventListener('click',closeChat);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&chatModal.classList.contains('active'))closeChat()});

    // Chat tabs
    document.querySelectorAll('.chat-tab').forEach(tab=>{
        tab.addEventListener('click',()=>{
            document.querySelectorAll('.chat-tab').forEach(t=>t.classList.remove('active'));
            tab.classList.add('active');
            openChat(tab.dataset.flow);
        });
    });


    // Search
    const searchBtn=document.getElementById('navSearchBtn');
    const searchOverlay=document.getElementById('searchOverlay');
    const searchInput=document.getElementById('searchInput');
    const searchResults=document.getElementById('searchResults');
    const searchClose=document.getElementById('searchClose');
    let blogIndex=[];
    if(searchBtn){
        fetch('blog/index.json').then(r=>r.json()).then(data=>{blogIndex=data}).catch(()=>{});
        searchBtn.addEventListener('click',()=>{searchOverlay.classList.add('active');setTimeout(()=>searchInput.focus(),200)});
        searchClose.addEventListener('click',()=>{searchOverlay.classList.remove('active');searchInput.value='';searchResults.innerHTML=''});
        searchOverlay.addEventListener('click',e=>{if(e.target===searchOverlay){searchOverlay.classList.remove('active');searchInput.value='';searchResults.innerHTML=''}});
        document.addEventListener('keydown',e=>{if(e.key==='Escape'&&searchOverlay.classList.contains('active')){searchOverlay.classList.remove('active');searchInput.value='';searchResults.innerHTML=''}});
        searchInput.addEventListener('input',()=>{
            const q=searchInput.value.trim().toLowerCase();
            if(q.length<2){searchResults.innerHTML='';return}
            const results=blogIndex.filter(p=>p.title.toLowerCase().includes(q)||p.excerpt.toLowerCase().includes(q)||(p.tags||[]).some(t=>t.toLowerCase().includes(q)));
            if(results.length===0){searchResults.innerHTML='<div class="search-no-results">Nenhum resultado encontrado.</div>';return}
            searchResults.innerHTML=results.slice(0,10).map(p=>`<a class="search-result-item" href="blog/${p.slug}.html"><span class="search-tag">${p.category||'Blog'}</span><strong>${highlightMatch(p.title,q)}</strong><span>${highlightMatch(p.excerpt,q)}</span></a>`).join('');
        });
    }
    function highlightMatch(text,q){return text.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark>$1</mark>')}

    // Cases slider
    const cards=document.querySelectorAll('.case-card');
    const dots=document.querySelectorAll('.cases-dot');
    const prevBtn=document.getElementById('casesPrev');
    const nextBtn=document.getElementById('casesNext');
    let caseIdx=0;
    function showCase(i){
        cards.forEach(c=>c.classList.remove('active'));
        dots.forEach(d=>d.classList.remove('active'));
        caseIdx=((i%cards.length)+cards.length)%cards.length;
        cards[caseIdx].classList.add('active');
        dots[caseIdx].classList.add('active');
    }
    if(prevBtn) prevBtn.addEventListener('click',()=>showCase(caseIdx-1));
    if(nextBtn) nextBtn.addEventListener('click',()=>showCase(caseIdx+1));
    dots.forEach((d,i)=>d.addEventListener('click',()=>showCase(i)));
    setInterval(()=>showCase(caseIdx+1),6000);
});

/* ========= FLOW ENGINE ========= */

function esc(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML}

// Service names map
const SVC_NAMES={it_management:'Gestão de TI Completa',google_workspace:'Google Workspace com IA',ai_development:'IA Aplicada & Desenvolvimento',cto_service:'CTO as a Service'};

// Open chat modal
function openChat(flowId){
    const modal=document.getElementById('chatModal');
    // Fix Chrome iOS viewport height
    const setVh=()=>{modal.style.height=window.innerHeight+'px'};
    setVh();
    window.addEventListener('resize',setVh);
    modal._cleanVh=()=>window.removeEventListener('resize',setVh);
    modal.classList.add('active');
    document.body.style.overflow='hidden';
    document.body.style.position='fixed';
    document.body.style.width='100%';
    document.body.style.top=`-${window.scrollY}px`;
    // Update active tab
    document.querySelectorAll('.chat-tab').forEach(t=>{
        t.classList.toggle('active',t.dataset.flow===flowId);
    });
    // Init chat
    chatMsgs=document.getElementById('chatMessages');
    chatInput=document.getElementById('chatInput');
    chatMsgs.innerHTML='';
    chatInput.innerHTML='';
    chatInput.classList.add('active');
    chatData={};
    chatStep=0;
    currentFlow=flowId;

    if(flowId==='welcome'){
        setTimeout(()=>showWelcomeMenu(),300);
    } else {
        setTimeout(()=>processStep(),300);
    }
}

function closeChat(){
    const modal=document.getElementById('chatModal');
    if(modal._cleanVh) modal._cleanVh();
    modal.classList.remove('active');
    modal.style.height='';
    const scrollY=document.body.style.top;
    document.body.style.overflow='';
    document.body.style.position='';
    document.body.style.width='';
    document.body.style.top='';
    window.scrollTo(0,parseInt(scrollY||'0')*-1);
}

// Legacy alias
function startFlow(flowId){openChat(flowId)}

/* ========= WELCOME MENU ========= */
async function showWelcomeMenu(){
    await showTyping(400);
    addBotMsg('Olá! Sou a <strong>Guinux.IA</strong> — Como posso te ajudar?');
    await new Promise(r=>setTimeout(r,200));

    const cardsHtml=`
    <div class="welcome-cards">
        <button class="welcome-card" onclick="switchFlow('analise')">
            <div class="welcome-card-icon">🔍</div>
            <div class="welcome-card-content">
                <strong>Análise & Proposta Inteligente</strong>
                <span>Diagnóstico + cotação sob medida — pesquisamos sua empresa com IA</span>
            </div>
            <div class="welcome-card-arrow">→</div>
        </button>
        <button class="welcome-card" onclick="switchFlow('faq')">
            <div class="welcome-card-icon">💬</div>
            <div class="welcome-card-content">
                <strong>Dúvidas Frequentes</strong>
                <span>Serviços, preços, atendimento e tecnologias</span>
            </div>
            <div class="welcome-card-arrow">→</div>
        </button>
    </div>`;
    addRawMsg(cardsHtml);
    chatInput.innerHTML='';
    chatInput.classList.remove('active');
}

function switchFlow(flowId){
    document.querySelectorAll('.chat-tab').forEach(t=>{
        t.classList.toggle('active',t.dataset.flow===flowId);
    });
    chatMsgs.innerHTML='';
    chatInput.innerHTML='';
    chatInput.classList.add('active');
    chatData={};
    chatStep=0;
    currentFlow=flowId;
    processStep();
}

/* ========= FAQ FLOW ========= */
const FAQ_DATA=[
    {q:'O que a Guinux faz?',a:'A Guinux é uma empresa de tecnologia com mais de 23 anos de experiência. Oferecemos 4 pilares: <strong>Gestão de TI Completa</strong> (outsourcing), <strong>Google Workspace com IA Gemini</strong>, <strong>IA Aplicada & Desenvolvimento</strong> (portais, dashboards, automação) e <strong>CTO as a Service</strong>. Somos Google Cloud Partner desde 2013.'},
    {q:'Quanto custa os serviços?',a:'Os valores dependem do porte da sua empresa e dos serviços necessários. O melhor caminho é fazer uma <strong>Análise & Proposta Inteligente</strong> — nossa IA pesquisa sua empresa e gera uma proposta personalizada em tempo real!'},
    {q:'Vocês atendem fora de Curitiba?',a:'Sim! Atendemos empresas em todo o Brasil de forma remota. Para Curitiba e região, também oferecemos atendimento presencial. Nossos clientes vão de startups a organizações com mais de 90 mil usuários como a OAB Paraná.'},
    {q:'Como funciona o suporte?',a:'Nosso Help Desk opera com SLA garantido, monitoramento proativo 24/7 e equipe dedicada. Canal direto, sem filas, sem burocracia. Relatórios transparentes periódicos.'},
    {q:'O que é CTO as a Service?',a:'Liderança tecnológica experiente na sua empresa sem custo de C-level fixo. Estratégia, roadmap de inovação, governança e compliance. Nosso CEO, Guilherme Straioto, atua como CTO da OAB Paraná neste modelo.'},
    {q:'Vocês trabalham com IA?',a:'Sim! IA é um dos nossos pilares principais. Desenvolvemos <strong>portais com IA integrada</strong>, dashboards inteligentes, automação de processos (RPA + AI), chatbots corporativos e monitoramento de produtividade com <strong>Gemini e Claude AI</strong>.'},
];

const FLOW_FAQ=[
    {id:'faq_greeting',type:'auto',msgs:['Certo! Veja as perguntas mais comuns:']},
    {id:'faq_choice',type:'faq_pills'},
];

/* ========= ANÁLISE UNIFICADA (Diagnóstico + Cotação) ========= */
const FLOW_ANALISE=[
    {id:'greeting',type:'auto',msgs:['Vou fazer uma análise completa da sua empresa com IA.','Preciso de poucas informações — e o resultado vai te impressionar.']},
    {id:'name',type:'text',msgs:['Qual é o seu nome?'],ph:'Seu nome...'},
    {id:'email',type:'text',msgs:d=>[`Prazer, ${esc(d.name.split(' ')[0])}! Informe seu <strong>e-mail corporativo</strong> — vou pesquisar sobre sua empresa.`],ph:'seu@empresa.com.br'},
    {id:'phone',type:'text',msgs:d=>[`Qual seu <strong>telefone</strong> com DDD? (WhatsApp de preferência)`],ph:'(41) 99999-9999'},
    {id:'company_lookup',type:'company_lookup'},
    {id:'needs',type:'multi',msgs:d=>[`O que mais interessa para a <strong>${esc(d.company)}</strong>? (selecione todos)`],opts:[
        {l:'Gestão de TI / Suporte',v:'suporte'},
        {l:'Google Workspace com IA',v:'google'},
        {l:'Portais corporativos com IA',v:'portal'},
        {l:'IA personalizada para a empresa',v:'ia'},
        {l:'Dashboards com IA',v:'dashboards'},
        {l:'Automação inteligente',v:'automacao'},
        {l:'Monitoramento de produtividade',v:'monitoramento'},
        {l:'Otimização de equipe com IA',v:'rh_ia'},
        {l:'CTO / Liderança tech',v:'cto'}
    ]},
    {id:'it_status',type:'pills',msgs:d=>[`Agora sobre a TI da ${esc(d.company)}: como funciona hoje?`],opts:[{l:'Não temos equipe de TI',v:'none'},{l:'TI interna própria',v:'internal'},{l:'Terceirizada (insatisfeito)',v:'outsourced'},{l:'Modelo híbrido',v:'hybrid'}]},
    {id:'infra',type:'pills',msgs:['Onde ficam seus servidores e dados?'],opts:[{l:'Servidores físicos locais',v:'onprem'},{l:'Tudo na nuvem',v:'cloud'},{l:'Híbrido (local + nuvem)',v:'hybrid'},{l:'Não sei ao certo',v:'unknown'}]},
    {id:'repetitive_tasks',type:'pills',msgs:d=>[`Na ${esc(d.company)}, existem tarefas manuais e repetitivas que consomem tempo?`],opts:[{l:'Sim, muitas!',v:'many'},{l:'Algumas',v:'some'},{l:'Poucas',v:'few'},{l:'Não sei',v:'unknown'}]},
    {id:'repetitive_examples',type:'multi',msgs:d=>{
        if(d.repetitive_tasks==='many'||d.repetitive_tasks==='some') return['Quais tipos mais se repetem?'];
        return['Qual área consome mais tempo da equipe?'];
    },opts:[{l:'Relatórios / Planilhas',v:'reports'},{l:'Atendimento ao cliente',v:'support'},{l:'Aprovações / Fluxos',v:'approvals'},{l:'Entrada de dados',v:'data_entry'},{l:'Financeiro / Folha',v:'finance'},{l:'Documentos / Contratos',v:'docs'},{l:'RH / Recrutamento',v:'rh'}]},
    {id:'ai_usage',type:'pills',msgs:['A empresa usa Inteligência Artificial hoje?'],opts:[{l:'Não utilizamos',v:'none'},{l:'ChatGPT / Gemini individual',v:'basic'},{l:'Uso sem padrão',v:'scattered'},{l:'Já temos IA integrada',v:'optimize'}]},
    {id:'tools',type:'multi',msgs:['Quais ferramentas usam? (selecione todas)'],opts:[{l:'Google Workspace',v:'google'},{l:'Microsoft 365',v:'microsoft'},{l:'ERP',v:'erp'},{l:'CRM',v:'crm'},{l:'IA (ChatGPT, Gemini, etc)',v:'ai_tools'},{l:'Nenhuma dessas',v:'none'}]},
    {id:'satisfaction',type:'stars',msgs:['De 1 a 5, satisfação com a TI atual?']},
    {id:'biggest_pain',type:'text',msgs:['Última: qual o maior problema de TI que te incomoda hoje?'],ph:'Ex: "internet cai", "perco tempo com planilhas"...',optional:true},
    {id:'analise_result',type:'analise_end'},
];

/* ========= CHAT ENGINE ========= */
let chatData={},chatStep=0,chatMsgs,chatInput,currentFlow='welcome';

function getFlowSteps(){
    if(currentFlow==='faq') return FLOW_FAQ;
    if(currentFlow==='analise') return FLOW_ANALISE;
    return FLOW_ANALISE; // fallback
}

async function processStep(){
    const steps=getFlowSteps();
    if(chatStep>=steps.length) return;
    const q=steps[chatStep];

    // Special types
    if(q.type==='faq_pills'){
        await showTyping(400);
        renderFaqPills();
        return;
    }
    if(q.type==='analise_end'){
        await generateAnalise();
        return;
    }
    if(q.type==='company_lookup'){
        await handleCompanyLookup();
        return;
    }

    const msgs=typeof q.msgs==='function'?q.msgs(chatData):q.msgs;
    for(const m of msgs){
        await showTyping(400+Math.random()*400);
        addBotMsg(m);
    }
    if(q.type==='auto'){
        chatStep++;
        setTimeout(()=>processStep(),800);
        return;
    }
    renderInput(q);
}

function showTyping(ms){
    return new Promise(resolve=>{
        const el=document.createElement('div');
        el.className='msg msg-bot msg-typing';
        el.innerHTML='<div class="msg-avatar">G</div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
        chatMsgs.appendChild(el);
        scrollChat();
        setTimeout(()=>{el.remove();resolve()},ms);
    });
}

function showProcessingMsg(text){
    const el=document.createElement('div');
    el.className='msg msg-bot msg-processing';
    el.innerHTML=`<div class="msg-avatar">G</div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div> <span class="processing-text">${text}</span></div>`;
    chatMsgs.appendChild(el);
    scrollChat();
    return el;
}

function addBotMsg(text){
    const el=document.createElement('div');
    el.className='msg msg-bot';
    el.innerHTML=`<div class="msg-avatar">G</div><div class="msg-bubble">${text}</div>`;
    chatMsgs.appendChild(el);
    scrollChat();
}

function addUserMsg(text){
    const el=document.createElement('div');
    el.className='msg msg-user';
    el.innerHTML=`<div class="msg-bubble">${esc(text)}</div>`;
    chatMsgs.appendChild(el);
    scrollChat();
}

function addRawMsg(html){
    const el=document.createElement('div');
    el.className='msg msg-bot';
    el.innerHTML=`<div class="msg-avatar">G</div><div style="flex:1;min-width:0">${html}</div>`;
    chatMsgs.appendChild(el);
    scrollChat();
}

function scrollChat(){requestAnimationFrame(()=>{chatMsgs.scrollTop=chatMsgs.scrollHeight;const last=chatMsgs.lastElementChild;if(last)last.scrollIntoView({behavior:'smooth',block:'end'})})}

/* ========= FAQ RENDERER ========= */
function renderFaqPills(){
    chatInput.innerHTML='';
    const wrap=document.createElement('div');
    wrap.className='ci-pills';
    wrap.style.flexDirection='column';
    FAQ_DATA.forEach((faq,i)=>{
        const btn=document.createElement('button');
        btn.className='ci-pill';btn.textContent=faq.q;
        btn.style.textAlign='left';
        btn.addEventListener('click',async()=>{
            addUserMsg(faq.q);
            chatInput.innerHTML='';
            await showTyping(600+Math.random()*400);
            addBotMsg(faq.a);
            await showTyping(400);
            addBotMsg('Tem outra dúvida? Ou quer explorar mais?');
            renderFaqFollowUp();
        });
        wrap.appendChild(btn);
    });
    chatInput.appendChild(wrap);
}

function renderFaqFollowUp(){
    chatInput.innerHTML='';
    const wrap=document.createElement('div');
    wrap.className='ci-pills';
    const moreBtn=document.createElement('button');
    moreBtn.className='ci-pill';moreBtn.textContent='Ver mais perguntas';
    moreBtn.addEventListener('click',()=>{chatInput.innerHTML='';renderFaqPills()});
    const analiseBtn=document.createElement('button');
    analiseBtn.className='ci-pill';analiseBtn.style.borderColor='var(--teal)';analiseBtn.style.color='var(--teal)';
    analiseBtn.textContent='Análise & Proposta Inteligente →';
    analiseBtn.addEventListener('click',()=>switchFlow('analise'));
    wrap.appendChild(moreBtn);wrap.appendChild(analiseBtn);
    chatInput.appendChild(wrap);
}

/* ========= INPUT RENDERER ========= */
function renderInput(q){
    chatInput.innerHTML='';
    if(q.type==='text'){
        const wrap=document.createElement('div');
        wrap.className='ci-text';
        const inp=document.createElement('input');
        inp.type='text';inp.placeholder=q.ph||'';inp.autocomplete='off';
        const btn=document.createElement('button');
        btn.className='ci-send';
        btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
        const submit=()=>{
            const v=inp.value.trim();
            if(!v&&!q.optional)return;
            addUserMsg(v||'(pular)');
            chatData[q.id]=v||'';
            chatStep++;chatInput.innerHTML='';
            setTimeout(()=>processStep(),400);
        };
        btn.addEventListener('click',submit);
        inp.addEventListener('keydown',e=>{if(e.key==='Enter')submit()});
        wrap.appendChild(inp);wrap.appendChild(btn);
        if(q.optional){
            const skip=document.createElement('button');
            skip.className='ci-skip';skip.textContent='Pular →';
            skip.addEventListener('click',()=>{addUserMsg('(pular)');chatData[q.id]='';chatStep++;chatInput.innerHTML='';setTimeout(()=>processStep(),400)});
            chatInput.appendChild(wrap);chatInput.appendChild(skip);
        }else{
            chatInput.appendChild(wrap);
        }
        setTimeout(()=>{inp.focus();scrollChat()},100);
    }
    else if(q.type==='pills'){
        const wrap=document.createElement('div');
        wrap.className='ci-pills';
        q.opts.forEach(o=>{
            const btn=document.createElement('button');
            btn.className='ci-pill';btn.textContent=o.l;
            btn.addEventListener('click',()=>{
                addUserMsg(o.l);
                chatData[q.id]=o.v;
                if(o.tier) chatData.tier=o.tier;
                chatStep++;chatInput.innerHTML='';
                setTimeout(()=>processStep(),400);
            });
            wrap.appendChild(btn);
        });
        chatInput.appendChild(wrap);
    }
    else if(q.type==='multi'){
        const sel=new Set();
        const wrap=document.createElement('div');
        wrap.className='ci-pills';
        q.opts.forEach(o=>{
            const btn=document.createElement('button');
            btn.className='ci-pill';btn.textContent=o.l;
            btn.addEventListener('click',()=>{
                if(sel.has(o.v)){sel.delete(o.v);btn.classList.remove('selected')}
                else{sel.add(o.v);btn.classList.add('selected')}
                conf.style.display=sel.size?'inline-block':'none';
            });
            wrap.appendChild(btn);
        });
        const conf=document.createElement('button');
        conf.className='ci-confirm';conf.textContent='Confirmar seleção →';conf.style.display='none';
        conf.addEventListener('click',()=>{
            const labels=q.opts.filter(o=>sel.has(o.v)).map(o=>o.l);
            addUserMsg(labels.join(', '));
            chatData[q.id]=[...sel];
            chatStep++;chatInput.innerHTML='';
            setTimeout(()=>processStep(),400);
        });
        chatInput.appendChild(wrap);chatInput.appendChild(conf);
    }
    else if(q.type==='stars'){
        const wrap=document.createElement('div');
        wrap.className='ci-stars';
        for(let i=1;i<=5;i++){
            const btn=document.createElement('button');
            btn.className='ci-star';btn.textContent='★';btn.dataset.v=i;
            btn.addEventListener('mouseenter',()=>{
                wrap.querySelectorAll('.ci-star').forEach(s=>{s.classList.toggle('active',+s.dataset.v<=i)});
            });
            btn.addEventListener('click',()=>{
                addUserMsg('★'.repeat(i)+' ('+i+'/5)');
                chatData[q.id]=i;
                chatStep++;chatInput.innerHTML='';
                setTimeout(()=>processStep(),400);
            });
            wrap.appendChild(btn);
        }
        chatInput.appendChild(wrap);
    }
}

/* ========= COMPANY LOOKUP ========= */
async function handleCompanyLookup(){
    const email=chatData.email||'';
    const domain=email.split('@')[1]||'';
    if(!domain||domain.includes('gmail')||domain.includes('hotmail')||domain.includes('yahoo')||domain.includes('outlook')){
        // Personal email — ask company name manually
        await showTyping(500);
        addBotMsg('Parece ser um e-mail pessoal. Sem problemas! Me diga o nome da sua empresa:');
        chatInput.innerHTML='';
        const wrap=document.createElement('div');wrap.className='ci-text';
        const inp=document.createElement('input');inp.type='text';inp.placeholder='Nome da empresa...';inp.autocomplete='off';
        const btn=document.createElement('button');btn.className='ci-send';
        btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
        const submit=()=>{
            const v=inp.value.trim();if(!v)return;
            addUserMsg(v);
            chatData.company=v;
            chatData.employees='25-50';
            chatData.segment='outro';
            chatData.companyResearch={hasWebsite:false,segment:'outro',segmentLabel:'',sizeEstimate:'media',employeeEstimate:'25-50',revenueEstimate:'R$ 2M – R$ 10M/ano'};
            chatStep++;chatInput.innerHTML='';
            setTimeout(()=>processStep(),400);
        };
        btn.addEventListener('click',submit);
        inp.addEventListener('keydown',e=>{if(e.key==='Enter')submit()});
        wrap.appendChild(inp);wrap.appendChild(btn);
        chatInput.appendChild(wrap);
        setTimeout(()=>inp.focus(),100);
        return;
    }

    // Corporate email — research the company silently
    await showTyping(400);

    const processingEl=showProcessingMsg('Pesquisando sua empresa…');

    try{
        // Try fetching the site HTML from the browser (bypasses Cloudflare challenges)
        let clientHtml='';
        try{
            const siteRes=await fetch(`https://${domain}`,{mode:'no-cors'}).catch(()=>null);
            // no-cors gives opaque response, try cors first
            const corsRes=await fetch(`https://${domain}`,{mode:'cors',redirect:'follow',signal:AbortSignal.timeout(6000)}).catch(()=>null);
            if(corsRes&&corsRes.ok) clientHtml=await corsRes.text().catch(()=>'');
        }catch(e){/* browser fetch failed, worker will try */}

        const res=await fetch('/api/lookup-company',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({domain, companyName:chatData.company||'', html:clientHtml})
        });
        processingEl.remove();
        const data=await res.json();

        if(data.success&&data.companyName){
            chatData.company=data.companyName;
            chatData.companyResearch=data;

            await showTyping(600);
            // Show company info card with estimate label
            const srcLabel=data.isEstimate?'estimativa baseada em dados públicos':data.cnpjData?'dados da Receita Federal + site':'dados extraídos do site';
            let cardHtml=`<div class="company-lookup-card">`;
            cardHtml+=`<div class="clc-header"><span class="clc-icon">🏢</span><strong>${esc(data.companyName)}</strong></div>`;
            cardHtml+=`<div class="clc-details">`;
            if(data.cnpjData&&data.cnpjData.razao_social) cardHtml+=`<span class="clc-tag">📄 ${esc(data.cnpjData.razao_social)}</span>`;
            if(data.cnpjData&&data.cnpjData.cnpj) cardHtml+=`<span class="clc-tag">🔢 CNPJ: ${esc(data.cnpjData.cnpj)}</span>`;
            if(data.segmentLabel) cardHtml+=`<span class="clc-tag">📌 ${esc(data.segmentLabel)}</span>`;
            if(data.cnpjData&&data.cnpjData.atividade_principal) cardHtml+=`<span class="clc-tag">🏭 ${esc(data.cnpjData.atividade_principal.substring(0,80))}</span>`;
            cardHtml+=`<span class="clc-tag">👥 ~${esc(data.employeeEstimate)} colaboradores</span>`;
            cardHtml+=`<span class="clc-tag">💰 ${esc(data.revenueEstimate)}</span>`;
            if(data.cnpjData&&data.cnpjData.capital_social){const cap=parseFloat(data.cnpjData.capital_social);if(cap>=1000) cardHtml+=`<span class="clc-tag">💼 Capital: R$ ${cap>=1000000?(cap/1000000).toFixed(1)+'M':Math.round(cap/1000)+'K'}</span>`;}
            if(data.foundingYear) cardHtml+=`<span class="clc-tag">📅 Desde ${data.foundingYear} (~${2026-data.foundingYear} anos)</span>`;
            if(data.cnpjData&&data.cnpjData.municipio) cardHtml+=`<span class="clc-tag">📍 ${esc(data.cnpjData.municipio)}${data.cnpjData.uf?'-'+data.cnpjData.uf:''}</span>`;
            if(data.cnpjData&&data.cnpjData.situacao) cardHtml+=`<span class="clc-tag">${data.cnpjData.situacao==='ATIVA'?'✅':'⚠️'} ${esc(data.cnpjData.situacao)}</span>`;
            if(data.cnpjData&&data.cnpjData.porte) cardHtml+=`<span class="clc-tag">📊 Porte: ${esc(data.cnpjData.porte)}</span>`;
            if(data.socialMedia&&Object.keys(data.socialMedia).length>0){
                const smIcons={linkedin:'🔗',instagram:'📷',facebook:'👥',youtube:'🎬',twitter:'🐦',github:'💻',tiktok:'🎵'};
                Object.keys(data.socialMedia).forEach(sm=>{cardHtml+=`<span class="clc-tag">${smIcons[sm]||'🌐'} ${sm.charAt(0).toUpperCase()+sm.slice(1)}</span>`});
            }
            if(data.clients&&data.clients.length>0) cardHtml+=`<span class="clc-tag">🤝 ${data.clients.length} clientes/parceiros detectados</span>`;
            if(data.headerTech&&data.headerTech.length>0) cardHtml+=`<span class="clc-tag">💻 ${data.headerTech.length} tecnologias no site</span>`;
            if(data.insights&&data.insights.length>0){
                data.insights.filter(ins=>!ins.includes('CNPJ')&&!ins.includes('Capital')&&!ins.includes('ATIVA')&&!ins.includes('Presença digital')&&!ins.includes('tecnologias')).forEach(ins=>{cardHtml+=`<span class="clc-tag">ℹ️ ${esc(ins)}</span>`});
            }
            if(data.companyDescription) cardHtml+=`<p class="clc-desc">${esc(data.companyDescription.substring(0,250))}${data.companyDescription.length>250?'...':''}</p>`;
            else if(data.description) cardHtml+=`<p class="clc-desc">${esc(data.description.substring(0,180))}${data.description.length>180?'...':''}</p>`;
            cardHtml+=`<p class="clc-source">📊 Fonte: ${srcLabel}</p>`;
            cardHtml+=`</div></div>`;
            addRawMsg(cardHtml);

            await showTyping(400);
            addBotMsg(`Esses dados estão corretos? ${data.isEstimate?'<em>(são estimativas — corrija se souber os dados reais)</em>':''}`);

            // Confirm / Correct Employee Count / Correct Name buttons
            chatInput.innerHTML='';
            const wrap=document.createElement('div');wrap.className='ci-pills';wrap.style.flexDirection='column';

            const confirmBtn=document.createElement('button');
            confirmBtn.className='ci-pill';confirmBtn.textContent=`✅ Sim, está correto`;
            confirmBtn.addEventListener('click',()=>{
                addUserMsg('Dados corretos!');
                chatData.employees=data.employeeEstimate;
                chatData.segment=data.segment;
                chatStep++;chatInput.innerHTML='';
                setTimeout(()=>processStep(),400);
            });

            const correctDataBtn=document.createElement('button');
            correctDataBtn.className='ci-pill';correctDataBtn.textContent='✏️ Corrigir dados (funcionários / faturamento)';
            correctDataBtn.addEventListener('click',()=>{
                chatInput.innerHTML='';
                // Show correction form
                const formWrap=document.createElement('div');formWrap.className='clc-correct-form';

                const nameRow=document.createElement('div');nameRow.className='clc-form-row';
                const nameLabel=document.createElement('label');nameLabel.textContent='Nome da empresa:';
                const nameInp=document.createElement('input');nameInp.type='text';nameInp.value=data.companyName;nameInp.placeholder='Nome da empresa';
                nameRow.appendChild(nameLabel);nameRow.appendChild(nameInp);

                const empRow=document.createElement('div');empRow.className='clc-form-row';
                const empLabel=document.createElement('label');empLabel.textContent='Nº de colaboradores:';
                const empInp=document.createElement('input');empInp.type='text';empInp.value=data.extractedEmployees||'';empInp.placeholder='Ex: 300';
                empRow.appendChild(empLabel);empRow.appendChild(empInp);

                const revRow=document.createElement('div');revRow.className='clc-form-row';
                const revLabel=document.createElement('label');revLabel.textContent='Faturamento anual (R$):';
                const revInp=document.createElement('input');revInp.type='text';revInp.value='';revInp.placeholder='Ex: 90 milhões, 5M, 500K';
                revRow.appendChild(revLabel);revRow.appendChild(revInp);

                const submitBtn=document.createElement('button');submitBtn.className='ci-confirm';submitBtn.textContent='Confirmar dados →';submitBtn.style.display='block';submitBtn.style.marginTop='.5rem';
                submitBtn.addEventListener('click',()=>{
                    const cName=nameInp.value.trim()||data.companyName;
                    const cEmp=empInp.value.trim();
                    const cRev=revInp.value.trim();

                    // Parse employee count
                    let empEst=data.employeeEstimate;
                    if(cEmp){
                        const num=parseInt(cEmp.replace(/[^\d]/g,''));
                        if(num>0){
                            chatData.companyResearch.extractedEmployees=num;
                            if(num<15) empEst='~'+num;
                            else if(num<30) empEst='15-30';
                            else if(num<60) empEst='30-60';
                            else if(num<100) empEst='60-100';
                            else if(num<200) empEst='100-200';
                            else if(num<500) empEst='200-500';
                            else if(num<1000) empEst='500-1.000';
                            else empEst=Math.round(num/1000)+'K+';
                            chatData.companyResearch.employeeEstimate=empEst;
                            // Update size estimate
                            if(num<15) chatData.companyResearch.sizeEstimate='micro';
                            else if(num<50) chatData.companyResearch.sizeEstimate='pequena';
                            else if(num<150) chatData.companyResearch.sizeEstimate='media';
                            else if(num<500) chatData.companyResearch.sizeEstimate='media_grande';
                            else chatData.companyResearch.sizeEstimate='grande';
                        }
                    }

                    // Parse revenue
                    if(cRev){
                        let revText=cRev.toLowerCase();
                        let revNum=parseFloat(revText.replace(/[^\d.,]/g,'').replace(',','.'));
                        if(revText.match(/bilh|bi\b|b\b/i)) revText='R$ '+(revNum>=1?revNum.toFixed(1)+'B':'R$ '+Math.round(revNum*1000)+'M')+'/ano';
                        else if(revText.match(/milh|mi\b|m\b/i)) revText='R$ '+Math.round(revNum)+'M/ano';
                        else if(revText.match(/mil|k\b/i)) revText='R$ '+Math.round(revNum)+'K/ano';
                        else if(revNum>1000000) revText='R$ '+Math.round(revNum/1000000)+'M/ano';
                        else if(revNum>1000) revText='R$ '+Math.round(revNum/1000)+'K/ano';
                        else revText='R$ '+cRev+'/ano';
                        chatData.companyResearch.revenueEstimate=revText;
                    }

                    addUserMsg(`${cName} — ${empEst} colab. — ${chatData.companyResearch.revenueEstimate}`);
                    chatData.company=cName;
                    chatData.employees=empEst;
                    chatData.segment=data.segment;
                    chatStep++;chatInput.innerHTML='';
                    setTimeout(()=>processStep(),400);
                });

                // Segment correction row
                const segRow=document.createElement('div');segRow.className='clc-form-row';
                const segLabel2=document.createElement('label');segLabel2.textContent='Segmento da empresa:';
                const segSel=document.createElement('select');
                const segOptions=[
                    {v:'juridico',l:'Advocacia / Jurídico'},{v:'saude',l:'Saúde'},{v:'contabil',l:'Contabilidade'},
                    {v:'tecnologia',l:'Tecnologia'},{v:'industria',l:'Indústria'},{v:'varejo',l:'Varejo / Comércio'},
                    {v:'financeiro',l:'Financeiro / Seguros'},{v:'imobiliario',l:'Imobiliário / Construção'},
                    {v:'educacao',l:'Educação'},{v:'logistica',l:'Logística / Transporte'},{v:'agro',l:'Agronegócio'},
                    {v:'marketing',l:'Marketing / Publicidade'},{v:'engenharia',l:'Engenharia'},
                    {v:'servicos',l:'Serviços / Consultoria'},{v:'alimenticio',l:'Alimentício'},{v:'outro',l:'Outro'},
                ];
                segOptions.forEach(o=>{const opt=document.createElement('option');opt.value=o.v;opt.textContent=o.l;if(o.v===data.segment)opt.selected=true;segSel.appendChild(opt);});
                segRow.appendChild(segLabel2);segRow.appendChild(segSel);

                formWrap.appendChild(nameRow);formWrap.appendChild(empRow);formWrap.appendChild(revRow);formWrap.appendChild(segRow);formWrap.appendChild(submitBtn);
                chatInput.appendChild(formWrap);

                // Patch submitBtn click to also capture segment (fires after main handler)
                submitBtn.addEventListener('click',()=>{
                    const chosenSeg=segSel.value;
                    const chosenSegLabel=segOptions.find(o=>o.v===chosenSeg)?.l||'';
                    chatData.companyResearch.segment=chosenSeg;
                    chatData.companyResearch.segmentLabel=chosenSegLabel;
                    chatData.segment=chosenSeg;
                });

                setTimeout(()=>nameInp.focus(),100);
            });

            wrap.appendChild(confirmBtn);wrap.appendChild(correctDataBtn);
            chatInput.appendChild(wrap);
        } else {
            throw new Error('No data');
        }
    }catch(err){
        processingEl.remove();
        // Lookup failed — ask manually
        await showTyping(400);
        addBotMsg('Não consegui encontrar dados automáticos. Me diga o nome da sua empresa:');
        chatInput.innerHTML='';
        const wrap=document.createElement('div');wrap.className='ci-text';
        const inp=document.createElement('input');inp.type='text';inp.placeholder='Nome da empresa...';inp.autocomplete='off';
        const btn=document.createElement('button');btn.className='ci-send';
        btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
        const submit=()=>{
            const v=inp.value.trim();if(!v)return;
            addUserMsg(v);
            chatData.company=v;
            chatData.employees='50-150';
            chatData.segment='outro';
            chatData.companyResearch={hasWebsite:false,segment:'outro',segmentLabel:'',sizeEstimate:'media',employeeEstimate:'50-150',revenueEstimate:'R$ 10M – R$ 30M/ano'};
            chatStep++;chatInput.innerHTML='';
            setTimeout(()=>processStep(),400);
        };
        btn.addEventListener('click',submit);
        inp.addEventListener('keydown',e=>{if(e.key==='Enter')submit()});
        wrap.appendChild(inp);wrap.appendChild(btn);
        chatInput.appendChild(wrap);
        setTimeout(()=>inp.focus(),100);
    }
}

/* ========= ANÁLISE UNIFICADA GENERATOR ========= */
async function generateAnalise(){
    chatInput.innerHTML='';chatInput.classList.remove('active');
    const d=chatData;
    const name=esc((d.name||'').split(' ')[0])||'Cliente';
    const company=esc(d.company||'sua empresa');
    const cr=d.companyResearch||{};

    // Dramatic AI analysis sequence
    await showTyping(600);
    addBotMsg(`${name}, iniciando análise profunda da ${company} com IA...`);
    await showTyping(1200);
    if(cr.cnpjData){
        addBotMsg(`🔍 Dados da Receita Federal obtidos — cruzando com informações do site e mercado...`);
    } else {
        addBotMsg(`🔍 Cruzando dados do site, segmento e mercado...`);
    }
    await showTyping(1500);
    const segL=cr.segmentLabel||'seu segmento';
    if(cr.cnpjData&&cr.cnpjData.atividade_principal){
        addBotMsg(`🏭 Atividade principal: <strong>${esc(cr.cnpjData.atividade_principal.substring(0,80))}</strong>`);
        await showTyping(800);
    }
    const compSvcs=(cr.companyServices||[]).slice(0,3);
    if(compSvcs.length>0){
        addBotMsg(`📋 Serviços identificados: <strong>${compSvcs.join(', ')}</strong>`);
        await showTyping(1000);
    }
    if(cr.headerTech&&cr.headerTech.length>0){
        addBotMsg(`💻 ${cr.headerTech.length} tecnologias detectadas no site: <strong>${cr.headerTech.slice(0,4).map(t=>typeof t==='string'?t:t.name).join(', ')}${cr.headerTech.length>4?'...':''}</strong>`);
        await showTyping(800);
    }
    if(cr.socialMedia&&Object.keys(cr.socialMedia).length>0){
        addBotMsg(`🌐 Presença digital: <strong>${Object.keys(cr.socialMedia).map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(', ')}</strong>`);
        await showTyping(600);
    }
    addBotMsg(`🧠 Calculando riscos, maturidade digital e potencial de automação para ${segL}...`);
    await showTyping(1800);
    const autoOps=(cr.automationOpportunities||[]).slice(0,2);
    if(autoOps.length>0){
        addBotMsg(`⚡ Oportunidades de automação detectadas: <strong>${autoOps.join(' · ')}</strong>`);
        await showTyping(1200);
    }
    const dataSources=[];
    if(cr.cnpjData) dataSources.push('Receita Federal');
    dataSources.push('site da empresa');
    if(cr.foundingYear) dataSources.push(`${2026-cr.foundingYear} anos de história`);
    addBotMsg(`📊 Gerando proposta personalizada com base em ${dataSources.join(', ')}...`);
    await showTyping(1400);
    addBotMsg('✅ <strong>Análise concluída!</strong> Veja o resultado:');
    await new Promise(r=>setTimeout(r,500));

    // Calculations
    const risk=calcRisk(d);
    const pot=calcPotential(d);
    const maturity=calcMaturity(d);
    const segment=cr.segment||'outro';
    const segmentLabel=cr.segmentLabel||'';
    const sizeEstimate=cr.sizeEstimate||'media';
    const employeeEstimate=cr.employeeEstimate||'25-50';
    const revenueEstimate=cr.revenueEstimate||'R$ 2M – R$ 10M/ano';
    const repTasks=d.repetitive_tasks||'unknown';
    const repExamples=d.repetitive_examples||'';
    const companyServices=cr.companyServices||[];
    const rawTech=cr.techStack||[];
    const techStack=rawTech.map(t=>typeof t==='string'?t:t.name||t).filter(Boolean);
    const operationalKw=cr.operationalKeywords||[];
    const rawDigital=cr.digitalMaturitySignals||[];
    const digitalSignals=rawDigital.map(s=>typeof s==='string'?s:s.signal||s).filter(Boolean);
    const rawAutoOpps=cr.automationOpportunities||[];
    const autoOpps=rawAutoOpps.map(a=>typeof a==='string'?a:a.opportunity||a).filter(Boolean);

    // ====== INTELLIGENT HOURS CALCULATION ======
    // Parse actual employee count from estimate range
    const empParseMap={'~5':5,'5-15':10,'15-30':22,'15-50':35,'25-50':40,'30-60':45,'50-100':75,'50-150':100,'60-100':80,'100-200':150,'100+':200,'150-500':300,'200-500':350,'500-1.000':700,'500+':700};
    let empCount=30;
    Object.keys(empParseMap).forEach(k=>{if(employeeEstimate.includes(k)||employeeEstimate===k) empCount=empParseMap[k]});
    if(cr.extractedEmployees) empCount=cr.extractedEmployees;

    // Base hours per employee per month that can be automated
    let baseHoursPerEmp=1.5; // conservative default
    // Adjust based on task repetitiveness
    if(repTasks==='many') baseHoursPerEmp=3.5;
    else if(repTasks==='some') baseHoursPerEmp=2.2;
    else if(repTasks==='few') baseHoursPerEmp=1.0;

    // Adjust based on current IT/AI maturity (less mature = more room)
    if(d.it_status==='none') baseHoursPerEmp*=1.4;
    else if(d.it_status==='outsourced') baseHoursPerEmp*=1.2;
    if(d.ai_usage==='none') baseHoursPerEmp*=1.3;
    else if(d.ai_usage==='basic'||d.ai_usage==='scattered') baseHoursPerEmp*=1.15;

    // Segment multiplier (some segments have more automatable processes)
    const segHoursMult={juridico:1.4,contabil:1.5,financeiro:1.3,industria:1.2,saude:1.2,varejo:1.1,servicos:1.3,educacao:1.1,logistica:1.3,imobiliario:1.2};
    baseHoursPerEmp*=(segHoursMult[segment]||1.0);

    // Boost for specific repetitive examples
    const repBoost={reports:0.5,finance:0.6,data_entry:0.7,approvals:0.4,docs:0.5,support:0.3};
    baseHoursPerEmp+=(repBoost[repExamples]||0);

    // Boost based on detected automation opportunities from website
    if(autoOpps.length>=3) baseHoursPerEmp*=1.2;
    else if(autoOpps.length>=1) baseHoursPerEmp*=1.1;

    const hoursSaved=Math.max(15,Math.round(empCount*baseHoursPerEmp));
    const hourlyRate=segment==='juridico'?85:segment==='financeiro'?75:segment==='contabil'?65:segment==='tecnologia'?70:50;
    const moneySaved=Math.round(hoursSaved*hourlyRate);

    // ====== SMART SERVICE RECOMMENDATIONS (context-aware) ======
    const needs=Array.isArray(d.needs)?d.needs:(d.needs?[d.needs]:['suporte']);
    const recDetails=[];

    // Build context-aware "why" messages using company data
    const hasTech=techStack.length>0;
    const compSvcStr=companyServices.length>0?companyServices.slice(0,3).join(', '):'';

    if(needs.includes('suporte')||d.it_status==='none'||d.it_status==='outsourced'){
        let why='Help Desk dedicado com SLA, monitoramento proativo 24/7, segurança corporativa e backup gerenciado.';
        if(d.it_status==='none') why=`A ${company} não tem equipe de TI dedicada — isso é um risco crítico. Propomos Help Desk dedicado com SLA, monitoramento 24/7 e gestão completa da infraestrutura.`;
        else if(d.it_status==='outsourced') why=`Detectamos insatisfação com TI terceirizada atual. Nossa gestão completa inclui Help Desk com SLA de 15min, monitoramento proativo e relatórios transparentes mensais.`;
        recDetails.push({svc:'Gestão de TI Completa',why,icon:'🛡️'});
    }
    if(needs.includes('google')||(d.tools&&!d.tools.includes('google')&&!d.tools.includes('microsoft'))){
        let why='E-mail corporativo, Drive, Meet e Gemini AI integrado — migração segura e treinamento personalizado.';
        if(hasTech&&techStack.some(t=>t.toLowerCase().includes('microsoft'))) why=`Detectamos uso de ferramentas Microsoft. A migração para Google Workspace + Gemini AI pode reduzir custos de licenciamento em até 30% e integrar IA nativa em todos os processos.`;
        recDetails.push({svc:'Google Workspace com IA Gemini',why,icon:'📧'});
    }
    if(needs.includes('ia')||needs.includes('automacao')||repTasks==='many'||d.ai_usage==='none'){
        let why=`Eliminação de tarefas repetitivas com IA: dashboards inteligentes, chatbots e automação de processos.`;
        if(autoOpps.length>0) why=`Para a ${company}, identificamos oportunidades concretas: ${autoOpps.slice(0,3).join('; ')}. Estimamos economia de <strong>${hoursSaved}+ horas/mês</strong>.`;
        else if(compSvcStr) why=`Baseado nos serviços da ${company} (${compSvcStr}), podemos automatizar processos internos com IA — potencial de <strong>${hoursSaved}+ horas/mês</strong> economizadas.`;
        recDetails.push({svc:'IA Aplicada & Automação',why,icon:'🤖'});
    }
    if(needs.includes('portal')){
        let why='Portal corporativo com IA nativa — financeiro, folha, projetos, processos acessíveis em interface inteligente que entende, responde e aprende com sua operação.';
        if(segment==='juridico') why='Portal jurídico com IA: gestão de processos, prazos, documentos e produtividade por advogado — converse com seus dados como conversa com uma pessoa.';
        else if(segment==='saude') why='Portal clínico com IA: agendamentos, prontuários, faturamento e comunicação com pacientes — tudo em interface inteligente.';
        else if(segment==='industria') why='Portal industrial com IA: produção, manutenção preditiva, OEE e qualidade em tempo real — dados que falam com você.';
        recDetails.push({svc:'Portal Corporativo com IA',why,icon:'🌐'});
    }
    if(needs.includes('dashboards')){
        recDetails.push({svc:'Dashboards Inteligentes com IA',why:`Painéis que analisam dados da ${company} e geram insights acionáveis automaticamente. Decisões baseadas em dados em tempo real, não em intuição.`,icon:'📊'});
    }
    if(needs.includes('monitoramento')){
        recDetails.push({svc:'Monitoramento de Produtividade com IA',why:`Métricas em tempo real sobre performance de equipes e processos da ${company}. Identificação de gargalos e oportunidades com IA — visibilidade total.`,icon:'📈'});
    }
    if(needs.includes('rh_ia')){
        recDetails.push({svc:'Otimização de Equipe com IA',why:`IA eliminando tarefas repetitivas na ${company} — sua equipe foca no estratégico. Faça mais com menos: redução de custos operacionais de até 40%.`,icon:'👥'});
    }
    if(needs.includes('cto')||sizeEstimate==='media_grande'||sizeEstimate==='grande'){
        let why=`Liderança tecnológica sem custo de C-level fixo. Estratégia digital, roadmap de inovação e governança de TI.`;
        if(empCount>=100) why=`Com ~${empCount} colaboradores, a ${company} precisa de governança de TI robusta. CTO as a Service traz liderança tech experiente, roadmap de inovação e compliance (LGPD) sem custo de executivo fixo.`;
        recDetails.push({svc:'CTO as a Service',why,icon:'🎯'});
    }
    if(d.backup==='none'||d.backup==='manual'){
        let why='Backup automático na nuvem com recuperação rápida. Proteção contra ransomware e perda de dados.';
        if(d.backup==='none') why=`⚠️ RISCO CRÍTICO: sem backup, a ${company} pode perder TODOS os dados em um ataque ransomware. Implementamos backup automático na nuvem com recuperação em minutos.`;
        recDetails.push({svc:'Backup & Disaster Recovery',why,icon:'💾'});
    }
    recDetails.push({svc:'Segurança Corporativa + LGPD',why:'Bitdefender GravityZone gerenciado, políticas de acesso, firewall gerenciado e adequação LGPD.',icon:'🔒'});
    if(recDetails.length===0){
        recDetails.push({svc:'Consultoria de Inovação',why:'Roadmap personalizado para transformação digital da sua empresa.',icon:'🚀'});
    }

    // Segment insights
    const segInsights={
        juridico:'Escritórios de advocacia que adotam IA aumentam produtividade em até 40% na análise documental. A OAB Paraná, nosso cliente, é referência nessa transformação.',
        imobiliario:'O setor imobiliário está entre os que mais se beneficiam de portais com IA. Atendimento 24/7, gestão de contratos e follow-up automático.',
        industria:'Indústrias com TI bem estruturada reduzem paradas não planejadas em até 60%. Nosso cliente Leal Embalagens é case aprovado pelo Google.',
        saude:'Na saúde, segurança de dados e LGPD não são opcionais — são obrigação legal. IA em prontuários e agendamentos transforma a operação.',
        servicos:'Empresas de serviços que implementam IA ganham velocidade e escala sem aumentar equipe. A automação de propostas é game-changer.',
        varejo:'No varejo, IA em atendimento e logística pode aumentar conversão em até 25%. Automação de estoque gera economia imediata.',
        tecnologia:'Mesmo empresas de tech se beneficiam de outsourcing de TI para focar no core business.',
        educacao:'Na educação, IA transforma comunicação com alunos, matrículas e gestão acadêmica.',
        contabil:'Escritórios contábeis que automatizam processos com IA ganham escala sem contratar.',
        agro:'O agro digital com IA otimiza gestão, logística e processos administrativos.',
    };

    // Automation examples
    const autoExamples={
        reports:'Relatórios e planilhas podem ser gerados automaticamente por IA, economizando horas semanais',
        support:'Chatbots com IA podem responder até 70% das perguntas frequentes dos clientes 24/7',
        approvals:'Fluxos de aprovação digital eliminam gargalos — aprovações que levavam dias viram minutos',
        data_entry:'Entrada de dados automatizada com IA — extração de informações de documentos e e-mails',
        finance:'Conciliação financeira e contas a pagar/receber automatizadas reduzem erros e tempo em 80%',
        docs:'Gestão inteligente de documentos com IA — busca, classificação e versionamento automáticos'
    };

    // Segment-specific auto hints
    const segAutoHints={
        juridico:'IA pode analisar contratos, gerar petições e classificar documentos automaticamente',
        imobiliario:'Atendimento 24/7 com chatbot IA, gestão de contratos e follow-up automático',
        industria:'Monitoramento de produção, controle de qualidade e manutenção preditiva com IA',
        servicos:'Automação de propostas, contratos, follow-up e relatórios de projeto',
        saude:'Triagem inteligente, agendamento otimizado e gestão de prontuários com IA',
        varejo:'Precificação dinâmica, previsão de demanda e atendimento inteligente',
        tecnologia:'CI/CD automatizado, monitoramento inteligente e gestão de incidentes com IA',
        educacao:'Comunicação personalizada, gestão de matrículas e análise de desempenho com IA',
        contabil:'Automação de lançamentos, conciliação e geração de relatórios fiscais com IA',
        agro:'Gestão de safra, logística e controle financeiro automatizados com IA'
    };

    // Build the impressive card
    let html=`<div class="diagnosis diag-premium">`;

    // Header
    html+=`<div class="diag-header-bar">`;
    html+=`<div class="diag-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.5 7.5L22 10l-7.5 2.5L12 20l-2.5-7.5L2 10l7.5-2.5L12 0z"/></svg> ANÁLISE COMPLETA — ${company.toUpperCase()}</div>`;
    html+=`</div>`;

    // Company profile card (enriched with CNPJ data)
    const cnpjInfo=cr.cnpjData||null;
    const socialInfo=cr.socialMedia||{};
    const clientsInfo=cr.clients||[];
    html+=`<div class="diag-company-profile">`;
    html+=`<div class="diag-company-badge"><strong>${company}</strong>`;
    if(cnpjInfo&&cnpjInfo.razao_social&&cnpjInfo.razao_social!==company) html+=`<span>📄 ${esc(cnpjInfo.razao_social)}</span>`;
    if(cnpjInfo&&cnpjInfo.cnpj) html+=`<span>🔢 CNPJ: ${esc(cnpjInfo.cnpj)}</span>`;
    if(segmentLabel) html+=`<span>📌 ${esc(segmentLabel)}</span>`;
    if(cnpjInfo&&cnpjInfo.atividade_principal) html+=`<span>🏭 ${esc(cnpjInfo.atividade_principal.substring(0,80))}</span>`;
    html+=`<span>👥 ~${esc(employeeEstimate)} colaboradores</span>`;
    html+=`<span>💰 Faturamento estimado: ${esc(revenueEstimate)}</span>`;
    if(cnpjInfo&&cnpjInfo.capital_social){const cap=parseFloat(cnpjInfo.capital_social);if(cap>=1000) html+=`<span>💼 Capital social: R$ ${cap>=1000000?(cap/1000000).toFixed(1)+'M':Math.round(cap/1000)+'K'}</span>`;}
    if(cr.foundingYear) html+=`<span>📅 Desde ${cr.foundingYear} (~${2026-cr.foundingYear} anos no mercado)</span>`;
    if(cnpjInfo&&cnpjInfo.municipio) html+=`<span>📍 ${esc(cnpjInfo.municipio)}${cnpjInfo.uf?'-'+cnpjInfo.uf:''}</span>`;
    if(cnpjInfo&&cnpjInfo.porte) html+=`<span>📊 Porte: ${esc(cnpjInfo.porte)}</span>`;
    if(Object.keys(socialInfo).length>0) html+=`<span>🌐 Presença digital: ${Object.keys(socialInfo).map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(', ')}</span>`;
    if(clientsInfo.length>0) html+=`<span>🤝 Clientes detectados: ${clientsInfo.slice(0,5).map(c=>esc(c)).join(', ')}</span>`;
    html+=`</div></div>`;

    // ====== COMPANY INTELLIGENCE SECTION (NEW) ======
    if(companyServices.length>0||techStack.length>0||operationalKw.length>0){
        html+=`<div class="diag-section"><h4>🔍 Inteligência Coletada da ${company}</h4>`;
        if(companyServices.length>0){
            html+=`<div class="diag-intel-row"><strong>Serviços/Produtos detectados:</strong></div>`;
            html+=`<div class="diag-tags">`;
            companyServices.forEach(s=>{html+=`<span class="diag-tag-blue">${esc(s)}</span>`});
            html+=`</div>`;
        }
        if(techStack.length>0){
            html+=`<div class="diag-intel-row"><strong>Tecnologias identificadas:</strong></div>`;
            html+=`<div class="diag-tags">`;
            techStack.forEach(t=>{html+=`<span class="diag-tag-gray">${esc(t)}</span>`});
            html+=`</div>`;
        }
        if(operationalKw.length>0){
            html+=`<div class="diag-intel-row"><strong>Processos operacionais:</strong></div>`;
            html+=`<div class="diag-tags">`;
            operationalKw.slice(0,8).forEach(k=>{html+=`<span class="diag-tag-teal">${esc(k)}</span>`});
            html+=`</div>`;
        }
        if(digitalSignals.length>0){
            html+=`<div class="diag-intel-row"><strong>Sinais de maturidade digital:</strong></div>`;
            html+=`<ul class="diag-items potential">${digitalSignals.slice(0,4).map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`;
        }
        html+=`</div>`;
    }

    // 3 score gauges
    const riskClass=risk.score>=7?'risk-high':risk.score>=4?'risk-mid':'risk-low';
    const riskLabel=risk.score>=7?'ALTO':risk.score>=4?'MÉDIO':'BAIXO';
    const riskEmoji=risk.score>=7?'🔴':risk.score>=4?'🟡':'🟢';
    const matLabel=maturity.score>=7?'AVANÇADA':maturity.score>=4?'INTERMEDIÁRIA':'INICIAL';
    const matClass=maturity.score>=7?'pot-high':maturity.score>=4?'risk-mid':'risk-high';

    html+=`<div class="diag-scores">`;
    html+=`<div class="diag-score-card"><div class="diag-score-number ${riskClass}">${risk.score}<span>/10</span></div><div class="diag-score-label">${riskEmoji} Risco ${riskLabel}</div></div>`;
    html+=`<div class="diag-score-card"><div class="diag-score-number ${matClass}">${maturity.score}<span>/10</span></div><div class="diag-score-label">📊 Maturidade ${matLabel}</div></div>`;
    html+=`<div class="diag-score-card"><div class="diag-score-number pot-high">${pot.score}<span>/10</span></div><div class="diag-score-label">🚀 Potencial</div></div>`;
    html+=`</div>`;

    // Segment insight
    if(segInsights[segment]){
        html+=`<div class="diag-insight"><span class="diag-insight-icon">💡</span><span>${segInsights[segment]}</span></div>`;
    }

    // Risk analysis
    html+=`<div class="diag-section"><h4>⚠️ Análise de Risco</h4>`;
    html+=`<div class="diag-bar"><div class="diag-bar-fill ${riskClass}" style="width:${risk.score*10}%"></div></div>`;
    html+=`<ul class="diag-items risk">${risk.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    // Maturity
    html+=`<div class="diag-section"><h4>📊 Maturidade Digital</h4>`;
    html+=`<div class="diag-bar"><div class="diag-bar-fill ${matClass}" style="width:${maturity.score*10}%"></div></div>`;
    html+=`<ul class="diag-items potential">${maturity.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    // ====== AUTOMATION & AI SECTION (ENRICHED) ======
    html+=`<div class="diag-section"><h4>🤖 Análise de Automação & IA — ${company}</h4>`;

    // Big highlight number
    html+=`<div class="diag-auto-highlight">`;
    html+=`<div class="diag-auto-number">${hoursSaved}+</div>`;
    html+=`<div class="diag-auto-label">horas/mês automatizáveis</div>`;
    html+=`<div class="diag-auto-sub">≈ <strong>R$ ${moneySaved.toLocaleString('pt-BR')}/mês</strong> em produtividade recuperada (R$ ${(moneySaved*12).toLocaleString('pt-BR')}/ano)</div>`;
    html+=`</div>`;

    // How we calculated
    html+=`<div class="diag-insight"><span class="diag-insight-icon">🧮</span><span><strong>Como calculamos:</strong> ${empCount} colaboradores × ${baseHoursPerEmp.toFixed(1)}h automatizáveis/mês (baseado em: volume de tarefas ${repTasks==='many'?'alto':repTasks==='some'?'moderado':'baixo'}, maturidade digital ${matLabel.toLowerCase()}, segmento ${segmentLabel||'geral'})</span></div>`;

    // Specific automation opportunities from website research
    if(autoOpps.length>0){
        html+=`<div class="diag-intel-row"><strong>⚡ Oportunidades específicas para a ${company}:</strong></div>`;
        html+=`<ul class="diag-items potential">${autoOpps.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`;
    }

    // Generic automation items
    const autoItems=[];
    if(repTasks==='many') autoItems.push('Alto volume de tarefas repetitivas identificado — automação com IA é prioridade #1');
    else if(repTasks==='some') autoItems.push('Tarefas repetitivas identificadas — bom potencial de otimização com IA');
    if(d.ai_usage==='none') autoItems.push('Sem IA na operação hoje — implementar agora coloca a empresa na frente de 85% dos concorrentes');
    else if(d.ai_usage==='scattered') autoItems.push('IA sem governança detectada — centralizar uso evita vazamento de dados e multiplica resultados em 3x');
    else if(d.ai_usage==='basic') autoItems.push('Uso básico de IA (ChatGPT/Gemini individual) — integrar no fluxo de trabalho com APIs amplifica resultados');
    if(autoExamples[repExamples]) autoItems.push(autoExamples[repExamples]);
    if(segAutoHints[segment]) autoItems.push(`<strong>Específico para ${segmentLabel||'seu segmento'}:</strong> ${segAutoHints[segment]}`);
    if(autoItems.length>0) html+=`<ul class="diag-items potential">${autoItems.map(i=>`<li>${i}</li>`).join('')}</ul>`;
    html+=`</div>`;

    // Potential
    html+=`<div class="diag-section"><h4>🚀 Potencial de Melhoria</h4>`;
    html+=`<div class="diag-bar"><div class="diag-bar-fill pot-high" style="width:${pot.score*10}%"></div></div>`;
    html+=`<ul class="diag-items potential">${pot.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    // ====== RECOMMENDED SERVICES (ENRICHED) ======
    html+=`<div class="diag-section"><h4>✨ Proposta de Serviços para a ${company}</h4>`;
    html+=`<p class="diag-section-sub">Serviços selecionados pela IA com base no diagnóstico, segmento e perfil da empresa:</p>`;
    recDetails.forEach((s,i)=>{
        html+=`<div class="diag-svc-card"><span class="diag-svc-icon">${s.icon}</span><div><strong>${s.svc}</strong> <span class="diag-svc-badge">Sob consulta</span><span>${s.why}</span></div></div>`;
    });
    html+=`</div>`;

    // ROI estimate
    const roi=calcROI(d,risk);
    roi.push({value:`↑ ${hoursSaved}h`,label:'Horas/mês economizadas'});
    roi.push({value:`R$ ${Math.round(moneySaved*12/1000)}K`,label:'Economia anual estimada'});
    html+=`<div class="diag-roi"><div class="diag-roi-title">📈 Estimativa de Impacto (12 meses)</div><div class="diag-roi-grid">`;
    roi.slice(0,8).forEach(r=>{
        html+=`<div class="diag-roi-item"><div class="diag-roi-value">${r.value}</div><div class="diag-roi-label">${r.label}</div></div>`;
    });
    html+=`</div></div>`;

    // Biggest pain echo (enriched)
    if(d.biggest_pain){
        html+=`<div class="diag-insight"><span class="diag-insight-icon">🎯</span><span>Sobre "<em>${esc(d.biggest_pain)}</em>" — analisamos mais de 200 empresas com desafios similares. A combinação de ${recDetails.length>1?recDetails.slice(0,2).map(s=>s.svc).join(' + '):recDetails[0]?.svc||'nossos serviços'} resolve isso com resultados visíveis em 15-30 dias.</span></div>`;
    }

    // Guinux credibility
    html+=`<div class="diag-insight"><span class="diag-insight-icon">🏆</span><span><strong>Por que a Guinux?</strong> 23+ anos no mercado · Google Cloud Partner desde 2013 · Bitdefender Partner · 50+ empresas atendidas · CTO da OAB Paraná (90 mil+ advogados) · 4× Google Cloud Next · Imersão no Technion, Israel.</span></div>`;

    // CTA
    const waMsg=encodeURIComponent(`Olá! Sou ${d.name} da ${d.company} (~${employeeEstimate} colab., ${segmentLabel||segment}).\n\nFiz a Análise Completa no site:\n📊 Risco: ${riskLabel} (${risk.score}/10)\n📊 Maturidade: ${matLabel} (${maturity.score}/10)\n📊 Potencial: ${pot.score}/10\n⚡ Horas automatizáveis: ${hoursSaved}+/mês (≈ R$ ${moneySaved.toLocaleString('pt-BR')}/mês)\n💰 Faturamento estimado: ${revenueEstimate}\n\nInteresse em: ${recDetails.map(s=>s.svc).join(', ')}.${d.biggest_pain?'\n\nDesafio: '+d.biggest_pain:''}`);
    html+=`<div class="diag-cta">`;
    html+=`<a href="https://wa.me/554140639294?text=${waMsg}" class="btn-main" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Falar com especialista agora</a>`;
    html+=`<button class="btn-ghost" onclick="downloadAnalisePDF()">📄 Baixar em PDF</button>`;
    html+=`</div></div>`;

    addRawMsg(html);
    expandAndAnimate();

    // Silent notification to Guinux about this simulation
    notifySimulation(d, {risk:riskLabel, riskScore:risk.score, matLabel, matScore:maturity.score, potScore:pot.score, hoursSaved, revenueEstimate, employeeEstimate, services:recDetails.map(s=>s.svc).join(', ')});
}

/* ========= DOWNLOAD PDF — EXECUTIVE (OAB-STYLE) ========= */
async function downloadAnalisePDF(){
    const d=chatData;
    const name=d.name||'Cliente';
    const company=d.company||'Empresa';
    const cr=d.companyResearch||{};
    const risk=calcRisk(d);
    const maturity=calcMaturity(d);
    const pot=calcPotential(d);
    const riskLabel=risk.score>=7?'ALTO':risk.score>=4?'MÉDIO':'BAIXO';
    const matLabel=maturity.score>=7?'AVANÇADA':maturity.score>=4?'INTERMEDIÁRIA':'INICIAL';
    const riskColor=risk.score>=7?'#EF4444':risk.score>=4?'#F59E0B':'#22C55E';
    const matColor=maturity.score>=7?'#22C55E':maturity.score>=4?'#F59E0B':'#EF4444';
    // OAB-style color palette
    const OD='#0D1B2A';const OB='#2B5A8C';const OA='#6BBED0';const OG='#22C55E';const OP='#8B5CF6';const OR='#EF4444';const OL='#F0F7FA';
    const employeeEst=cr.employeeEstimate||'25-50';
    const revenueEst=cr.revenueEstimate||'R$ 2M – R$ 10M/ano';
    const segLabel=cr.segmentLabel||'';
    const empMap={'10-25':20,'25-50':40,'50-100':80,'100+':200,'5-15':10,'15-30':25,'15-50':35,'30-60':50,'50-150':100,'60-100':80,'100-200':150,'150-500':300,'200-500':350,'500+':600,'500-1.000':750};
    const empCount=empMap[employeeEst]||30;
    const taskMult=(d.repetitive_tasks==='many')?0.15:(d.repetitive_tasks==='some')?0.08:0.04;
    const hoursSaved=Math.round(empCount*taskMult*4);
    const roi=calcROI(d,risk);
    const needs=Array.isArray(d.needs)?d.needs:(d.needs?[d.needs]:['suporte']);
    const today=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
    const docNum='GX-'+Date.now().toString(36).toUpperCase();
    const siteAnalysis=cr.siteAnalysis||{};

    // Extra research data for PDF
    const companyServices=(cr.companyServices||[]).slice(0,5);
    const techStack=(cr.techStack||[]).map(t=>typeof t==='string'?t:t.name||t).filter(Boolean);
    const autoOppsRaw=(cr.automationOpportunities||[]);
    const autoOpps=autoOppsRaw.map(a=>typeof a==='string'?a:a.opportunity||a).filter(Boolean);
    let autoOppsDetailed=autoOppsRaw.filter(a=>a&&a.opportunity);

    // FALLBACK: never show 0 high-impact opportunities — generate segment-based ones
    const segmentFallbacks={
        advocacia:[
            {opportunity:'IA para Triagem de Processos',description:'Classificação automática de novos processos, priorização por urgência e distribuição inteligente entre advogados.',impact:'alto'},
            {opportunity:'Geração Automática de Petições',description:'IA gera minutas de petições, contratos e pareceres baseada em modelos e jurisprudência atualizada.',impact:'alto'},
            {opportunity:'Chatbot Jurídico para Clientes',description:'Atendimento 24/7 para consultas de status processual, agendamentos e dúvidas frequentes.',impact:'alto'},
            {opportunity:'Pesquisa Jurisprudencial com IA',description:'Busca inteligente em bases de jurisprudência com resumos automáticos e sugestões de argumentação.',impact:'medio'},
            {opportunity:'Automação de Prazos e Intimações',description:'Monitoramento automático de diários oficiais e controle inteligente de prazos processuais.',impact:'alto'},
            {opportunity:'Dashboard de Performance',description:'Visão em tempo real de métricas do escritório: processos, prazos, produtividade por equipe.',impact:'medio'},
        ],
        tecnologia:[
            {opportunity:'Automação de Deploy e CI/CD',description:'Pipeline inteligente de deploy com testes automáticos, rollback e monitoramento.',impact:'alto'},
            {opportunity:'Chatbot de Suporte Técnico',description:'IA para primeiro atendimento de tickets, resolução automática de problemas comuns.',impact:'alto'},
            {opportunity:'Monitoramento Preditivo',description:'IA antecipa falhas de infraestrutura e sugere ações preventivas automaticamente.',impact:'alto'},
        ],
        saude:[
            {opportunity:'Triagem Inteligente de Pacientes',description:'IA classifica urgência e direciona pacientes automaticamente para o profissional adequado.',impact:'alto'},
            {opportunity:'Agendamento com IA',description:'Chatbot para agendamento, confirmação e remarcação automática de consultas.',impact:'alto'},
            {opportunity:'Prontuário Inteligente',description:'IA auxilia no preenchimento de prontuários e sugere diagnósticos baseados em histórico.',impact:'alto'},
        ],
        contabilidade:[
            {opportunity:'Automação de Lançamentos',description:'IA classifica e lança documentos fiscais automaticamente no sistema contábil.',impact:'alto'},
            {opportunity:'Conciliação Bancária com IA',description:'Matching automático de extratos bancários com lançamentos contábeis.',impact:'alto'},
            {opportunity:'Chatbot para Clientes',description:'Atendimento 24/7 para dúvidas sobre impostos, prazos e documentação necessária.',impact:'alto'},
        ],
        default:[
            {opportunity:'Chatbot Inteligente para Atendimento',description:'Atendimento automatizado 24/7 com IA, reduzindo tempo de resposta e liberando a equipe para tarefas estratégicas.',impact:'alto'},
            {opportunity:'Automação de Processos Internos (RPA + IA)',description:'Eliminação de tarefas manuais repetitivas — entrada de dados, relatórios, aprovações — com robôs inteligentes.',impact:'alto'},
            {opportunity:'Dashboard de Gestão com IA',description:'Visão unificada de KPIs com insights preditivos, alertas automáticos e recomendações de ação.',impact:'alto'},
            {opportunity:'Gestão Inteligente de Documentos',description:'IA para busca, classificação, versionamento e extração de dados de documentos automaticamente.',impact:'medio'},
            {opportunity:'IA para Análise de Dados',description:'Transforme dados brutos em insights acionáveis com modelos de IA treinados para seu negócio.',impact:'alto'},
            {opportunity:'Automação de E-mail e Comunicação',description:'Triagem, resposta e encaminhamento automático de e-mails com IA, priorizando por urgência.',impact:'medio'},
        ]
    };

    const companyDescription=cr.companyDescription||cr.description||'';

    // Detect segment from company description, services, or domain
    const segText=(companyDescription+' '+(cr.segment||'')+' '+company).toLowerCase();
    let detectedSegment='default';
    if(/advoc|juríd|direito|law|legal/.test(segText)) detectedSegment='advocacia';
    else if(/contab|fiscal|tribut/.test(segText)) detectedSegment='contabilidade';
    else if(/saúde|saude|clínic|medic|hospit|odonto/.test(segText)) detectedSegment='saude';
    else if(/tech|software|dev|sistema|startup/.test(segText)) detectedSegment='tecnologia';

    // If no detailed opps or no high-impact ones, inject fallbacks
    const highImpactCount=autoOppsDetailed.filter(a=>a.impact==='alto').length;
    if(autoOppsDetailed.length<3 || highImpactCount===0){
        const fallbacks=segmentFallbacks[detectedSegment]||segmentFallbacks.default;
        const existingNames=new Set(autoOppsDetailed.map(a=>(a.opportunity||'').toLowerCase()));
        fallbacks.forEach(fb=>{
            if(!existingNames.has(fb.opportunity.toLowerCase())){
                autoOppsDetailed.push(fb);
                existingNames.add(fb.opportunity.toLowerCase());
            }
        });
    }
    const cnpjData=cr.cnpjData||null;
    const socialMedia=cr.socialMedia||{};
    const benchmark=cr.competitorBenchmark||null;

    // Pre-load logo as data URI to avoid CORS/tainted canvas issues
    let logoSrc='';
    try{
        const logoRes=await fetch('https://www.guinux.com.br/logogx-ia.png');
        const logoBlob=await logoRes.blob();
        logoSrc=await new Promise(resolve=>{const r=new FileReader();r.onloadend=()=>resolve(r.result);r.readAsDataURL(logoBlob);});
    }catch(e){console.warn('Logo fetch for PDF failed:',e);}

    const svcs=[];
    if(needs.includes('suporte')||d.it_status==='none'||d.it_status==='outsourced') svcs.push({n:'Gestão de TI Completa',d:'Outsourcing inteligente: Help Desk dedicado com SLA, monitoramento proativo 24/7, gestão de infraestrutura, segurança corporativa e backup gerenciado.',items:['Help Desk com SLA garantido','Monitoramento proativo 24/7','Gestão de servidores e rede','Backup automático na nuvem','Relatórios transparentes periódicos']});
    if(needs.includes('google')) svcs.push({n:'Google Workspace com IA Gemini',d:'Produtividade máxima com Google Workspace + Gemini AI integrado. Migração segura, treinamento para equipes e suporte enterprise dedicado.',items:['Migração completa e segura','Gemini AI integrado','Treinamento personalizado','Suporte enterprise','Otimização contínua']});
    if(needs.includes('ia')||needs.includes('automacao')||d.repetitive_tasks==='many') svcs.push({n:'IA Aplicada & Automação',d:'Eliminação de tarefas repetitivas, dashboards inteligentes com IA, chatbots corporativos e automação de processos (RPA + AI).',items:['Chatbots inteligentes','Automação de processos (RPA+AI)','Integração com APIs e sistemas','IA personalizada para seu negócio','Redução de custos operacionais']});
    if(needs.includes('portal')) svcs.push({n:'Portal Corporativo com IA',d:'Portal de alta tecnologia com IA nativa — financeiro, folha, projetos e processos em interface inteligente que entende, responde e aprende com sua operação.',items:['Interface inteligente com IA nativa','Módulos financeiro, RH, projetos','Converse com seus dados como com uma pessoa','Relatórios e insights gerados por IA','UX focada no usuário']});
    if(needs.includes('dashboards')) svcs.push({n:'Dashboards Inteligentes com IA',d:'Painéis que analisam dados e geram insights acionáveis automaticamente. Decisões baseadas em dados em tempo real.',items:['KPIs em tempo real','Alertas inteligentes','Análise preditiva com IA','Integração com múltiplas fontes','Acesso mobile']});
    if(needs.includes('monitoramento')) svcs.push({n:'Monitoramento de Produtividade',d:'Métricas em tempo real sobre performance de equipes e processos. Identificação de gargalos e oportunidades com IA.',items:['Métricas por equipe e processo','Identificação de gargalos','Benchmarks do segmento','Relatórios automáticos','Alertas de desvio']});
    if(needs.includes('rh_ia')) svcs.push({n:'Otimização de Equipe com IA',d:'IA eliminando tarefas repetitivas — sua equipe foca no estratégico. Faça mais com menos: redução de custos operacionais de até 40%.',items:['Automação de tarefas repetitivas','Análise de produtividade por colaborador','Redistribuição inteligente de tarefas','Onboarding automatizado','ROI de equipe por área']});
    if(needs.includes('cto')) svcs.push({n:'CTO as a Service',d:'Liderança tecnológica experiente sem custo de C-level fixo. Estratégia digital, roadmap de inovação e governança de TI.',items:['Estratégia digital personalizada','Roadmap de inovação','Governança e compliance (LGPD)','Avaliação de fornecedores','Mentoria para equipes']});
    if(svcs.length===0) svcs.push({n:'Consultoria de Inovação',d:'Roadmap personalizado para transformação digital da sua empresa com IA.',items:['Diagnóstico completo','Roadmap de transformação','Priorização de iniciativas','Quick wins identificados','Acompanhamento trimestral']});

    // Color assignments for service cards
    const svcColors=[OB,OA,OG,OP,OD,OR,OA,OB];

    const pdfHtml=`
    <div style="font-family:'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a2e;width:700px;margin:0 auto;line-height:1.5">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap" rel="stylesheet">

        <!-- ===== HEADER BAR ===== -->
        <div style="background:linear-gradient(135deg,${OD} 0%,${OB} 50%,#1a4a6e 100%);padding:20px 36px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${OA}">
            <div>
                <div style="color:#fff;font-size:16px;font-weight:800;letter-spacing:-.3px">Análise Completa &amp; Proposta <span style="color:${OA}">${company}</span></div>
                <div style="color:rgba(255,255,255,.5);font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-top:2px">Diagnóstico digital + proposta inteligente</div>
            </div>
            <div style="text-align:right">
                ${logoSrc?`<img src="${logoSrc}" style="height:32px;filter:grayscale(1) brightness(3);opacity:.9">`:''}
                <div style="color:rgba(255,255,255,.5);font-size:8px;margin-top:4px">${docNum} · ${today}</div>
            </div>
        </div>

        <!-- ===== HERO SECTION ===== -->
        <div style="background:linear-gradient(160deg,${OD} 0%,#162d4a 100%);padding:28px 36px;position:relative;overflow:hidden">
            <div style="font-size:24px;font-weight:900;color:#fff;line-height:1.15;margin-bottom:8px;position:relative;z-index:1">
                Diagnóstico Digital <span style="color:${OA}">Completo</span><br>+ Proposta <span style="color:${OA}">Inteligente</span>
            </div>
            <div style="font-size:11px;color:rgba(255,255,255,.7);line-height:1.6;max-width:85%;margin-bottom:16px;position:relative;z-index:1">
                Preparado exclusivamente para <strong style="color:#fff">${name}</strong> da <strong style="color:#fff">${company}</strong>.
                Análise baseada em ${cr.sourcesQueried?cr.sourcesQueried.length:5}+ fontes de dados incluindo Receita Federal, análise de site, DNS, segurança e tecnologias.
            </div>
            <div style="display:flex;gap:14px;position:relative;z-index:1">
                <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 16px;text-align:center">
                    <span style="font-size:22px;font-weight:800;color:${riskColor};display:block">${risk.score}/10</span>
                    <span style="font-size:8px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.8px">Risco ${riskLabel}</span>
                </div>
                <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 16px;text-align:center">
                    <span style="font-size:22px;font-weight:800;color:${matColor};display:block">${maturity.score}/10</span>
                    <span style="font-size:8px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.8px">Maturidade ${matLabel}</span>
                </div>
                <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 16px;text-align:center">
                    <span style="font-size:22px;font-weight:800;color:${OA};display:block">${pot.score}/10</span>
                    <span style="font-size:8px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.8px">Potencial</span>
                </div>
                ${hoursSaved>0?`<div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 16px;text-align:center">
                    <span style="font-size:22px;font-weight:800;color:${OA};display:block">${hoursSaved}h+</span>
                    <span style="font-size:8px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.8px">Horas/mês automação</span>
                </div>`:''}
                <div style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 16px;text-align:center">
                    <span style="font-size:22px;font-weight:800;color:${OA};display:block">~${employeeEst}</span>
                    <span style="font-size:8px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.8px">Colaboradores</span>
                </div>
            </div>
        </div>

        <!-- ===== PERFIL + INTELIGÊNCIA ===== -->
        <div style="padding:20px 36px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
                <div style="width:18px;height:3px;background:${OB};border-radius:2px"></div>
                <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:${OB}">Perfil da Empresa</div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
                <div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;border-left:3px solid ${OB};flex:1;min-width:140px">
                    <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:2px">CONTATO</div>
                    <div style="font-size:11px;font-weight:700;color:${OD}">${name}</div>
                    <div style="font-size:9px;color:#64748b">${d.email||''}</div>
                </div>
                <div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;border-left:3px solid ${OA};flex:1;min-width:120px">
                    <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:2px">SEGMENTO</div>
                    <div style="font-size:11px;font-weight:700;color:${OD}">${segLabel||'Não identificado'}</div>
                </div>
                <div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;border-left:3px solid ${OG};flex:1;min-width:110px">
                    <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:2px">FATURAMENTO EST.</div>
                    <div style="font-size:11px;font-weight:700;color:${OD}">${revenueEst}</div>
                </div>
                ${cnpjData&&cnpjData.municipio?`<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;border-left:3px solid ${OP};flex:1;min-width:110px">
                    <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:2px">LOCALIZAÇÃO</div>
                    <div style="font-size:11px;font-weight:700;color:${OD}">${cnpjData.municipio}${cnpjData.uf?'-'+cnpjData.uf:''}</div>
                </div>`:''}
            </div>

            ${cnpjData?`
            <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10px">
                ${cnpjData.razao_social?`<tr><td style="padding:3px 8px;color:#94a3b8;width:30%">Razão Social</td><td style="padding:3px 8px;font-weight:600;color:${OD}">${cnpjData.razao_social}</td></tr>`:''}
                ${cnpjData.cnpj?`<tr style="background:#f8fafc"><td style="padding:3px 8px;color:#94a3b8">CNPJ</td><td style="padding:3px 8px;font-weight:600">${cnpjData.cnpj}</td></tr>`:''}
                ${cnpjData.atividade_principal?`<tr><td style="padding:3px 8px;color:#94a3b8">Atividade</td><td style="padding:3px 8px">${cnpjData.atividade_principal}</td></tr>`:''}
                ${cnpjData.capital_social?`<tr style="background:#f8fafc"><td style="padding:3px 8px;color:#94a3b8">Capital Social</td><td style="padding:3px 8px">R$ ${Number(cnpjData.capital_social).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td></tr>`:''}
                ${cnpjData.data_abertura?`<tr><td style="padding:3px 8px;color:#94a3b8">Abertura</td><td style="padding:3px 8px">${cnpjData.data_abertura}</td></tr>`:''}
            </table>`:''}

            ${techStack.length>0?`<div style="margin-bottom:10px">
                <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:4px">TECNOLOGIAS DETECTADAS</div>
                ${techStack.slice(0,12).map(t=>`<span style="display:inline-block;background:${OL};color:${OB};padding:2px 8px;border-radius:4px;font-size:8px;font-weight:600;margin:2px 2px">${t}</span>`).join('')}
            </div>`:''}
            ${companyServices.length>0?`<div style="margin-bottom:10px">
                <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:4px">SERVIÇOS IDENTIFICADOS</div>
                ${companyServices.map(s=>`<span style="display:inline-block;background:#e8f4f8;color:#0D1B2A;padding:2px 8px;border-radius:4px;font-size:8px;font-weight:600;margin:2px 2px">${s}</span>`).join('')}
            </div>`:''}
        </div>

        <!-- ===== DIAGNÓSTICO DETALHADO ===== -->
        <div style="padding:0 36px 16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                <div style="width:18px;height:3px;background:${OB};border-radius:2px"></div>
                <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:${OB}">Diagnóstico Detalhado</div>
            </div>
            <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;border-left:3px solid ${riskColor};margin-bottom:8px;page-break-inside:avoid">
                <div style="font-size:10px;font-weight:700;color:${riskColor};margin-bottom:4px">⚠️ Pontos de Risco (${risk.score}/10 — ${riskLabel})</div>
                ${risk.items.map(i=>`<div style="font-size:9px;color:#475569;padding:2px 0 2px 12px;position:relative;line-height:1.4"><span style="position:absolute;left:0;color:${OA};font-weight:700">→</span>${i}</div>`).join('')}
            </div>
            <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;border-left:3px solid ${matColor};margin-bottom:8px;page-break-inside:avoid">
                <div style="font-size:10px;font-weight:700;color:${matColor};margin-bottom:4px">📊 Maturidade Digital (${maturity.score}/10 — ${matLabel})</div>
                ${maturity.items.map(i=>`<div style="font-size:9px;color:#475569;padding:2px 0 2px 12px;position:relative;line-height:1.4"><span style="position:absolute;left:0;color:${OA};font-weight:700">→</span>${i}</div>`).join('')}
            </div>
            <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;border-left:3px solid ${OA};page-break-inside:avoid">
                <div style="font-size:10px;font-weight:700;color:${OA};margin-bottom:4px">🚀 Potencial de Melhoria (${pot.score}/10)</div>
                ${pot.items.map(i=>`<div style="font-size:9px;color:#475569;padding:2px 0 2px 12px;position:relative;line-height:1.4"><span style="position:absolute;left:0;color:${OA};font-weight:700">→</span>${i}</div>`).join('')}
            </div>
        </div>

        ${d.biggest_pain?`
        <div style="padding:0 36px 16px;page-break-inside:avoid">
            <div style="background:#FFF8E1;border-left:4px solid #F59E0B;border-radius:0 8px 8px 0;padding:12px 16px">
                <div style="font-size:10px;font-weight:700;color:#92400E;margin-bottom:4px">🎯 Sua principal dor</div>
                <div style="font-size:9px;color:#78716C;line-height:1.5">"<em>${d.biggest_pain}</em>" — Isso é exatamente o tipo de problema que resolvemos. Clientes com desafios similares viram resultados em menos de 30 dias.</div>
            </div>
        </div>`:''}

        ${benchmark?`
        <!-- ===== BENCHMARK COMPETITIVO ===== -->
        <div style="padding:0 36px 16px;page-break-inside:avoid">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                <div style="width:18px;height:3px;background:${OB};border-radius:2px"></div>
                <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:${OB}">Benchmark Competitivo — ${benchmark.segmentLabel||segLabel}</div>
            </div>
            <div style="background:linear-gradient(135deg,#f8fafc,#f0f7fa);border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                    <div>
                        <div style="font-size:12px;font-weight:800;color:${OD}">${company}</div>
                        <div style="font-size:9px;color:#64748b;margin-top:1px">${benchmark.positioning}</div>
                    </div>
                    <div style="display:flex;gap:16px">
                        <div style="text-align:center">
                            <div style="font-size:20px;font-weight:900;color:${benchmark.totalCompanyScore>=benchmark.totalMarketScore?OG:OR}">${benchmark.totalCompanyScore}/10</div>
                            <div style="font-size:7px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Sua empresa</div>
                        </div>
                        <div style="text-align:center">
                            <div style="font-size:20px;font-weight:900;color:#94a3b8">${benchmark.totalMarketScore}/10</div>
                            <div style="font-size:7px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Média mercado</div>
                        </div>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:7px">
                    ${benchmark.dimensions.map(dim=>{
                        const cw=Math.round(Math.min(dim.company,10)*10);
                        const mw=Math.round(Math.min(dim.market,10)*10);
                        const col=dim.company>=dim.market?OG:OR;
                        return `<div>
                            <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                                <div style="font-size:8px;font-weight:600;color:${OD}">${dim.label}</div>
                                <div style="font-size:8px;color:#64748b">${dim.company.toFixed(1)} <span style="color:#94a3b8">vs ${dim.market.toFixed(1)} mercado</span></div>
                            </div>
                            <div style="position:relative;height:7px;background:#e2e8f0;border-radius:4px">
                                <div style="position:absolute;left:0;top:0;height:100%;width:${mw}%;background:#cbd5e1;border-radius:4px"></div>
                                <div style="position:absolute;left:0;top:0;height:100%;width:${cw}%;background:${col};border-radius:4px;opacity:.8"></div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
                ${benchmark.competitors&&benchmark.competitors.length>0?`
                <div style="margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0">
                    <div style="font-size:7px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">Concorrentes identificados</div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">
                        ${benchmark.competitors.map(c=>`<span style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:2px 8px;border-radius:4px;font-size:8px;font-weight:600">${c.name}</span>`).join('')}
                    </div>
                </div>`:''}
            </div>
        </div>`:''}

        <!-- ===== AUTOMAÇÃO & IA — THE HERO SECTION ===== -->
        <div style="padding:0 36px 16px;page-break-before:always">
            <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:14px;padding:22px 24px;position:relative;overflow:hidden;page-break-inside:avoid">
                <div style="font-size:16px;font-weight:900;color:#fff;margin-bottom:4px;position:relative;z-index:1">
                    <span style="color:${OA}">Oportunidades</span> de Automação &amp; IA
                </div>
                <div style="font-size:9px;color:rgba(255,255,255,.65);margin-bottom:14px;line-height:1.5;position:relative;z-index:1">
                    Análise do site da ${company}: ${siteAnalysis.hasChatbot?`chatbot detectado (${siteAnalysis.chatbotProvider||'genérico'})`:'sem chatbot'}${siteAnalysis.hasSearch?', com busca':', sem busca inteligente'}${siteAnalysis.formCount>0?`, ${siteAnalysis.formCount} formulário(s)`:''}.
                    ${Math.max(autoOppsDetailed.filter(a=>a.impact==='alto').length,3)} oportunidades de alto impacto identificadas.
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;position:relative;z-index:1">
                    ${autoOppsDetailed.slice(0,6).map(a=>`<div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px;flex:1;min-width:180px">
                        <div style="font-size:9px;font-weight:700;color:#fff;margin-bottom:2px">${a.opportunity||a}</div>
                        <div style="font-size:7.5px;color:rgba(255,255,255,.55);line-height:1.4">${a.description||''}</div>
                        ${a.impact?`<span style="display:inline-block;margin-top:4px;background:${a.impact==='alto'?'rgba(34,197,94,.2)':a.impact==='medio'?'rgba(245,158,11,.2)':'rgba(148,163,184,.2)'};color:${a.impact==='alto'?OG:a.impact==='medio'?'#F59E0B':'#94a3b8'};padding:1px 6px;border-radius:3px;font-size:7px;font-weight:700">Impacto ${a.impact}</span>`:''}
                    </div>`).join('')}
                </div>
            </div>
        </div>

        <!-- ===== PROPOSTA DE SERVIÇOS ===== -->
        <div style="padding:0 36px 16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                <div style="width:18px;height:3px;background:${OB};border-radius:2px"></div>
                <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:${OB}">Proposta de Serviços — ${company}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
                ${svcs.map((s,i)=>`<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;border-left:3px solid ${svcColors[i%svcColors.length]};flex:1;min-width:280px;page-break-inside:avoid">
                    <div style="font-size:10px;font-weight:700;color:${OD};margin-bottom:3px;line-height:1.2">${String(i+1).padStart(2,'0')}. ${s.n}</div>
                    <div style="font-size:8px;color:#64748b;line-height:1.45;margin-bottom:5px">${s.d}</div>
                    <div style="display:flex;flex-wrap:wrap;gap:3px">
                        ${s.items.map(item=>`<span style="font-size:7px;background:${OL};color:${OB};padding:2px 6px;border-radius:3px;font-weight:600">${item}</span>`).join('')}
                    </div>
                </div>`).join('')}
            </div>

            <!-- Investment bar -->
            <div style="background:linear-gradient(135deg,${OD},${OB});border-radius:12px;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;page-break-inside:avoid">
                <div>
                    <div style="color:rgba(255,255,255,.7);font-size:9px;text-transform:uppercase;letter-spacing:1.5px">Investimento total</div>
                    <div style="color:rgba(255,255,255,.5);font-size:8px;margin-top:1px">Personalizado após reunião de alinhamento</div>
                </div>
                <div style="text-align:right">
                    <div style="color:${OA};font-size:24px;font-weight:900;letter-spacing:-.5px">Sob Consulta</div>
                    <div style="color:rgba(255,255,255,.5);font-size:8px">Possibilidade de fases</div>
                </div>
            </div>
        </div>

        <!-- ===== ROI IMPACTO ===== -->
        <div style="padding:0 36px 16px;page-break-inside:avoid">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                <div style="width:18px;height:3px;background:${OB};border-radius:2px"></div>
                <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:${OB}">Impacto Projetado — 12 Meses</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;page-break-inside:avoid">
                ${roi.slice(0,6).map((r,i)=>{
                    const roiColors=[OA,OB,OG,OP,OD,OR];
                    return `<div style="background:${OL};border-radius:8px;padding:10px;text-align:center;flex:1;min-width:90px${i===0?';border-left:4px solid '+OA+';background:linear-gradient(135deg,#0d2137,#1a3a5a)':''}">
                        <div style="font-size:18px;font-weight:900;color:${i===0?OA:roiColors[i%roiColors.length]}">${r.value}</div>
                        <div style="font-size:7px;color:${i===0?'rgba(255,255,255,.85)':'#64748b'};text-transform:uppercase;letter-spacing:.5px;margin-top:2px;line-height:1.3">${r.label}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>

        <!-- ===== DIFERENCIAIS ===== -->
        <div style="padding:0 36px 16px;page-break-inside:avoid">
            <div style="background:linear-gradient(135deg,${OD},#1a3550);border-radius:10px;padding:14px 18px">
                <div style="font-size:9px;font-weight:800;color:${OA};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Diferenciais Guinux</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px">
                    <div style="flex:1;min-width:180px"><div style="font-size:8px;color:#fff;font-weight:700;margin-bottom:1px">🏢 23+ anos no mercado</div><div style="font-size:7.5px;color:rgba(255,255,255,.6);line-height:1.4">200+ empresas atendidas, parceiro estratégico comprovado.</div></div>
                    <div style="flex:1;min-width:180px"><div style="font-size:8px;color:#fff;font-weight:700;margin-bottom:1px">☁️ Google Cloud Partner</div><div style="font-size:7.5px;color:rgba(255,255,255,.6);line-height:1.4">Infraestrutura enterprise, SLA global, 4× Google Next.</div></div>
                    <div style="flex:1;min-width:180px"><div style="font-size:8px;color:#fff;font-weight:700;margin-bottom:1px">🤖 IA proprietária</div><div style="font-size:7.5px;color:rgba(255,255,255,.6);line-height:1.4">IA treinada com dados do cliente — não genérica.</div></div>
                </div>
            </div>
        </div>

        <!-- ===== PRÓXIMOS PASSOS ===== -->
        <div style="padding:0 36px 16px;page-break-inside:avoid">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                <div style="width:18px;height:3px;background:${OB};border-radius:2px"></div>
                <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:${OB}">Próximos Passos</div>
            </div>
            <div style="display:flex;gap:0;position:relative">
                <div style="flex:1;text-align:center;position:relative">
                    <div style="width:14px;height:14px;border-radius:50%;background:${OA};margin:0 auto 6px;border:2px solid #fff;box-shadow:0 0 0 2px ${OA}"></div>
                    <div style="font-size:8px;font-weight:800;color:${OD};text-transform:uppercase">Reunião</div>
                    <div style="font-size:7px;color:#94a3b8;margin-top:1px">30min com especialista</div>
                </div>
                <div style="flex:1;text-align:center;position:relative">
                    <div style="width:14px;height:14px;border-radius:50%;background:${OP};margin:0 auto 6px;border:2px solid #fff;box-shadow:0 0 0 2px ${OP}"></div>
                    <div style="font-size:8px;font-weight:800;color:${OD};text-transform:uppercase">Proposta Formal</div>
                    <div style="font-size:7px;color:#94a3b8;margin-top:1px">Escopo, valor e SLA</div>
                </div>
                <div style="flex:1;text-align:center;position:relative">
                    <div style="width:14px;height:14px;border-radius:50%;background:${OA};margin:0 auto 6px;border:2px solid #fff;box-shadow:0 0 0 2px ${OA}"></div>
                    <div style="font-size:8px;font-weight:800;color:${OD};text-transform:uppercase">Implementação</div>
                    <div style="font-size:7px;color:#94a3b8;margin-top:1px">Onboarding ágil</div>
                </div>
                <div style="flex:1;text-align:center;position:relative">
                    <div style="width:14px;height:14px;border-radius:50%;background:${OG};margin:0 auto 6px;border:2px solid #fff;box-shadow:0 0 0 2px ${OG}"></div>
                    <div style="font-size:8px;font-weight:800;color:${OD};text-transform:uppercase">Resultados</div>
                    <div style="font-size:7px;color:#94a3b8;margin-top:1px">Impacto em 30 dias</div>
                </div>
            </div>
        </div>

        <!-- ===== FOOTER ===== -->
        <div style="background:${OD};padding:16px 36px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="color:rgba(255,255,255,.5);font-size:8px">Guinux Inteligênc<span style="color:${OA}">IA</span> em TI · 23+ anos</div>
                <div style="color:rgba(255,255,255,.35);font-size:7px">Documento confidencial · ${docNum}</div>
            </div>
            <div style="border-top:1px solid rgba(255,255,255,.08);padding-top:8px;display:flex;gap:20px;flex-wrap:wrap">
                <span style="color:rgba(255,255,255,.55);font-size:8px">✉ hq@guinux.com.br</span>
                <span style="color:rgba(255,255,255,.55);font-size:8px">📞 (41) 4063-9294</span>
                <span style="color:rgba(255,255,255,.55);font-size:8px">🌐 guinux.com.br</span>
                <span style="color:rgba(255,255,255,.55);font-size:8px">📍 Curitiba — PR</span>
            </div>
        </div>
    </div>`;

    // White overlay while PDF renders (hidden from html2canvas via onclone)
    const pdfOverlay=document.createElement('div');
    pdfOverlay.id='__pdf_overlay__';
    pdfOverlay.style.cssText='position:fixed;inset:0;background:#fff;z-index:999999;display:flex;align-items:center;justify-content:center;';
    pdfOverlay.innerHTML='<div style="font-family:sans-serif;font-size:15px;color:#666;display:flex;align-items:center;gap:10px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B9EA8" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Gerando PDF…</div>';
    document.body.appendChild(pdfOverlay);

    const container=document.createElement('div');
    container.id='__pdf_container__';
    container.innerHTML=pdfHtml;
    container.style.cssText='position:fixed;left:0;top:0;width:700px;background:#fff;pointer-events:none;overflow:visible;';
    document.body.appendChild(container);

    // Force all images inside container to have explicit dimensions
    container.querySelectorAll('img').forEach(img=>{
        img.style.maxWidth='none';
        img.style.display='inline-block';
    });

    // Wait for images to load
    const imgs=container.querySelectorAll('img');
    const imgPromises=[...imgs].map(img=>new Promise(resolve=>{
        if(img.complete&&img.naturalWidth>0) return resolve();
        img.onload=resolve;
        img.onerror=resolve;
        setTimeout(resolve,3000);
    }));

    try{
        await Promise.all(imgPromises);
        await new Promise(r=>setTimeout(r,600));

        const h=container.scrollHeight;
        const opt={
            margin:0,
            filename:`Guinux_Proposta_${company.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`,
            image:{type:'jpeg',quality:0.98},
            html2canvas:{
                scale:2,
                useCORS:true,
                allowTaint:false,
                letterRendering:true,
                width:700,
                height:h,
                windowWidth:700,
                windowHeight:h,
                backgroundColor:'#ffffff',
                scrollX:0,
                scrollY:0,
                x:0,
                y:0,
                logging:false,
                onclone:function(clonedDoc){
                    // Remove the white overlay so it doesn't paint over everything
                    const ov=clonedDoc.getElementById('__pdf_overlay__');
                    if(ov) ov.remove();
                    // Fix container positioning for clean render
                    const el=clonedDoc.getElementById('__pdf_container__');
                    if(el){el.style.position='static';el.style.top='0';el.style.left='0';}
                }
            },
            jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
            pagebreak:{mode:['css','legacy']}
        };

        // Download PDF
        await html2pdf().set(opt).from(container).save();
        console.log('PDF generated successfully');

        // Generate blob for storage + email
        const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob').catch(()=>null);
        const base64 = pdfBlob ? await new Promise(resolve => {
            const reader = new FileReader();
            reader.readAsDataURL(pdfBlob);
            reader.onloadend = () => resolve((reader.result||'').split(',')[1] || null);
            reader.onerror = () => resolve(null);
        }) : null;

        if(base64){
            // 1. Save PDF to KV storage, get shareable URL
            let pdfUrl = null;
            try{
                const saveRes = await fetch('/api/save-pdf',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({ pdfBase64:base64, filename:opt.filename, company, email:chatData.email||'', name:chatData.name||'' })
                });
                const saveData = await saveRes.json();
                if(saveData.url){ pdfUrl = saveData.url; console.log('PDF saved:', pdfUrl); }
            }catch(e){ console.warn('PDF save error:', e); }

            // 2. Show link + copy button in chat
            if(pdfUrl) showPdfLink(pdfUrl, company);

            // 3. Send email with attachment + download link
            const visitorEmail = chatData.email || '';
            if(visitorEmail){
                const linkLine = pdfUrl ? `<p style="margin:12px 0"><a href="${pdfUrl}" style="display:inline-block;background:#2B5A8C;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">⬇ Baixar PDF online</a></p>` : '';
                fetch('/api/send-report',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                        to: visitorEmail,
                        name: chatData.name||'',
                        company,
                        subject:`Sua Análise & Proposta — ${company} | Guinux.IA`,
                        htmlContent:`<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e"><h2 style="color:#2B5A8C">Olá, ${chatData.name||''}!</h2><p>Segue em anexo sua <strong>Análise & Proposta personalizada</strong> para a <strong>${company}</strong>, gerada pela nossa IA.</p>${linkLine}<p>O documento inclui diagnóstico digital completo, oportunidades de automação e proposta personalizada para o seu negócio.</p><p>Estamos à disposição para uma reunião de alinhamento — sem compromisso.</p><br><p style="color:#2B5A8C"><strong>Guinux InteligêncIA em TI</strong><br>✉ hq@guinux.com.br · 📞 (41) 4063-9294<br><a href="https://guinux.com.br" style="color:#6BBED0">guinux.com.br</a></p></div>`,
                        pdfBase64: base64,
                        pdfFilename: opt.filename,
                        type:'proposal'
                    })
                }).then(r=>r.json()).then(r=>{
                    if(r.success) console.log('PDF sent by email to', visitorEmail);
                    else console.warn('Email send failed:', r.error);
                }).catch(e=>console.warn('Email send error:', e));
            }

            // 4. Send WhatsApp via Freshchat (if phone available and PDF URL exists)
            if(pdfUrl && chatData.phone){
                fetch('/api/whatsapp',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({ phone:chatData.phone, name:chatData.name||'', company, pdfUrl })
                }).then(r=>r.json()).then(r=>{
                    if(r.success) console.log('PDF link sent via WhatsApp');
                    else if(r.skipped) console.log('WhatsApp skipped:', r.reason);
                    else console.warn('WhatsApp send failed:', r.error);
                }).catch(e=>console.warn('WhatsApp error:', e));
            }
        }
    }catch(e){
        console.error('PDF error:',e);
        alert('Erro ao gerar PDF. Tente novamente.');
    }finally{
        try{document.body.removeChild(pdfOverlay);}catch(ex){}
        try{document.body.removeChild(container);}catch(ex){}
    }
}

/* ========= SILENT NOTIFICATION (Email + Google Chat Webhook) ========= */
async function notifySimulation(d, scores){
    try{
        await fetch('/api/notify',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                name:d.name||'',
                email:d.email||'',
                phone:d.phone||'',
                company:d.company||'',
                employees:scores.employeeEstimate||'',
                revenue:scores.revenueEstimate||'',
                risk:`${scores.risk} (${scores.riskScore}/10)`,
                maturity:`${scores.matLabel} (${scores.matScore}/10)`,
                potential:`${scores.potScore}/10`,
                hoursSaved:scores.hoursSaved||0,
                services:scores.services||'',
                pain:d.biggest_pain||'',
                segment:(d.companyResearch||{}).segmentLabel||''
            })
        });
    }catch(e){
        console.log('Notification error (non-critical):',e);
    }
}

/* ========= LEGACY COTAÇÃO GENERATOR (kept for reference) ========= */
async function generateCotacao(){
    chatInput.innerHTML='';chatInput.classList.remove('active');
    const d=chatData;
    const name=esc((d.name||'').split(' ')[0])||'Cliente';

    await showTyping(800);
    addBotMsg(`Perfeito, ${name}! Analisando o perfil da <strong>${esc(d.company||'sua empresa')}</strong>...`);
    await showTyping(1000);
    addBotMsg('🔄 Cruzando dados de porte, segmento e necessidade...');
    await showTyping(800);
    addBotMsg('🔄 Avaliando potencial de automação...');
    await showTyping(1200);
    addBotMsg('✅ Proposta pronta! Veja o que preparei:');
    await new Promise(r=>setTimeout(r,400));

    const recSvcs=[];
    const recDetails=[];
    const sz=d.employees||'1-10';
    const needs=Array.isArray(d.needs)?d.needs:(d.needs?[d.needs]:['suporte']);
    const pain=d.pain||'';
    const segment=d.segment||'outro';
    const repTasks=d.repetitive_tasks||'unknown';

    // Smart recommendations based on multi-select needs
    if(needs.includes('suporte')){
        recSvcs.push('it_management');
        recDetails.push({svc:'Gestão de TI Completa',why:'Help Desk dedicado, monitoramento 24/7, segurança e backup. A base para tudo funcionar.',icon:'🛡️'});
    }
    if(needs.includes('google')){
        recSvcs.push('google_workspace');
        recDetails.push({svc:'Google Workspace com IA Gemini',why:'E-mail corporativo, Drive, Meet e Gemini AI integrado para produtividade máxima.',icon:'📧'});
    }
    if(needs.includes('ia')||needs.includes('automacao')||repTasks==='many'){
        recSvcs.push('ai_development');
        recDetails.push({svc:'IA Aplicada & Automação',why:'Eliminação de tarefas repetitivas, dashboards inteligentes e chatbots com IA.',icon:'🤖'});
    }
    if(needs.includes('portal')){
        recSvcs.push('portal_ia');
        recDetails.push({svc:'Portal Corporativo com IA',why:'Portal de alta tecnologia com IA nativa — financeiro, RH, projetos, processos em uma interface inteligente que aprende com sua operação.',icon:'🌐'});
    }
    if(needs.includes('cto')||(sz==='50-100'||sz==='100+'||sz==='100-500'||sz==='500+')){
        recSvcs.push('cto_service');
        recDetails.push({svc:'CTO as a Service',why:'Liderança tecnológica, estratégia e governança sem custo de C-level fixo.',icon:'🎯'});
    }
    if(needs.includes('automacao')&&!recSvcs.includes('ai_development')){
        recSvcs.push('ai_development');
        recDetails.push({svc:'Automação de Processos (RPA + IA)',why:'Elimine tarefas repetitivas — sua equipe foca no estratégico.',icon:'⚡'});
    }
    if(pain==='seguranca'&&!recSvcs.includes('it_management')){
        recSvcs.push('it_management');
        recDetails.push({svc:'Gestão de TI + Segurança',why:'Segurança corporativa, LGPD e compliance — proteja dados e operação.',icon:'🔒'});
    }
    if(pain==='produtividade'&&!recSvcs.includes('ai_development')){
        recSvcs.push('ai_development');
        recDetails.push({svc:'IA para Produtividade',why:'Automação e IA para eliminar tarefas repetitivas e otimizar equipe.',icon:'🤖'});
    }
    if(recSvcs.length===0){
        recSvcs.push('it_management');
        recDetails.push({svc:'Gestão de TI Completa',why:'Base sólida para qualquer empresa que quer crescer com tecnologia.',icon:'🛡️'});
    }

    // Segment-specific insight
    const segInsights={
        juridico:'Escritórios de advocacia que adotam IA aumentam produtividade em até 40% na análise documental. A OAB Paraná, nosso cliente, é referência nessa transformação.',
        imobiliario:'O setor imobiliário está entre os que mais se beneficiam de portais com IA. Cases como a DCL Real Estate comprovam ganhos de eficiência operacional.',
        industria:'Indústrias com TI bem estruturada reduzem paradas não planejadas em até 60%. Nosso cliente Leal Embalagens é case aprovado pelo Google.',
        saude:'Na saúde, segurança de dados e LGPD não são opcionais — são obrigação legal. IA em prontuários e agendamentos transforma a operação.',
        servicos:'Empresas de serviços que implementam IA ganham velocidade e escala sem aumentar equipe. A automação de propostas e follow-up é game-changer.',
        varejo:'No varejo, IA em atendimento e logística pode aumentar conversão em até 25%. Automação de estoque e precificação geram economia imediata.',
        tecnologia:'Mesmo empresas de tech se beneficiam de outsourcing de TI para focar no core business. Sua equipe de dev não deveria cuidar de infra.',
        educacao:'Na educação, IA transforma comunicação com alunos, matrículas e gestão acadêmica. Automação reduz carga administrativa em até 50%.',
    };

    const optimizations=[];
    if(pain==='instavel') optimizations.push({text:'Redução de até 95% no downtime com monitoramento proativo',pct:95});
    if(pain==='custo') optimizations.push({text:'Economia de 30-40% migrando para nuvem otimizada',pct:35});
    if(pain==='produtividade') optimizations.push({text:'Até 35% mais produtividade com IA em tarefas repetitivas',pct:35});
    if(pain==='sem_controle') optimizations.push({text:'Visibilidade total com dashboards e relatórios em tempo real',pct:80});
    if(pain==='seguranca') optimizations.push({text:'LGPD, backup e segurança corporativa implementados',pct:90});
    if(pain==='inovacao') optimizations.push({text:'Roadmap de inovação com IA, automação e transformação digital',pct:70});
    if(repTasks==='many') optimizations.push({text:'Automação de tarefas repetitivas com IA — economia de horas/semana',pct:85});
    else if(repTasks==='some') optimizations.push({text:'Processos automatizáveis identificados — ganho estimado de 20%',pct:60});
    if(optimizations.length===0) optimizations.push({text:'Estrutura profissional de TI pode aumentar produtividade em até 30%',pct:30});

    // Estimate automation hours saved
    const empMap={'1-10':8,'10-25':20,'25-50':40,'50-100':80,'100-500':200,'100+':200,'500+':500};
    const empCount=empMap[sz]||10;
    const taskMult=repTasks==='many'?0.15:repTasks==='some'?0.08:0.04;
    const hoursSaved=Math.round(empCount*taskMult*4);

    // Build card
    let html=`<div class="diagnosis cotacao-card">`;
    html+=`<div class="diag-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg> PROPOSTA PERSONALIZADA</div>`;

    // Company profile
    html+=`<div class="diag-section"><div class="diag-company-badge">`;
    html+=`<strong>${esc(d.company)}</strong>`;
    html+=`<span>${d.employees} colaboradores · ${esc(segment)}</span></div></div>`;

    // Segment insight
    if(segInsights[segment]){
        html+=`<div class="diag-insight"><span class="diag-insight-icon">💡</span><span>${segInsights[segment]}</span></div>`;
    }

    // Automation insight
    if(hoursSaved>0){
        html+=`<div class="diag-insight"><span class="diag-insight-icon">⚡</span><span>Com base no porte e perfil da ${esc(d.company)}, estimamos que <strong>${hoursSaved}+ horas/mês</strong> podem ser economizadas com automação e IA em tarefas repetitivas.</span></div>`;
    }

    // Recommended services
    html+=`<div class="diag-section"><h4>Serviços Recomendados</h4>`;
    recDetails.forEach(s=>{
        html+=`<div class="diag-svc-card">`;
        html+=`<span class="diag-svc-icon">${s.icon}</span>`;
        html+=`<div><strong>${s.svc}</strong><span>${s.why}</span></div></div>`;
    });
    html+=`</div>`;

    // Optimization bars
    html+=`<div class="diag-section"><h4>Potencial de Otimização</h4>`;
    optimizations.forEach(o=>{
        html+=`<div class="diag-opt-row"><span class="diag-opt-label">${o.text}</span>`;
        html+=`<div class="diag-bar"><div class="diag-bar-fill pot-high" style="width:${o.pct}%"></div></div></div>`;
    });
    html+=`</div>`;

    // Urgency badge
    const urgLabel=d.urgency==='imediata'?'⚡ Atendimento prioritário — resposta em até 2h':'📅 Agendaremos uma reunião de apresentação';
    html+=`<div class="diag-urgency"><span>${urgLabel}</span></div>`;

    // CTA
    const needsLabel=Array.isArray(d.needs)?d.needs.join(', '):(d.needs||'');
    const waMsg=encodeURIComponent(`Olá! Sou ${d.name} da ${d.company} (${d.employees} colaboradores, segmento ${d.segment}). Fiz uma cotação no site e tenho interesse em: ${recDetails.map(s=>s.svc).join(', ')}. Necessidades: ${needsLabel}. Urgência: ${d.urgency}.`);
    html+=`<div class="diag-cta">`;
    html+=`<a href="https://wa.me/554140639294?text=${waMsg}" class="btn-main" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Falar com especialista</a>`;
    html+=`<button class="btn-ghost" onclick="sendByEmail('cotacao')">📧 Enviar por e-mail</button>`;
    html+=`<button class="btn-ghost" onclick="switchFlow('diagnostico')">Fazer diagnóstico completo →</button>`;
    html+=`</div></div>`;

    addRawMsg(html);
    expandAndAnimate();
}

/* ========= DIAGNOSIS GENERATOR (Impressionante) ========= */
async function generateDiagnosis(){
    chatInput.innerHTML='';chatInput.classList.remove('active');
    const d=chatData;
    const name=esc((d.name||'').split(' ')[0])||'Cliente';

    // Dramatic analysis sequence
    await showTyping(800);
    addBotMsg(`${name}, coletei todas as informações. Iniciando análise com IA...`);
    await showTyping(1000);
    addBotMsg('🔄 Processando perfil da empresa e segmento...');
    await showTyping(800);
    addBotMsg('🔄 Avaliando infraestrutura e segurança...');
    await showTyping(800);
    addBotMsg('🔄 Analisando potencial de automação e IA...');
    await showTyping(800);
    addBotMsg('🔄 Calculando maturidade digital e risco operacional...');
    await showTyping(800);
    addBotMsg('🔄 Gerando recomendações personalizadas...');
    await showTyping(1200);
    addBotMsg('✅ Diagnóstico concluído! Resultado impressionante.');
    await new Promise(r=>setTimeout(r,500));

    const risk=calcRisk(d);
    const pot=calcPotential(d);
    const maturity=calcMaturity(d);
    const svcs=recommendSvcs(d);
    const segment=d.segment||'outro';
    const repTasks=d.repetitive_tasks||'unknown';
    const repExamples=d.repetitive_examples||'';
    const autoInterest=d.automation_interest||'medium';

    // Estimate automation
    const empMap={'1-10':8,'10-25':20,'25-50':40,'50-100':80,'100-500':200,'100+':200,'500+':500};
    const empCount=empMap[d.employees]||10;
    const taskMult=repTasks==='many'?0.15:repTasks==='some'?0.08:0.04;
    const hoursSaved=Math.round(empCount*taskMult*4);
    const moneySaved=Math.round(hoursSaved*45);

    // Automation-specific examples based on their answers
    const autoExamples={
        reports:'Relatórios e planilhas podem ser gerados automaticamente por IA, economizando horas semanais',
        support:'Chatbots com IA podem responder até 70% das perguntas frequentes dos clientes 24/7',
        approvals:'Fluxos de aprovação digital eliminam gargalos — aprovações que levavam dias viram minutos',
        data_entry:'Entrada de dados automatizada com IA — extração de informações de documentos e e-mails',
        finance:'Conciliação financeira e contas a pagar/receber automatizadas reduzem erros e tempo em 80%',
        docs:'Gestão inteligente de documentos com IA — busca, classificação e versionamento automáticos'
    };

    // Build diagnosis card
    let html=`<div class="diagnosis diag-premium">`;
    html+=`<div class="diag-header-bar">`;
    html+=`<div class="diag-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.5 7.5L22 10l-7.5 2.5L12 20l-2.5-7.5L2 10l7.5-2.5L12 0z"/></svg> DIAGNÓSTICO COMPLETO — ${esc(d.company).toUpperCase()}</div>`;
    html+=`<div class="diag-company-badge"><strong>${esc(d.company)}</strong><span>${d.employees} colaboradores · ${esc(segment)}</span></div>`;
    html+=`</div>`;

    // 3 score gauges
    const riskClass=risk.score>=7?'risk-high':risk.score>=4?'risk-mid':'risk-low';
    const riskLabel=risk.score>=7?'ALTO':risk.score>=4?'MÉDIO':'BAIXO';
    const riskEmoji=risk.score>=7?'🔴':risk.score>=4?'🟡':'🟢';
    const matLabel=maturity.score>=7?'AVANÇADA':maturity.score>=4?'INTERMEDIÁRIA':'INICIAL';
    const matClass=maturity.score>=7?'pot-high':maturity.score>=4?'risk-mid':'risk-high';

    html+=`<div class="diag-scores">`;
    html+=`<div class="diag-score-card"><div class="diag-score-number ${riskClass}">${risk.score}<span>/10</span></div><div class="diag-score-label">${riskEmoji} Risco ${riskLabel}</div></div>`;
    html+=`<div class="diag-score-card"><div class="diag-score-number ${matClass}">${maturity.score}<span>/10</span></div><div class="diag-score-label">📊 Maturidade ${matLabel}</div></div>`;
    html+=`<div class="diag-score-card"><div class="diag-score-number pot-high">${pot.score}<span>/10</span></div><div class="diag-score-label">🚀 Potencial de Melhoria</div></div>`;
    html+=`</div>`;

    // Risk analysis
    html+=`<div class="diag-section"><h4>⚠️ Análise de Risco</h4>`;
    html+=`<div class="diag-bar"><div class="diag-bar-fill ${riskClass}" style="width:${risk.score*10}%"></div></div>`;
    html+=`<ul class="diag-items risk">${risk.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    // Maturity analysis
    html+=`<div class="diag-section"><h4>📊 Maturidade Digital</h4>`;
    html+=`<div class="diag-bar"><div class="diag-bar-fill ${matClass}" style="width:${maturity.score*10}%"></div></div>`;
    html+=`<ul class="diag-items potential">${maturity.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    // AUTOMATION & AI section (NEW - impressive)
    html+=`<div class="diag-section"><h4>🤖 Análise de Automação & IA</h4>`;
    if(hoursSaved>0){
        html+=`<div class="diag-insight"><span class="diag-insight-icon">⚡</span><span>Estimativa: <strong>${hoursSaved}+ horas/mês</strong> economizadas com automação (≈ R$ ${moneySaved.toLocaleString('pt-BR')}/mês em produtividade recuperada)</span></div>`;
    }
    if(autoExamples[repExamples]){
        html+=`<div class="diag-insight"><span class="diag-insight-icon">🎯</span><span>${autoExamples[repExamples]}</span></div>`;
    }
    const autoItems=[];
    if(repTasks==='many') autoItems.push('Alto volume de tarefas repetitivas — automação é prioridade #1');
    else if(repTasks==='some') autoItems.push('Tarefas repetitivas identificadas — bom potencial de automação');
    if(d.ai_usage==='none') autoItems.push('Sem IA na operação — implementar agora coloca a empresa na frente dos concorrentes');
    else if(d.ai_usage==='scattered') autoItems.push('IA sem governança — centralizar uso evita vazamento de dados e multiplica resultados');
    else if(d.ai_usage==='basic') autoItems.push('Uso básico de IA — integrar Gemini/Claude no fluxo de trabalho amplifica resultados em 3x');
    if(autoInterest==='high') autoItems.push('Interesse alto em automação — ROI rápido, resultados em 30-60 dias');
    const segAutoHints={
        juridico:'IA pode analisar contratos, gerar petições e classificar documentos automaticamente',
        imobiliario:'Atendimento 24/7 com chatbot IA, gestão de contratos e follow-up automático',
        industria:'Monitoramento de produção, controle de qualidade e manutenção preditiva com IA',
        servicos:'Automação de propostas, contratos, follow-up e relatórios de projeto',
        saude:'Triagem inteligente, agendamento otimizado e gestão de prontuários com IA',
        varejo:'Precificação dinâmica, previsão de demanda e atendimento inteligente',
        tecnologia:'CI/CD automatizado, monitoramento inteligente e gestão de incidentes com IA',
        educacao:'Comunicação personalizada, gestão de matrículas e análise de desempenho com IA'
    };
    if(segAutoHints[segment]) autoItems.push(segAutoHints[segment]);
    html+=`<ul class="diag-items potential">${autoItems.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    // Potential
    html+=`<div class="diag-section"><h4>🚀 Potencial de Melhoria</h4>`;
    html+=`<div class="diag-bar"><div class="diag-bar-fill pot-high" style="width:${pot.score*10}%"></div></div>`;
    html+=`<ul class="diag-items potential">${pot.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    // Personalized recommendations
    html+=`<div class="diag-section"><h4>✨ Recomendações Personalizadas</h4>`;
    const recs=getDetailedRecs(d,risk,maturity);
    recs.forEach(r=>{
        html+=`<div class="diag-svc-card"><span class="diag-svc-icon">${r.icon}</span><div><strong>${r.title}</strong><span>${r.desc}</span></div></div>`;
    });
    html+=`</div>`;

    // ROI estimate (enhanced)
    const roi=calcROI(d,risk);
    if(hoursSaved>10) roi.push({value:`↑ ${hoursSaved}h`,label:'Horas/mês economizadas'});
    html+=`<div class="diag-roi"><div class="diag-roi-title">📈 Estimativa de Impacto (12 meses)</div><div class="diag-roi-grid">`;
    roi.slice(0,6).forEach(r=>{
        html+=`<div class="diag-roi-item"><div class="diag-roi-value">${r.value}</div><div class="diag-roi-label">${r.label}</div></div>`;
    });
    html+=`</div></div>`;

    // Biggest pain echo
    if(d.biggest_pain){
        html+=`<div class="diag-insight"><span class="diag-insight-icon">🎯</span><span>Sobre "<em>${esc(d.biggest_pain)}</em>" — isso é exatamente o tipo de problema que resolvemos. A ${esc(d.company)} tem perfil muito parecido com clientes nossos que viram resultados em menos de 30 dias após implementação.</span></div>`;
    }

    // CTA
    const waMsg=encodeURIComponent(`Olá! Sou ${d.name} da ${d.company} (${d.employees} colab., ${segment}). Fiz o diagnóstico no site:\n\n📊 Risco: ${riskLabel} (${risk.score}/10)\n📊 Maturidade: ${matLabel} (${maturity.score}/10)\n📊 Potencial: ${pot.score}/10\n⚡ Horas/mês automatizáveis: ${hoursSaved}+\n\nGostaria de conversar sobre: ${svcs.map(s=>SVC_NAMES[s]).join(', ')}.${d.biggest_pain?'\n\nDesafio principal: '+d.biggest_pain:''}`);
    html+=`<div class="diag-cta">`;
    html+=`<a href="https://wa.me/554140639294?text=${waMsg}" class="btn-main" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Falar com especialista agora</a>`;
    html+=`<button class="btn-ghost" onclick="sendByEmail('diagnostico')">📧 Enviar diagnóstico por e-mail</button>`;
    html+=`<button class="btn-ghost" onclick="switchFlow('cotacao')">Ver cotação personalizada →</button>`;
    html+=`</div></div>`;

    addRawMsg(html);
    expandAndAnimate();
}

function expandAndAnimate(){
    const chatEl=document.getElementById('chatMessages');
    chatEl.style.maxHeight='none';
    setTimeout(()=>{
        scrollChat();
        document.querySelectorAll('.diag-bar-fill').forEach(b=>{
            const w=b.style.width;b.style.width='0%';
            setTimeout(()=>b.style.width=w,50);
        });
        const diag=document.querySelector('.diagnosis');
        if(diag) diag.scrollIntoView({behavior:'smooth',block:'start'});
    },200);
}

/* ========= CALCULATION ENGINES ========= */

function calcRisk(d){
    let score=0;const items=[];
    if(!d.backup) d.backup='cloud_auto'; // default when question removed
    if(d.it_status==='none'){score+=3;items.push('Sem equipe de TI — vulnerabilidade crítica em caso de incidentes')}
    else if(d.it_status==='outsourced'){score+=2;items.push('TI terceirizada com insatisfação — risco de queda no serviço')}
    if(d.infra==='onprem'){score+=2;items.push('Servidores locais — risco de perda de dados, ransomware e downtime')}
    else if(d.infra==='unknown'){score+=1.5;items.push('Infraestrutura desconhecida — falta de visibilidade aumenta riscos')}
    if(d.ai_usage==='none'){score+=0.5;items.push('Sem IA — concorrentes que adotam ganham vantagem competitiva')}
    else if(d.ai_usage==='scattered'){score+=1;items.push('IA sem governança — risco de vazamento de dados sensíveis')}
    if(d.satisfaction&&d.satisfaction<=2){score+=1;items.push('Baixa satisfação com TI — pode estar impactando a operação diariamente')}
    const emp=d.employees||'';
    if((emp==='50-100'||emp==='100+')&&d.it_status==='none'){score+=1;items.push('Empresa de grande porte sem TI dedicada — exposição severa')}
    if(items.length===0)items.push('Cenário atual com risco operacional controlado');
    return{score:Math.min(Math.round(score),10),items};
}

function calcPotential(d){
    let score=0;const items=[];
    if(d.ai_usage==='none'){score+=3;items.push('Implementar IA pode gerar até 35% de ganho em eficiência operacional')}
    else if(d.ai_usage==='scattered'){score+=2;items.push('Centralizar IA com governança elimina redundâncias e acelera resultados')}
    else{score+=1;items.push('Escalar IA existente com automações avançadas e integrações profundas')}
    if(d.infra==='onprem'){score+=2;items.push('Migração para nuvem pode reduzir custos de infraestrutura em até 40%')}
    else if(d.infra==='hybrid'){score+=1;items.push('Otimizar modelo híbrido para máxima eficiência e menor custo')}
    if(d.it_status==='none'||d.it_status==='outsourced'){score+=2;items.push('Gestão profissional de TI pode elevar uptime para 99.9%')}
    if(d.backup==='none'||d.backup==='manual'){score+=1;items.push('Backup automatizado na nuvem garante continuidade do negócio')}
    const emp=d.employees||'';
    if(emp==='50-100'||emp==='100+'){score+=1;items.push('Escala da empresa maximiza ROI de cada investimento em tecnologia')}
    if(d.satisfaction&&d.satisfaction<=3){score+=0.5;items.push('Grande margem para melhoria na experiência de TI dos colaboradores')}
    return{score:Math.min(Math.round(score),10),items};
}

function calcMaturity(d){
    let score=10;const items=[];
    // Start at 10 and subtract
    if(d.it_status==='none'){score-=3;items.push('Sem equipe de TI dedicada')}
    else if(d.it_status==='outsourced'){score-=1.5;items.push('TI terceirizada com insatisfação')}
    else if(d.it_status==='internal'){score-=0.5;items.push('TI interna — bom, mas pode escalar melhor')}
    else{items.push('Modelo híbrido de TI — boa prática')}

    if(d.infra==='onprem'){score-=2;items.push('Infraestrutura local — modelo legado')}
    else if(d.infra==='cloud'){items.push('Infraestrutura na nuvem — moderno')}
    else if(d.infra==='unknown'){score-=2;items.push('Infraestrutura desconhecida — falta de governança')}

    if(d.backup==='cloud_auto'){items.push('Backup automático na nuvem — excelente')}
    else if(d.backup==='manual'){score-=1.5;items.push('Backup manual — processo frágil')}
    else if(d.backup==='none'){score-=2.5;items.push('Sem backup — risco crítico')}

    if(d.ai_usage==='optimize'){items.push('Já utiliza IA — empresa inovadora')}
    else if(d.ai_usage==='none'){score-=1;items.push('Sem uso de IA — oportunidade latente')}

    const tools=d.tools||[];
    if(tools.includes('google')||tools.includes('microsoft')){items.push('Ferramentas de produtividade em uso')}
    if(tools.includes('erp')){items.push('ERP implementado')}
    if(tools.includes('crm')){items.push('CRM em uso')}
    if(tools.includes('none')){score-=1;items.push('Nenhuma ferramenta corporativa — processo manual')}

    return{score:Math.max(Math.min(Math.round(score),10),1),items};
}

function recommendSvcs(d){
    const svcs=new Set();
    if(d.it_status==='none'||d.it_status==='outsourced')svcs.add('it_management');
    if(d.ai_usage!=='optimize')svcs.add('google_workspace');
    if(d.ai_usage==='none'||d.ai_usage==='scattered'||d.ai_usage==='basic')svcs.add('ai_development');
    if(d.repetitive_tasks==='many'||d.automation_interest==='high')svcs.add('ai_development');
    const emp=d.employees||'';
    if(emp==='50-100'||emp==='100+'||emp==='100-500'||emp==='500+')svcs.add('cto_service');
    if(svcs.size===0)svcs.add('it_management');
    return[...svcs];
}

function getDetailedRecs(d,risk,maturity){
    const recs=[];
    if(d.it_status==='none'||d.it_status==='outsourced'){
        recs.push({icon:'🛡️',title:'Gestão de TI Completa',desc:'Help Desk dedicado, monitoramento 24/7, gestão de ativos, backup e segurança. Base para tudo funcionar.'});
    }
    if(d.backup==='none'||d.backup==='manual'){
        recs.push({icon:'💾',title:'Backup & Disaster Recovery',desc:'Backup automático na nuvem com recuperação rápida. Nunca mais perca dados por incidente ou ransomware.'});
    }
    if(d.ai_usage==='none'||d.ai_usage==='scattered'||d.ai_usage==='basic'){
        recs.push({icon:'🤖',title:'IA Aplicada & Automação',desc:'Implementar IA com governança: automação de processos, chatbots, dashboards inteligentes com Gemini e Claude.'});
    }
    if(d.repetitive_tasks==='many'||d.repetitive_tasks==='some'){
        recs.push({icon:'⚡',title:'Automação de Processos (RPA + IA)',desc:'Eliminar tarefas repetitivas com automação inteligente. Sua equipe foca no estratégico, a IA cuida do operacional.'});
    }
    const tools=d.tools||[];
    if(!tools.includes('google')&&!tools.includes('microsoft')){
        recs.push({icon:'📧',title:'Google Workspace com Gemini',desc:'E-mail corporativo, Drive, Meet, Chat e Gemini AI integrado. Produtividade e colaboração em outro nível.'});
    }
    const emp=d.employees||'';
    if(emp==='50-100'||emp==='100+'||emp==='100-500'||emp==='500+'){
        recs.push({icon:'🎯',title:'CTO as a Service',desc:'Liderança tecnológica estratégica, roadmap de inovação, governança e compliance sem custo de C-level fixo.'});
    }
    if(recs.length===0){
        recs.push({icon:'🚀',title:'Consultoria de Inovação',desc:'Análise aprofundada e roadmap personalizado para transformação digital da sua empresa.'});
    }
    return recs;
}

function calcROI(d,risk){
    const roi=[];
    if(d.it_status==='none'||d.it_status==='outsourced'){
        roi.push({value:'↑ 99.9%',label:'Uptime da operação'});
    }
    if(d.backup==='none'||d.backup==='manual'){
        roi.push({value:'↓ 95%',label:'Risco de perda de dados'});
    }
    if(d.ai_usage==='none'){
        roi.push({value:'↑ 35%',label:'Produtividade com IA'});
    } else if(d.ai_usage==='scattered'){
        roi.push({value:'↑ 20%',label:'Eficiência com IA governada'});
    }
    if(d.infra==='onprem'){
        roi.push({value:'↓ 40%',label:'Custo de infraestrutura'});
    }
    if(d.satisfaction&&d.satisfaction<=3){
        roi.push({value:'↑ 4x',label:'Satisfação da equipe com TI'});
    }
    if(d.repetitive_tasks==='many'){
        roi.push({value:'↓ 60%',label:'Tempo em tarefas manuais'});
    }
    if(roi.length===0){
        roi.push({value:'↑ 30%',label:'Eficiência operacional'});
        roi.push({value:'↓ 25%',label:'Custo total de TI'});
    }
    return roi.slice(0,6);
}

/* ========= SEND BY EMAIL (automatic with beautiful HTML) ========= */
async function sendByEmail(type){
    const d=chatData;
    const email=d.email||'';
    if(!email){
        addBotMsg('⚠️ E-mail não informado. Refaça o processo para incluir seu e-mail.');
        return;
    }
    const name=d.name||'Cliente';
    const company=d.company||'Empresa';
    const segment=d.segment||'';
    const employees=d.employees||'';

    await showTyping(600);
    addBotMsg(`📧 Enviando para <strong>${esc(email)}</strong>...`);

    // Build beautiful HTML email
    const htmlContent=generateEmailHTML(type,d);
    const subject=type==='analise'
        ?`Análise Completa & Proposta — ${company} | Guinux.IA`
        :type==='diagnostico'
        ?`Diagnóstico Digital — ${company} | Guinux.IA`
        :`Cotação Personalizada — ${company} | Guinux.IA`;

    try{
        const res=await fetch('/api/send-report',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({to:email,name,company,subject,htmlContent,type})
        });
        const data=await res.json();
        if(data.success){
            addBotMsg(`✅ Enviado com sucesso para <strong>${esc(email)}</strong>! Verifique sua caixa de entrada (e spam, por precaução).`);
        }else{
            console.error('Email API error:',data);
            addBotMsg(`⚠️ Falha no envio (${data.status||'erro'}). Tente novamente ou entre em contato pelo telefone (41) 4063-9294.`);
        }
    }catch(err){
        console.error('Email send error:',err);
        addBotMsg(`⚠️ Erro de conexão ao enviar e-mail. Tente novamente em instantes.`);
    }
}

function generateEmailHTML(type,d){
    const name=d.name||'Cliente';
    const company=d.company||'Empresa';
    const segment=d.segment||'';
    const employees=d.employees||'';

    const headerColor='#1A7A7A';
    const bgColor='#f7f8fa';

    let content='';

    if(type==='analise'){
        const cr=d.companyResearch||{};
        const risk=calcRisk(d);
        const maturity=calcMaturity(d);
        const pot=calcPotential(d);
        const riskLabel=risk.score>=7?'ALTO':risk.score>=4?'MÉDIO':'BAIXO';
        const matLabel=maturity.score>=7?'AVANÇADA':maturity.score>=4?'INTERMEDIÁRIA':'INICIAL';
        const riskColor=risk.score>=7?'#e74c3c':risk.score>=4?'#f39c12':'#27ae60';
        const matColor=maturity.score>=7?'#27ae60':maturity.score>=4?'#f39c12':'#e74c3c';
        const employeeEst=cr.employeeEstimate||'25-50';
        const revenueEst=cr.revenueEstimate||'R$ 2M – R$ 10M/ano';
        const segLabel=cr.segmentLabel||'';
        const seg=cr.segment||'outro';
        const empMap2={'10-25':20,'25-50':40,'50-100':80,'100+':200};
        const empCount2=empMap2[employeeEst]||30;
        const taskMult2=(d.repetitive_tasks==='many')?0.15:(d.repetitive_tasks==='some')?0.08:0.04;
        const hoursSaved2=Math.round(empCount2*taskMult2*4);
        const recs=getDetailedRecs(d,risk,maturity);
        const roi=calcROI(d,risk);
        const needs=Array.isArray(d.needs)?d.needs:(d.needs?[d.needs]:[]);

        // Build service recommendations for email
        const emailSvcs=[];
        if(needs.includes('suporte')||d.it_status==='none'||d.it_status==='outsourced') emailSvcs.push({n:'Gestão de TI Completa',i:'🛡️',w:'Help Desk dedicado, monitoramento 24/7'});
        if(needs.includes('google')) emailSvcs.push({n:'Google Workspace com IA Gemini',i:'📧',w:'E-mail corporativo + Gemini AI'});
        if(needs.includes('ia')||needs.includes('automacao')||d.repetitive_tasks==='many') emailSvcs.push({n:'IA Aplicada & Automação',i:'🤖',w:'Dashboards, chatbots e automação'});
        if(needs.includes('portal')) emailSvcs.push({n:'Portal Corporativo com IA',i:'🌐',w:'Portal inteligente com IA nativa'});
        if(needs.includes('cto')) emailSvcs.push({n:'CTO as a Service',i:'🎯',w:'Liderança tech estratégica'});
        if(emailSvcs.length===0) emailSvcs.push({n:'Consultoria de Inovação',i:'🚀',w:'Roadmap de transformação digital'});

        content=`
        <div style="background:${bgColor};padding:20px;border-radius:12px;margin:20px 0">
            <h2 style="color:#1A1A2A;margin:0 0 4px">${company}</h2>
            <p style="color:#666;margin:0;font-size:14px">${segLabel?'📌 '+segLabel+' · ':''}👥 ~${employeeEst} colaboradores · 💰 ${revenueEst}</p>
        </div>

        <table width="100%" cellpadding="0" cellspacing="12" style="margin:20px 0">
            <tr>
                <td style="background:#fff;border:2px solid ${riskColor};border-radius:12px;padding:20px;text-align:center;width:33%">
                    <div style="font-size:36px;font-weight:800;color:${riskColor}">${risk.score}<span style="font-size:16px;color:#999">/10</span></div>
                    <div style="font-size:12px;font-weight:700;color:${riskColor};text-transform:uppercase">Risco ${riskLabel}</div>
                </td>
                <td style="background:#fff;border:2px solid ${matColor};border-radius:12px;padding:20px;text-align:center;width:33%">
                    <div style="font-size:36px;font-weight:800;color:${matColor}">${maturity.score}<span style="font-size:16px;color:#999">/10</span></div>
                    <div style="font-size:12px;font-weight:700;color:${matColor};text-transform:uppercase">Maturidade ${matLabel}</div>
                </td>
                <td style="background:#fff;border:2px solid ${headerColor};border-radius:12px;padding:20px;text-align:center;width:33%">
                    <div style="font-size:36px;font-weight:800;color:${headerColor}">${pot.score}<span style="font-size:16px;color:#999">/10</span></div>
                    <div style="font-size:12px;font-weight:700;color:${headerColor};text-transform:uppercase">Potencial</div>
                </td>
            </tr>
        </table>

        <div style="background:#fff;border-radius:12px;padding:20px;margin:16px 0;border-left:4px solid ${riskColor}">
            <h3 style="color:#1A1A2A;margin:0 0 12px">⚠️ Análise de Risco</h3>
            ${risk.items.map(i=>`<p style="color:#555;margin:4px 0;font-size:14px">• ${i}</p>`).join('')}
        </div>

        <div style="background:#fff;border-radius:12px;padding:20px;margin:16px 0;border-left:4px solid ${matColor}">
            <h3 style="color:#1A1A2A;margin:0 0 12px">📊 Maturidade Digital</h3>
            ${maturity.items.map(i=>`<p style="color:#555;margin:4px 0;font-size:14px">• ${i}</p>`).join('')}
        </div>

        ${hoursSaved2>0?`
        <div style="background:linear-gradient(135deg,#1A7A7A10,#2B5A8C10);border-radius:12px;padding:20px;margin:16px 0;border:1px solid #1A7A7A30">
            <h3 style="color:#1A1A2A;margin:0 0 8px">⚡ Potencial de Automação</h3>
            <p style="color:#1A7A7A;font-size:24px;font-weight:800;margin:8px 0">${hoursSaved2}+ horas/mês</p>
            <p style="color:#666;font-size:14px;margin:0">podem ser economizadas com automação e IA (≈ R$ ${(hoursSaved2*45).toLocaleString('pt-BR')}/mês)</p>
        </div>`:''}

        <div style="background:#fff;border-radius:12px;padding:20px;margin:16px 0;border-left:4px solid ${headerColor}">
            <h3 style="color:#1A1A2A;margin:0 0 12px">🚀 Potencial de Melhoria</h3>
            ${pot.items.map(i=>`<p style="color:#555;margin:4px 0;font-size:14px">• ${i}</p>`).join('')}
        </div>

        <div style="background:#fff;border-radius:12px;padding:20px;margin:16px 0">
            <h3 style="color:#1A1A2A;margin:0 0 16px">✨ Proposta de Serviços Personalizados</h3>
            ${emailSvcs.map(s=>`<div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:${bgColor};border-radius:8px;margin:8px 0">
                <span style="font-size:24px">${s.i}</span>
                <div><strong style="color:#1A1A2A">${s.n}</strong><br><span style="color:#666;font-size:13px">${s.w}</span></div>
            </div>`).join('')}
        </div>

        <div style="background:linear-gradient(135deg,#1A7A7A,#2B5A8C);border-radius:12px;padding:24px;margin:16px 0;color:#fff">
            <h3 style="color:#fff;margin:0 0 16px">📈 Estimativa de Impacto (12 meses)</h3>
            <table width="100%" cellpadding="8" cellspacing="0">
                <tr>${roi.slice(0,4).map(r=>`<td style="text-align:center"><div style="font-size:24px;font-weight:800">${r.value}</div><div style="font-size:11px;opacity:.8">${r.label}</div></td>`).join('')}</tr>
            </table>
        </div>

        ${d.biggest_pain?`<div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0;border-left:4px solid #FF9800">
            <p style="color:#333;margin:0;font-size:14px">🎯 Sobre "<em>${d.biggest_pain}</em>" — isso é exatamente o tipo de problema que resolvemos. Clientes com desafios similares viram resultados em menos de 30 dias.</p>
        </div>`:''}`;

    } else if(type==='diagnostico'){
        const risk=calcRisk(d);
        const maturity=calcMaturity(d);
        const pot=calcPotential(d);
        const riskLabel=risk.score>=7?'ALTO':risk.score>=4?'MÉDIO':'BAIXO';
        const matLabel=maturity.score>=7?'AVANÇADA':maturity.score>=4?'INTERMEDIÁRIA':'INICIAL';
        const riskColor=risk.score>=7?'#e74c3c':risk.score>=4?'#f39c12':'#27ae60';
        const matColor=maturity.score>=7?'#27ae60':maturity.score>=4?'#f39c12':'#e74c3c';
        const empMap={'1-10':8,'10-25':20,'25-50':40,'50-100':80,'100-500':200,'100+':200,'500+':500};
        const empCount=empMap[employees]||10;
        const taskMult=(d.repetitive_tasks==='many')?0.15:(d.repetitive_tasks==='some')?0.08:0.04;
        const hoursSaved=Math.round(empCount*taskMult*4);
        const recs=getDetailedRecs(d,risk,maturity);
        const roi=calcROI(d,risk);

        content=`
        <div style="background:${bgColor};padding:20px;border-radius:12px;margin:20px 0">
            <h2 style="color:#1A1A2A;margin:0 0 4px">${company}</h2>
            <p style="color:#666;margin:0;font-size:14px">${employees} colaboradores · ${segment}</p>
        </div>

        <table width="100%" cellpadding="0" cellspacing="12" style="margin:20px 0">
            <tr>
                <td style="background:#fff;border:2px solid ${riskColor};border-radius:12px;padding:20px;text-align:center;width:33%">
                    <div style="font-size:36px;font-weight:800;color:${riskColor}">${risk.score}<span style="font-size:16px;color:#999">/10</span></div>
                    <div style="font-size:12px;font-weight:700;color:${riskColor};text-transform:uppercase">Risco ${riskLabel}</div>
                </td>
                <td style="background:#fff;border:2px solid ${matColor};border-radius:12px;padding:20px;text-align:center;width:33%">
                    <div style="font-size:36px;font-weight:800;color:${matColor}">${maturity.score}<span style="font-size:16px;color:#999">/10</span></div>
                    <div style="font-size:12px;font-weight:700;color:${matColor};text-transform:uppercase">Maturidade ${matLabel}</div>
                </td>
                <td style="background:#fff;border:2px solid ${headerColor};border-radius:12px;padding:20px;text-align:center;width:33%">
                    <div style="font-size:36px;font-weight:800;color:${headerColor}">${pot.score}<span style="font-size:16px;color:#999">/10</span></div>
                    <div style="font-size:12px;font-weight:700;color:${headerColor};text-transform:uppercase">Potencial</div>
                </td>
            </tr>
        </table>

        <div style="background:#fff;border-radius:12px;padding:20px;margin:16px 0;border-left:4px solid ${riskColor}">
            <h3 style="color:#1A1A2A;margin:0 0 12px">⚠️ Análise de Risco</h3>
            ${risk.items.map(i=>`<p style="color:#555;margin:4px 0;font-size:14px">• ${i}</p>`).join('')}
        </div>

        <div style="background:#fff;border-radius:12px;padding:20px;margin:16px 0;border-left:4px solid ${matColor}">
            <h3 style="color:#1A1A2A;margin:0 0 12px">📊 Maturidade Digital</h3>
            ${maturity.items.map(i=>`<p style="color:#555;margin:4px 0;font-size:14px">• ${i}</p>`).join('')}
        </div>

        ${hoursSaved>0?`
        <div style="background:linear-gradient(135deg,#1A7A7A10,#2B5A8C10);border-radius:12px;padding:20px;margin:16px 0;border:1px solid #1A7A7A30">
            <h3 style="color:#1A1A2A;margin:0 0 8px">⚡ Potencial de Automação</h3>
            <p style="color:#1A7A7A;font-size:24px;font-weight:800;margin:8px 0">${hoursSaved}+ horas/mês</p>
            <p style="color:#666;font-size:14px;margin:0">podem ser economizadas com automação e IA (≈ R$ ${(hoursSaved*45).toLocaleString('pt-BR')}/mês em produtividade)</p>
        </div>`:''}

        <div style="background:#fff;border-radius:12px;padding:20px;margin:16px 0;border-left:4px solid ${headerColor}">
            <h3 style="color:#1A1A2A;margin:0 0 12px">🚀 Potencial de Melhoria</h3>
            ${pot.items.map(i=>`<p style="color:#555;margin:4px 0;font-size:14px">• ${i}</p>`).join('')}
        </div>

        <div style="background:#fff;border-radius:12px;padding:20px;margin:16px 0">
            <h3 style="color:#1A1A2A;margin:0 0 16px">✨ Recomendações Personalizadas</h3>
            ${recs.map(r=>`<div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:${bgColor};border-radius:8px;margin:8px 0">
                <span style="font-size:24px">${r.icon}</span>
                <div><strong style="color:#1A1A2A">${r.title}</strong><br><span style="color:#666;font-size:13px">${r.desc}</span></div>
            </div>`).join('')}
        </div>

        <div style="background:linear-gradient(135deg,#1A7A7A,#2B5A8C);border-radius:12px;padding:24px;margin:16px 0;color:#fff">
            <h3 style="color:#fff;margin:0 0 16px">📈 Estimativa de Impacto (12 meses)</h3>
            <table width="100%" cellpadding="8" cellspacing="0">
                <tr>${roi.slice(0,4).map(r=>`<td style="text-align:center"><div style="font-size:24px;font-weight:800">${r.value}</div><div style="font-size:11px;opacity:.8">${r.label}</div></td>`).join('')}</tr>
            </table>
        </div>

        ${d.biggest_pain?`<div style="background:#FFF3E0;border-radius:12px;padding:16px;margin:16px 0;border-left:4px solid #FF9800">
            <p style="color:#333;margin:0;font-size:14px">🎯 Sobre "<em>${d.biggest_pain}</em>" — isso é exatamente o tipo de problema que resolvemos. Clientes com desafios similares viram resultados em menos de 30 dias.</p>
        </div>`:''}`;

    } else {
        // Cotação
        const needs=Array.isArray(d.needs)?d.needs:(d.needs?[d.needs]:[]);
        const svcs=[];
        if(needs.includes('suporte')) svcs.push({n:'Gestão de TI Completa',i:'🛡️'});
        if(needs.includes('google')) svcs.push({n:'Google Workspace com IA Gemini',i:'📧'});
        if(needs.includes('ia')) svcs.push({n:'IA Aplicada & Automação',i:'🤖'});
        if(needs.includes('portal')) svcs.push({n:'Portal Corporativo com IA',i:'🌐'});
        if(needs.includes('cto')) svcs.push({n:'CTO as a Service',i:'🎯'});
        if(needs.includes('automacao')) svcs.push({n:'Automação de Processos',i:'⚡'});
        if(svcs.length===0) svcs.push({n:'Gestão de TI Completa',i:'🛡️'});

        content=`
        <div style="background:${bgColor};padding:20px;border-radius:12px;margin:20px 0">
            <h2 style="color:#1A1A2A;margin:0 0 4px">${company}</h2>
            <p style="color:#666;margin:0;font-size:14px">${employees} colaboradores · ${segment} · Urgência: ${d.urgency||'não informada'}</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:20px;margin:16px 0">
            <h3 style="color:#1A1A2A;margin:0 0 16px">Serviços Recomendados</h3>
            ${svcs.map(s=>`<div style="display:flex;gap:12px;align-items:center;padding:12px;background:${bgColor};border-radius:8px;margin:8px 0">
                <span style="font-size:24px">${s.i}</span>
                <strong style="color:#1A1A2A">${s.n}</strong>
            </div>`).join('')}
        </div>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#1A7A7A,#2B5A8C);border-radius:16px 16px 0 0;padding:30px;text-align:center">
            <img src="https://www.guinux.com.br/logogx-ia.png" alt="Guinux.IA" width="180" style="display:block;margin:0 auto 12px;max-width:180px;height:auto">
            <p style="color:rgba(255,255,255,.8);margin:0;font-size:13px;letter-spacing:2px">INTELIGÊNCIA EM TI</p>
        </div>
        <div style="background:#fff;border-radius:0 0 16px 16px;padding:30px;box-shadow:0 4px 20px rgba(0,0,0,.08)">
            <p style="color:#333;font-size:16px">Olá <strong>${name}</strong>,</p>
            <p style="color:#555;font-size:14px">Segue o resultado do seu ${type==='analise'?'análise completa e proposta personalizada':type==='diagnostico'?'diagnóstico digital':'cotação personalizada'}, gerado pela <strong>Guinux.IA</strong>.</p>
            ${content}
            <div style="text-align:center;margin:30px 0 10px">
                <a href="https://wa.me/554140639294" style="display:inline-block;background:linear-gradient(135deg,#1A7A7A,#2B5A8C);color:#fff;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;font-size:15px">Falar com especialista →</a>
            </div>
            <p style="text-align:center;color:#999;font-size:12px;margin-top:8px">Ou ligue: +55 41 4063-9294</p>
        </div>
        <div style="text-align:center;padding:20px;color:#999;font-size:11px">
            <p>Guinux | InteligêncIA em TI<br>Av. Paraná, 1755 — Curitiba, PR<br>Google Cloud Partner desde 2013</p>
            <p><a href="https://www.guinux.com.br" style="color:#1A7A7A">www.guinux.com.br</a></p>
        </div>
    </div>
    </body></html>`;
}

/* ═══════════════════════════════════════════════
   SLIDE PANEL — Open external links in iframe
   Visitor never leaves the page
   ═══════════════════════════════════════════════ */
function slidePanelAbrir(url, title) {
    const overlay = document.getElementById('slidePanelOverlay');
    const iframe = document.getElementById('slidePanelIframe');
    const loader = document.getElementById('slidePanelLoader');
    const titleEl = document.getElementById('slidePanelTitle');
    const extLink = document.getElementById('slidePanelExternal');
    const fallback = document.getElementById('slidePanelFallback');

    titleEl.textContent = title || url;
    extLink.href = url;

    // Reset state
    iframe.src = 'about:blank';
    iframe.style.display = '';
    loader.classList.remove('hidden');
    fallback.classList.add('hidden');
    fallback.querySelector('.slide-panel-fallback-link').href = url;

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Static image previews for known URLs that block iframe embedding
    const staticPreviews = {
        'cloud.google.com': 'assets/googlepartner.png'
    };

    // Domains known to block iframe embedding
    const knownBlocked = ['google.com', 'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'youtube.com', 'github.com', 'apple.com', 'microsoft.com'];
    let hostname = '';
    try { hostname = new URL(url).hostname; } catch(e) {}
    const isKnownBlocked = knownBlocked.some(d => hostname === d || hostname.endsWith('.' + d));

    // Check if there's a static preview image for this hostname
    const staticImg = staticPreviews[hostname];

    let fallbackTimer;
    let settled = false;

    function showFallback(imgSrc) {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        loader.classList.add('hidden');
        iframe.style.display = 'none';
        if (imgSrc) {
            fallback.classList.add('has-preview');
            const existing = fallback.querySelector('.slide-panel-fallback-img');
            if (existing) existing.remove();
            const img = document.createElement('img');
            img.src = imgSrc;
            img.className = 'slide-panel-fallback-img';
            img.alt = title || url;
            fallback.insertBefore(img, fallback.firstChild);
        } else {
            fallback.classList.remove('has-preview');
            const existing = fallback.querySelector('.slide-panel-fallback-img');
            if (existing) existing.remove();
        }
        fallback.classList.remove('hidden');
    }

    function showSuccess() {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        loader.classList.add('hidden');
    }

    // If we have a static preview, skip iframe loading entirely
    if (staticImg) {
        setTimeout(() => showFallback(staticImg), 100);
        return;
    }

    // Timeout: fast for known-blocked, longer for unknown
    fallbackTimer = setTimeout(() => showFallback(null), isKnownBlocked ? 1500 : 8000);

    setTimeout(() => { iframe.src = url; }, 100);

    iframe.onload = () => {
        if (settled) return;
        try {
            const doc = iframe.contentDocument;
            if (doc !== null) {
                const bodyLen = (doc.body?.innerText || '').trim().length;
                if (bodyLen < 50) { showFallback(null); return; }
            }
        } catch(e) {}
        showSuccess();
        try {
            const iframeTitle = iframe.contentDocument?.title;
            if (iframeTitle) titleEl.textContent = iframeTitle;
        } catch(e) {}
    };

    iframe.onerror = () => { showFallback(null); };
}

function slidePanelFechar() {
    const overlay = document.getElementById('slidePanelOverlay');
    const iframe = document.getElementById('slidePanelIframe');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { iframe.src = 'about:blank'; iframe.removeAttribute('srcdoc'); }, 350);
}

function slidePanelAbrirHtml(html, title) {
    const overlay = document.getElementById('slidePanelOverlay');
    const iframe = document.getElementById('slidePanelIframe');
    const loader = document.getElementById('slidePanelLoader');
    const titleEl = document.getElementById('slidePanelTitle');
    const extLink = document.getElementById('slidePanelExternal');
    const fallback = document.getElementById('slidePanelFallback');
    titleEl.textContent = title || '';
    extLink.href = '#';
    iframe.style.display = '';
    loader.classList.remove('hidden');
    fallback.classList.add('hidden');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    iframe.onload = () => loader.classList.add('hidden');
    iframe.removeAttribute('src');
    iframe.srcdoc = html;
}

function showPdfLink(url, company) {
    // Chat bubble with link + copy button
    const el = document.createElement('div');
    el.className = 'msg bot';
    const safeUrl = url.replace(/'/g, '%27');
    el.innerHTML = `<div class="msg-bubble" style="max-width:100%">
        <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:#6bbed0">📎 PDF salvo — ${company}</div>
        <div style="font-size:11px;color:#94a3b8;word-break:break-all;margin-bottom:10px">${url}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a href="${url}" target="_blank" rel="noopener" style="background:rgba(107,190,208,.15);color:#6bbed0;border:1px solid rgba(107,190,208,.3);border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;text-decoration:none">⬇ Abrir PDF</a>
            <button onclick="navigator.clipboard.writeText('${safeUrl}').then(()=>{this.textContent='✓ Copiado!';setTimeout(()=>this.textContent='Copiar link',2500)})" style="background:#6bbed0;color:#0d1b2e;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:11px;font-weight:700">Copiar link</button>
        </div>
    </div>`;
    const chatMsgs = document.getElementById('chatMessages');
    if(chatMsgs){ chatMsgs.appendChild(el); scrollChat(); }
}

function mostrarTodosEventos() {
    const eventos = [
        {ano:2012, nome:'VMware World',          local:'Las Vegas',      href:''},
        {ano:2014, nome:'Amazon re:Invent',       local:'Las Vegas',      href:'blog/amazon-reinvent-2014-las-vegas.html'},
        {ano:2018, nome:'Google Cloud Next',      local:'São Francisco',  href:'blog/google-next-2018-san-francisco.html'},
        {ano:2019, nome:'Google Cloud Next',      local:'São Francisco',  href:'blog/google-next-2019-san-francisco.html'},
        {ano:2022, nome:'Imersão Technion',       local:'Haifa, Israel',  href:'blog/imersao-tecnologica-israel.html', destaque:true},
        {ano:2022, nome:'Imersão Vale do Silício',local:'SF & Tel Aviv',  href:'blog/san-francisco-cultura-inovacao.html', destaque:true},
        {ano:2023, nome:'Google Cloud Next',      local:'São Francisco',  href:''},
        {ano:2024, nome:'Google Cloud Next',      local:'Las Vegas',      href:'blog/google-next-2024-las-vegas.html'},
    ];
    const rows = eventos.map(e => {
        const arrow = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>`;
        const inner = `<span class="ey">${e.ano}</span><span class="en">${e.nome}</span><span class="el">${e.local}${e.href?' '+arrow:''}</span>`;
        return e.href
            ? `<a class="er${e.destaque?' ea':''}" href="${e.href}">${inner}</a>`
            : `<div class="er">${inner}</div>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif;background:#0d1b2e;color:#e0e8f0;padding:28px 24px}
h2{font-size:17px;font-weight:800;color:#fff;margin-bottom:3px}
.sub{font-size:11px;color:#6b9ea8;margin-bottom:20px;letter-spacing:.3px}
.er{display:flex;align-items:center;gap:0;padding:11px 14px;border-radius:10px;margin-bottom:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);text-decoration:none;color:inherit;transition:.15s}
a.er:hover{background:rgba(107,190,208,.13);border-color:rgba(107,190,208,.35);color:#6bbed0}
.ea{border-color:rgba(107,190,208,.22);background:rgba(107,190,208,.07)}
.ey{width:40px;font-size:12px;font-weight:700;color:#6bbed0;flex-shrink:0}
.en{flex:1;font-size:13px;font-weight:600}
.el{font-size:11px;color:#7a9aaa;margin-left:auto;padding-left:12px;display:flex;align-items:center;gap:5px}
</style></head><body>
<h2>Eventos Internacionais</h2>
<p class="sub">8 eventos · ordenados por ano</p>
${rows}
</body></html>`;
    slidePanelAbrirHtml(html, 'Todos os Eventos');
}

// Close panel on overlay click (outside the panel)
document.addEventListener('click', (e) => {
    const overlay = document.getElementById('slidePanelOverlay');
    if (e.target === overlay) slidePanelFechar();
});

// Close panel on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const overlay = document.getElementById('slidePanelOverlay');
        if (overlay.classList.contains('open')) slidePanelFechar();
    }
});

// Intercept all external links — open in slide panel instead of navigating away
// Exceptions: WhatsApp links (wa.me) open natively for app redirect
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Only intercept http/https external links
    if (!href.startsWith('http://') && !href.startsWith('https://')) return;

    // Skip same-domain links
    try {
        const linkUrl = new URL(href, window.location.origin);
        if (linkUrl.hostname === window.location.hostname) return;
        if (linkUrl.hostname === 'www.guinux.com.br' || linkUrl.hostname === 'guinux.com.br') return;
    } catch (err) { return; }

    // Skip WhatsApp links (need native app redirect)
    if (href.includes('wa.me/') || href.includes('whatsapp.com')) return;

    // Skip resource links (fonts, CDNs, etc.) — these are not clickable
    if (href.includes('fonts.googleapis.com') || href.includes('fonts.gstatic.com') || href.includes('cdnjs.cloudflare.com')) return;

    e.preventDefault();
    e.stopPropagation();

    // Derive a nice title from the link text or URL
    let title = link.textContent?.trim();
    if (!title || title.length < 3) {
        title = link.getAttribute('aria-label') || link.getAttribute('title') || '';
    }
    if (!title || title.length < 3) {
        try { title = new URL(href).hostname.replace('www.', ''); } catch (_) { title = href; }
    }

    slidePanelAbrir(href, title);
});
