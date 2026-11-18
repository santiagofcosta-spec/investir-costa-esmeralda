/* =====================================================================
   v3 · Etapa 1 (versão de teste)
   - menu com 4 seções (A Região · Simular · Patrimônio · Agro) + subabas
   - porta de entrada por objetivo do cliente
   - bloco "Imóvel ou CDI?" com números do próprio simulador (sem inventar nada)
   - detalhes secundários recolhidos em "Ver ..."
   Roda depois do app.js e reaproveita as funções dele.
   ===================================================================== */
(()=>{
// avisos de material pendente (fotos, história, vídeo) só no modo corretor
if(MODO_CORRETOR) document.body.classList.add('ver-pendentes');
// seção "Viver aqui" (Etapa 4): entra no mesmo sistema de abas do app.js
renders.viver=()=>{ const wa=$('viverWA'); if(wa) wa.href=waURL(L(`Olá ${CONTATO.primeiroNome}! Vi no site a seção Viver em Porto Belo e quero agendar uma visita à região.`,`¡Hola ${CONTATO.primeiroNome}! Vi en el sitio la sección Vivir en Porto Belo y quiero agendar una visita a la región.`)); };
{ const n=$('acompNome'); if(n) n.textContent=CONTATO.nome; const i=$('acompIniciais'); if(i) i.textContent=CONTATO.nome.split(/\s+/).filter(Boolean).map((p,k,a)=>k===0||k===a.length-1?p[0]:'').join('');
  const a=$('acompWA'); if(a) a.href=waURL(L(`Olá ${CONTATO.primeiroNome}! Vi o site Investir na Costa Esmeralda e quero conversar com você.`,`¡Hola ${CONTATO.primeiroNome}! Vi el sitio Invertir en la Costa Esmeralda y quiero conversar con usted.`)); }
// os momentos do dia aparecem conforme o cliente rola a tela
{ const io=('IntersectionObserver' in window)?new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visto'); io.unobserve(e.target); } }),{threshold:.25}):null;
  document.querySelectorAll('.momento').forEach(m=>io?io.observe(m):m.classList.add('visto')); }
const GRUPOS={
  viver:{abas:['viver'],nomes:{}},
  regiao:{abas:['why','idx'],nomes:{why:()=>L('Por que investir','Por qué invertir'),idx:()=>L('Índices do Brasil','Índices de Brasil')}},
  simular:{abas:['sim','avista','planta'],nomes:{sim:()=>L('Financiado ou com renda','Financiado o con renta'),avista:()=>L('À vista','Al contado'),planta:()=>L('Na planta','En pozo')}},
  patrimonio:{abas:['holding','corr'],nomes:{holding:()=>L('PF x Holding','Persona física x Holding'),corr:()=>L('Correção de valor','Valor actualizado')}},
  agro:{abas:['soja'],nomes:{}},
  corretor:{abas:['corretor'],nomes:{}},
};
const grupoDe=t=>Object.keys(GRUPOS).find(g=>GRUPOS[g].abas.includes(t))||'regiao';
const ultimaAba={}; // lembra a subaba escolhida em cada seção

/* ---------- menu ---------- */
function atualizarNav(){
  const g=grupoDe(tab); ultimaAba[g]=tab;
  document.querySelectorAll('#nav4 [data-grupo]').forEach(b=>b.setAttribute('aria-current',b.dataset.grupo===g));
  const G=GRUPOS[g], sub=$('subtabs');
  sub.hidden=G.abas.length<2;
  sub.innerHTML=G.abas.length<2?'':G.abas.map(a=>`<button type="button" data-aba="${a}" aria-pressed="${a===tab}">${G.nomes[a]()}</button>`).join('');
}
const showOrig=window.show;
window.show=function(t){ showOrig(t); atualizarNav(); if(tab==='why') renderProva(); };
$('nav4').addEventListener('click',e=>{ const b=e.target.closest('[data-grupo]'); if(!b) return; const g=b.dataset.grupo; show(ultimaAba[g]||GRUPOS[g].abas[0]); });
$('subtabs').addEventListener('click',e=>{ const b=e.target.closest('[data-aba]'); if(b) show(b.dataset.aba); });
if(MODO_CORRETOR||ORIGEM) document.querySelector('#nav4 [data-grupo="corretor"]').hidden=false;

/* ---------- porta de entrada ---------- */
const irNav=()=>$('nav4Wrap').scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
$('porta').addEventListener('click',e=>{
  const b=e.target.closest('[data-porta]'); if(!b) return;
  document.querySelectorAll('[data-porta]').forEach(x=>x.setAttribute('aria-pressed',x===b));
  const k=b.dataset.porta;
  if(k==='renda'){ setModo('temporada'); show('sim'); }
  else show({planta:'planta',avista:'avista',agro:'soja',familia:'holding'}[k]);
  if(['sim','avista','planta','holding'].includes(tab)&&!resAberto) abrirResultados('auto');
  irNav();
});

/* ---------- recolher detalhes ---------- */
function recolher(els,pt,es,{grande=false}={}){
  els=els.filter(Boolean); if(!els.length) return;
  const d=document.createElement('details'); d.className='mais'+(grande?' grande':'');
  d.innerHTML=`<summary>${L(pt,es)}</summary>`;
  const box=document.createElement('div'); box.className='stack'; d.appendChild(box);
  els[0].before(d); els.forEach(el=>box.appendChild(el));
  return d;
}
const P=id=>{ const el=$(id); return el&&(el.closest('.two')||el.closest('.panel')); };

// A Região: ficam à vista a prova, Porto Belo em transformação, o gráfico principal, "Já subiu demais?" e população
{ const pb=$('porto-belo'), cards=pb.querySelector(':scope > .cards'), dados=$('pbDados'); if(cards&&dados) cards.after(dados);
  const box=$('whyMaisBox');
  [$('reasons'),P('chAnual'),P('tblRank'),P('chCub'),$('objecao-espera'),$('microrregioes'),[...$('p-why').children].find(el=>el.querySelector?.('h2')?.textContent.trim()==='E Porto Belo?'||el.querySelector?.('h2')?.textContent.trim()==='¿Y Porto Belo?')]
    .filter(Boolean).forEach(el=>box.appendChild(el));
  // ordem visível: prova → gráfico principal → Porto Belo → já subiu demais → população → ver todos
  const acum=P('chAcum'); $('prova').after(acum);
}
// Simular
recolher([P('tblComp'),P('tblGanho'),P('tblSens'),P('tblFluxo')],'Ver a conta completa: comparativo, imposto, sensibilidade e resumo para o cliente','Ver la cuenta completa: comparativo, impuesto, sensibilidad y resumen para el cliente');
recolher([P('aDesc'),P('chUsd'),$('intlBox')],'Ver mais: poder do desconto, à vista x financiado e m² em dólar','Ver más: poder del descuento, contado x financiado y m² en dólares');
{ const nota=$('pTbl')?.closest('.two')?.nextElementSibling;
  recolher([P('pTbl'),nota&&nota.matches('p.note')?nota:null],'Ver resultado detalhado e cronograma de pagamento','Ver resultado detallado y cronograma de pagos'); }
// Nos simuladores a resposta vem primeiro; formulários e a tabela de premissas ficam em "Ajustar os números"
for(const aba of ['sim','avista','planta','holding']){
  const sec=$('p-'+aba), cen=sec?.querySelector(':scope > .cenarios'), cmp=$('cmp-'+aba); if(!cen) continue;
  const d=document.createElement('details'); d.className='mais ajustes'; d.id='ajustes-'+aba;
  d.innerHTML=`<summary>${L('✎ Ajustar os números: valor do imóvel, entrada, renda e premissas','✎ Ajustar los números: valor del inmueble, anticipo, renta y supuestos')}</summary>`;
  const box=document.createElement('div'); box.className='stack'; d.appendChild(box);
  sec.prepend(d); box.appendChild(cen); if(cmp) box.appendChild(cmp);
}
// Patrimônio
recolher([P('hTbl'),P('hRegras')],'Ver a conta detalhada e as regras usadas','Ver la cuenta detallada y las reglas usadas');
// Agro: simulador na frente (apresentação → filtros + sacas → cards → projeção); tabelas de cotação atrás do botão "Cotação"
{ const sec=$('p-soja'), ag=$('objecao-agro'), filtro=sec.querySelector(':scope > .filtro'), proj=$('projAgro');
  // "Sacas a vender" sai do formulário de custos e vai para o simulador
  const fSac=$('sProducao')?.closest('.f');
  const sim=document.createElement('section'); sim.className='panel agro-sim'; sim.id='agroSim';
  sim.innerHTML=`<div class="ph"><h2>${L('Simule a sua safra','Simule su cosecha')}</h2><span class="note">${L('Escolha onde vende a soja e quantas sacas quer trocar','Elija dónde vende la soja y cuántas sacas quiere cambiar')}</span></div>`;
  const cards=document.createElement('section'); cards.className='agro-cards'; cards.id='agroCards'; cards.setAttribute('aria-live','polite');
  // o que vai para dentro de "Cotação" (na ordem atual da página)
  const cot=[...sec.children].filter(el=>el!==ag&&el!==filtro&&el!==proj);
  ag.after(sim); if(filtro){ filtro.classList.remove('panel'); sim.appendChild(filtro); }
  if(fSac){ fSac.classList.add('agro-sacas');
    // sacas ⇄ m²: digitar o tamanho do imóvel calcula as sacas necessárias (e vice-versa)
    const q=document.createElement('div'); q.className='agro-qtd'; filtro.appendChild(q); q.appendChild(fSac);
    // líquido da venda logo abaixo das sacas (a tabela completa fica em "Cotação da soja"; preenchido pelo renderCustos)
    q.insertAdjacentHTML('afterend','<p class="agro-liq" id="sLiqResumo" aria-live="polite"></p>');
    q.insertAdjacentHTML('beforeend',`<span class="agro-eq" aria-hidden="true">⇄</span>
      <div class="f agro-sacas agro-m2"><label for="sM2">${L('Ou o tamanho do imóvel','O el tamaño del inmueble')}</label><div class="in"><input id="sM2" type="number" step="1" min="1" inputmode="numeric" placeholder="90"><span>m²</span></div></div>`); }
  sim.after(cards); cards.after(proj);
  const d=document.createElement('details'); d.className='mais cotacao'; d.id='cotacao';
  d.innerHTML=`<summary>${L('📊 Cotação da soja: preços, ofertas, custos por saca e cidades','📊 Cotización de la soja: precios, ofertas, costos por saca y ciudades')}</summary>`;
  const box=document.createElement('div'); box.className='stack'; d.appendChild(box); cot.forEach(el=>box.appendChild(el));
  proj.after(d);
  // o campo saiu do formulário: repassa a digitação para o cálculo de custos
  $('sProducao').addEventListener('input',e=>{ if(e.isTrusted) AGRO.porM2=false; $('formCustos').dispatchEvent(new Event('input',{bubbles:true})); });
  $('sM2').addEventListener('input',()=>{ const v=+$('sM2').value; if(!(v>0)) return; AGRO.porM2=true; AGRO.m2Alvo=v; sacasParaM2(); });
}
// estado do conversor sacas ⇄ m² (preço líquido da saca vem do cálculo de custos, a cada renderProjAgro)
const AGRO={liq:null,porM2:false,m2Alvo:null};
const precoM2Agro=()=>agroCid==='portobelo'?REFS.m2PortoBelo.v:it[LAST];
function sacasParaM2(){ // fixa o m² escolhido e acha as sacas (arredonda para cima: dá para pagar o imóvel inteiro)
  if(!AGRO.liq||!AGRO.m2Alvo) return false;
  const n=Math.ceil(AGRO.m2Alvo*precoM2Agro()/AGRO.liq);
  if(num('sProducao')===n) return false;
  setNum('sProducao',n); $('sProducao').dispatchEvent(new Event('input',{bubbles:true})); return true;
}

// link de argumento (#objecao-...) ou âncora dentro de algo recolhido: abre antes de rolar
function abrirAncora(){ const id=decodeURIComponent(location.hash.slice(1)); const el=id&&$(id); if(!el) return; let d=el.closest('details'); while(d){ d.open=true; d=d.parentElement.closest('details'); } }
addEventListener('hashchange',abrirAncora); abrirAncora(); if(location.hash) rotaHash();
// PDF/impressão: abre tudo para sair completo
addEventListener('beforeprint',()=>document.querySelectorAll('details.mais').forEach(d=>{ d.dataset.v3Fechado=d.open?'':'1'; d.open=true; }));
addEventListener('afterprint',()=>document.querySelectorAll('details.mais').forEach(d=>{ if(d.dataset.v3Fechado) d.open=false; }));

/* ---------- prova: Imóvel ou CDI? ---------- */
const mi=v=>v>=1e6?L(`R$ ${(v/1e6).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} mi`,`R$ ${(v/1e6).toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2})} M`):brl(v);
let provaAnimada=false;
function renderProva(){
  const el=$('prova'); if(!el) return;
  const base=autoP(), F=FILTROS[autoFiltro];
  const cen=modo=>{ const p={...base,modo,entrada:base.valor}; const r=simular(p); return {p,r,f:r.fim}; };
  const T=cen('temporada'), A=cen('anual'), N=cen('nenhum');
  const be=empate(T.p), anos=T.p.anos, inv=T.f.investido, dif=T.f.imovel-T.f.cdb;
  const selic=S.selic.filter(x=>x!=null), selicMed=selic.reduce((a,b)=>a+b,0)/selic.length;
  const cubAA=Math.pow(cubFim/cubIni,1/anosPer)-1, yb=rendaAno1(T.p)/T.p.valor;
  const FT=RM().fonteTemporada, prov=FT?L(` (${FT.pt})`,` (${FT.es})`):RM().provisorio?L(' (referência de mercado ainda provisória)',' (referencia de mercado aún provisoria)'):'';
  const bars=[[L('Imóvel com renda de temporada','Inmueble con renta de temporada'),T.f.imovel,'linear-gradient(90deg,#A67C2E,#F5E6B3)',true],
    [L(`CDB ${Math.round(T.p.pctCdi*100)}% do CDI, já sem IR`,`CDB ${Math.round(T.p.pctCdi*100)}% del CDI, neto de impuestos`),T.f.cdb,'var(--c-cdi)',false],
    [L('Dinheiro colocado','Dinero invertido'),inv,'var(--c-brasil)',false]];
  const max=Math.max(...bars.map(b=>b[1]));
  el.innerHTML=`
    <div><span class="badge" data-es="La cuenta con datos oficiales">${L('A conta com dados oficiais','La cuenta con datos oficiales')}</span>
      <h2 id="provaTit">${L('Imóvel ou CDI? Faça a conta com o mesmo dinheiro.','¿Inmueble o CDI? Haga la cuenta con el mismo dinero.')}</h2></div>
    <p class="lead2">${L(`${brl(T.p.valor)} à vista, ${anos} anos. Valores no fim já descontam IR, corretagem na venda, administração e despesas do proprietário.`,`${brl(T.p.valor)} al contado, ${anos} años. Los valores finales ya descuentan impuestos, comisión de venta, administración y gastos del propietario.`)}</p>
    <div class="prova-bars">${bars.map(([n,v,c,w])=>`<div class="prova-bar${w?' win':''}"><span>${n}</span><div class="track"><div class="fill" data-w="${(v/max*100).toFixed(1)}" style="background:${c}"></div></div><b>${mi(v)}</b></div>`).join('')}</div>
    ${dif>0?`<div class="prova-ganho">${L(`O imóvel termina com <b>${mi(dif)} a mais</b> que o CDB, com o mesmo dinheiro.`,`El inmueble termina con <b>${mi(dif)} más</b> que el CDB, con el mismo dinero.`)}</div>`:''}
    <div class="prova-cards">
      <div class="prova-card"><span class="big">${isFinite(be)?pct(be,1):'—'}</span><h3>${L('é a valorização que basta para empatar com o CDI','es la valorización que alcanza para empatar con el CDI')}</h3>
        <p>${L(`Desde dez/2020 Porto Belo valorizou ${pct(taxaPB(),1)} ao ano (DWV) e Itapema ${pct(cagrItapema(),1)} (FipeZap). Só o custo de construir (CUB/SC) subiu ${pct(cubAA,1)} ao ano.`,`Desde dic/2020 Porto Belo se valorizó ${pct(taxaPB(),1)} anual (DWV) e Itapema ${pct(cagrItapema(),1)} (FipeZap). Solo el costo de construir (CUB/SC) subió ${pct(cubAA,1)} anual.`)}</p></div>
      <div class="prova-card"><span class="big">${L('2 ganhos','2 ganancias')}</span><h3>${L('renda todo ano + valorização','renta todos los años + valorización')}</h3>
        <p>${L(`A temporada rende cerca de ${pct(yb,1)} do valor do imóvel por ano, antes dos custos${prov}. No CDB o ganho é só o juro, e o IR leva 15% dele.`,`La temporada rinde cerca de ${pct(yb,1)} del valor del inmueble por año, antes de costos${prov}. En el CDB la ganancia es solo el interés, y el impuesto se lleva 15%.`)}</p></div>
      <div class="prova-card"><span class="big">${L('Escritura','Escritura')}</span><h3>${L('um bem real, registrado no seu nome','un bien real, registrado a su nombre')}</h3>
        <p>${L('Matrícula no cartório de imóveis, sem depender de banco ou corretora. Cada empreendimento passa pela nossa checagem jurídica antes de ser oferecido.','Matrícula en el registro de la propiedad, sin depender de banco o corredora. Cada emprendimiento pasa por nuestra verificación jurídica antes de ofrecerse.')}</p>
        <a href="#seguranca">${L('Ver o que checamos →','Ver lo que verificamos →')}</a></div>
    </div>
    <p class="prova-honesto">${L(`<b>Quando o CDI ganha:</b> comprar só para esperar valorizar, sem alugar. Nesse caso o CDB chega a ${mi(N.f.cdb)} e o imóvel a ${mi(N.f.imovel)}, com a Selic de hoje (${p1(D.bcb.selicMeta)}, acima da média de ${p1(selicMed)} desde 2016). Com aluguel anual em vez de temporada, o imóvel chega a ${mi(A.f.imovel)} contra ${mi(A.f.cdb)} do CDB. O simulador mostra os dois lados para você decidir com segurança.`,`<b>Cuándo gana el CDI:</b> comprar solo para esperar la valorización, sin alquilar. En ese caso el CDB llega a ${mi(N.f.cdb)} y el inmueble a ${mi(N.f.imovel)}, con la Selic de hoy (${p1(D.bcb.selicMeta)}, por encima del promedio de ${p1(selicMed)} desde 2016). Con alquiler anual en lugar de temporada, el inmueble llega a ${mi(A.f.imovel)} contra ${mi(A.f.cdb)} del CDB. El simulador muestra los dos lados para que usted decida con seguridad.`)}</p>
    <div class="prova-acoes"><button class="btn" type="button" data-v3ir="sim">${L('Simular com o valor do cliente →','Simular con el valor del cliente →')}</button><button class="btn ghost" type="button" data-v3ir="avista">${L('Ver renda por mês à vista','Ver renta mensual al contado')}</button></div>
    <p class="nota">${L(`Valorização usada: ${F.nome()} (${pct(F.taxa(),1)} ao ano, ${F.fonte()}). Rentabilidade passada não garante rentabilidade futura. Simulação ilustrativa.`,`Valorización usada: ${F.nome()} (${pct(F.taxa(),1)} anual, ${F.fonte()}). Rentabilidad pasada no garantiza rentabilidad futura. Simulación ilustrativa.`)}</p>`;
  const fills=el.querySelectorAll('.fill');
  if(provaAnimada||reduce) fills.forEach(f=>f.style.width=f.dataset.w+'%');
  else { provaAnimada=true; requestAnimationFrame(()=>requestAnimationFrame(()=>fills.forEach(f=>f.style.width=f.dataset.w+'%'))); }
}
$('prova').addEventListener('click',e=>{ const b=e.target.closest('[data-v3ir]'); if(!b) return; const t=b.dataset.v3ir; if(t==='sim') setModo('temporada'); show(t); if(!resAberto) abrirResultados('auto'); irNav(); });

/* ---------- cards de motivação: aparecem em cada simulação, com os números da própria conta ----------
   Regra: cada card só entra quando a frase é verdadeira no cenário que está na tela. */
const card=(ic,big,tit,txt)=>({ic,big,tit,txt});
const xVezes=x=>x.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'×';
const realIpca=()=>{ const ip=idxBCB('ipca')[LAST]/100; return it[LAST]/it[0]/ip-1; };
const MOTIVA={
  sim(){ const p=premissas(), r=simular(p), f=r.fim, a=r.ano1, out=[];
    const liq1=a.aluguel-a.adm-a.ir-a.desp;
    if(p.modo!=='nenhum'&&r.P0>0&&a.parcela>0){ const c=liq1/a.parcela;
      if(c>=1) out.push(card('🔑','100%',L('da parcela paga pelo aluguel','de la cuota pagada por el alquiler'),L(`E ainda sobram ${brl((liq1-a.parcela)/12)} por mês. O inquilino paga o imóvel para você.`,`Y además sobran ${brl((liq1-a.parcela)/12)} por mes. El inquilino paga el inmueble por usted.`)));
      else if(c>=0.25) out.push(card('🔑',pct(c,0),L('da parcela paga pelo aluguel','de la cuota pagada por el alquiler'),L(`Você completa ${brl((a.parcela-liq1)/12)} por mês no 1º ano. O resto quem paga é o inquilino, e tudo vira patrimônio seu.`,`Usted completa ${brl((a.parcela-liq1)/12)} por mes el 1er año. El resto lo paga el inquilino, y todo se vuelve patrimonio suyo.`)));
    } else if(p.modo!=='nenhum'&&liq1>0) out.push(card('💵',brl(liq1/12),L('de renda líquida por mês','de renta neta por mes'),L('Já no 1º ano, depois de administração, IR e despesas. E o imóvel continua valorizando.','Ya el 1er año, después de administración, impuesto y gastos. Y el inmueble sigue valorizándose.')));
    if(f.investido>0&&f.imovel>f.investido) out.push(card('🏠',xVezes(f.imovel/f.investido),L('o dinheiro que saiu do seu bolso','el dinero que salió de su bolsillo'),L(`Você coloca ${brl(f.investido)} ao longo de ${p.anos} anos e termina com ${brl(f.imovel)} líquidos, já sem dívida, IR e corretagem.`,`Usted pone ${brl(f.investido)} a lo largo de ${p.anos} años y termina con ${brl(f.imovel)} netos, ya sin deuda, impuestos ni comisión.`)));
    if(p.valoriz>0) out.push(card('⏳',brl(p.valor*p.valoriz),L('é quanto custa esperar 1 ano','es lo que cuesta esperar 1 año'),L(`Com ${pct(p.valoriz,1)} de valorização ao ano, o mesmo imóvel fica esse valor mais caro daqui a 12 meses.`,`Con ${pct(p.valoriz,1)} de valorización anual, el mismo inmueble queda ese valor más caro dentro de 12 meses.`)));
    const re=realIpca(); if(re>0) out.push(card('🛡️','+'+pct(re,0),L('acima da inflação desde 2020','por encima de la inflación desde 2020'),L(`Foi o ganho real do m² em Itapema, já descontado o IPCA (FipeZap e IBGE). Dinheiro parado perde para a inflação; imóvel acompanha o custo de construir.`,`Fue la ganancia real del m² en Itapema, descontado el IPCA (FipeZap e IBGE). El dinero quieto pierde contra la inflación; el inmueble acompaña el costo de construir.`)));
    return out; },
  avista(){ const base=premissas(), d=(viewAuto?RM().descontoAvista:num('desconto'))/100, pv={...base,entrada:Infinity,desc:d}, r=simular(pv), f=r.fim, out=[];
    const renda=r.fluxos.slice(1,13).reduce((a,b)=>a+b,0)/12;
    if(renda>0) out.push(card('💵',brl(renda),L('por mês na sua conta','por mes en su cuenta'),L('Renda líquida já no 1º ano, depois de administração, IR e despesas. E o imóvel continua valorizando.','Renta neta ya el 1er año, después de administración, impuesto y gastos. Y el inmueble sigue valorizándose.')));
    if(d>0) out.push(card('🏷️',brl(base.valor-r.preco),L('de ganho no dia da compra','de ganancia el día de la compra'),L(`Você paga ${brl(r.preco)} por um imóvel que vale ${brl(base.valor)} no mercado.`,`Usted paga ${brl(r.preco)} por un inmueble que vale ${brl(base.valor)} en el mercado.`)));
    if(base.juros>0) out.push(card('🏦','0%',L('de juros de banco','de interés bancario'),L(`Comprando à vista você não paga os ${pct(base.juros,1)} ao ano do financiamento. Todo o retorno fica com você.`,`Comprando al contado no paga el ${pct(base.juros,1)} anual de la financiación. Todo el retorno queda con usted.`)));
    if(f.investido>0&&f.imovel>f.investido) out.push(card('📈',xVezes(f.imovel/f.investido),L(`o seu dinheiro em ${base.anos} anos`,`su dinero en ${base.anos} años`),L(`${brl(f.investido)} viram ${brl(f.imovel)} líquidos, somando aluguel e valorização.`,`${brl(f.investido)} se convierten en ${brl(f.imovel)} netos, sumando alquiler y valorización.`)));
    return out; },
  planta(){ const r=simPlanta(viewAuto?autoPlantaG():num), out=[];
    out.push(card('💳',brl(r.tipo.ato),L('para começar','para empezar'),L(`Entrada de ${pct(r.e,0)} e parcelas a partir de ${brl(r.tipo.mensalIni)} por mês durante a obra.`,`Anticipo de ${pct(r.e,0)} y cuotas desde ${brl(r.tipo.mensalIni)} por mes durante la obra.`)));
    if(r.vmN>r.totalPago) out.push(card('🏗️',brl(r.vmN),L('vale o imóvel na entrega','vale el inmueble a la entrega'),L(`Até lá você terá pago ${brl(r.totalPago)}. O imóvel valoriza enquanto você paga aos poucos.`,`Hasta entonces habrá pagado ${brl(r.totalPago)}. El inmueble se valoriza mientras usted paga de a poco.`)));
    if(r.lucro>0) out.push(card('📈',pct(r.roi,0),L('de retorno sobre o que pagou','de retorno sobre lo pagado'),L(`Vendendo na entrega das chaves: ${brl(r.lucro)} de lucro, já sem saldo, corretagem e IR.`,`Vendiendo a la entrega: ${brl(r.lucro)} de ganancia, ya sin saldo, comisión ni impuesto.`)));
    if(CUB.v12m>0) out.push(card('🧱','+'+p1(CUB.v12m),L('subiu o custo de construir em 12 meses','subió el costo de construir en 12 meses'),L('Quem entra no lançamento compra pela tabela de hoje. Quem deixa para depois compra pela tabela nova, mais cara.','Quien entra en el lanzamiento compra por la lista de hoy. Quien lo deja para después compra por la lista nueva, más cara.')));
    return out; },
  holding(){ const r=simHolding(viewAuto?autoHoldingG():num), eco=r.totPf-r.totHd, out=[];
    if(eco>0) out.push(card('💼',brl(eco),L(`a menos em impostos e custos em ${r.anos} anos`,`menos en impuestos y costos en ${r.anos} años`),L(`Pessoa física: ${brl(r.totPf)}. Holding: ${brl(r.totHd)}.`,`Persona física: ${brl(r.totPf)}. Holding: ${brl(r.totHd)}.`)));
    if(r.pf.sucessao>r.hd.sucessao) out.push(card('👨‍👩‍👧',brl(r.pf.sucessao-r.hd.sucessao),L('a menos na herança','menos en la herencia'),L(`Inventário e ITCMD na pessoa física: ${brl(r.pf.sucessao)}. Com a holding, a doação das cotas em vida custa ${brl(r.hd.sucessao)}.`,`Sucesorio e ITCMD como persona física: ${brl(r.pf.sucessao)}. Con la holding, la donación de cuotas en vida cuesta ${brl(r.hd.sucessao)}.`)));
    if(r.vFim>r.V) out.push(card('🏠',brl(r.vFim),L(`em imóveis daqui a ${r.anos} anos`,`en inmuebles dentro de ${r.anos} años`),L(`O patrimônio de hoje (${brl(r.V)}) valorizado no período, organizado para passar para a família.`,`El patrimonio de hoy (${brl(r.V)}) valorizado en el período, organizado para pasar a la familia.`)));
    return out; },
  soja:null, // preenchido pelo renderProjAgro (precisa do preço líquido da saca)
};
const ALVO={sim:'objecao-cdi',avista:'aVerdict',planta:'pVerdict',holding:'hVerdict'};
const assinaturas={};
function pintarCards(id,lista,titulo){
  const el=$(id); if(!el) return;
  if(!lista.length){ el.innerHTML=''; return; }
  const sig=lista.map(c=>c.big).join('|'), novo=assinaturas[id]!==sig; assinaturas[id]=sig;
  el.innerHTML=`<h3 class="motiva-tit">${titulo}</h3><div class="motiva-grid">${lista.map((c,i)=>`<article class="motiva-card${novo?' entra':''}" style="--i:${i}"><span class="ic" aria-hidden="true">${c.ic}</span><b class="big">${c.big}</b><h4>${c.tit}</h4><p>${c.txt}</p></article>`).join('')}</div>`;
}
for(const [aba,alvo] of Object.entries(ALVO)){
  const a=$(alvo); if(!a) continue;
  const box=document.createElement('section'); box.className='motiva'; box.id='motiva-'+aba; a.after(box);
  let pend=false; const upd=()=>{ if(pend) return; pend=true; requestAnimationFrame(()=>{ pend=false; try{ pintarCards(box.id,MOTIVA[aba](),L('O que isso significa para você','Lo que esto significa para usted')); }catch(e){ console.warn('motiva',aba,e); } }); };
  new MutationObserver(upd).observe(aba==='sim'?$('verdict'):a,{childList:true,subtree:true,characterData:true}); upd();
}
// Agro: cards no simulador da safra, atualizados junto com a projeção
{ const orig=window.renderProjAgro;
  window.renderProjAgro=function(liq,n,c){
    // sem preço da saca: esquece o preço anterior (senão o campo m² converteria com a cidade antiga)
    AGRO.liq=liq>0?liq:null;
    // no modo m²: se mudou a cidade da soja ou do imóvel, recalcula as sacas para manter o mesmo m² (o novo cálculo volta aqui)
    if(AGRO.porM2&&AGRO.liq&&sacasParaM2()) return;
    orig(liq,n,c);
    const m=$('sM2'); if(m&&document.activeElement!==m){ if(liq>0&&n>0) m.value=AGRO.porM2?AGRO.m2Alvo:Math.round(n*liq/precoM2Agro()); else if(!AGRO.porM2) m.value=''; }
    try{ cardsAgro(liq,n); }catch(e){ console.warn('motiva agro',e); }
    try{ renderFluxo(); }catch(e){ console.warn('fluxo agro',e); } };
  function cardsAgro(liq,n){
    if(!(liq>0)||!(n>0)){ const el=$('agroCards'); assinaturas.agroCards=null;
      el.innerHTML=!(liq>0)?`<p class="agro-sempreco">${L(`Sem preço de soja publicado para ${esc(selNome)}/${esc(selUF)}. Escolha uma cidade próxima que tenha cotação (os atalhos acima mostram as do estado) para ver quanto a safra compra.`,`Sin precio de soja publicado para ${esc(selNome)}/${esc(selUF)}. Elija una ciudad cercana con cotización (los atajos de arriba muestran las del estado) para ver cuánto compra la cosecha.`)}</p>`:''; return; }
    const R=SITE_CONFIG.referenciaMercado, pb=agroCid==='portobelo', cid=pb?'Porto Belo':'Itapema', m2=pb?REFS.m2PortoBelo.v:it[LAST], area=REFS.soja.areaPadrao, C=liq*n;
    const y=Math.max(0,(R.aluguelMensalPctValor*12/100)*(1-R.vacancia/100)*(1-R.admAnual/100)*(1-R.irAluguel/100)-R.despesasAnoPctValor/100);
    const cubAA=Math.pow(cubFim/cubIni,12/mesesEntre(CUB.inicio.mes,cubFimKey))-1, aptos=C/(m2*area), out=[];
    // todos os cards com número em m² ou R$: mudam com as sacas, com a cidade da soja e com a cidade do imóvel
    // (em sacas, "esperar a safra" seria sempre sacas × CUB e não mudaria com a cidade)
    const m2Imovel=AGRO.porM2&&AGRO.m2Alvo?AGRO.m2Alvo:C/m2;
    const aptTxt=aptos>=1?L(`cerca de ${fmtN(aptos,1)} apartamento(s) de ${area} m²`,`cerca de ${fmtN(aptos,1)} departamento(s) de ${area} m²`):L(`${pct(aptos,0)} de um apartamento de ${area} m²`,`${pct(aptos,0)} de un departamento de ${area} m²`);
    if(AGRO.porM2&&AGRO.m2Alvo) out.push(card('🌾',`${fmtN(n)} sc`,L(`para um imóvel de ${fmtN(AGRO.m2Alvo)} m² em ${cid}`,`para un inmueble de ${fmtN(AGRO.m2Alvo)} m² en ${cid}`),L(`A ${brl(m2)}/m², ${fmtN(AGRO.m2Alvo)} m² custam ${brl(AGRO.m2Alvo*m2)}. Com a saca a ${brl2(liq)} líquidos, são ${fmtN(n)} sacas.`,`A ${brl(m2)}/m², ${fmtN(AGRO.m2Alvo)} m² cuestan ${brl(AGRO.m2Alvo*m2)}. Con la saca a ${brl2(liq)} netos, son ${fmtN(n)} sacas.`)));
    else out.push(card('🏠',`${fmtN(C/m2)} m²`,L(`em ${cid} com ${fmtN(n)} sacas`,`en ${cid} con ${fmtN(n)} sacas`),L(`Com a saca a ${brl2(liq)} líquidos, ${fmtN(n)} sacas viram ${brl(C)}: ${aptTxt}, a ${brl(m2)}/m².`,`Con la saca a ${brl2(liq)} netos, ${fmtN(n)} sacas son ${brl(C)}: ${aptTxt}, a ${brl(m2)}/m².`)));
    if(y>0) out.push(card('🔑',brl(y*C/12),L('por mês de aluguel, sem plantar','por mes de alquiler, sin sembrar'),L(`Já líquido de administração, IR e despesas. São cerca de ${fmtN(y*C/liq)} sacas por ano, mesmo em ano de seca ou de saca barata.`,`Ya neto de administración, impuesto y gastos. Son cerca de ${fmtN(y*C/liq)} sacas por año, incluso en año de sequía o de saca barata.`)));
    // modo m²: o valor do imóvel é fixo e o que varia com a cidade da soja são as sacas → mostra em sacas; modo sacas → em R$
    if(cubAA>0) out.push(AGRO.porM2
      ? card('⏳',`${fmtN(C*cubAA/liq)} sc`,L('a mais se esperar a próxima safra','más si espera la próxima cosecha'),L(`Se o m² subir só como o custo de obra (${pct(cubAA,1)} ao ano), os mesmos ${fmtN(m2Imovel)} m² custam ${brl(C*cubAA)} a mais daqui a 12 meses, com a saca a ${brl2(liq)}.`,`Si el m² sube solo como el costo de obra (${pct(cubAA,1)} anual), los mismos ${fmtN(m2Imovel)} m² cuestan ${brl(C*cubAA)} más dentro de 12 meses, con la saca a ${brl2(liq)}.`))
      : card('⏳',brl(C*cubAA),L('a mais se esperar a próxima safra','más si espera la próxima cosecha'),L(`Se o m² subir só como o custo de obra (${pct(cubAA,1)} ao ano), o mesmo imóvel de ${fmtN(m2Imovel)} m² custa esse valor a mais daqui a 12 meses: cerca de ${fmtN(C*cubAA/liq)} sacas.`,`Si el m² sube solo como el costo de obra (${pct(cubAA,1)} anual), el mismo inmueble de ${fmtN(m2Imovel)} m² cuesta ese valor más dentro de 12 meses: cerca de ${fmtN(C*cubAA/liq)} sacas.`)));
    out.push(card('🛡️',brl(C),L('em imóvel com escritura no seu nome','en un inmueble con escritura a su nombre'),L('Um bem que não estraga no silo, não depende do preço da saca, não paga armazenagem e passa para os filhos com segurança.','Un bien que no se echa a perder en el silo, no depende del precio de la saca, no paga almacenaje y pasa a los hijos con seguridad.')));
    pintarCards('agroCards',out,L('O que a sua safra vira em imóvel','En qué se convierte su cosecha en inmueble'));
  }
  /* ---------- Simulador de fluxo (entrada + parcelas, em sacas ou em R$) ----------
     Converte pelo preço líquido da saca de hoje na cidade escolhida (AGRO.liq). O valor do imóvel acompanha o
     simulador de cima até o cliente digitar outro. Sem correção: é para ter noção; o aviso explica a diferença
     entre contrato em sacas (quantidade fixa) e em R$ (corrigido, ex.: CUB). */
  // valor do imóvel = m² × valor do m² (o valor do m² vem com a referência da região e pode ser trocado)
  const FLX={unid:'sc',m2:null,m2Manual:false,pm2:null,pm2Manual:false,valor:null,entrada:null,entradaManual:false};
  { const d=document.createElement('details'); d.className='mais cotacao fluxo-box'; d.id='fluxoAgro';
    d.innerHTML=`<summary>${L('🧮 Simulador de fluxo: entrada + parcelas, em sacas ou em R$','🧮 Simulador de flujo: anticipo + cuotas, en sacas o en R$')}</summary>
      <div class="fluxo">
        <div class="fluxo-unid" role="group" aria-label="${L('Unidade','Unidad')}">
          <span>${L('Simular em:','Simular en:')}</span>
          <button type="button" data-u="sc" aria-pressed="true">🌾 ${L('Sacas','Sacas')}</button><button type="button" data-u="brl" aria-pressed="false">R$ ${L('Reais','Reales')}</button>
        </div>
        <div class="fluxo-form">
          <div class="f2"><label for="fxM2">${L('Tamanho do imóvel','Tamaño del inmueble')}</label><div class="in"><input id="fxM2" type="number" min="1" step="1" inputmode="numeric"><span>m²</span></div></div>
          <div class="f2"><label for="fxPm2">${L('Valor do m²','Valor del m²')}</label><div class="in"><span>R$</span><input id="fxPm2" type="number" min="1" step="10" inputmode="numeric"></div><small id="fxPm2Ref"></small></div>
          <div class="fx-valor"><span>${L('Valor do imóvel','Valor del inmueble')}</span><b id="fxValorTxt"></b><small id="fxValorEq"></small></div>
          <div class="f2"><label for="fxEntrada">${L('Entrada','Anticipo')}</label><div class="in"><input id="fxEntrada" type="number" min="0" step="1" inputmode="decimal"><span class="fx-u"></span></div><small id="fxEntradaEq"></small></div>
          <div class="f2"><label for="fxN">${L('Número de parcelas','Número de cuotas')}</label><div class="in"><input id="fxN" type="number" min="1" max="240" step="1" value="4"></div></div>
          <div class="f2"><label for="fxPer">${L('Frequência','Frecuencia')}</label><div class="in"><select id="fxPer"><option value="12" selected>${L('Na safra (1 por ano)','En la cosecha (1 por año)')}</option><option value="6">${L('A cada 6 meses','Cada 6 meses')}</option><option value="1">${L('Mensal','Mensual')}</option></select></div></div>
          <div class="f2"><label for="fxChavesPct">${L('Saldo nas chaves','Saldo a la entrega')}</label><div class="in"><input id="fxChavesPct" type="number" min="0" max="100" step="1" value="0"><span>%</span></div><small>${L('Parte paga na entrega do imóvel (0 = sem saldo)','Parte pagada en la entrega (0 = sin saldo)')}</small></div>
          <div class="f2"><label for="fxChavesMes">${L('Mês das chaves','Mes de la entrega')}</label><div class="in"><input id="fxChavesMes" type="number" min="1" max="360" step="1"><span>${L('mês','mes')}</span></div><small id="fxChavesMesHint"></small></div>
          <div class="f2 fx-cub"><label class="chk"><input type="checkbox" id="fxCub"> <span>${L('Corrigir parcelas pelo CUB','Ajustar cuotas por el CUB')}</span></label><div class="in"><input id="fxCubTx" type="number" min="0" max="50" step="0.1"><span>${L('% ao ano','% anual')}</span></div><small id="fxCubHint"></small></div>
          <div class="f2"><label for="fxProd">${L('Sua produção por safra (opcional)','Su producción por cosecha (opcional)')}</label><div class="in"><input id="fxProd" type="number" min="0" step="100" inputmode="numeric" placeholder="${L('ex.: 20000','ej.: 20000')}"><span>sc</span></div></div>
        </div>
        <div id="fxRes"></div>
      </div>`;
    const cards=$('agroCards'); cards.after(d);
    const conv=v=>FLX.unid==='sc'?v*AGRO.liq:v/AGRO.liq; // converte o número digitado para a outra unidade
    d.querySelector('.fluxo-unid').addEventListener('click',e=>{ const b=e.target.closest('[data-u]'); if(!b||b.dataset.u===FLX.unid) return;
      if(AGRO.liq&&FLX.entrada!=null) FLX.entrada=conv(FLX.entrada);
      FLX.unid=b.dataset.u; renderFluxo(true); });
    $('fxM2').addEventListener('input',()=>{ const v=+$('fxM2').value; if(v>0){ FLX.m2=v; FLX.m2Manual=true; renderFluxo(); } });
    $('fxPm2').addEventListener('input',()=>{ const v=+$('fxPm2').value; if(v>0){ FLX.pm2=v; FLX.pm2Manual=true; renderFluxo(); } });
    $('fxPm2Ref').addEventListener('click',e=>{ if(e.target.closest('[data-ref]')){ FLX.pm2Manual=false; renderFluxo(true); } });
    $('fxEntrada').addEventListener('input',()=>{ const v=+$('fxEntrada').value; if(v>=0){ FLX.entrada=v; FLX.entradaManual=true; renderFluxo(); } });
    ['fxN','fxPer','fxProd','fxChavesPct','fxCubTx'].forEach(id=>$(id).addEventListener('input',()=>renderFluxo()));
    $('fxPer').addEventListener('change',()=>renderFluxo());
    $('fxCub').addEventListener('change',()=>renderFluxo());
    $('fxChavesMes').addEventListener('input',()=>{ const v=+$('fxChavesMes').value; if(v>0){ FLX.mesChaves=v; FLX.mesChavesManual=true; renderFluxo(); } });
    $('fxCubTx').value=(+CUB.v12m).toFixed(1); // taxa padrão: alta do CUB/SC nos últimos 12 meses (editável)
  }
  function renderFluxo(redesenharCampos){
    const res=$('fxRes'); if(!res) return;
    const liq=AGRO.liq, sc=FLX.unid==='sc';
    document.querySelectorAll('.fluxo-unid [data-u]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.u===FLX.unid));
    document.querySelectorAll('.fx-u').forEach(s=>s.textContent=sc?'sc':'R$');
    if(!liq){ res.innerHTML=`<p class="agro-sempreco">${L('Escolha acima uma cidade com preço de soja para converter sacas e reais.','Elija arriba una ciudad con precio de soja para convertir sacas y reales.')}</p>`; return; }
    // m² e valor do m² seguem o simulador de cima e a referência da região até o cliente digitar outros
    const ref=precoM2Agro(), cidRef=agroCid==='portobelo'?L('Porto Belo, DWV','Porto Belo, DWV'):L(`Itapema, FipeZap ${fmtMes(LASTKEY)}`,`Itapema, FipeZap ${fmtMes(LASTKEY)}`);
    if(!FLX.m2Manual) FLX.m2=Math.max(1,Math.round(AGRO.porM2&&AGRO.m2Alvo?AGRO.m2Alvo:num('sProducao')*liq/ref));
    if(!FLX.pm2Manual) FLX.pm2=ref;
    const valorBrl=FLX.m2*FLX.pm2;
    FLX.valor=sc?valorBrl/liq:valorBrl; // valor na unidade escolhida
    if(!FLX.entradaManual) FLX.entrada=FLX.valor*0.3;
    FLX.entrada=Math.min(FLX.entrada,FLX.valor);
    const fmtU=v=>sc?`${fmtN(Math.round(v))} sc`:brl(v), outra=v=>sc?brl(v*liq):`${fmtN(Math.round(v/liq))} sc`;
    const im=$('fxM2'), ip=$('fxPm2'), ie=$('fxEntrada');
    if(redesenharCampos||document.activeElement!==im) im.value=FLX.m2;
    if(redesenharCampos||document.activeElement!==ip) ip.value=Math.round(FLX.pm2);
    if(redesenharCampos||document.activeElement!==ie) ie.value=Math.round(FLX.entrada);
    $('fxPm2Ref').innerHTML=FLX.pm2Manual&&Math.round(FLX.pm2)!==Math.round(ref)
      ? L(`Referência da região: ${brl(ref)} (${cidRef}). <button type="button" class="linkbtn" data-ref>usar a referência</button>`,`Referencia de la región: ${brl(ref)} (${cidRef}). <button type="button" class="linkbtn" data-ref>usar la referencia</button>`)
      : L(`Referência da região (${cidRef}). Pode trocar pelo valor do imóvel real.`,`Referencia de la región (${cidRef}). Puede cambiarlo por el valor del inmueble real.`);
    $('fxValorTxt').textContent=fmtU(FLX.valor);
    $('fxValorEq').textContent='= '+outra(FLX.valor)+L(` · ${fmtN(FLX.m2)} m² × ${brl(FLX.pm2)}`,` · ${fmtN(FLX.m2)} m² × ${brl(FLX.pm2)}`);
    $('fxEntradaEq').textContent=`= ${outra(FLX.entrada)} · ${pct(FLX.valor>0?FLX.entrada/FLX.valor:0,0)} ${L('do valor','del valor')}`;
    const N=Math.max(1,Math.min(240,Math.round(num('fxN')||1))), per=+$('fxPer').value||12;
    // saldo nas chaves: % do valor, pago no mês das chaves (padrão: junto com a última parcela)
    const kPct=Math.max(0,Math.min(100,num('fxChavesPct')||0))/100, K=Math.min(FLX.valor*kPct,FLX.valor-FLX.entrada);
    const parcBase=Math.max(0,FLX.valor-FLX.entrada-K)/N, ultMes=N*per;
    if(!FLX.mesChavesManual) FLX.mesChaves=ultMes;
    const mc=Math.max(1,Math.round(FLX.mesChaves||ultMes)), imc=$('fxChavesMes');
    if(redesenharCampos||document.activeElement!==imc) imc.value=mc;
    $('fxChavesMesHint').textContent=K>0?L(`Padrão: junto com a última parcela (mês ${ultMes})`,`Por defecto: junto con la última cuota (mes ${ultMes})`):L('Sem saldo nas chaves','Sin saldo a la entrega');
    // correção pelo CUB: só faz sentido em contrato em R$ (em sacas a quantidade é fixa)
    const cb=$('fxCub'), cubOk=!sc; cb.disabled=!cubOk; $('fxCubTx').disabled=!cubOk||!cb.checked;
    const corr=cubOk&&cb.checked, tx=Math.max(0,num('fxCubTx')||0)/100, f=m=>corr?Math.pow(1+tx,m/12):1;
    $('fxCubHint').textContent=sc?L('Em sacas a quantidade é fixa: a correção pelo CUB vale para contrato em R$. Mude para "R$ Reais" para usar.','En sacas la cantidad es fija: el ajuste por CUB vale para contratos en R$. Cambie a "R$ Reales" para usarlo.')
      :L(`Padrão: alta do CUB/SC nos últimos 12 meses (${p1(CUB.v12m)}). Corrige parcelas e chaves mês a mês desde hoje.`,`Por defecto: suba del CUB/SC en los últimos 12 meses (${p1(CUB.v12m)}). Ajusta cuotas y entrega mes a mes desde hoy.`);
    const prod=num('fxProd'), toSc=v=>sc?v:v/liq, toBrl=v=>sc?v*liq:v;
    const perTxt={12:L('na safra, 1 por ano','en la cosecha, 1 por año'),6:L('a cada 6 meses','cada 6 meses'),1:L('por mês','por mes')}[per];
    // eventos do fluxo (valores na unidade escolhida; em R$ já com a correção, se marcada)
    const lbl=k=>per===12?L(`${k}ª safra · mês ${k*per}`,`${k}ª cosecha · mes ${k*per}`):L(`mês ${k*per}`,`mes ${k*per}`);
    const ev=[{n:'0',q:L('Entrada (hoje)','Anticipo (hoy)'),m:0,v:FLX.entrada,cls:'ent'}];
    for(let k=1;k<=N;k++) ev.push({n:String(k),q:lbl(k),m:k*per,v:parcBase*f(k*per)});
    if(K>0) ev.push({n:'🔑',q:L(`Chaves · mês ${mc}`,`Entrega · mes ${mc}`),m:mc,v:K*f(mc),cls:'chv'});
    ev.sort((a,b)=>a.m-b.m||(a.cls==='chv')-(b.cls==='chv'));
    const total=ev.reduce((s,e)=>s+e.v,0), correcao=total-FLX.valor, anos=Math.max(ultMes,K>0?mc:0)/12;
    const parc1=parcBase*f(per), parcN=parcBase*f(ultMes);
    const tile=(lb,v,sub,cls='')=>`<div class="fx-tile ${cls}"><span class="lb">${lb}</span><b>${fmtU(v)}</b><small>${outra(v)}${sub?' · '+sub:''}</small></div>`;
    let safraTxt='';
    if(prod>0){ const porAno=toSc(parc1)*(12/per), p=porAno/prod, kSc=toSc(K*f(mc));
      safraTxt=`<div class="fx-safra${p<=0.5?' ok':''}">${L(`As parcelas usam <b>${pct(p,0)} da sua safra</b> por ano (${fmtN(Math.round(porAno))} de ${fmtN(prod)} sacas${corr?', no 1º ano':''})${p<=0.5?': sobra a maior parte da produção.':p<=1?'.':'. É mais do que a produção de um ano: aumente o prazo ou a entrada.'}${K>0?` Nas chaves: ${fmtN(Math.round(kSc))} sacas, ${pct(kSc/prod,0)} de uma safra.`:''}`,`Las cuotas usan <b>${pct(p,0)} de su cosecha</b> por año (${fmtN(Math.round(porAno))} de ${fmtN(prod)} sacas${corr?', en el 1er año':''})${p<=0.5?': queda la mayor parte de la producción.':p<=1?'.':'. Es más que la producción de un año: aumente el plazo o el anticipo.'}${K>0?` En la entrega: ${fmtN(Math.round(kSc))} sacas, ${pct(kSc/prod,0)} de una cosecha.`:''}`)}</div>`; }
    const MAX=24, parcelas=ev.filter(e=>!e.cls), outros=ev.filter(e=>e.cls);
    const linha=e=>`<tr${e.cls?` class="${e.cls}"`:''}><td>${e.n}</td><td>${e.q}</td><td>${fmtN(Math.round(toSc(e.v)))} sc</td><td>${brl(toBrl(e.v))}</td></tr>`;
    const corpo=parcelas.length>MAX
      ? [...ev.filter(e=>e.cls==='ent'),...parcelas.slice(0,MAX)].map(linha).join('')+`<tr><td colspan="4">${L(`… mais ${parcelas.length-MAX} parcelas${corr?' (corrigidas)':' iguais'}`,`… ${parcelas.length-MAX} cuotas más${corr?' (ajustadas)':' iguales'}`)}</td></tr>`+outros.filter(e=>e.cls==='chv').map(linha).join('')
      : ev.map(linha).join('');
    const pE=FLX.valor>0?FLX.entrada/FLX.valor*100:0, pK=FLX.valor>0?K/FLX.valor*100:0;
    res.innerHTML=`<div class="fx-tiles">
        ${tile(L('Entrada (hoje)','Anticipo (hoy)'),FLX.entrada,pct(FLX.valor>0?FLX.entrada/FLX.valor:0,0))}
        ${tile(L(`${N} parcela(s) de`,`${N} cuota(s) de`),corr?parc1:parcBase,corr?L(`${perTxt} · a 1ª; a última ${fmtU(parcN)}`,`${perTxt} · la 1ª; la última ${fmtU(parcN)}`):perTxt)}
        ${K>0?tile(L('Chaves','Entrega'),K*f(mc),L(`no mês ${mc} · ${pct(kPct,0)} do valor`,`en el mes ${mc} · ${pct(kPct,0)} del valor`),'chv'):''}
        ${tile(L('Total pago','Total pagado'),total,corr?L(`inclui ${fmtU(correcao)} de correção`,`incluye ${fmtU(correcao)} de ajuste`):L(`em ${fmtN(anos,anos%1?1:0)} ano(s)`,`en ${fmtN(anos,anos%1?1:0)} año(s)`))}
      </div>
      ${safraTxt}
      <div class="fx-barra" aria-hidden="true"><span style="width:${pE.toFixed(1)}%"></span><span class="p" style="width:${Math.max(0,100-pE-pK).toFixed(1)}%"></span><span class="k" style="width:${pK.toFixed(1)}%"></span></div>
      <div class="fx-legenda" aria-hidden="true"><span><i></i>${L('Entrada','Anticipo')}</span><span><i class="p"></i>${L('Parcelas','Cuotas')}</span>${K>0?`<span><i class="k"></i>${L('Chaves','Entrega')}</span>`:''}</div>
      <div class="tblwrap"><table class="fx-tbl"><thead><tr><th>#</th><th>${L('Quando','Cuándo')}</th><th>${L('Sacas','Sacas')}</th><th>R$${corr?L(' (corrigido)',' (ajustado)'):''}</th></tr></thead><tbody>${corpo}</tbody></table></div>
      <p class="note">${L(`Conversão pelo preço líquido da saca hoje: ${brl2(liq)} em ${esc(selNome)}/${esc(selUF)}. É uma conta para ter noção. Em contrato <b>em sacas</b>, a quantidade fica fixa e o valor em R$ acompanha o preço da soja. Em contrato <b>em R$</b>, as parcelas costumam ser corrigidas pelo CUB${corr?`; aqui foram corrigidas a ${pct(tx,1)} ao ano, e as sacas de cada parcela estão no preço de hoje (a soja de amanhã pode valer mais ou menos)`:` (o CUB/SC subiu ${p1(CUB.v12m)} em 12 meses; marque a opção acima para simular)`}. As condições reais dependem do contrato com a incorporadora.`,`Conversión por el precio neto de la saca hoy: ${brl2(liq)} en ${esc(selNome)}/${esc(selUF)}. Es una cuenta para tener una idea. En contrato <b>en sacas</b>, la cantidad queda fija y el valor en R$ acompaña el precio de la soja. En contrato <b>en R$</b>, las cuotas suelen ajustarse por el CUB${corr?`; aquí se ajustaron a ${pct(tx,1)} anual, y las sacas de cada cuota están al precio de hoy (la soja de mañana puede valer más o menos)`:` (el CUB/SC subió ${p1(CUB.v12m)} en 12 meses; marque la opción de arriba para simular)`}. Las condiciones reales dependen del contrato con la constructora.`)}</p>`;
  }
  if(tab==='soja') renderSoja();
}

/* ---------- modo atendimento: letras maiores, sem notas, roteiro com "Próximo →" ----------
   O roteiro segue o objetivo escolhido na porta de entrada. Teclas: → / ← / Esc. Link direto: ?atendimento=1 */
document.querySelector('section.contato')?.setAttribute('id','contatoFim');
const PASSO={
  porta:[null,'porta',()=>L('O que o cliente procura?','¿Qué busca el cliente?')],
  dia:['viver','umDia',()=>L('Um dia em Porto Belo','Un día en Porto Belo')],
  perto:['viver','pertoTit',()=>L('Tudo perto','Todo cerca')],
  acomp:[null,'acompanha',()=>L('Quem vai te acompanhar','Quién lo acompaña')],
  prova:['why','prova',()=>L('Imóvel ou CDI: a conta','Inmueble o CDI: la cuenta')],
  pb:['why','porto-belo',()=>L('Porto Belo em transformação','Porto Belo en transformación')],
  teto:['why','objecao-teto',()=>L('Já subiu demais?','¿Ya subió demasiado?')],
  simRes:['sim','objecao-cdi',()=>L('A conta do imóvel','La cuenta del inmueble')],
  simCards:['sim','motiva-sim',()=>L('O que isso significa','Lo que esto significa')],
  avRes:['avista','aVerdict',()=>L('Renda à vista','Renta al contado')],
  avCards:['avista','motiva-avista',()=>L('O que isso significa','Lo que esto significa')],
  plRes:['planta','pVerdict',()=>L('Ganho na planta','Ganancia en pozo')],
  plCub:['planta','objecao-cub-imposto',()=>L('O CUB come o lucro?','¿El CUB se come la ganancia?')],
  plCards:['planta','motiva-planta',()=>L('O que isso significa','Lo que esto significa')],
  hoRes:['holding','hVerdict',()=>L('Pessoa física x holding','Persona física x holding')],
  hoCards:['holding','motiva-holding',()=>L('O que isso significa','Lo que esto significa')],
  agIntro:['soja','objecao-agro',()=>L('Sacas x m²','Sacas x m²')],
  agSim:['soja','agroSim',()=>L('Simule a safra','Simule la cosecha')],
  agCards:['soja','agroCards',()=>L('O que a safra vira','En qué se convierte la cosecha')],
  agProj:['soja','projAgro',()=>L('Por que compensa','Por qué conviene')],
  seg:[null,'seguranca',()=>L('Segurança jurídica','Seguridad jurídica')],
  fim:[null,'contatoFim',()=>L('Próximo passo','Próximo paso')],
};
const ROTEIRO={
  // emoção primeiro (um dia em Porto Belo), depois a conta, depois confiança (segurança + quem acompanha)
  renda:['porta','dia','prova','pb','simRes','simCards','seg','acomp','fim'],
  avista:['porta','dia','prova','avRes','avCards','seg','acomp','fim'],
  planta:['porta','dia','pb','plRes','plCards','plCub','seg','acomp','fim'],
  agro:['porta','agIntro','agSim','agCards','agProj','dia','seg','acomp','fim'],
  familia:['porta','dia','perto','prova','hoRes','hoCards','seg','acomp','fim'],
};
let atend=false, rot='renda', passo=0;
const bar=document.createElement('div'); bar.className='at-bar no-print'; bar.hidden=true; bar.setAttribute('role','toolbar');
document.body.appendChild(bar);
function pintarBarra(){
  const R=ROTEIRO[rot], k=R[passo], ult=passo===R.length-1;
  bar.innerHTML=`<button type="button" data-at="prev" ${passo===0?'disabled':''} aria-label="${L('Voltar','Volver')}">←</button>
    <div class="at-info"><small>${L('Passo','Paso')} ${passo+1} ${L('de','de')} ${R.length}</small><b>${PASSO[k][2]()}</b></div>
    ${ult?`<a class="at-next" href="${$('waBox')?.href||'#'}" target="_blank" rel="noopener">${L('WhatsApp ↗','WhatsApp ↗')}</a>`:`<button type="button" class="at-next" data-at="next">${L('Próximo →','Siguiente →')}</button>`}
    <button type="button" data-at="sair" class="at-sair" aria-label="${L('Sair do modo atendimento','Salir del modo atención')}">✕</button>
    <div class="at-dots" aria-hidden="true">${R.map((_,i)=>`<i class="${i===passo?'on':i<passo?'ok':''}"></i>`).join('')}</div>`;
}
function irPasso(i){
  const R=ROTEIRO[rot]; passo=Math.max(0,Math.min(R.length-1,i));
  const [aba,alvo]=PASSO[R[passo]];
  if(aba&&aba!==tab){ if(aba==='sim') setModo('temporada'); show(aba); }
  if(['sim','avista','planta','holding'].includes(tab)&&!resAberto) abrirResultados('auto');
  pintarBarra();
  requestAnimationFrame(()=>{ const el=$(alvo); if(!el) return;
    let d=el.closest('details'); while(d){ d.open=true; d=d.parentElement.closest('details'); }
    el.style.scrollMarginTop='150px'; el.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
    el.classList.remove('at-foco'); void el.offsetWidth; el.classList.add('at-foco'); });
}
function modoAtend(on){
  atend=on; document.body.classList.toggle('atendimento',on); bar.hidden=!on;
  btnAt.setAttribute('aria-pressed',on);
  if(on){ const esc=document.querySelector('[data-porta][aria-pressed="true"]'); if(esc) rot=esc.dataset.porta; irPasso(esc?1:0); }
}
bar.addEventListener('click',e=>{ const b=e.target.closest('[data-at]'); if(!b) return; const a=b.dataset.at;
  if(a==='next') irPasso(passo+1); else if(a==='prev') irPasso(passo-1); else if(a==='sair') modoAtend(false); });
addEventListener('keydown',e=>{ if(!atend||e.target.closest('input,select,textarea')) return;
  if(e.key==='ArrowRight'){ e.preventDefault(); irPasso(passo+1); } else if(e.key==='ArrowLeft'){ e.preventDefault(); irPasso(passo-1); } else if(e.key==='Escape') modoAtend(false); });
// escolher um objetivo na porta, durante o atendimento, troca o roteiro e já avança
$('porta').addEventListener('click',e=>{ const b=e.target.closest('[data-porta]'); if(!b||!atend) return; rot=b.dataset.porta; setTimeout(()=>irPasso(1),0); });
const btnAt=document.createElement('button'); btnAt.type='button'; btnAt.className='at-btn'; btnAt.setAttribute('aria-pressed','false');
btnAt.innerHTML=`🎯 <span>${L('Atendimento','Atención')}</span>`; btnAt.title=L('Modo atendimento: letras maiores e roteiro passo a passo','Modo atención: letras más grandes y guion paso a paso');
btnAt.addEventListener('click',()=>modoAtend(!atend));
document.querySelector('.hero .lang')?.prepend(btnAt);
if(URLQ.get('atendimento')==='1') setTimeout(()=>modoAtend(true),300);

/* ---------- Etapa 3: notas longas (fontes e premissas) viram "ⓘ Fonte e detalhes" ----------
   Só notas fixas do HTML, sem id (as que têm id são atualizadas pelo app.js e algumas são avisos importantes). */
document.querySelectorAll('main p.note:not([id]), body > section p.note:not([id]), section p.note:not([id])').forEach(p=>{
  if(p.closest('details.info,.porta,.at-bar,.prova,.login,#formLogin,#objecao-agro,#p-corr')||p.textContent.trim().length<170) return;
  const d=document.createElement('details'); d.className='info';
  d.innerHTML=`<summary>ⓘ ${L('Fonte e detalhes','Fuente y detalles')}</summary>`;
  p.before(d); d.appendChild(p);
});

/* ---------- começa com os resultados do Cenário de mercado já abertos ---------- */
if(!URLQ.get('cen')&&!resAberto) abrirResultados('auto');
atualizarNav(); if(tab==='why') renderProva();
// o Banco Central ao vivo pode mudar o CDI depois do carregamento
setTimeout(()=>{ if(tab==='why') renderProva(); },10000);
})();
