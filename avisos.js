/* Avisos de ofertas de soja (Vilhena, Comodoro, Campo Novo do Parecis) na aba Investidor Agro.
   Os avisos vêm de dados/avisos_soja.json, gravado pelo scripts/monitor_soja.py.
   Com a página aberta, confere de novo a cada 10 minutos; o que chegou desde a última visita
   ganha destaque e um contador na aba (lembrado só neste navegador). */
(function(){
  const ARQ='dados/avisos_soja.json';
  let AV=null, vistoAte=null, primeiraCarga=true;
  try{ vistoAte=localStorage.getItem('avisosSojaVisto'); }catch(e){}

  const novos=()=>!AV?[]:AV.avisos.filter(a=>!vistoAte||a.t>vistoAte);
  const fmtT=t=>{t=String(t||''); return esc(`${t.slice(8,10)}/${t.slice(5,7)} ${t.slice(11,16)}`);};
  const R=v=>brl2(Number(v)||0); // valores sempre como número (o arquivo vem do robô, mas não confiamos às cegas)
  const horasDesde=t=>(Date.now()-new Date(t.replace(' ','T')+':00-03:00'))/36e5;

  function badge(){ // contador no menu de cima (botão Agro) e no menu de abas
    const n=novos().length;
    document.querySelectorAll('.nav4 [data-grupo="agro"], .tabs [data-tab="soja"]').forEach(b=>{
      let s=b.querySelector('.av-badge');
      if(!n||tab==='soja'){ if(s) s.remove(); return; }
      if(!s){ s=document.createElement('span'); s.className='av-badge'; b.appendChild(s); }
      s.textContent=n>99?'99+':String(n);
      s.setAttribute('aria-label',L(`${n} avisos novos de soja`,`${n} avisos nuevos de soja`));
    });
  }

  function toast(n){
    let t=document.getElementById('avToast');
    if(!t){ t=document.createElement('button'); t.id='avToast'; t.type='button'; t.className='av-toast';
      t.addEventListener('click',()=>{ t.hidden=true; show('soja'); document.getElementById('avBox')?.scrollIntoView({behavior:'smooth',block:'start'}); });
      document.body.appendChild(t); }
    t.textContent=L(`🔔 ${n} aviso${n>1?'s':''} novo${n>1?'s':''} de soja`,`🔔 ${n} aviso${n>1?'s':''} nuevo${n>1?'s':''} de soja`);
    t.hidden=false; clearTimeout(t._h); t._h=setTimeout(()=>{t.hidden=true;},12000);
  }

  function linha(a,novo){
    const compra=a.lado==='compra';
    const rot={nova:L('Nova','Nueva'),subiu:L('Subiu','Subió'),caiu:L('Caiu','Bajó')}[a.tipo]||esc(a.tipo);
    const preco=a.antes!=null?`${R(a.antes)} → <b>${R(a.preco)}</b> ${+a.preco>+a.antes?'▲':'▼'}`:`<b>${R(a.preco)}</b>`;
    const extra=[compra?esc(a.entrega):'',compra?(a.fob?'FOB':'CIF'):'',+a.sc?`${(+a.sc).toLocaleString('pt-BR')} sc`:''].filter(Boolean).join(' · ');
    return `<li class="av-it${novo?' av-novo':''}"><span class="av-lado ${compra?'pos':'neg'}">${compra?L('COMPRA','COMPRA'):L('VENDA','VENTA')}</span>`+
      `<span class="tag${a.tipo==='nova'?'':' on'}">${rot}</span> <span class="av-p">${preco}</span>`+
      `<span class="note"> · ${esc(a.cidade)}-${esc(a.uf)}${extra?' · '+extra:''} · ${fmtT(a.t)}</span></li>`;
  }

  function render(){
    const box=document.getElementById('avBox'); if(!box) return;
    if(!AV){ box.hidden=true; return; }
    box.hidden=false;
    const nv=new Set(novos()), lista=AV.avisos.slice().reverse();
    const parado=!AV.lido||horasDesde(AV.lido)>26;
    const r=AV.resumo, cards=(AV.cidades||[]).map(nome=>{
      const c=(r&&r.cidades&&r.cidades[nome])||{};
      const dif=(v,a)=>v!=null&&a!=null&&v!==a?` <span class="${v>a?'pos':'neg'}">${v>a?'+':''}${(+v-+a).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`:'';
      return `<div class="kpi"><div class="lb">${esc(nome)}</div>`+
        `<div class="n">${L('Melhor compra','Mejor compra')}: <b>${c.compra_max!=null?R(c.compra_max):'—'}</b>${dif(c.compra_max,c.compra_abertura)}</div>`+
        `<div class="n">${L('Menor venda','Menor venta')}: <b>${c.venda_min!=null?R(c.venda_min):'—'}</b>${dif(c.venda_min,c.venda_abertura)}</div></div>`;
    }).join('');
    const mostrar=box.dataset.todos?lista:lista.slice(0,15);
    box.innerHTML=`<div class="ph"><h2>🔔 ${L('Avisos de ofertas','Avisos de ofertas')}</h2>`+
      `<span class="note">${L('Verificado em','Verificado el')} ${AV.verificado?fmtT(AV.verificado):'—'}</span></div>`+
      `<p class="note" style="margin:0 0 10px">${L('Compra: avisa oferta nova ou que <b>subiu</b>. Venda: avisa oferta nova ou que <b>caiu</b>. Ofertas da cidade e das vizinhas, no Grão Direto (R$ por saca de 60 kg).','Compra: avisa oferta nueva o que <b>subió</b>. Venta: avisa oferta nueva o que <b>bajó</b>. Ofertas de la ciudad y vecinas, en Grão Direto (R$ por saca de 60 kg).')}</p>`+
      (parado?`<p class="note neg">${L(`Coleta parada desde ${AV.lido?fmtT(AV.lido):'—'}: o Grão Direto não respondeu. Os avisos voltam sozinhos quando ele responder.`,`Recolección detenida desde ${AV.lido?fmtT(AV.lido):'—'}: Grão Direto no respondió. Los avisos vuelven solos cuando responda.`)}</p>`:'')+
      (r?`<h3 class="av-sub">${L('Hoje','Hoy')} (${esc(fmtDia(String(r.dia||'')))})</h3><div class="kpis">${cards}</div>`:'')+
      `<h3 class="av-sub">${L('Últimos avisos','Últimos avisos')}${nv.size?` · <span class="pos">${nv.size} ${L('novos','nuevos')}</span>`:''}</h3>`+
      (lista.length?`<ul class="av-lista">${mostrar.map(a=>linha(a,nv.has(a))).join('')}</ul>`+
        (lista.length>15?`<button type="button" class="av-mais" id="avMais">${box.dataset.todos?L('Mostrar menos','Mostrar menos'):L(`Ver todos (${lista.length})`,`Ver todos (${lista.length})`)}</button>`:'')
        :`<p class="note">${L('Nenhuma mudança nos últimos 7 dias.','Ningún cambio en los últimos 7 días.')}</p>`);
    const m=document.getElementById('avMais');
    if(m) m.addEventListener('click',()=>{ if(box.dataset.todos) delete box.dataset.todos; else box.dataset.todos='1'; render(); });
  }

  function marcarVisto(){
    if(!AV||!AV.avisos.length) return;
    const ult=AV.avisos[AV.avisos.length-1].t;
    if(vistoAte&&vistoAte>=ult) return;
    // marca como visto depois de um tempo na aba, para o destaque "novo" ainda aparecer nesta visita
    setTimeout(()=>{ if(tab!=='soja') return; vistoAte=ult; try{ localStorage.setItem('avisosSojaVisto',ult); }catch(e){} badge(); },8000);
  }

  async function carregar(){
    try{
      const r=await fetch(`${ARQ}?t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok) return;
      const j=await r.json();
      if(!j||!Array.isArray(j.avisos)) return;
      const antes=AV?AV.avisos.length:0, ultAntes=AV&&AV.avisos.length?AV.avisos[AV.avisos.length-1].t:null;
      AV=j;
      const chegaram=ultAntes?j.avisos.filter(a=>a.t>ultAntes).length:0;
      if(!primeiraCarga&&chegaram) toast(chegaram);
      primeiraCarga=false;
      badge();
      if(tab==='soja'){ render(); marcarVisto(); }
    }catch(e){ /* sem arquivo ou fora do ar: o painel some */ }
  }

  // o v3.js guarda a cotação dentro de um bloco recolhido; os avisos ficam fora dele, à vista
  { const box=document.getElementById('avBox'), cot=document.getElementById('cotacao'); if(box&&cot) cot.before(box); }
  const orig=renders.soja;
  renders.soja=function(){ orig(); render(); badge(); marcarVisto(); };
  carregar();
  setInterval(()=>{ if(!document.hidden) carregar(); },10*60*1000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) carregar(); });
})();
