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

/* ========= WELCOME MENU (pre-loaded options) ========= */
async function showWelcomeMenu(){
    await showTyping(400);
    addBotMsg('Olá! Sou a <strong>Guinux.IA</strong> — Como posso te ajudar?');
    await new Promise(r=>setTimeout(r,200));

    const cardsHtml=`
    <div class="welcome-cards">
        <button class="welcome-card" onclick="switchFlow('diagnostico')">
            <div class="welcome-card-icon">🔍</div>
            <div class="welcome-card-content">
                <strong>Diagnóstico Gratuito</strong>
                <span>Análise de risco, potencial e maturidade digital com IA</span>
            </div>
            <div class="welcome-card-arrow">→</div>
        </button>
        <button class="welcome-card" onclick="switchFlow('cotacao')">
            <div class="welcome-card-icon">💰</div>
            <div class="welcome-card-content">
                <strong>Cotação Personalizada</strong>
                <span>Proposta sob medida para seu porte e necessidade</span>
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
    {q:'Quanto custa os serviços?',a:'Os valores dependem do porte da sua empresa e dos serviços necessários. Para empresas pequenas (até 25 colaboradores), temos planos a partir de valores acessíveis. O melhor caminho é <strong>fazer uma cotação personalizada</strong> — leva menos de 2 minutos!'},
    {q:'Vocês atendem fora de Curitiba?',a:'Sim! Atendemos empresas em todo o Brasil de forma remota. Para empresas em Curitiba e região, também oferecemos atendimento presencial. Nossos clientes vão de startups locais a organizações com mais de 90 mil usuários como a OAB Paraná.'},
    {q:'Como funciona o suporte?',a:'Nosso Help Desk opera com SLA garantido, monitoramento proativo 24/7 e equipe dedicada. Você tem um canal direto com a nossa equipe — sem filas, sem burocracia. Relatórios transparentes de acompanhamento são enviados periodicamente.'},
    {q:'O que é CTO as a Service?',a:'É ter um líder de tecnologia experiente na sua empresa sem o custo de um C-level fixo. Definimos estratégia, roadmap de inovação, governança e compliance. Nosso CEO, Guilherme Straioto, atua como CTO da OAB Paraná neste modelo.'},
    {q:'Vocês trabalham com IA?',a:'Sim! IA é um dos nossos pilares principais. Desenvolvemos <strong>portais com IA integrada</strong>, dashboards inteligentes, automação de processos (RPA + AI), chatbots corporativos e monitoramento de produtividade. Trabalhamos com <strong>Gemini e Claude AI</strong>.'},
];

const FLOW_FAQ=[
    {id:'faq_greeting',type:'auto',msgs:['Certo! Veja as perguntas mais comuns:']},
    {id:'faq_choice',type:'faq_pills'},
];

/* ========= COTAÇÃO FLOW ========= */
const FLOW_COTACAO=[
    {id:'greeting',type:'auto',msgs:['Vamos montar uma proposta personalizada para sua empresa!','São perguntas rápidas — leva menos de 2 minutos.']},
    {id:'name',type:'text',msgs:['Qual é o seu nome?'],ph:'Digite seu nome...'},
    {id:'email',type:'text',msgs:d=>[`Prazer, ${esc(d.name.split(' ')[0])}! Qual seu e-mail para enviarmos a proposta?`],ph:'seu@email.com.br'},
    {id:'company',type:'text',msgs:['Qual o nome da sua empresa?'],ph:'Nome da empresa...'},
    {id:'employees',type:'pills',msgs:['Quantas pessoas trabalham na empresa?'],opts:[{l:'1–10',v:'1-10',tier:'micro'},{l:'10–25',v:'10-25',tier:'pequena'},{l:'25–50',v:'25-50',tier:'media'},{l:'50–100',v:'50-100',tier:'media_grande'},{l:'100+',v:'100+',tier:'grande'}]},
    {id:'segment',type:'pills',msgs:['Qual o segmento?'],opts:[{l:'Advocacia / Jurídico',v:'juridico'},{l:'Imobiliário / Construção',v:'imobiliario'},{l:'Indústria',v:'industria'},{l:'Serviços / Consultoria',v:'servicos'},{l:'Saúde',v:'saude'},{l:'Varejo / Comércio',v:'varejo'},{l:'Tecnologia',v:'tecnologia'},{l:'Outro',v:'outro'}]},
    {id:'needs',type:'multi',msgs:['Quais são suas necessidades? (selecione todas que se aplicam)'],opts:[{l:'Suporte e gestão de TI',v:'suporte'},{l:'Google Workspace / E-mail',v:'google'},{l:'Implementar IA na empresa',v:'ia'},{l:'Portal Corporativo com IA',v:'portal'},{l:'Liderança tecnológica (CTO)',v:'cto'},{l:'Automação de processos',v:'automacao'}]},
    {id:'repetitive_tasks',type:'pills',msgs:d=>[`Na ${esc(d.company)}, existem tarefas repetitivas que consomem tempo da equipe?`],opts:[{l:'Sim, muitas!',v:'many'},{l:'Algumas',v:'some'},{l:'Poucas',v:'few'},{l:'Não sei identificar',v:'unknown'}]},
    {id:'pain',type:'pills',msgs:['Qual o maior desafio hoje?'],opts:[{l:'TI instável / cai muito',v:'instavel'},{l:'Sem controle ou visibilidade',v:'sem_controle'},{l:'Gastos altos com TI',v:'custo'},{l:'Equipe improdutiva',v:'produtividade'},{l:'Segurança e LGPD',v:'seguranca'},{l:'Falta de inovação',v:'inovacao'}]},
    {id:'urgency',type:'pills',msgs:['Qual a urgência?'],opts:[{l:'Imediata — preciso já',v:'imediata'},{l:'Próximos 30 dias',v:'30dias'},{l:'Estou pesquisando',v:'pesquisa'}]},
    {id:'cotacao_result',type:'cotacao_end'},
];

/* ========= DIAGNÓSTICO FLOW (Impressionante) ========= */
const FLOW_DIAGNOSTICO=[
    {id:'greeting',type:'auto',msgs:['Vou realizar uma análise completa da maturidade digital da sua empresa.','São perguntas rápidas — e o resultado vai te surpreender.']},
    {id:'name',type:'text',msgs:['Para começar, qual é o seu nome?'],ph:'Seu nome...'},
    {id:'email',type:'text',msgs:d=>[`Prazer, ${esc(d.name.split(' ')[0])}! Qual seu e-mail? Vou enviar o diagnóstico completo.`],ph:'seu@email.com.br'},
    {id:'company',type:'text',msgs:['Qual o nome da empresa?'],ph:'Nome da empresa...'},
    {id:'employees',type:'pills',msgs:['Quantos colaboradores a empresa tem?'],opts:[{l:'1–10',v:'1-10'},{l:'10–25',v:'10-25'},{l:'25–50',v:'25-50'},{l:'50–100',v:'50-100'},{l:'100–500',v:'100-500'},{l:'500+',v:'500+'}]},
    {id:'segment',type:'pills',msgs:['Qual o segmento da empresa?'],opts:[{l:'Advocacia / Jurídico',v:'juridico'},{l:'Imobiliário / Construção',v:'imobiliario'},{l:'Indústria',v:'industria'},{l:'Serviços / Consultoria',v:'servicos'},{l:'Saúde',v:'saude'},{l:'Varejo / Comércio',v:'varejo'},{l:'Tecnologia',v:'tecnologia'},{l:'Educação',v:'educacao'},{l:'Outro',v:'outro'}]},
    {id:'it_status',type:'pills',msgs:['Como é a TI da empresa hoje?'],opts:[{l:'Não temos equipe de TI',v:'none'},{l:'TI interna própria',v:'internal'},{l:'Terceirizada (insatisfeito)',v:'outsourced'},{l:'Modelo híbrido',v:'hybrid'}]},
    {id:'infra',type:'pills',msgs:['Onde ficam seus servidores e dados?'],opts:[{l:'Servidores físicos locais',v:'onprem'},{l:'Tudo na nuvem',v:'cloud'},{l:'Híbrido (local + nuvem)',v:'hybrid'},{l:'Não sei ao certo',v:'unknown'}]},
    {id:'backup',type:'pills',msgs:['Como é feito o backup dos dados?'],opts:[{l:'Backup automático na nuvem',v:'cloud_auto'},{l:'Backup manual / HD externo',v:'manual'},{l:'Não temos backup',v:'none'},{l:'Não sei',v:'unknown'}]},
    {id:'security',type:'pills',msgs:['A empresa tem antivírus corporativo e políticas de segurança?'],opts:[{l:'Sim, tudo configurado',v:'full'},{l:'Tem antivírus, mas sem políticas',v:'partial'},{l:'Cada um usa o seu',v:'individual'},{l:'Não temos nada',v:'none'}]},
    {id:'repetitive_tasks',type:'pills',msgs:d=>[`Entendi. Agora sobre produtividade: na ${esc(d.company)}, existem tarefas manuais e repetitivas?`],opts:[{l:'Sim, muitas! Gasta muito tempo',v:'many'},{l:'Algumas poderiam ser automatizadas',v:'some'},{l:'Poucas ou nenhuma',v:'few'},{l:'Não sei identificar',v:'unknown'}]},
    {id:'repetitive_examples',type:'pills',msgs:d=>{
        if(d.repetitive_tasks==='many'||d.repetitive_tasks==='some') return['Quais tipos de tarefas mais se repetem?'];
        return['Qual área consome mais tempo da equipe?'];
    },opts:[{l:'Envio de relatórios / planilhas',v:'reports'},{l:'Atendimento / respostas ao cliente',v:'support'},{l:'Processos de aprovação',v:'approvals'},{l:'Entrada de dados / cadastros',v:'data_entry'},{l:'Financeiro / contas a pagar',v:'finance'},{l:'Controle de documentos',v:'docs'}]},
    {id:'automation_interest',type:'pills',msgs:d=>{
        const segHints={juridico:'análise de contratos e petições',imobiliario:'gestão de contratos e atendimento',industria:'controle de produção e qualidade',servicos:'propostas e follow-up de clientes',saude:'prontuários e agendamentos',varejo:'estoque e atendimento',tecnologia:'deploy e monitoramento',educacao:'comunicação e matrículas'};
        const hint=segHints[d.segment]||'processos internos';
        return[`No seu segmento, IA já automatiza ${hint}. Isso é algo que interessa?`];
    },opts:[{l:'Muito! Quero implementar',v:'high'},{l:'Interessante, quero saber mais',v:'medium'},{l:'Talvez no futuro',v:'low'}]},
    {id:'ai_usage',type:'pills',msgs:['A empresa já usa Inteligência Artificial hoje?'],opts:[{l:'Não utilizamos nada',v:'none'},{l:'Uso individual, sem padrão',v:'scattered'},{l:'Usamos ChatGPT / Gemini',v:'basic'},{l:'Já temos IA integrada',v:'optimize'}]},
    {id:'tools',type:'multi',msgs:['Quais ferramentas a empresa usa? (selecione todas)'],opts:[{l:'Google Workspace',v:'google'},{l:'Microsoft 365',v:'microsoft'},{l:'ERP / Sistema de gestão',v:'erp'},{l:'CRM',v:'crm'},{l:'Ferramentas de IA',v:'ai_tools'},{l:'Nenhuma dessas',v:'none'}]},
    {id:'satisfaction',type:'stars',msgs:['De 1 a 5, qual sua satisfação com a TI atual?']},
    {id:'biggest_pain',type:'text',msgs:['Última pergunta: qual o maior problema de TI ou tecnologia que te incomoda hoje?'],ph:'Ex: "a internet cai toda hora", "perco tempo com planilhas"...',optional:true},
];

/* ========= CHAT ENGINE ========= */
let chatData={},chatStep=0,chatMsgs,chatInput,currentFlow='welcome';

function getFlowSteps(){
    if(currentFlow==='faq') return FLOW_FAQ;
    if(currentFlow==='cotacao') return FLOW_COTACAO;
    return FLOW_DIAGNOSTICO;
}

async function processStep(){
    const steps=getFlowSteps();
    if(chatStep>=steps.length){
        if(currentFlow==='diagnostico') await generateDiagnosis();
        return;
    }
    const q=steps[chatStep];

    // Special types
    if(q.type==='faq_pills'){
        await showTyping(400);
        renderFaqPills();
        return;
    }
    if(q.type==='cotacao_end'){
        await generateCotacao();
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

function scrollChat(){chatMsgs.scrollTop=chatMsgs.scrollHeight}

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
    const cotBtn=document.createElement('button');
    cotBtn.className='ci-pill';cotBtn.style.borderColor='var(--teal)';cotBtn.style.color='var(--teal)';
    cotBtn.textContent='Fazer cotação →';
    cotBtn.addEventListener('click',()=>switchFlow('cotacao'));
    const diagBtn=document.createElement('button');
    diagBtn.className='ci-pill';diagBtn.textContent='Fazer diagnóstico →';
    diagBtn.addEventListener('click',()=>switchFlow('diagnostico'));
    wrap.appendChild(moreBtn);wrap.appendChild(cotBtn);wrap.appendChild(diagBtn);
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
        setTimeout(()=>inp.focus(),100);
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

/* ========= COTAÇÃO GENERATOR ========= */
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
    if(d.it_status==='none'){score+=3;items.push('Sem equipe de TI — vulnerabilidade crítica em caso de incidentes')}
    else if(d.it_status==='outsourced'){score+=2;items.push('TI terceirizada com insatisfação — risco de queda no serviço')}
    if(d.infra==='onprem'){score+=2;items.push('Servidores locais — risco de perda de dados, ransomware e downtime')}
    else if(d.infra==='unknown'){score+=1.5;items.push('Infraestrutura desconhecida — falta de visibilidade aumenta riscos')}
    if(d.backup==='none'){score+=2.5;items.push('Sem backup — um incidente pode significar perda total de dados')}
    else if(d.backup==='manual'){score+=1.5;items.push('Backup manual é falho — risco de esquecimento e perda parcial')}
    else if(d.backup==='unknown'){score+=1;items.push('Backup desconhecido — não há garantia de recuperação')}
    if(d.security==='none'){score+=2;items.push('Sem antivírus ou políticas — empresa totalmente exposta a ataques')}
    else if(d.security==='individual'){score+=1.5;items.push('Segurança descentralizada — cada colaborador é um ponto de risco')}
    else if(d.security==='partial'){score+=0.5;items.push('Antivírus sem políticas — proteção parcial, gestão limitada')}
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
    if(d.security==='none'||d.security==='individual'){score+=1;items.push('Segurança corporativa pode prevenir até 99% das ameaças comuns')}
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

    if(d.security==='full'){items.push('Segurança corporativa implementada')}
    else if(d.security==='none'){score-=2;items.push('Sem proteção de segurança')}
    else if(d.security==='individual'){score-=1.5;items.push('Segurança individual — sem gestão centralizada')}

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
    if(d.security==='none'||d.security==='individual')svcs.add('it_management');
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
    if(d.security==='none'||d.security==='individual'){
        recs.push({icon:'🔒',title:'Segurança Corporativa + LGPD',desc:'Antivírus gerenciado (Bitdefender), políticas de acesso, treinamento anti-phishing e adequação LGPD.'});
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
    if(d.security==='none'||d.security==='individual'){
        roi.push({value:'↓ 99%',label:'Ameaças bloqueadas'});
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
    const subject=type==='diagnostico'
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
            throw new Error(data.error||'Falha no envio');
        }
    }catch(err){
        console.error('Email send error:',err);
        // Fallback to mailto
        const fallbackSubject=encodeURIComponent(subject);
        const fallbackBody=encodeURIComponent(`Olá ${name},\n\nSegue seu ${type==='diagnostico'?'diagnóstico':'cotação'} da ${company}.\n\nPara ver o resultado completo, acesse: www.guinux.com.br e refaça o processo.\n\nAtenciosamente,\nGuinux.IA`);
        window.open(`mailto:${encodeURIComponent(email)}?subject=${fallbackSubject}&body=${fallbackBody}`,'_blank');
        addBotMsg(`📧 E-mail preparado para <strong>${esc(email)}</strong>. Confira seu cliente de e-mail.`);
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

    if(type==='diagnostico'){
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
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800">GUINUX</h1>
            <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px;letter-spacing:2px">INTELIGÊNCIA EM TI</p>
        </div>
        <div style="background:#fff;border-radius:0 0 16px 16px;padding:30px;box-shadow:0 4px 20px rgba(0,0,0,.08)">
            <p style="color:#333;font-size:16px">Olá <strong>${name}</strong>,</p>
            <p style="color:#555;font-size:14px">Segue o resultado do seu ${type==='diagnostico'?'diagnóstico digital':'cotação personalizada'}, gerado pela <strong>Guinux.IA</strong>.</p>
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
