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
    await showTyping(500);
    addBotMsg('Olá! Sou a <strong>Guinux.IA</strong> — assistente inteligente da Guinux.');
    await showTyping(600);
    addBotMsg('Como posso te ajudar hoje? Escolha uma opção:');
    await new Promise(r=>setTimeout(r,300));

    // Render 3 cards in the chat messages area
    const cardsHtml=`
    <div class="welcome-cards">
        <button class="welcome-card" onclick="switchFlow('diagnostico')">
            <div class="welcome-card-icon">🔍</div>
            <div class="welcome-card-content">
                <strong>Diagnóstico Gratuito</strong>
                <span>Análise completa de risco, potencial e maturidade digital da sua empresa com IA</span>
            </div>
            <div class="welcome-card-arrow">→</div>
        </button>
        <button class="welcome-card" onclick="switchFlow('cotacao')">
            <div class="welcome-card-icon">💰</div>
            <div class="welcome-card-content">
                <strong>Cotação Personalizada</strong>
                <span>Proposta sob medida com serviços recomendados para seu porte e necessidade</span>
            </div>
            <div class="welcome-card-arrow">→</div>
        </button>
        <button class="welcome-card" onclick="switchFlow('faq')">
            <div class="welcome-card-icon">💬</div>
            <div class="welcome-card-content">
                <strong>Dúvidas Frequentes</strong>
                <span>Perguntas sobre serviços, preços, atendimento e tecnologias da Guinux</span>
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
    {id:'greeting',type:'auto',msgs:['Vamos montar uma proposta personalizada para sua empresa!','Leva menos de 2 minutos.']},
    {id:'name',type:'text',msgs:['Qual é o seu nome?'],ph:'Digite seu nome...'},
    {id:'company',type:'text',msgs:d=>[`Prazer, ${esc(d.name.split(' ')[0])}! 😊 Qual o nome da sua empresa?`],ph:'Nome da empresa...'},
    {id:'employees',type:'pills',msgs:['Quantas pessoas trabalham na empresa?'],opts:[{l:'1–10',v:'1-10',tier:'micro'},{l:'10–25',v:'10-25',tier:'pequena'},{l:'25–50',v:'25-50',tier:'media'},{l:'50–100',v:'50-100',tier:'media_grande'},{l:'100+',v:'100+',tier:'grande'}]},
    {id:'segment',type:'pills',msgs:['Qual o segmento?'],opts:[{l:'Advocacia / Jurídico',v:'juridico'},{l:'Imobiliário / Construção',v:'imobiliario'},{l:'Indústria',v:'industria'},{l:'Serviços / Consultoria',v:'servicos'},{l:'Saúde',v:'saude'},{l:'Varejo / Comércio',v:'varejo'},{l:'Tecnologia',v:'tecnologia'},{l:'Outro',v:'outro'}]},
    {id:'needs',type:'pills',msgs:['Qual a principal necessidade hoje?'],opts:[{l:'Suporte e gestão de TI',v:'suporte'},{l:'Google Workspace / E-mail',v:'google'},{l:'Implementar IA na empresa',v:'ia'},{l:'Liderança tecnológica (CTO)',v:'cto'},{l:'Múltiplas necessidades',v:'multiplo'}]},
    {id:'pain',type:'pills',msgs:['Qual o maior desafio hoje?'],opts:[{l:'TI instável',v:'instavel'},{l:'Sem controle ou visibilidade',v:'sem_controle'},{l:'Gastos altos com TI',v:'custo'},{l:'Equipe improdutiva',v:'produtividade'},{l:'Segurança e LGPD',v:'seguranca'},{l:'Falta de inovação',v:'inovacao'}]},
    {id:'urgency',type:'pills',msgs:['Qual a urgência?'],opts:[{l:'Imediata',v:'imediata'},{l:'Próximos 30 dias',v:'30dias'},{l:'Estou pesquisando',v:'pesquisa'}]},
    {id:'cotacao_result',type:'cotacao_end'},
];

/* ========= DIAGNÓSTICO FLOW (Impressionante) ========= */
const FLOW_DIAGNOSTICO=[
    {id:'greeting',type:'auto',msgs:['Vou realizar uma análise completa da maturidade digital da sua empresa.','São perguntas rápidas — e o resultado vai te surpreender.']},
    {id:'name',type:'text',msgs:['Para começar, qual é o seu nome?'],ph:'Seu nome...'},
    {id:'company',type:'text',msgs:d=>[`Prazer, ${esc(d.name.split(' ')[0])}! Qual o nome da empresa?`],ph:'Nome da empresa...'},
    {id:'employees',type:'pills',msgs:['Quantos colaboradores?'],opts:[{l:'1–10',v:'1-10'},{l:'10–25',v:'10-25'},{l:'25–50',v:'25-50'},{l:'50–100',v:'50-100'},{l:'100+',v:'100+'}]},
    {id:'segment',type:'pills',msgs:['Qual o segmento da empresa?'],opts:[{l:'Advocacia / Jurídico',v:'juridico'},{l:'Imobiliário / Construção',v:'imobiliario'},{l:'Indústria',v:'industria'},{l:'Serviços / Consultoria',v:'servicos'},{l:'Saúde',v:'saude'},{l:'Varejo / Comércio',v:'varejo'},{l:'Tecnologia',v:'tecnologia'},{l:'Outro',v:'outro'}]},
    {id:'it_status',type:'pills',msgs:['Como é a TI da empresa hoje?'],opts:[{l:'Não temos equipe de TI',v:'none'},{l:'TI interna própria',v:'internal'},{l:'Terceirizada (insatisfeito)',v:'outsourced'},{l:'Modelo híbrido',v:'hybrid'}]},
    {id:'infra',type:'pills',msgs:['Onde ficam seus servidores e dados?'],opts:[{l:'Servidores físicos locais',v:'onprem'},{l:'Tudo na nuvem',v:'cloud'},{l:'Híbrido (local + nuvem)',v:'hybrid'},{l:'Não sei ao certo',v:'unknown'}]},
    {id:'backup',type:'pills',msgs:['Como é feito o backup dos dados?'],opts:[{l:'Backup automático na nuvem',v:'cloud_auto'},{l:'Backup manual / HD externo',v:'manual'},{l:'Não temos backup',v:'none'},{l:'Não sei',v:'unknown'}]},
    {id:'security',type:'pills',msgs:['A empresa tem antivírus corporativo e políticas de segurança?'],opts:[{l:'Sim, tudo configurado',v:'full'},{l:'Tem antivírus, mas sem políticas',v:'partial'},{l:'Cada um usa o seu',v:'individual'},{l:'Não temos nada',v:'none'}]},
    {id:'ai_usage',type:'pills',msgs:['Como a empresa usa Inteligência Artificial hoje?'],opts:[{l:'Não utilizamos',v:'none'},{l:'Uso individual, sem padrão',v:'scattered'},{l:'Já usamos, queremos mais',v:'optimize'}]},
    {id:'tools',type:'multi',msgs:['Quais ferramentas a empresa usa? (selecione todas)'],opts:[{l:'Google Workspace',v:'google'},{l:'Microsoft 365',v:'microsoft'},{l:'ERP / Sistema de gestão',v:'erp'},{l:'CRM',v:'crm'},{l:'Ferramentas de IA',v:'ai_tools'},{l:'Nenhuma dessas',v:'none'}]},
    {id:'satisfaction',type:'stars',msgs:['De 1 a 5, qual sua satisfação com a TI atual?']},
    {id:'biggest_pain',type:'text',msgs:['Por fim, descreva em uma frase: qual o maior problema de TI da empresa hoje?'],ph:'Ex: "a internet cai toda hora", "não temos controle"...',optional:true},
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
    addBotMsg('Cruzando dados de porte, segmento e necessidade...');
    await showTyping(1200);
    addBotMsg('Proposta pronta! Veja o que preparei:');
    await new Promise(r=>setTimeout(r,400));

    const recSvcs=[];
    const recDetails=[];
    const sz=d.employees||'1-10';
    const need=d.needs||'multiplo';
    const pain=d.pain||'';
    const segment=d.segment||'outro';

    // Smart recommendations
    if(need==='suporte'||need==='multiplo'){
        recSvcs.push('it_management');
        recDetails.push({svc:'Gestão de TI Completa',why:'Help Desk dedicado, monitoramento 24/7, segurança e backup. A base para tudo funcionar.',icon:'🛡️'});
    }
    if(need==='google'||need==='multiplo'){
        recSvcs.push('google_workspace');
        recDetails.push({svc:'Google Workspace com IA Gemini',why:'E-mail corporativo, Drive, Meet e Gemini AI integrado para produtividade máxima.',icon:'📧'});
    }
    if(need==='ia'||need==='multiplo'){
        recSvcs.push('ai_development');
        recDetails.push({svc:'IA Aplicada & Desenvolvimento',why:'Portais com IA, dashboards, automação de processos — faça mais com menos.',icon:'🤖'});
    }
    if(need==='cto'||(sz==='50-100'||sz==='100+')){
        recSvcs.push('cto_service');
        recDetails.push({svc:'CTO as a Service',why:'Liderança tecnológica, estratégia e governança sem custo de C-level fixo.',icon:'🎯'});
    }
    if(pain==='seguranca'&&!recSvcs.includes('it_management')){
        recSvcs.push('it_management');
        recDetails.push({svc:'Gestão de TI Completa',why:'Segurança, LGPD e compliance — proteja seus dados e sua operação.',icon:'🛡️'});
    }
    if(pain==='produtividade'&&!recSvcs.includes('ai_development')){
        recSvcs.push('ai_development');
        recDetails.push({svc:'IA Aplicada & Desenvolvimento',why:'Automação e IA para eliminar tarefas repetitivas e otimizar equipe.',icon:'🤖'});
    }
    if(recSvcs.length===0){
        recSvcs.push('it_management');
        recDetails.push({svc:'Gestão de TI Completa',why:'Base sólida para qualquer empresa que quer crescer com tecnologia.',icon:'🛡️'});
    }

    // Segment-specific insight
    const segInsights={
        juridico:'Escritórios de advocacia que adotam IA aumentam produtividade em até 40% na análise documental.',
        imobiliario:'O setor imobiliário está entre os que mais se beneficiam de portais com IA para atendimento.',
        industria:'Indústrias com TI bem estruturada reduzem paradas não planejadas em até 60%.',
        saude:'Na saúde, segurança de dados e LGPD não são opcionais — são obrigação legal.',
        servicos:'Empresas de serviços que implementam IA ganham velocidade e escala sem aumentar equipe.',
        varejo:'No varejo, IA em atendimento e logística pode aumentar conversão em até 25%.',
        tecnologia:'Mesmo empresas de tech se beneficiam de outsourcing para focar no core business.',
    };

    const optimizations=[];
    if(pain==='instavel') optimizations.push({text:'Redução de até 95% no downtime com monitoramento proativo',pct:95});
    if(pain==='custo') optimizations.push({text:'Economia de 30-40% migrando para nuvem otimizada',pct:35});
    if(pain==='produtividade') optimizations.push({text:'Até 35% mais produtividade com IA em tarefas repetitivas',pct:35});
    if(pain==='sem_controle') optimizations.push({text:'Visibilidade total com dashboards e relatórios em tempo real',pct:80});
    if(pain==='seguranca') optimizations.push({text:'LGPD, backup e segurança corporativa implementados',pct:90});
    if(pain==='inovacao') optimizations.push({text:'Roadmap de inovação com IA, automação e transformação digital',pct:70});
    if(optimizations.length===0) optimizations.push({text:'Estrutura profissional de TI pode aumentar produtividade em até 30%',pct:30});

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
    const waMsg=encodeURIComponent(`Olá! Sou ${d.name} da ${d.company} (${d.employees} colaboradores, segmento ${d.segment}). Fiz uma cotação no site e tenho interesse em: ${recDetails.map(s=>s.svc).join(', ')}. Necessidade: ${d.needs}. Urgência: ${d.urgency}.`);
    html+=`<div class="diag-cta">`;
    html+=`<a href="https://wa.me/554140639294?text=${waMsg}" class="btn-main" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Receber proposta detalhada</a>`;
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
    addBotMsg(`${name}, coletei todas as informações. Iniciando análise...`);

    await showTyping(1000);
    addBotMsg('🔄 Processando perfil da empresa...');
    await showTyping(800);
    addBotMsg('🔄 Avaliando infraestrutura e segurança...');
    await showTyping(800);
    addBotMsg('🔄 Calculando maturidade digital e risco operacional...');
    await showTyping(800);
    addBotMsg('🔄 Gerando recomendações personalizadas com IA...');
    await showTyping(1200);
    addBotMsg('✅ Diagnóstico concluído!');
    await new Promise(r=>setTimeout(r,500));

    const risk=calcRisk(d);
    const pot=calcPotential(d);
    const maturity=calcMaturity(d);
    const svcs=recommendSvcs(d);
    const segment=d.segment||'outro';

    // Build diagnosis card
    let html=`<div class="diagnosis diag-premium">`;
    html+=`<div class="diag-header-bar">`;
    html+=`<div class="diag-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.5 7.5L22 10l-7.5 2.5L12 20l-2.5-7.5L2 10l7.5-2.5L12 0z"/></svg> DIAGNÓSTICO COMPLETO</div>`;
    html+=`<div class="diag-company-badge"><strong>${esc(d.company)}</strong><span>${d.employees} colaboradores · ${esc(segment)}</span></div>`;
    html+=`</div>`;

    // 3 score gauges
    const riskClass=risk.score>=7?'risk-high':risk.score>=4?'risk-mid':'risk-low';
    const riskLabel=risk.score>=7?'ALTO':risk.score>=4?'MÉDIO':'BAIXO';
    const riskEmoji=risk.score>=7?'🔴':risk.score>=4?'🟡':'🟢';
    const matLabel=maturity.score>=7?'AVANÇADA':maturity.score>=4?'INTERMEDIÁRIA':'INICIAL';
    const matClass=maturity.score>=7?'pot-high':maturity.score>=4?'risk-mid':'risk-high';

    html+=`<div class="diag-scores">`;
    // Risk
    html+=`<div class="diag-score-card">`;
    html+=`<div class="diag-score-number ${riskClass}">${risk.score}<span>/10</span></div>`;
    html+=`<div class="diag-score-label">${riskEmoji} Risco ${riskLabel}</div></div>`;
    // Maturity
    html+=`<div class="diag-score-card">`;
    html+=`<div class="diag-score-number ${matClass}">${maturity.score}<span>/10</span></div>`;
    html+=`<div class="diag-score-label">📊 Maturidade ${matLabel}</div></div>`;
    // Potential
    html+=`<div class="diag-score-card">`;
    html+=`<div class="diag-score-number pot-high">${pot.score}<span>/10</span></div>`;
    html+=`<div class="diag-score-label">🚀 Potencial de Melhoria</div></div>`;
    html+=`</div>`;

    // Risk analysis
    html+=`<div class="diag-section"><h4>⚠️ Análise de Risco</h4>`;
    html+=`<div class="diag-bar"><div class="diag-bar-fill ${riskClass}" style="width:${risk.score*10}%"></div></div>`;
    html+=`<ul class="diag-items risk">${risk.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    // Maturity analysis
    html+=`<div class="diag-section"><h4>📊 Maturidade Digital</h4>`;
    html+=`<div class="diag-bar"><div class="diag-bar-fill ${matClass}" style="width:${maturity.score*10}%"></div></div>`;
    html+=`<ul class="diag-items potential">${maturity.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    // Potential
    html+=`<div class="diag-section"><h4>🚀 Potencial de Melhoria</h4>`;
    html+=`<div class="diag-bar"><div class="diag-bar-fill pot-high" style="width:${pot.score*10}%"></div></div>`;
    html+=`<ul class="diag-items potential">${pot.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    // Personalized recommendations
    html+=`<div class="diag-section"><h4>✨ Recomendações Personalizadas</h4>`;
    const recs=getDetailedRecs(d,risk,maturity);
    recs.forEach(r=>{
        html+=`<div class="diag-svc-card">`;
        html+=`<span class="diag-svc-icon">${r.icon}</span>`;
        html+=`<div><strong>${r.title}</strong><span>${r.desc}</span></div></div>`;
    });
    html+=`</div>`;

    // ROI estimate
    const roi=calcROI(d,risk);
    html+=`<div class="diag-roi">`;
    html+=`<div class="diag-roi-title">📈 Estimativa de Impacto (12 meses)</div>`;
    html+=`<div class="diag-roi-grid">`;
    roi.forEach(r=>{
        html+=`<div class="diag-roi-item"><div class="diag-roi-value">${r.value}</div><div class="diag-roi-label">${r.label}</div></div>`;
    });
    html+=`</div></div>`;

    // Biggest pain echo
    if(d.biggest_pain){
        html+=`<div class="diag-insight"><span class="diag-insight-icon">🎯</span><span>Sobre "<em>${esc(d.biggest_pain)}</em>" — isso é exatamente o tipo de problema que resolvemos com ${svcs.length>1?'a combinação de serviços recomendados':'o serviço recomendado'}. Nossos clientes com desafios similares viram resultados em menos de 30 dias.</span></div>`;
    }

    // CTA
    const waMsg=encodeURIComponent(`Olá! Sou ${d.name} da ${d.company} (${d.employees} colab., ${segment}). Fiz o diagnóstico no site:\n\n📊 Risco: ${riskLabel} (${risk.score}/10)\n📊 Maturidade: ${matLabel} (${maturity.score}/10)\n📊 Potencial: ${pot.score}/10\n\nGostaria de conversar sobre: ${svcs.map(s=>SVC_NAMES[s]).join(', ')}.${d.biggest_pain?'\n\nDesafio principal: '+d.biggest_pain:''}`);
    html+=`<div class="diag-cta">`;
    html+=`<a href="https://wa.me/554140639294?text=${waMsg}" class="btn-main" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Falar com especialista agora</a>`;
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
    if(d.ai_usage==='none'||d.ai_usage==='scattered')svcs.add('ai_development');
    const emp=d.employees||'';
    if(emp==='50-100'||emp==='100+')svcs.add('cto_service');
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
    if(d.ai_usage==='none'||d.ai_usage==='scattered'){
        recs.push({icon:'🤖',title:'IA Aplicada & Automação',desc:'Implementar IA com governança: automação de processos, chatbots, dashboards inteligentes com Gemini e Claude.'});
    }
    const tools=d.tools||[];
    if(!tools.includes('google')&&!tools.includes('microsoft')){
        recs.push({icon:'📧',title:'Google Workspace com Gemini',desc:'E-mail corporativo, Drive, Meet, Chat e Gemini AI integrado. Produtividade e colaboração em outro nível.'});
    }
    const emp=d.employees||'';
    if(emp==='50-100'||emp==='100+'){
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
    if(roi.length===0){
        roi.push({value:'↑ 30%',label:'Eficiência operacional'});
        roi.push({value:'↓ 25%',label:'Custo total de TI'});
    }
    return roi.slice(0,4);
}
