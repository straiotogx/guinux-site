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

    // Hero prompt → open chat modal
    const heroPromptBox=document.getElementById('heroPromptBox');
    if(heroPromptBox){
        heroPromptBox.addEventListener('click',()=>openChat('faq'));
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
    modal.classList.add('active');
    document.body.style.overflow='hidden';
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
    setTimeout(()=>processStep(),300);
}

function closeChat(){
    const modal=document.getElementById('chatModal');
    modal.classList.remove('active');
    document.body.style.overflow='';
}

// Legacy alias
function startFlow(flowId){openChat(flowId)}

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
    {id:'faq_greeting',type:'auto',msgs:['Olá! Sou a Guinux.IA ✨','Aqui estão as perguntas mais comuns. Clique na que te interessa:']},
    {id:'faq_choice',type:'faq_pills'},
];

/* ========= COTAÇÃO FLOW ========= */
const FLOW_COTACAO=[
    {id:'greeting',type:'auto',msgs:['Olá! Sou a Guinux.IA ✨','Vou montar uma proposta personalizada para sua empresa. Leva menos de 2 minutos!']},
    {id:'name',type:'text',msgs:['Qual é o seu nome?'],ph:'Digite seu nome...'},
    {id:'company',type:'text',msgs:d=>[`Prazer, ${esc(d.name.split(' ')[0])}! Qual o nome da sua empresa?`],ph:'Nome da empresa...'},
    {id:'employees',type:'pills',msgs:['Qual o porte da empresa?'],opts:[{l:'1–10 pessoas',v:'1-10',tier:'micro'},{l:'10–25 pessoas',v:'10-25',tier:'pequena'},{l:'25–50 pessoas',v:'25-50',tier:'media'},{l:'50–100 pessoas',v:'50-100',tier:'media_grande'},{l:'100+ pessoas',v:'100+',tier:'grande'}]},
    {id:'segment',type:'pills',msgs:d=>[`${esc(d.company)} com ${d.employees} — entendi!`,'Qual o segmento da empresa?'],opts:[{l:'Advocacia / Jurídico',v:'juridico'},{l:'Imobiliário / Construção',v:'imobiliario'},{l:'Indústria',v:'industria'},{l:'Serviços / Consultoria',v:'servicos'},{l:'Saúde',v:'saude'},{l:'Varejo / Comércio',v:'varejo'},{l:'Tecnologia',v:'tecnologia'},{l:'Outro',v:'outro'}]},
    {id:'needs',type:'pills',msgs:d=>{
        const sz=d.employees;
        let intro='';
        if(sz==='1-10') intro='Para empresas do seu porte, eficiência é tudo.';
        else if(sz==='10-25') intro='Empresas em crescimento como a sua precisam de base sólida.';
        else if(sz==='25-50') intro='Com esse porte, uma TI bem estruturada faz toda a diferença.';
        else intro='Para empresas do seu porte, estratégia e governança são essenciais.';
        return [intro,'Qual a principal necessidade hoje?'];
    },opts:[{l:'Preciso de suporte e gestão de TI',v:'suporte'},{l:'Quero migrar para Google Workspace',v:'google'},{l:'Quero implementar IA na empresa',v:'ia'},{l:'Preciso de liderança tecnológica (CTO)',v:'cto'},{l:'Tenho múltiplas necessidades',v:'multiplo'}]},
    {id:'pain',type:'pills',msgs:['E qual o maior desafio que vocês enfrentam hoje?'],opts:[{l:'TI instável / cai muito',v:'instavel'},{l:'Sem controle ou visibilidade',v:'sem_controle'},{l:'Gastos altos com TI',v:'custo'},{l:'Equipe improdutiva',v:'produtividade'},{l:'Segurança e LGPD',v:'seguranca'},{l:'Não estamos inovando',v:'inovacao'}]},
    {id:'urgency',type:'pills',msgs:['Qual a urgência para resolver isso?'],opts:[{l:'Imediata — preciso agora',v:'imediata'},{l:'Próximos 30 dias',v:'30dias'},{l:'Estou pesquisando',v:'pesquisa'}]},
    {id:'cotacao_result',type:'cotacao_end'},
];

/* ========= DIAGNÓSTICO FLOW ========= */
const FLOW_DIAGNOSTICO=[
    {id:'greeting',type:'auto',msgs:['Olá! Sou a Guinux.IA ✨','Vou analisar sua empresa e gerar um diagnóstico completo de risco e potencial.','Vamos lá?']},
    {id:'name',type:'text',msgs:['Qual é o seu nome?'],ph:'Digite seu nome...'},
    {id:'company',type:'text',msgs:d=>[`Prazer, ${esc(d.name.split(' ')[0])}! Qual o nome da sua empresa?`],ph:'Nome da empresa...'},
    {id:'employees',type:'pills',msgs:['Quantos colaboradores a empresa possui?'],opts:[{l:'1–10',v:'1-10'},{l:'10–25',v:'10-25'},{l:'25–50',v:'25-50'},{l:'50–100',v:'50-100'},{l:'100+',v:'100+'}]},
    {id:'it_status',type:'pills',msgs:d=>[`Entendi, ${esc(d.company)} com ${d.employees} colaboradores. Como está a TI hoje?`],opts:[{l:'Sem equipe de TI',v:'none'},{l:'TI interna',v:'internal'},{l:'Terceirizada (insatisfeito)',v:'outsourced'},{l:'Modelo híbrido',v:'hybrid'}]},
    {id:'infra',type:'pills',msgs:['E a infraestrutura, onde estão seus servidores e dados?'],opts:[{l:'Servidores locais',v:'onprem'},{l:'Tudo na nuvem',v:'cloud'},{l:'Híbrido',v:'hybrid'},{l:'Não sei',v:'unknown'}]},
    {id:'ai_usage',type:'pills',msgs:['E inteligência artificial? Como a empresa usa IA hoje?'],opts:[{l:'Não utilizamos',v:'none'},{l:'Uso descentralizado',v:'scattered'},{l:'Usamos, queremos otimizar',v:'optimize'}]},
    {id:'services',type:'multi',msgs:d=>{
        let r=d.ai_usage==='none'?'Interessante — há muito potencial para ganhos com IA.':d.ai_usage==='scattered'?'Uso descentralizado pode gerar riscos. Boa hora de estruturar.':'Ótimo! Vamos escalar isso.';
        return [r,'Quais serviços te interessam? Selecione um ou mais:'];
    },opts:[{l:'Gestão de TI Completa',v:'it_management'},{l:'Google Workspace com IA',v:'google_workspace'},{l:'IA Aplicada & Desenvolvimento',v:'ai_development'},{l:'CTO as a Service',v:'cto_service'}]},
    {id:'satisfaction',type:'stars',msgs:['De 1 a 5, qual sua satisfação com a TI atual?']},
    {id:'message',type:'text',msgs:['Quer descrever algum desafio ou necessidade específica? (opcional)'],ph:'Descreva aqui ou deixe em branco...',optional:true},
];

/* ========= CHAT ENGINE ========= */
let chatData={},chatStep=0,chatMsgs,chatInput,currentFlow='diagnostico';

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
        await showTyping(500+Math.random()*600);
        addBotMsg(m);
    }
    if(q.type==='auto'){
        chatStep++;
        setTimeout(()=>processStep(),1000);
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
            addBotMsg('Tem outra dúvida? Ou quer fazer uma cotação?');
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
    cotBtn.addEventListener('click',()=>{
        chatInput.innerHTML='';chatMsgs.innerHTML='';
        chatData={};chatStep=0;currentFlow='cotacao';
        processStep();
    });
    const diagBtn=document.createElement('button');
    diagBtn.className='ci-pill';diagBtn.textContent='Fazer diagnóstico →';
    diagBtn.addEventListener('click',()=>{
        chatInput.innerHTML='';chatMsgs.innerHTML='';
        chatData={};chatStep=0;currentFlow='diagnostico';
        processStep();
    });
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
    addBotMsg(`Perfeito, ${name}! Analisando o perfil da ${esc(d.company||'sua empresa')}...`);
    await showTyping(1000);
    addBotMsg('Montando proposta personalizada...');
    await showTyping(1200);

    // Smart service recommendation based on needs + size
    const recSvcs=[];
    const recDetails=[];
    const sz=d.employees||'1-10';
    const need=d.needs||'multiplo';
    const pain=d.pain||'';

    // Always recommend based on primary need
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
    // Add based on pain points
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

    // Optimization insights
    const optimizations=[];
    if(pain==='instavel') optimizations.push('Monitoramento proativo pode reduzir downtime em até 95%');
    if(pain==='custo') optimizations.push('Migração para nuvem e otimização podem reduzir custos em 30-40%');
    if(pain==='produtividade') optimizations.push('IA em tarefas repetitivas pode liberar até 35% do tempo da equipe');
    if(pain==='sem_controle') optimizations.push('Dashboards e relatórios transparentes dão visibilidade total da operação');
    if(pain==='seguranca') optimizations.push('Implementação de LGPD, backup e segurança corporativa com Bitdefender');
    if(pain==='inovacao') optimizations.push('Roadmap de inovação com IA, automação e transformação digital');
    if(optimizations.length===0) optimizations.push('Estrutura profissional de TI pode aumentar produtividade em até 30%');

    // Build cotação card
    let html=`<div class="diagnosis">`;
    html+=`<div class="diag-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg> PROPOSTA PERSONALIZADA — ${esc(d.company||'Empresa')}</div>`;

    // Company profile
    html+=`<div class="diag-section"><h4>📋 Perfil da Empresa</h4>`;
    html+=`<ul class="diag-items potential"><li><strong>${esc(d.company)}</strong> · ${d.employees} colaboradores</li>`;
    html+=`<li>Segmento: ${esc(d.segment||'Não informado')}</li>`;
    html+=`<li>Necessidade principal: ${esc(d.needs==='multiplo'?'Múltiplas necessidades':d.needs||'')}</li></ul></div>`;

    // Recommended services
    html+=`<div class="diag-section"><h4>✨ Serviços Recomendados</h4>`;
    recDetails.forEach(s=>{
        html+=`<div style="display:flex;gap:.5rem;align-items:flex-start;margin-bottom:.5rem;padding:.5rem;background:rgba(26,122,122,.06);border-radius:8px">`;
        html+=`<span style="font-size:1.25rem;flex-shrink:0">${s.icon}</span>`;
        html+=`<div><strong style="color:#fff;font-size:.8125rem">${s.svc}</strong><br><span style="font-size:.75rem;color:#B0B4C8">${s.why}</span></div></div>`;
    });
    html+=`</div>`;

    // Optimization
    html+=`<div class="diag-section"><h4>🚀 Potencial de Otimização</h4>`;
    const potBar=Math.min(optimizations.length*25+20,90);
    html+=`<div class="diag-bar"><div class="diag-bar-fill pot-high" style="width:${potBar}%"></div></div>`;
    html+=`<ul class="diag-items potential">${optimizations.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    // Urgency badge
    const urgLabel=d.urgency==='imediata'?'⚡ Atendimento prioritário':'📅 Agendaremos uma reunião';
    html+=`<div style="text-align:center;padding:.5rem;background:rgba(26,122,122,.1);border-radius:8px;margin-bottom:1rem"><span style="font-size:.8125rem;font-weight:600;color:var(--teal)">${urgLabel}</span></div>`;

    // CTA
    const waMsg=encodeURIComponent(`Olá! Sou ${d.name} da ${d.company} (${d.employees} colaboradores, segmento ${d.segment}). Fiz uma cotação no site e tenho interesse em: ${recDetails.map(s=>s.svc).join(', ')}. Necessidade: ${d.needs}. Urgência: ${d.urgency}.`);
    html+=`<div class="diag-cta">`;
    html+=`<a href="https://wa.me/554140639294?text=${waMsg}" class="btn-main" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Receber proposta detalhada</a>`;
    html+=`<button class="btn-ghost" onclick="chatMsgs.innerHTML='';chatData={};chatStep=0;currentFlow='diagnostico';chatInput.classList.add('active');processStep()">Fazer diagnóstico completo →</button>`;
    html+=`</div></div>`;

    addRawMsg(html);
    expandAndAnimate();
}

/* ========= DIAGNOSIS GENERATOR ========= */
async function generateDiagnosis(){
    chatInput.innerHTML='';chatInput.classList.remove('active');

    await showTyping(1000);
    addBotMsg('Analisando suas respostas...');
    await showTyping(1200);
    addBotMsg('Calculando indicadores de risco e potencial...');
    await showTyping(1500);
    addBotMsg('Diagnóstico pronto! Aqui está:');
    await new Promise(r=>setTimeout(r,400));

    const d=chatData;
    const risk=calcRisk(d);
    const pot=calcPotential(d);
    const svcs=recommendSvcs(d);

    let html=`<div class="diagnosis">`;
    html+=`<div class="diag-title"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.5 7.5L22 10l-7.5 2.5L12 20l-2.5-7.5L2 10l7.5-2.5L12 0z"/></svg> DIAGNÓSTICO DE RISCO & POTENCIAL — ${esc(d.company||'Empresa')}</div>`;

    const riskClass=risk.score>=7?'risk-high':risk.score>=4?'risk-mid':'risk-low';
    const riskLabel=risk.score>=7?'Alto':risk.score>=4?'Médio':'Baixo';
    html+=`<div class="diag-section"><h4>⚠ Índice de Risco: ${riskLabel} (${risk.score}/10)</h4>`;
    html+=`<div class="diag-bar"><div class="diag-bar-fill ${riskClass}" style="width:${risk.score*10}%"></div></div>`;
    html+=`<ul class="diag-items risk">${risk.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    const potClass=pot.score>=7?'pot-high':'pot-mid';
    html+=`<div class="diag-section"><h4>🚀 Potencial de Melhoria: ${pot.score}/10</h4>`;
    html+=`<div class="diag-bar"><div class="diag-bar-fill ${potClass}" style="width:${pot.score*10}%"></div></div>`;
    html+=`<ul class="diag-items potential">${pot.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;

    html+=`<div class="diag-section"><h4>✨ Serviços Recomendados</h4>`;
    html+=`<div class="diag-svcs">${svcs.map(s=>`<span class="diag-svc">${SVC_NAMES[s]||s}</span>`).join('')}</div></div>`;

    const waMsg=encodeURIComponent(`Olá! Sou ${d.name} da ${d.company}. Fiz o diagnóstico no site e meu índice de risco é ${riskLabel} (${risk.score}/10). Gostaria de conversar sobre: ${svcs.map(s=>SVC_NAMES[s]).join(', ')}.`);
    html+=`<div class="diag-cta">`;
    html+=`<a href="https://wa.me/554140639294?text=${waMsg}" class="btn-main" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Falar com especialista</a>`;
    html+=`<button class="btn-ghost" onclick="location.reload()">Refazer</button>`;
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
        if(diag) diag.scrollIntoView({behavior:'smooth',block:'center'});
    },200);
}

function calcRisk(d){
    let score=0;const items=[];
    if(d.it_status==='none'){score+=3;items.push('Sem equipe de TI — vulnerabilidade crítica em caso de incidentes')}
    else if(d.it_status==='outsourced'){score+=2;items.push('TI terceirizada com insatisfação — risco de queda no serviço')}
    if(d.infra==='onprem'){score+=2;items.push('Servidores locais — risco de perda de dados e downtime')}
    else if(d.infra==='unknown'){score+=1.5;items.push('Infraestrutura desconhecida — falta de visibilidade aumenta riscos')}
    if(d.ai_usage==='none'){score+=1;items.push('Sem IA — concorrentes que adotam IA ganham vantagem competitiva')}
    else if(d.ai_usage==='scattered'){score+=1.5;items.push('IA sem governança — risco de dados sensíveis e inconsistência')}
    if(d.satisfaction&&d.satisfaction<=2){score+=1.5;items.push('Baixa satisfação com TI atual — pode impactar produtividade')}
    const emp=d.employees||'';
    if((emp==='50-100'||emp==='100+')&&d.it_status==='none'){score+=1;items.push('Empresa de porte médio/grande sem TI — exposição elevada')}
    if(items.length===0)items.push('Seu cenário atual apresenta baixo risco operacional');
    return{score:Math.min(Math.round(score),10),items};
}

function calcPotential(d){
    let score=0;const items=[];
    if(d.ai_usage==='none'){score+=3;items.push('Implementar IA pode gerar até 35% de ganho em eficiência')}
    else if(d.ai_usage==='scattered'){score+=2;items.push('Centralizar IA com governança pode eliminar redundâncias e riscos')}
    else{score+=1;items.push('Escalar IA existente com automações profundas e integrações')}
    if(d.infra==='onprem'){score+=2;items.push('Migração para nuvem pode reduzir custos de infraestrutura em até 40%')}
    else if(d.infra==='hybrid'){score+=1;items.push('Otimizar modelo híbrido para máxima eficiência')}
    if(d.it_status==='none'||d.it_status==='outsourced'){score+=2;items.push('Gestão profissional de TI pode aumentar uptime para 99.9%')}
    const emp=d.employees||'';
    if(emp==='50-100'||emp==='100+'){score+=1;items.push('Escala da empresa potencializa ROI de cada investimento em tecnologia')}
    if(d.satisfaction&&d.satisfaction<=3){score+=1;items.push('Margem significativa para melhoria na experiência de TI')}
    return{score:Math.min(Math.round(score),10),items};
}

function recommendSvcs(d){
    const svcs=new Set(d.services||[]);
    if(d.it_status==='none'||d.it_status==='outsourced')svcs.add('it_management');
    if(d.ai_usage!=='optimize')svcs.add('google_workspace');
    if(d.ai_usage==='none'||d.ai_usage==='scattered')svcs.add('ai_development');
    const emp=d.employees||'';
    if(emp==='50-100'||emp==='100+')svcs.add('cto_service');
    if(svcs.size===0)svcs.add('it_management');
    return[...svcs];
}
