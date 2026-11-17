/* Vitrine do empreendimento (Área restrita), inspirada na "Área do corretor" do Conecta Towers (Maxces):
   capa + placar de disponibilidade + prazo da condição, e cartões que abrem Plantas, Galeria, Lazer,
   Localização, Condições e "Tenho X para investir" (o que cabe no orçamento do cliente).
   Tudo vem da tabela cifrada já aberta (TAB); nada é salvo nem enviado. Textos da tabela já chegam escapados. */
(function(){
  const box=document.getElementById('vitBox');
  if(!box||typeof renderCorretor!=='function') return;

  const IMG=s=>/^img\/[a-z0-9_\/-]+\.(jpg|png|webp)$/i.test(String(s||''))?s:'';
  const n0=v=>Math.max(0,Math.round(+v||0));
  const txt=s=>{ const t=document.createElement('textarea'); t.innerHTML=String(s||''); return t.value; };
  const area=a=>a?a.toLocaleString('pt-BR',{minimumFractionDigits:2})+' m²':'';
  const conds=(e,u)=>(u&&u.condicoes)||(e&&e.condicoes)||null;
  const nomeUni=u=>`${u.torre?u.torre+'-':''}${u.unidade??''}`;
  let aba=null, empAtual=null, X={e:0,m:0,b:0};   // orçamento do cliente fica só na memória desta aba

  /* ---------- lightbox das fotos ---------- */
  let lb=null, lbFotos=[], lbI=0;
  function abrirFoto(lista,i){
    if(!lb){
      lb=document.createElement('dialog'); lb.className='vit-lb';
      lb.innerHTML=`<button type="button" class="vit-lb-x" aria-label="${L('Fechar','Cerrar')}">✕</button>
        <button type="button" class="vit-lb-p" aria-label="${L('Anterior','Anterior')}">‹</button>
        <img alt=""><button type="button" class="vit-lb-n" aria-label="${L('Próxima','Siguiente')}">›</button><p class="vit-lb-c"></p>`;
      document.body.appendChild(lb);
      lb.querySelector('.vit-lb-x').addEventListener('click',()=>lb.close());
      lb.querySelector('.vit-lb-p').addEventListener('click',()=>mostrar(lbI-1));
      lb.querySelector('.vit-lb-n').addEventListener('click',()=>mostrar(lbI+1));
      lb.addEventListener('click',ev=>{ if(ev.target===lb) lb.close(); });
      lb.addEventListener('keydown',ev=>{ if(ev.key==='ArrowLeft') mostrar(lbI-1); if(ev.key==='ArrowRight') mostrar(lbI+1); });
    }
    lbFotos=lista; mostrar(i); if(!lb.open) lb.showModal();
  }
  function mostrar(i){
    lbI=(i+lbFotos.length)%lbFotos.length; const [src,leg]=lbFotos[lbI];
    lb.querySelector('img').src=src; lb.querySelector('.vit-lb-c').textContent=`${leg?leg+' · ':''}${lbI+1}/${lbFotos.length}`;
    lb.querySelectorAll('.vit-lb-p,.vit-lb-n').forEach(b=>b.hidden=lbFotos.length<2);
  }
  const fotosLocal=f=>[[IMG(f.mapaRua),L('Mapa da rua (© OpenStreetMap)','Mapa de la calle (© OpenStreetMap)')],[IMG(f.mapa),L('Vista aérea','Vista aérea')]].filter(x=>x[0]);
  const rotFoto=s=>{ const n=s.split('/').pop().replace(/\.\w+$/,'').replace(/-/g,' '); return n.charAt(0).toUpperCase()+n.slice(1); };

  /* ---------- "Tenho X para investir" ---------- */
  function analisar(c){
    const mn=c.mensais||{}, bl=c.baloes||{}, un=c.unico||{};
    const n=n0(mn.n), mv=n0(mn.valor), nb=n0(bl.n), bv=n0(bl.valor), cada=Math.max(1,n0(bl.cada)||12);
    const uv=n0(un.valor), um=Math.max(1,n0(un.mes)||1), ent=n0(c.entrada);
    const total=ent+n*mv+nb*bv+uv, agora=ent+(um<=1?uv:0), depois=um>1?uv:0, balAno=bv*12/cada;
    const r={total,agora,mensal:mv,balAno,n,nb,cada};
    if(!n&&!nb){                                            // à vista: tudo em até 30 dias (+ saldo posterior, se houver)
      r.tipo='avista'; r.ok=X.e>=total-depois; r.falta=Math.max(0,total-depois-X.e); return r;
    }
    if(X.e>=ent&&X.m>=mv&&X.b>=balAno-0.5){ r.tipo='tabela'; r.ok=true; return r; }
    // ajuste que mantém o valor total: usa a entrada e o extra anual do cliente e recalcula a mensal
    const e2=Math.min(X.e,total-depois), resto=total-depois-e2;
    const b2=nb?Math.min(Math.floor(X.b*cada/12),Math.floor(resto/nb)):0;
    const sobra=Math.max(0,resto-b2*nb), m2=n?Math.floor(sobra/n):0, troco=n?sobra-m2*n:0; // troco (< n reais) vai para a entrada: total fecha exato
    const fecha=n?true:(resto-b2*nb)<=0;
    r.tipo='ajuste'; r.ok=fecha&&m2+(troco?1:0)<=X.m;
    r.aj={entrada:e2+troco,mensais:{n:m2?n:0,valor:m2,inicio:Math.max(1,n0(mn.inicio)||1)},
      baloes:{n:b2?nb:0,valor:b2,cada,inicio:Math.max(1,n0(bl.inicio)||12)},
      unico:{valor:depois,mes:um},correcao:c.correcao||''};
    r.mensalNec=m2+(troco?1:0); r.faltaMes=Math.max(0,r.mensalNec-X.m); r.faltaEnt=r.faltaMes*n;
    return r;
  }
  function tenhoX(e){
    const grupos=new Map();                                 // mesma condição para várias unidades = 1 bloco só
    e.unidades.forEach((u,i)=>{ const c=conds(e,u); if(!c||u.status==='vendido') return; if(!grupos.has(c)) grupos.set(c,[]); grupos.get(c).push(i); });
    const campo=(id,rot,val,dica)=>`<div class="f"><label for="${id}">${rot}</label><div class="in"><span>R$</span><input id="${id}" type="text" data-num data-dinheiro data-casas="0" inputmode="numeric" autocomplete="off" value="${val?n0(val).toLocaleString('pt-BR'):''}" placeholder="0"></div><span class="extenso" aria-hidden="true">${porExtenso(n0(val))}</span>${dica?`<small class="note">${dica}</small>`:''}</div>`;
    const temX=X.e||X.m||X.b;
    let res='';
    if(temX){
      for(const [c,idx] of grupos){
        const us=idx.map(i=>e.unidades[i]), rotU=us.map(u=>`${nomeUni(u)}${u.area?' ('+area(u.area)+')':''}`).join(L(' ou ',' o '));
        for(const k of Object.keys(c).filter(k=>c[k]&&typeof c[k]==='object')){
          const r=analisar(c[k]), nm=c[k].nome||k;
          let selo, corpo='', btn='';
          if(r.tipo==='avista'){
            selo=r.ok?['ok',L('✅ Cabe','✅ Entra')]:['nao',L('❌ Não cabe','❌ No entra')];
            corpo=r.ok?L(`Precisa de ${brl(r.agora)} em até 30 dias; o cliente tem ${brl(X.e)}.`,`Necesita ${brl(r.agora)} en hasta 30 días; el cliente tiene ${brl(X.e)}.`)
              :L(`Precisa de ${brl(r.agora)} em até 30 dias. <b>Faltam ${brl(r.falta)}.</b>`,`Necesita ${brl(r.agora)} en hasta 30 días. <b>Faltan ${brl(r.falta)}.</b>`);
          }else if(r.tipo==='tabela'){
            selo=['ok',L('✅ Cabe na condição da tabela','✅ Entra en la condición de lista')];
            corpo=L(`Entrada ${brl(n0(c[k].entrada))} · ${r.n} × ${brl(r.mensal)}`,`Anticipo ${brl(n0(c[k].entrada))} · ${r.n} × ${brl(r.mensal)}`)+(r.nb?` · ${r.nb} × ${brl(n0(c[k].baloes.valor))}`:'')+
              `<br><span class="note">${L(`Sobra por mês: ${brl(X.m-r.mensal)}.`,`Sobra por mes: ${brl(X.m-r.mensal)}.`)}</span>`;
            btn=`<button class="btn ghost" type="button" data-prop="${idx[0]}" data-base="${k}">${L('📄 Montar proposta','📄 Armar propuesta')}</button>`;
          }else{
            const a=r.aj, linha=`${L('Entrada','Anticipo')} ${brl(a.entrada)}`+(a.mensais.n?` · ${a.mensais.n} × ${brl(a.mensais.valor)}`:'')+(a.baloes.n?` · ${a.baloes.n} × ${brl(a.baloes.valor)} ${a.baloes.cada===12?L('por ano','por año'):''}`:'')+(a.unico.valor?` · ${brl(a.unico.valor)} ${L('no mês','en el mes')} ${a.unico.mes}`:'');
            if(r.ok){
              selo=['aj',L('🟡 Cabe com ajuste','🟡 Entra con ajuste')];
              corpo=`${linha}<br><span class="note">${L(`Mesmo valor total (${brl(r.total)}), com o dinheiro redistribuído. Precisa de aprovação da incorporadora.`,`Mismo valor total (${brl(r.total)}), con el dinero redistribuido. Necesita aprobación del desarrollador.`)}</span>`;
              btn=`<button class="btn" type="button" data-prop="${idx[0]}" data-base="${k}" data-aj="1">${L('📄 Montar proposta com este fluxo','📄 Armar propuesta con este plan')}</button>`;
            }else{
              selo=['nao',L('❌ Não cabe','❌ No entra')];
              corpo=`${L('Para fechar o valor, a mensal teria de ser','Para cerrar el valor, la cuota tendría que ser')} <b>${brl(r.mensalNec)}</b>.<br>
                <b>${L(`Faltam ${brl(r.faltaMes)} por mês`,`Faltan ${brl(r.faltaMes)} por mes`)}</b> ${L(`(ou cerca de ${brl(r.faltaEnt)} a mais de entrada).`,`(o cerca de ${brl(r.faltaEnt)} más de anticipo).`)}`;
            }
          }
          res+=`<div class="vit-x ${selo[0]}"><div class="vit-x-h"><b>${nm} · ${brl(r.total)}</b><span class="vit-selo ${selo[0]}">${selo[1]}</span></div>
            <p class="note">${L('Unidade','Unidad')} ${rotU}</p><p>${corpo}</p>${btn?`<div class="actions">${btn}</div>`:''}</div>`;
        }
      }
      res+=`<p class="note">${L(`Mensais e balões corrigidos pelo CUB sobem com o tempo (CUB/SC: ${p1(CUB.v12m)} nos últimos 12 meses). Deixe uma folga no orçamento.`,`Las cuotas ajustadas por el CUB suben con el tiempo (CUB/SC: ${p1(CUB.v12m)} en los últimos 12 meses). Deje un margen en el presupuesto.`)}</p>`;
    }
    return `<p class="note">${L('Digite o que o cliente tem. O site mostra, para cada condição, se cabe como está, se cabe redistribuindo o pagamento ou quanto falta.','Escriba lo que el cliente tiene. El sitio muestra, para cada condición, si entra tal cual, si entra redistribuyendo el pago o cuánto falta.')}</p>
      <div class="vit-xin inputs">${campo('vxE',L('Tem para a entrada','Tiene para el anticipo'),X.e,L('Dinheiro disponível agora (até 30 dias)','Dinero disponible ahora (hasta 30 días)'))}
        ${campo('vxM',L('Pode pagar por mês','Puede pagar por mes'),X.m)}
        ${campo('vxB',L('Extra por ano (opcional)','Extra por año (opcional)'),X.b,L('13º, bônus, safra: vira balão anual','Aguinaldo, bono, cosecha: se vuelve refuerzo anual'))}</div>
      <div id="vxRes">${res}</div>`;
  }

  /* ---------- conteúdo de cada cartão ---------- */
  function detalhe(e,k){
    const f=e.fotos||{};
    if(k==='plantas') return `<div class="vit-plantas">${e.unidades.map((u,i)=>{ const pl=IMG(u.planta); return `<figure class="vit-pl">
        ${pl?`<button type="button" class="vit-img" data-foto="pl" data-i="${i}"><img src="${pl}" alt="${L('Planta','Planta')} ${nomeUni(u)}" loading="lazy"></button>`:''}
        <figcaption><b>${L('Unidade','Unidad')} ${nomeUni(u)}</b> <span class="st ${u.status||''}">${STATUS[u.status]||u.status||''}</span><br>
          ${[u.tipo,area(u.area),u.vagas?`${u.vagas} ${L('vagas','cocheras')}`:'',u.pavimento?`${u.pavimento}º ${L('andar','piso')}`:''].filter(Boolean).join(' · ')}<br>
          <b class="vit-preco">${brl(u.valor)}</b>${u.avista?` <span class="note">· ${L('à vista','contado')} ${brl(u.avista)}</span>`:''}</figcaption>
        <div class="actions"><button class="btn ghost" type="button" data-usar="${i}">${L('Usar nas simulações','Usar en las simulaciones')}</button>${conds(e,u)?`<button class="btn" type="button" data-prop="${i}" data-base="fluxo">${L('📄 Proposta','📄 Propuesta')}</button>`:''}</div></figure>`; }).join('')}</div>`;
    if(k==='galeria'){ const g=[IMG(f.capa),...(f.galeria||[]).map(IMG)].filter(Boolean);
      return `<div class="vit-gal">${g.map((s,i)=>`<button type="button" class="vit-img" data-foto="gal" data-i="${i}"><img src="${s}" alt="${rotFoto(s)}" loading="lazy"></button>`).join('')}</div><p class="note">${L('Imagens ilustrativas do catálogo. Clique para ampliar.','Imágenes ilustrativas del catálogo. Haga clic para ampliar.')}</p>`; }
    if(k==='lazer'){ const lz=IMG(f.lazer);
      return `<p>${e.lazer||''}</p>${lz?`<button type="button" class="vit-img vit-larga" data-foto="lazer" data-i="0"><img src="${lz}" alt="${L('Planta do lazer','Planta de áreas comunes')}" loading="lazy"></button>`:''}`; }
    if(k==='local'){ const fl=fotosLocal(f), end=[e.endereco,e.bairro,e.cidade?e.cidade+' - SC':''].filter(Boolean).join(', ');
      return `<p><b>${end}</b>${e.distanciaMar?` · ${L(`≈ ${Math.round(e.distanciaMar).toLocaleString('pt-BR')} m do mar em linha reta`,`≈ ${Math.round(e.distanciaMar).toLocaleString('pt-BR')} m del mar en línea recta`)}${e.praia?` (${e.praia})`:''}`:''}</p>
        <div class="vit-locs">${fl.map(([src,leg],i)=>`<button type="button" class="vit-img" data-foto="mapa" data-i="${i}"><img src="${src}" alt="${leg}" loading="lazy"></button>`).join('')}</div>
        <div class="actions"><a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(txt(end))}" target="_blank" rel="noopener">${L('Abrir no Google Maps','Abrir en Google Maps')}</a></div>`; }
    if(k==='cond'){ const vis=new Set(); let h='';
      e.unidades.forEach(u=>{ const c=conds(e,u); if(!c||vis.has(c)) return; vis.add(c);
        for(const kk of Object.keys(c).filter(x=>c[x]&&typeof c[x]==='object')){ const p=c[kk], r=analisar(p), mn=p.mensais||{}, bl=p.baloes||{}, un=p.unico||{};
          const it=[[L('Entrada','Anticipo'),brl(n0(p.entrada))],
            n0(mn.n)?[L('Mensais','Cuotas'),`${mn.n} × ${brl(n0(mn.valor))}`]:null,
            n0(bl.n)?[L('Balões','Refuerzos'),`${bl.n} × ${brl(n0(bl.valor))}${n0(bl.cada)===12?' '+L('anuais','anuales'):''}`]:null,
            n0(un.valor)?[n0(un.mes)<=1?L('Saldo em 30 dias','Saldo en 30 días'):L('Parcela única','Cuota única'),brl(n0(un.valor))]:null].filter(Boolean);
          h+=`<div class="vit-cond"><h3>${p.nome||kk}</h3><div class="vit-preco">${brl(r.total)}</div><ul class="prop-res">${it.map(([a,b])=>`<li><span>${a}</span><b>${b}</b></li>`).join('')}</ul>
            <p class="note">${p.correcao?L(`Corrigido pelo ${p.correcao}.`,`Ajustado por ${p.correcao}.`):L('Sem correção.','Sin ajuste.')}</p></div>`; } });
      return `<div class="vit-conds">${h}</div>${e.observacoes?`<p class="note">${e.observacoes}</p>`:''}`; }
    if(k==='x') return tenhoX(e);
    return '';
  }

  /* ---------- vitrine ---------- */
  function render(){
    const e=TAB?.empreendimentos.find(x=>x.id===cEmp);
    if(!e){ box.hidden=true; box.innerHTML=''; return; }
    if(empAtual!==e.id){ empAtual=e.id; aba=null; }
    const f=e.fotos||{}, capa=IMG(f.capa), us=e.unidades;
    const cont=s=>us.filter(u=>(u.status||'disponivel')===s).length;
    const disp=cont('disponivel'), res=cont('reservado'), vend=cont('vendido'), pDisp=us.length?Math.round(disp/us.length*100):0;
    let prazo='';
    if(/^\d{4}-\d{2}-\d{2}$/.test(e.validade||'')){
      const d=Math.ceil((new Date(e.validade+'T23:59:59')-new Date())/864e5), dt=fmtDia(e.validade);
      prazo=d<0?`<span class="vit-prazo fim">${L(`Condição venceu em ${dt}`,`Condición venció el ${dt}`)}</span>`
        :`<span class="vit-prazo${d<=7?' urg':''}">⏳ ${L(`Condição válida até ${dt} · ${d===0?'último dia':d===1?'falta 1 dia':`faltam ${d} dias`}`,`Condición válida hasta ${dt} · ${d===0?'último día':d===1?'falta 1 día':`faltan ${d} días`}`)}</span>`;
    }
    const temPl=us.some(u=>IMG(u.planta)), temCond=us.some(u=>conds(e,u));
    const cards=[
      ['plantas','📐',L('Plantas','Plantas'),L('Unidades, áreas e preços','Unidades, áreas y precios'),temPl||us.length],
      ['galeria','🖼️',L('Galeria de imagens','Galería de imágenes'),L('Fachada e áreas comuns','Fachada y áreas comunes'),capa||(f.galeria||[]).length],
      ['lazer','🏊',L('Lazer','Áreas comunes'),L('O que o prédio oferece','Lo que ofrece el edificio'),e.lazer],
      ['local','📍',L('Localização','Ubicación'),L('Endereço e mapa','Dirección y mapa'),e.endereco||f.mapa],
      ['cond','💳',L('Condições','Condiciones'),L('À vista e parcelado','Contado y financiado'),temCond],
      ['x','🎯',L('Tenho “X” para investir','Tengo “X” para invertir'),L('O que cabe no orçamento do cliente','Lo que entra en el presupuesto del cliente'),temCond],
    ].filter(c=>c[4]);
    if(aba&&!cards.some(c=>c[0]===aba)) aba=null;
    box.hidden=false;
    box.innerHTML=`<div class="vit-hero"${capa?` style="background-image:linear-gradient(180deg,rgba(11,16,21,.15),rgba(11,16,21,.92)),url('${capa}')"`:''}>
        <div class="vit-hero-txt"><span class="badge">${[e.fase,e.entrega?L('entrega ','entrega ')+fmtMesAno(e.entrega):''].filter(Boolean).join(' · ')}</span>
          <h2>${e.nome}</h2><p>${[e.bairro,e.cidade,e.incorporacao?L('Registro de Incorporação nº ','Registro de Incorporación nº ')+e.incorporacao:''].filter(Boolean).join(' · ')}</p>${prazo}</div>
        <div class="vit-placar" title="${L(`${pDisp}% das ${us.length} unidades disponíveis`,`${pDisp}% de las ${us.length} unidades disponibles`)}">
          <div class="vit-nums"><span><b>${disp}</b> ${L('disponíveis','disponibles')}</span>${res?`<span><b>${res}</b> ${L('reservadas','reservadas')}</span>`:''}${vend?`<span><b>${vend}</b> ${L('vendidas','vendidas')}</span>`:''}</div>
          <div class="vit-barra"><i style="width:${pDisp}%"></i></div><small>${pDisp}% ${L('disponível','disponible')}</small></div>
      </div>
      <div class="vit-cards">${cards.map(([k,ic,t,s])=>`<button type="button" class="vit-card" data-aba="${k}" aria-expanded="${aba===k}"><span class="ic">${ic}</span><span><b>${t}</b><small>${s}</small></span><span class="seta">›</span></button>`).join('')}</div>
      <div class="vit-det" id="vitDet"${aba?'':' hidden'}>${aba?`<h3 class="av-sub">${cards.find(c=>c[0]===aba)[2]}</h3>`+detalhe(e,aba):''}</div>`;
    ligar(e);
  }

  function ligar(e){
    box.querySelectorAll('[data-aba]').forEach(b=>b.addEventListener('click',()=>{ aba=aba===b.dataset.aba?null:b.dataset.aba; render();
      if(aba) document.getElementById('vitDet').scrollIntoView({behavior:'smooth',block:'nearest'}); }));
    const f=e.fotos||{};
    box.querySelectorAll('[data-foto]').forEach(b=>b.addEventListener('click',()=>{
      const t=b.dataset.foto, i=+b.dataset.i;
      if(t==='pl'){ const l=e.unidades.filter(u=>IMG(u.planta)).map(u=>[IMG(u.planta),`${L('Unidade','Unidad')} ${nomeUni(u)} · ${area(u.area)}`]); abrirFoto(l,Math.max(0,l.findIndex(x=>x[0]===IMG(e.unidades[i].planta)))); }
      else if(t==='gal'){ const g=[IMG(f.capa),...(f.galeria||[]).map(IMG)].filter(Boolean); abrirFoto(g.map(s=>[s,rotFoto(s)]),i); }
      else if(t==='mapa') abrirFoto(fotosLocal(f),i);
      else abrirFoto([[IMG(f.lazer),'']],0);
    }));
    box.querySelectorAll('[data-usar]').forEach(b=>b.addEventListener('click',()=>usarUnidade(+b.dataset.usar)));
    box.querySelectorAll('.vit-plantas [data-prop]').forEach(b=>b.addEventListener('click',()=>{
      if(typeof window.abrirPropostaCom==='function') window.abrirPropostaCom(e.unidades[+b.dataset.prop],b.dataset.base,null);
    }));
    ['vxE','vxM','vxB'].forEach(id=>{ const i=document.getElementById(id); if(!i) return;
      i.addEventListener('input',()=>{ X={e:n0(lerNum(document.getElementById('vxE').value)),m:n0(lerNum(document.getElementById('vxM').value)),b:n0(lerNum(document.getElementById('vxB').value))};
        const tmp=document.createElement('div'); tmp.innerHTML=tenhoX(e);
        document.getElementById('vxRes').replaceWith(tmp.querySelector('#vxRes')); ligarRes(e); }); });
    ligarRes(e);
  }
  function ligarRes(e){
    document.querySelectorAll('#vxRes [data-prop]').forEach(b=>b.addEventListener('click',()=>{
      const u=e.unidades[+b.dataset.prop], base=b.dataset.base, aj=b.dataset.aj?analisar(conds(e,u)[base]).aj:null;
      if(typeof window.abrirPropostaCom==='function') window.abrirPropostaCom(u,base,aj);
    }));
  }

  const orig=renderCorretor;
  renderCorretor=function(){ orig(); if(!TAB){ empAtual=null; aba=null; X={e:0,m:0,b:0}; } render(); };
  renders.corretor=renderCorretor;
})();
