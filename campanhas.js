/* Campanhas por praça (Área restrita). Fonte: pasta Beni\Marketing\Gerenciador (publicar_site.py).
   - dados/pracas.enc.json: praças, estados e material, cifrados com a mesma chave das tabelas (CHAVE_TAB, só na memória).
   - dados/pracas/<id>.<ficha|planilha>.enc: PDF e planilha cifrados.
   - Cidades: Brasil = IBGE (D.soja.municipios); Paraguai e Argentina = dados/cidades_mercosul.json (público).
   Leaflet (mapa) é carregado só quando uma praça conferida é aberta e usado via window.L
   (o L do site é a função de tradução). Textos do pacote chegam escapados (limparTextos). */
(function(){
  const box=document.getElementById('campBox'), modo=document.getElementById('corrModo'), area=document.getElementById('areaCorretor');
  if(!box||!modo||!area||typeof renderCorretor!=='function') return;

  const txt=s=>{ const t=document.createElement('textarea'); t.innerHTML=String(s??''); return t.value; };
  const norm=s=>txt(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  const LINHAS=[['prisma','Prisma Esmeralda | Goya'],['goya','Goya']];
  const PAISES=[['BR',L('Brasil','Brasil')],['PY',L('Paraguai','Paraguay')],['AR',L('Argentina','Argentina')]];
  const PIL={1:L('Residencial de elite','Residencial de élite'),2:L('Finanças e negócios','Finanzas y negocios'),3:L('Saúde, estética e bem-estar','Salud, estética y bienestar'),4:L('Lazer, mobilidade e tradição','Ocio, movilidad y tradición')};
  const COR={1:'#D4AF37',2:'#4FA3A5',3:'#C98BB9',4:'#7FB069'}, GOYA='#2F6FDB', EXC='#C0392B';
  const corDe=p=>p.acao==='excluir'?EXC:p.linha==='goya'?GOYA:COR[p.pilar];
  const dia=s=>{ const [a,m,d]=String(s||'').split('-'); return d?`${d}/${m}/${a}`:''; };
  const idadeDias=s=>(Date.now()-new Date(s+'T12:00:00'))/864e5;
  const wa=msg=>`https://wa.me/${CONTATO_PADRAO.whatsapp}?text=${encodeURIComponent(msg)}`;
  const quem=()=>USUARIO?.nome?txt(USUARIO.nome):L('corretor','corredor');
  // comando do Claude Code para atender o pedido (.claude/commands/mapear-praca.md); visível só no login do Santiago
  const SANTIAGO='santiago-fernandes-costa', ehSantiago=()=>USUARIO?.id===SANTIAGO;
  // o comando é só um atalho (não é segredo); o nome entra limpo: sem quebra de linha, sem "|" e símbolos, até 80 caracteres
  const limpaArg=s=>txt(s).replace(/[^\p{L}\p{N} .,'()\-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,80);
  const comando=(cidade,linha,extra='')=>`/mapear-praca ${limpaArg(cidade)} | ${linha==='goya'?'goya':'prisma'}${extra}`;
  const caixaCmd=c=>ehSantiago()?`<div class="camp-cmd"><span class="note">${L('Comando para o Claude:','Comando para Claude:')}</span><code>${esc(c)}</code><button class="btn ghost mini" type="button" data-copiar="${esc(c)}">${L('Copiar comando','Copiar comando')}</button></div>`:'';

  let modoAtual='emp', PK=null, MERC=null, pais='BR', sel=null, aberto=null /* [pracaId, linha] */, prio='A', mapa=null, erro='';

  // ---------- dados ----------
  async function abrirPacote(){
    if(PK) return PK;
    if(!CHAVE_TAB) throw new Error('chave');
    const r=await fetch('dados/pracas.enc.json',{cache:'no-store'}); if(!r.ok) throw new Error('rede');
    const e=await r.json();
    const claro=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(e.iv),additionalData:utf8('pracas-v1')},CHAVE_TAB,b64(e.ct));
    return PK=limparTextos(JSON.parse(new TextDecoder().decode(claro)));
  }
  async function abrirMerc(){
    if(MERC) return MERC;
    const r=await fetch('dados/cidades_mercosul.json'); if(!r.ok) throw new Error('rede');
    return MERC=await r.json();
  }
  function cidades(p){
    if(p==='BR') return Object.entries(D.soja?.municipios?.uf||{}).flatMap(([uf,l])=>l.map(([n])=>({pais:'BR',uf,nome:n})));
    return (MERC?.[p]||[]).map(([n,reg])=>({pais:p,reg,nome:n}));
  }
  const rotulo=c=>c.pais==='BR'?`${c.nome} (${c.uf})`:(c.reg?`${c.nome} (${c.reg})`:c.nome);
  const pracaDa=c=>PK?.pracas.find(p=>p.cidades.some(x=>x.pais===c.pais&&norm(x.nome)===norm(c.nome)&&(c.pais!=='BR'||x.uf===c.uf)))||null;
  function acharCidade(v){
    const l=cidades(pais), n=norm(v); if(!n) return null;
    return l.find(c=>norm(rotulo(c))===n)||(l.filter(c=>norm(c.nome)===n).length===1?l.find(c=>norm(c.nome)===n):null);
  }

  // ---------- tela ----------
  function render(){
    if(!TAB){ modo.hidden=true; box.hidden=true; area.classList.remove('modo-camp'); modoAtual='emp'; PK=null; sel=null; aberto=null; destruirMapa(); return; }
    modo.hidden=false;
    modo.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.modo===modoAtual)));
    area.classList.toggle('modo-camp',modoAtual==='camp');
    box.hidden=modoAtual!=='camp';
    if(modoAtual==='camp') pintar();
  }
  async function pintar(){
    erro='';
    try{ await abrirPacote(); if(pais!=='BR') await abrirMerc(); }
    catch(e){ erro=e.message==='chave'?L('Saia e entre de novo para ver as campanhas.','Salga y vuelva a entrar para ver las campañas.'):L('Não consegui carregar as praças. Confira a internet e tente de novo.','No pude cargar las plazas. Verifique internet e intente de nuevo.'); }
    destruirMapa();
    const conf=(PK?.pracas||[]).filter(p=>LINHAS.some(([l])=>p[l]?.estado==='conferida'));
    box.innerHTML=`
      <div class="ph"><h2>${L('Campanhas por praça','Campañas por plaza')}</h2><span class="note">${L('Pinos e material prontos para o Gerenciador de Anúncios da Meta','Pines y material listos para el Administrador de Anuncios de Meta')}</span></div>
      ${erro?`<p class="note camp-erro">${erro}</p>`:''}
      <div class="camp-filtro">
        <div class="seg" role="group" aria-label="${L('País','País')}">${PAISES.map(([k,n])=>`<button type="button" data-pais="${k}" aria-pressed="${k===pais}">${n}</button>`).join('')}</div>
        <div class="in camp-busca"><input id="campBusca" list="campLista" autocomplete="off" placeholder="${L('Digite a cidade','Escriba la ciudad')}" aria-label="${L('Cidade','Ciudad')}" value="${sel&&sel.pais===pais?esc(rotulo(sel)):''}"></div>
        <datalist id="campLista">${cidades(pais).map(c=>`<option value="${esc(rotulo(c))}"></option>`).join('')}</datalist>
        <button class="btn ghost" type="button" id="campSair">${L('Sair','Salir')}</button>
      </div>
      ${conf.length?`<div class="camp-atalhos"><span class="note">${L('Praças conferidas:','Plazas verificadas:')}</span>${conf.map(p=>`<button type="button" class="camp-chip" data-praca="${p.id}">${p.titulo}</button>`).join('')}</div>`:''}
      <div id="campRes">${sel?resultado():`<p class="note">${L('Escolha o país e digite a cidade. Cidades não mapeadas podem ser pedidas pelo WhatsApp.','Elija el país y escriba la ciudad. Las ciudades no mapeadas se pueden pedir por WhatsApp.')}</p>`}</div>`;
    ligar();
    if(aberto) montarMapa();
  }
  function resultado(){
    const p=pracaDa(sel), nome=rotulo(sel);
    const cards=LINHAS.map(([l,n])=>{
      const st=p?.[l]; let corpo;
      if(st?.estado==='conferida') corpo=`<span class="camp-st ok">${L('Conferida','Verificada')} · ${dia(st.desde)}</span><button class="btn" type="button" data-abrir="${l}">${L('Abrir material da campanha','Abrir material de campaña')}</button>`;
      else if(st?.estado==='em pesquisa') corpo=`<span class="camp-st pesq">${L('Em pesquisa desde','En investigación desde')} ${dia(st.desde)}</span><p class="note">${L('O pedido já foi aceito. Aguarde a pesquisa ficar pronta.','El pedido ya fue aceptado. Espere a que la investigación esté lista.')}</p>`;
      else { const cid=`${nome}${sel.pais!=='BR'?', '+PAISES.find(x=>x[0]===sel.pais)[1]:''}`, cmd=comando(cid,l);
        corpo=`<span class="camp-st nao">${L('Não mapeada','No mapeada')}</span><a class="btn" target="_blank" rel="noopener" href="${wa(`Pedido de mapeamento: ${cid}, linha ${n}. Solicitado por ${quem()}.\n\nComando para o Claude: ${cmd}`)}">${L('Solicitar mapeamento','Solicitar mapeo')}</a>${caixaCmd(cmd)}`; }
      return `<div class="camp-card${aberto&&aberto[1]===l&&p&&aberto[0]===p.id?' on':''}"><b>${n}</b>${corpo}</div>`;
    }).join('');
    return `<h3 class="camp-cid">${esc(nome)}${p?` <span class="note">· ${L('praça','plaza')} ${p.titulo}</span>`:''}</h3>
      <div class="camp-cards">${cards}</div>${p&&aberto&&aberto[0]===p.id?material(p,aberto[1]):''}`;
  }

  // ---------- material da praça conferida ----------
  const pinosDe=(p,linha)=>(p.dados?.pinos||[]).filter(x=>x.status==='ok'&&x.linha===linha);
  const okPrio=x=>x.acao==='excluir'||prio==='todas'||(prio==='A'?x.prioridade==='A':x.prioridade!=='C');
  function conjuntos(p,linha){
    const inc=pinosDe(p,linha).filter(x=>x.acao==='incluir'), exc=pinosDe(p,linha).filter(x=>x.acao==='excluir');
    const nomeL=LINHAS.find(x=>x[0]===linha)[1];
    if(inc.some(x=>x.idiomas.includes('es'))) return [
      {t:`${nomeL} · ${L('português','portugués')}`,idioma:L('Português','Portugués'),inc:inc.filter(x=>x.idiomas.includes('pt')),exc},
      {t:`${nomeL} · ${L('espanhol','español')}`,idioma:L('Espanhol','Español'),inc:inc.filter(x=>x.idiomas.includes('es')),exc}];
    return [{t:nomeL,idioma:L('Português','Portugués'),inc,exc}];
  }
  const porRaio=l=>{ const g={}; l.forEach(x=>(g[x.raio_km]=g[x.raio_km]||[]).push(x)); return Object.entries(g).sort((a,b)=>a[0]-b[0]); };
  const coords=l=>l.map(x=>`${(+x.lat).toFixed(6)}, ${(+x.lon).toFixed(6)}`).join('\n');
  function blocoCopiar(titulo,lista,tipo){
    if(!lista.length) return `<p class="note">${tipo==='exc'?L('Sem exclusões.','Sin exclusiones.'):L('Nenhum local nesta prioridade.','Ningún lugar en esta prioridad.')}</p>`;
    return porRaio(lista).map(([r,l])=>`<div class="camp-copia"><span>${titulo} · ${L('raio','radio')} ${String(r).replace('.',',')} km · ${l.length} ${l.length>1?L('locais','lugares'):L('local','lugar')}</span><button class="btn ghost" type="button" data-copiar="${esc(coords(l))}">${L('Copiar','Copiar')}</button></div>`).join('');
  }
  function material(p,linha){
    const d=p.dados, st=p[linha], velha=idadeDias(st.desde)>183, todos=pinosDe(p,linha);
    const conferir=(d.pinos||[]).filter(x=>x.status!=='ok'&&x.linha===linha);
    const titulos=linha==='prisma'?(d.perfil?.titulos||[]):[];
    const blocos=conjuntos(p,linha).map((c,i)=>`<div class="camp-bloco"><h4>${L('Conjunto','Conjunto')} ${i+1}: ${c.t}</h4>
      <p class="note">${L('Idioma do público:','Idioma del público:')} <b>${c.idioma}</b> · ${c.inc.filter(okPrio).length} ${L('locais','lugares')} · ${c.exc.length} ${L('exclusões','exclusiones')}</p>
      ${blocoCopiar(L('Locais','Lugares'),c.inc.filter(okPrio),'inc')}${blocoCopiar(L('Exclusões','Exclusiones'),c.exc,'exc')}</div>`).join('');
    return `<div class="camp-mat">
      <div class="camp-cab"><div><span class="badge">${LINHAS.find(x=>x[0]===linha)[1]}</span><h3>${p.titulo}</h3>
        <p class="note">${L('Conferida em','Verificada el')} ${dia(st.desde)} · ${L('pesquisa de','investigación del')} ${d.pesquisado_em||''}</p></div>
        ${velha?`<div><a class="btn ghost" target="_blank" rel="noopener" href="${wa(`Pedido de atualização: ${txt(p.titulo)}, linha ${LINHAS.find(x=>x[0]===linha)[1]}. Solicitado por ${quem()}.\n\nComando para o Claude: ${comando(txt(p.titulo),linha,' (atualização)')}`)}">${L('Pesquisa antiga: solicitar atualização','Investigación antigua: solicitar actualización')}</a>${caixaCmd(comando(txt(p.titulo),linha,' (atualização)'))}</div>`:''}</div>
      <div class="camp-mapa" id="campMapa" role="img" aria-label="${L('Mapa dos pinos','Mapa de los pines')}"></div>
      <div class="camp-leg">${linha==='prisma'?Object.entries(PIL).map(([k,n])=>`<span style="--c:${COR[k]}">${n}</span>`).join(''):''}<span style="--c:${GOYA}">Goya</span><span style="--c:${EXC}">${L('Exclusão','Exclusión')}</span></div>
      <details class="camp-lista"><summary>${L('Lista dos pinos','Lista de los pines')} (${todos.length})</summary><ul>${todos.map(x=>`<li><span class="sw" style="background:${corDe(x)}"></span><b>${x.nome}</b> · ${x.cidade} · ${String(x.raio_km).replace('.',',')} km${x.prioridade?' · '+x.prioridade:''}${x.acao==='excluir'?' · '+L('exclusão','exclusión'):''}</li>`).join('')}</ul></details>

      <h4 class="camp-h">${L('Montar no Gerenciador de Anúncios','Armar en el Administrador de Anuncios')}</h4>
      <div class="camp-prio"><span class="note">${L('Quais locais copiar:','Qué lugares copiar:')}</span><div class="seg" role="group">${[['A',L('Só prioridade A (comece por aqui)','Solo prioridad A (empiece aquí)')],['AB',L('A e B','A y B')],['todas',L('Todas','Todas')]].map(([k,n])=>`<button type="button" data-prio="${k}" aria-pressed="${prio===k}">${n}</button>`).join('')}</div></div>
      ${blocos}
      <ul class="camp-check">${[L('CRECI 9226J visível na peça','CRECI 9226J visible en la pieza'),L('Idioma do público igual ao do conjunto','Idioma del público igual al del conjunto'),L('Exclusões coladas em "excluir locais"','Exclusiones pegadas en "excluir lugares"'),L('Testei antes colando só 2 coordenadas','Probé antes pegando solo 2 coordenadas')].map(t=>`<li><label><input type="checkbox"> ${t}</label></li>`).join('')}</ul>
      <p class="note camp-aviso">${L('A Meta não documenta a colagem de várias coordenadas de uma vez: teste com 2 antes. Se não aceitar, cole cada coordenada na busca de local e use "Soltar pino". Confirme também que a categoria especial de habitação não se aplica a esta praça.','Meta no documenta pegar varias coordenadas a la vez: pruebe con 2 antes. Si no acepta, pegue cada coordenada en la búsqueda de lugar y use "Soltar pin". Confirme también que la categoría especial de vivienda no aplica a esta plaza.')}</p>

      <h4 class="camp-h">${L('Material da campanha','Material de campaña')}</h4>
      ${linha==='prisma'?`<div class="destaque-camp"><b>${L('Argumento central','Argumento central')}.</b> ${d.perfil?.argumento||''} <button class="btn ghost mini" type="button" data-copiar="${d.perfil?.argumento||''}">${L('Copiar','Copiar')}</button></div>`
        :`<div class="destaque-camp"><b>${L('Público','Público')}.</b> ${d.goya?.publico||''}<br><b>${L('Argumento','Argumento')}.</b> ${d.goya?.argumento||''} <button class="btn ghost mini" type="button" data-copiar="${d.goya?.argumento||''}">${L('Copiar','Copiar')}</button></div>`}
      ${titulos.length?`<div class="tblwrap"><table class="camp-tit"><thead><tr><th>${L('Português','Portugués')}</th><th>${L('Espanhol','Español')}</th></tr></thead><tbody>${titulos.map(t=>`<tr><td>${t.pt} <button class="btn ghost mini" type="button" data-copiar="${t.pt}">${L('Copiar','Copiar')}</button></td><td>${t.es} <button class="btn ghost mini" type="button" data-copiar="${t.es}">${L('Copiar','Copiar')}</button></td></tr>`).join('')}</tbody></table></div>`:''}
      <p class="note">${linha==='prisma'?L('Peça: modelo Prisma do Manual de Comunicação (pág. 8): feed 1080×1350 ou stories 1080×1920.','Pieza: modelo Prisma del Manual de Comunicación (pág. 8): feed 1080×1350 o stories 1080×1920.'):L('Peça: modelo Goya do Manual de Comunicação (pág. 9). Títulos Goya: banco da pág. 7.','Pieza: modelo Goya del Manual de Comunicación (pág. 9). Títulos Goya: banco de la pág. 7.')}</p>

      <div class="actions camp-down">
        <button class="btn" type="button" data-baixar="ficha">${L('Baixar ficha (PDF)','Descargar ficha (PDF)')}</button>
        <button class="btn" type="button" data-baixar="planilha">${L('Baixar planilha (Excel)','Descargar planilla (Excel)')}</button>
      </div>
      ${conferir.length?`<h4 class="camp-h">${L('A conferir (fora do mapa e da lista)','A verificar (fuera del mapa y de la lista)')}</h4><ul class="camp-conf">${conferir.map(x=>`<li><b>${x.nome}</b> · ${x.cidade}${x.obs?` · <span class="note">${x.obs}</span>`:''} <a class="btn ghost mini" target="_blank" rel="noopener" href="${wa(`Sei onde fica: ${txt(x.nome)} (${txt(x.cidade)}), praça ${txt(p.titulo)}. Endereço: `)}">${L('Sei onde fica','Sé dónde queda')}</a></li>`).join('')}</ul>`:''}
    </div>`;
  }

  // ---------- mapa (Leaflet sob demanda) ----------
  let leafP=null;
  function carregarLeaflet(){
    if(window.L&&window.L.map) return Promise.resolve(window.L);
    return leafP=leafP||new Promise((ok,falha)=>{
      const css=document.createElement('link'); css.rel='stylesheet'; css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='; css.crossOrigin=''; document.head.appendChild(css);
      const s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='; s.crossOrigin='';
      s.onload=()=>ok(window.L); s.onerror=()=>{ leafP=null; falha(new Error('leaflet')); }; document.head.appendChild(s);
    });
  }
  function destruirMapa(){ if(mapa){ mapa.remove(); mapa=null; } }
  async function montarMapa(){
    const el=document.getElementById('campMapa'); if(!el||!aberto) return;
    const p=PK.pracas.find(x=>x.id===aberto[0]), pinos=pinosDe(p,aberto[1]);
    let Lf; try{ Lf=await carregarLeaflet(); }catch{ el.innerHTML=`<p class="note">${L('O mapa não carregou (internet). Use a lista dos pinos abaixo; os botões de copiar funcionam.','El mapa no cargó (internet). Use la lista de pines abajo; los botones de copiar funcionan.')}</p>`; el.classList.add('sem'); return; }
    if(!document.body.contains(el)) return;
    destruirMapa();
    mapa=Lf.map(el,{scrollWheelZoom:false});
    mapa.fitBounds(Lf.latLngBounds(pinos.map(x=>[x.lat,x.lon])).pad(0.1));
    Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(mapa);
    pinos.forEach(x=>Lf.circle([x.lat,x.lon],{radius:x.raio_km*1000,color:corDe(x),weight:1.5,fillOpacity:.15,dashArray:x.acao==='excluir'?'6 4':null})
      .bindPopup(`<b>${x.nome}</b><br>${x.tipo} · ${x.cidade}<br>${x.endereco}<br>${L('Raio','Radio')} ${String(x.raio_km).replace('.',',')} km${x.prioridade?' · '+L('prioridade','prioridad')+' '+x.prioridade:''}${x.motivo?'<br>'+x.motivo:''}<br><a href="https://www.google.com/maps?q=${x.lat},${x.lon}" target="_blank" rel="noopener">${L('ver no Google Maps','ver en Google Maps')}</a>`)
      .addTo(mapa));
  }

  // ---------- ações ----------
  async function baixar(tipo){
    const p=PK.pracas.find(x=>x.id===aberto[0]), rel=p.arquivos?.[tipo]; if(!rel) return;
    const nome=rel.split('/').pop();
    const r=await fetch(rel,{cache:'no-store'}); const e=await r.json();
    const claro=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(e.iv),additionalData:utf8('praca-arquivo:'+nome)},CHAVE_TAB,b64(e.ct));
    const tipoMime=tipo==='ficha'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([claro],{type:tipoMime}));
    a.download=`${tipo==='ficha'?'Ficha':'Pinos'}-${p.id}.${tipo==='ficha'?'pdf':'xlsx'}`; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },2000);
  }
  async function copiar(b){
    const t=txt(b.dataset.copiar);
    try{ await navigator.clipboard.writeText(t); }catch{ const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    const v=b.textContent; b.textContent=L('Copiado ✓','Copiado ✓'); setTimeout(()=>{ b.textContent=v; },1500);
  }
  function ligar(){
    box.querySelectorAll('[data-pais]').forEach(b=>b.addEventListener('click',()=>{ pais=b.dataset.pais; sel=null; aberto=null; pintar(); }));
    const inp=document.getElementById('campBusca');
    inp.addEventListener('change',()=>{ const c=acharCidade(inp.value); sel=c; aberto=null; pintar(); });
    inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); inp.dispatchEvent(new Event('change')); } });
    document.getElementById('campSair').addEventListener('click',()=>document.getElementById('btnSair').click());
    box.querySelectorAll('[data-praca]').forEach(b=>b.addEventListener('click',()=>{
      const p=PK.pracas.find(x=>x.id===b.dataset.praca), c=p.cidades[0];
      pais=c.pais; sel={pais:c.pais,uf:c.uf,nome:txt(c.nome)};
      aberto=[p.id,LINHAS.find(([l])=>p[l]?.estado==='conferida')[0]]; pintar();
    }));
    box.querySelectorAll('[data-abrir]').forEach(b=>b.addEventListener('click',()=>{
      const p=pracaDa(sel); aberto=aberto&&aberto[0]===p.id&&aberto[1]===b.dataset.abrir?null:[p.id,b.dataset.abrir]; pintar();
      if(aberto) setTimeout(()=>document.querySelector('.camp-mat')?.scrollIntoView({behavior:'smooth',block:'start'}),50);
    }));
    box.querySelectorAll('[data-prio]').forEach(b=>b.addEventListener('click',()=>{ prio=b.dataset.prio; pintar(); }));
    box.querySelectorAll('[data-copiar]').forEach(b=>b.addEventListener('click',()=>copiar(b)));
    box.querySelectorAll('[data-baixar]').forEach(b=>b.addEventListener('click',()=>baixar(b.dataset.baixar).catch(()=>{ b.textContent=L('Falhou, tente de novo','Falló, intente de nuevo'); })));
  }
  modo.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ modoAtual=b.dataset.modo; render(); }));

  const orig=renderCorretor;
  renderCorretor=function(){ orig(); render(); };
  renders.corretor=renderCorretor;
})();
