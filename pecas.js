/* Peças prontas (Área restrita): vídeos, carrossel e legendas de campanha por empreendimento.
   Fonte: costa-esmeralda-docs/publicar_pecas.py.
   - dados/pecas.enc.json: índice, miniaturas e legendas, cifrados com a chave das tabelas (CHAVE_TAB, só na memória).
   - dados/pecas/<arquivo>.bin: 12 bytes de IV + conteúdo cifrado (AES-GCM, AAD "peca:<arquivo>").
   Os arquivos só são baixados e abertos quando o corretor clica em "Ver" ou "Baixar". */
(function(){
  const box=document.getElementById('pecaBox'), modo=document.getElementById('corrModo'), area=document.getElementById('areaCorretor');
  if(!box||!modo||!area||typeof renderCorretor!=='function') return;

  let IDX=null, kitId=null, lg=null /* idioma do material */, leg='pt' /* legenda: pt|py|ar */, erro='';
  const urls={};                                     // bin -> objectURL já aberto (evita baixar duas vezes)
  const ativo=()=>modo.querySelector('[data-modo="pecas"]')?.getAttribute('aria-pressed')==='true';
  const seg=s=>s<60?`${s} s`:`${Math.floor(s/60)} min ${String(s%60).padStart(2,'0')} s`;
  const mb=v=>String(v).replace('.',',')+' MB';

  async function abrirIndice(){
    if(IDX) return IDX;
    if(!CHAVE_TAB) throw new Error('chave');
    const r=await fetch('dados/pecas.enc.json',{cache:'no-store'}); if(!r.ok) throw new Error('rede');
    const e=await r.json();
    const claro=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(e.iv),additionalData:utf8('pecas-v1')},CHAVE_TAB,b64(e.ct));
    return IDX=JSON.parse(new TextDecoder().decode(claro));
  }
  // baixa o .bin mostrando o progresso e devolve um objectURL com o arquivo já decifrado
  async function abrirArquivo(bin,mime,progresso){
    if(urls[bin]) return urls[bin];
    const r=await fetch(bin,{cache:'no-store'}); if(!r.ok) throw new Error('rede');
    const total=+r.headers.get('content-length')||0, partes=[]; let lido=0;
    if(r.body&&r.body.getReader){ const rd=r.body.getReader();
      for(;;){ const {done,value}=await rd.read(); if(done) break; partes.push(value); lido+=value.length; if(total&&progresso) progresso(Math.round(lido*100/total)); } }
    else partes.push(new Uint8Array(await r.arrayBuffer()));
    const tudo=new Uint8Array(partes.reduce((n,p)=>n+p.length,0)); let o=0; for(const p of partes){ tudo.set(p,o); o+=p.length; }
    const nome=bin.split('/').pop();
    const claro=await crypto.subtle.decrypt({name:'AES-GCM',iv:tudo.slice(0,12),additionalData:utf8('peca:'+nome)},CHAVE_TAB,tudo.slice(12));
    return urls[bin]=URL.createObjectURL(new Blob([claro],{type:mime}));
  }
  function salvar(url,nome){ const a=document.createElement('a'); a.href=url; a.download=nome; document.body.appendChild(a); a.click(); setTimeout(()=>a.remove(),1000); }
  function liberar(){ Object.values(urls).forEach(u=>URL.revokeObjectURL(u)); for(const k in urls) delete urls[k]; }

  function render(){
    if(!TAB){ box.hidden=true; area.classList.remove('modo-pecas'); IDX=null; kitId=null; liberar(); return; }
    const on=ativo(); area.classList.toggle('modo-pecas',on); box.hidden=!on;
    if(on) pintar();
  }
  async function pintar(){
    erro='';
    try{ await abrirIndice(); }
    catch(e){ erro=e.message==='chave'?L('Saia e entre de novo para ver as peças.','Salga y vuelva a entrar para ver las piezas.'):L('Não consegui carregar as peças. Confira a internet e tente de novo.','No pude cargar las piezas. Verifique internet e intente de nuevo.'); }
    const kits=IDX?.kits||[];
    if(!kitId||!kits.some(k=>k.id===kitId)) kitId=(kits.find(k=>k.id===cEmp)||kits[0])?.id||null;
    if(!lg) lg=L('pt','es');
    const k=kits.find(x=>x.id===kitId), idi=k?.idiomas||['pt','es'];
    box.innerHTML=`
      <div class="ph"><h2>${L('Peças prontas','Piezas listas')}</h2><span class="note">${L('Vídeos, carrossel e legendas de campanha, prontos para publicar','Videos, carrusel y textos de campaña, listos para publicar')}</span></div>
      ${erro?`<p class="note camp-erro">${erro}</p>`:''}
      ${kits.length?`<div class="camp-filtro">
        <div class="in peca-sel"><select id="pecaKit" aria-label="${L('Empreendimento','Emprendimiento')}">${kits.map(x=>`<option value="${esc(x.id)}"${x.id===kitId?' selected':''}>${esc(x.titulo)}</option>`).join('')}</select></div>
        ${idi.length>1?`<div class="seg" role="group" aria-label="${L('Idioma do material','Idioma del material')}">${[['pt','Português'],['es','Español']].map(([c,n])=>`<button type="button" data-lg="${c}" aria-pressed="${c===lg}">${n}</button>`).join('')}</div>`:`<span class="note">${L('Material em português','Material en portugués')}</span>`}
        <button class="btn ghost" type="button" id="pecaSair">${L('Sair','Salir')}</button></div>`:(erro?'':`<p class="note">${L('Ainda não há peças publicadas.','Aún no hay piezas publicadas.')}</p>`)}
      ${k?kitHtml(k):''}`;
    ligar();
  }
  function kitHtml(k){
    const i=lg==='es'?1:0, car=k.carrossel[lg]||k.carrossel.pt||[], LEG=[['pt','Português'],['py','Español · Paraguay'],['ar','Español · Argentina']], lt=k.legendas[leg]||{}, temLeg=Object.keys(k.legendas||{}).length>0;
    return `
      <p class="note destaque-camp">${L('Material exclusivo da Goya Investimentos Imobiliários (CRECI 9226J). Não repasse os arquivos a outras imobiliárias. Os vídeos vão sem música: escolha uma calma no próprio Instagram.','Material exclusivo de Goya Investimentos Imobiliários (CRECI 9226J). No comparta los archivos con otras inmobiliarias. Los videos van sin música: elija una tranquila en el propio Instagram.')}</p>
      <h3 class="camp-h">${L('Vídeos','Videos')}</h3>
      <div class="peca-videos">${k.videos.map(v=>{ const a=v.arq[lg]||v.arq.pt; return `
        <div class="peca-card" data-vid="${esc(v.id)}">
          <div class="peca-tela"><img src="${esc(v.mini)}" alt="" loading="lazy"></div>
          <b>${esc(v.titulo[i])}</b>
          <span class="note">${esc(v.desc[i])}</span>
          <span class="note">${seg(v.dur)} · ${mb(a.mb)} · 1080×1920</span>
          <div class="peca-acoes"><button class="btn ghost mini" type="button" data-ver="${esc(v.id)}">${L('Ver','Ver')}</button><button class="btn mini" type="button" data-baixar-v="${esc(v.id)}">${L('Baixar','Descargar')}</button></div>
        </div>`; }).join('')}</div>
      ${car.length?`<h3 class="camp-h">${L('Carrossel (5 imagens, 1080×1350)','Carrusel (5 imágenes, 1080×1350)')}</h3>
      <div class="peca-car">${car.map((c,n)=>`<button type="button" class="peca-img" data-img="${n}" title="${L('Baixar esta imagem','Descargar esta imagen')}"><img src="${esc(c.mini)}" alt="${n+1}" loading="lazy"><span>${n+1}</span></button>`).join('')}</div>
      <p><button class="btn mini" type="button" id="pecaCar5">${L('Baixar as 5 imagens','Descargar las 5 imágenes')}</button> <span class="note">${L('Publique as 5 juntas, na ordem 1 a 5.','Publique las 5 juntas, en el orden 1 a 5.')}</span></p>`:''}
      ${temLeg?`<h3 class="camp-h">${L('Legendas','Textos')}</h3>
      <div class="seg" role="group" aria-label="${L('Legenda','Texto')}">${LEG.map(([c,n])=>`<button type="button" data-leg="${c}" aria-pressed="${c===leg}">${n}</button>`).join('')}</div>
      <div class="camp-bloco"><div class="camp-copia"><b>${L('Legenda do post (filme e carrossel)','Texto del post (película y carrusel)')}</b><button class="btn ghost mini" type="button" data-copiar="${esc(lt.post||'')}">${L('Copiar','Copiar')}</button></div>
        <p class="peca-texto">${esc(lt.post||'')}</p></div>
      <div class="camp-bloco"><b>${L('Textos curtos para os Stories','Textos cortos para las Historias')}</b>
        ${(lt.stories||[]).map(s=>`<div class="camp-copia"><span>${esc(s)}</span><button class="btn ghost mini" type="button" data-copiar="${esc(s.replace(/^[^:]+:\s*/,'').replace(/^"|"$/g,''))}">${L('Copiar','Copiar')}</button></div>`).join('')}</div>`:''}`;
  }

  // ---------- ações ----------
  const kit=()=>IDX.kits.find(x=>x.id===kitId);
  async function comBotao(b,fn){
    const v=b.textContent; b.disabled=true;
    try{ await fn(p=>{ b.textContent=`${p}%`; }); b.textContent=v; }
    catch{ b.textContent=L('Falhou, tente de novo','Falló, intente de nuevo'); }
    finally{ b.disabled=false; }
  }
  async function copiar(b){
    const t=b.dataset.copiar;
    try{ await navigator.clipboard.writeText(t); }catch{ const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    const v=b.textContent; b.textContent=L('Copiado ✓','Copiado ✓'); setTimeout(()=>{ b.textContent=v; },1500);
  }
  function ligar(){
    box.querySelector('#pecaKit')?.addEventListener('change',e=>{ kitId=e.target.value; pintar(); });
    box.querySelectorAll('[data-lg]').forEach(b=>b.addEventListener('click',()=>{ lg=b.dataset.lg; leg=lg==='es'?(leg==='pt'?'py':leg):'pt'; pintar(); }));
    box.querySelectorAll('[data-leg]').forEach(b=>b.addEventListener('click',()=>{ leg=b.dataset.leg; pintar(); }));
    box.querySelector('#pecaSair')?.addEventListener('click',()=>document.getElementById('btnSair').click());
    box.querySelectorAll('[data-copiar]').forEach(b=>b.addEventListener('click',()=>copiar(b)));
    box.querySelectorAll('[data-ver]').forEach(b=>b.addEventListener('click',()=>comBotao(b,async p=>{
      const v=kit().videos.find(x=>x.id===b.dataset.ver), a=v.arq[lg]||v.arq.pt;
      const url=await abrirArquivo(a.bin,'video/mp4',p);
      const tela=b.closest('.peca-card').querySelector('.peca-tela');
      tela.innerHTML=`<video src="${url}" controls playsinline autoplay muted></video>`;
    })));
    box.querySelectorAll('[data-baixar-v]').forEach(b=>b.addEventListener('click',()=>comBotao(b,async p=>{
      const v=kit().videos.find(x=>x.id===b.dataset.baixarV), a=v.arq[lg]||v.arq.pt;
      salvar(await abrirArquivo(a.bin,'video/mp4',p),a.nome);
    })));
    const car=()=>kit().carrossel[lg]||kit().carrossel.pt;
    box.querySelectorAll('[data-img]').forEach(b=>b.addEventListener('click',async()=>{
      const c=car()[+b.dataset.img]; try{ salvar(await abrirArquivo(c.bin,'image/jpeg'),c.nome); }catch{ b.classList.add('erro'); }
    }));
    box.querySelector('#pecaCar5')?.addEventListener('click',e=>comBotao(e.currentTarget,async p=>{
      const l=car(); for(let n=0;n<l.length;n++){ salvar(await abrirArquivo(l[n].bin,'image/jpeg'),l[n].nome); p(Math.round((n+1)*100/l.length)); await new Promise(r=>setTimeout(r,400)); }
    }));
  }
  modo.querySelectorAll('button').forEach(b=>b.addEventListener('click',render));   // depois do campanhas.js, que marca o botão ativo

  const orig=renderCorretor;
  renderCorretor=function(){ orig(); render(); };
  renders.corretor=renderCorretor;
})();
