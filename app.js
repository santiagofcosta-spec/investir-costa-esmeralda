/* Calculadora Costa Esmeralda
   Dados: dados/dados.js (robô mensal) + Banco Central ao vivo a cada abertura.
   Idioma: ?lang=es mostra a versão em espanhol. */
const D = window.DADOS;
let imprimindo = false;

/* ---------- CONFIGURAÇÃO DO SITE: edite aqui, sem mexer no HTML ----------
   creci: preencher quando sair (aí a assinatura passa a mostrar "Corretor de imóveis · CRECI ...").
   whatsappNumero: só números, com 55 + DDD. */
const SITE_CONFIG = {
  consultorNome: 'Santiago Fernandes Costa',
  primeiroNome: 'Santiago',
  imobiliaria: 'Goya Investimentos Imobiliários',
  creci: '',
  whatsappNumero: '5547992176060',
  whatsappTxt: '(47) 99217-6060',
  itbiRegistroPct: 3.5,        // ITBI + cartório + registro, % do valor
  mobiliaPadraoPct: 8.0,       // mobília e decoração, % do valor (locação/temporada)
  // Cenário de mercado (automático). Temporada: média de Porto Belo no Airbnb (AirROI, nov/2025–out/2026, 661 anúncios),
  // escolhida em 15/11/2026 por ser a referência mais conservadora (AirDNA e Airbtics/Itapema dão números maiores).
  // Os demais itens seguem SEM fonte oficial, da experiência da consultoria.
  // provisorio:true = itens sem fonte ainda não conferidos pelo Santiago (o site mostra "referência provisória").
  referenciaMercado: {
    provisorio: true,
    fonteTemporada: { pt:'média de Porto Belo no Airbnb (AirROI, nov/2025 a out/2026)', es:'promedio de Porto Belo en Airbnb (AirROI, nov/2025 a oct/2026)' },
    entradaPct: 30,               // usado só se o "Seu cenário" estiver sem valor
    diariaAltaPctValor: 0.0710,   // diária na alta (dez–mar), % do valor do imóvel (R$ 639 num imóvel de R$ 900 mil)
    diariaBaixaPctValor: 0.0650,  // diária no resto do ano (R$ 585 em R$ 900 mil)
    ocupAlta: 41, ocupBaixa: 23, mesesAlta: 4,
    // aluguel anual tradicional, % do valor por mês: rentabilidade de Florianópolis no FipeZap Locação (set/2026: 5,42% a.a.).
    // Itapema e Porto Belo não entram no índice; Florianópolis é o mercado oficial mais parecido (SC, litoral, m² alto).
    aluguelMensalPctValor: 0.45,
    fonteAluguel: { pt:'rentabilidade de Florianópolis, FipeZap Locação set/2026 (Itapema e Porto Belo não entram no índice)', es:'rentabilidad de Florianópolis, FipeZap Alquiler sep/2026 (Itapema y Porto Belo no están en el índice)' },
    vacancia: 8,
    admTemporada: 20, admAnual: 10, // % sobre a receita
    despesasAnoPctValor: 0.53,    // IPTU, manutenção, seguro: % do valor por ano
    irAluguel: 10,                // IR efetivo sobre aluguel
    corretagem: 6,                // na venda
    descontoAvista: 5,
    fluxoPlanta: { entrada: 10, mensais: 30, reforcos: 10 },
    honorInventario: 5
  }
};
const CONTATO = { nome:SITE_CONFIG.consultorNome, primeiroNome:SITE_CONFIG.primeiroNome, whatsapp:SITE_CONFIG.whatsappNumero, whatsappTxt:SITE_CONFIG.whatsappTxt, creci:SITE_CONFIG.creci, imobiliaria:SITE_CONFIG.imobiliaria };

/* ---------- referências de mercado com fonte (conferidas em 13/11/2026; atualizar à mão) ---------- */
const REFS = window.REFS_DADOS; // dados/referencias.json: números de mercado com fonte, data e validade

/* ---------- idade dos dados manuais ---------- */
const diasDesde = iso => Math.floor((Date.now() - new Date(iso + 'T12:00:00')) / 864e5);
const vencido = r => !!(r && r.atualizado && r.validadeDias && diasDesde(r.atualizado) > r.validadeDias);
function selo(r){ // "conferido em nov/2026" + aviso se passou da validade
  if(!r || !r.atualizado) return '';
  const [y,m]=r.atualizado.split('-'); const q=NOMES_MES[+m-1]+'/'+y;
  return vencido(r) ? ` <span class="velho">${L(`dado de ${q}, pode estar desatualizado`,`dato de ${q}, puede estar desactualizado`)}</span>`
                    : ` <span class="fresco">${L(`conferido em ${q}`,`verificado en ${q}`)}</span>`;
}

/* ---------- idioma ---------- */
const ES = new URLSearchParams(location.search).get('lang') === 'es';
const L = (pt, es) => ES ? es : pt;
function traduzirEstatico(){
  document.documentElement.lang = ES ? 'es' : 'pt-BR';
  document.title = L('Investir na Costa Esmeralda','Invertir en la Costa Esmeralda');
  if(ES) document.querySelectorAll('[data-es]').forEach(el=>{ el.innerHTML = el.dataset.es; });
  if(ES) $('sCidadeTxt').placeholder='Escriba el nombre';
  if(ES) $('senhaCorretor').placeholder='Contraseña';
  $('lang-pt').setAttribute('aria-current', ES?'false':'true');
  $('lang-es').setAttribute('aria-current', ES?'true':'false');
}

/* ---------- população (IBGE: Censo 2010, Censo 2022, estimativa 2025) ---------- */
const POP = {
  itapema:['Itapema',[45797,75940,86116],'--c-itapema'],
  portobelo:['Porto Belo',[16083,27688,31557],'--c-bc'],
  bombinhas:['Bombinhas',[14293,25058,28738],'--c-floripa'],
  sc:['Santa Catarina',[6248436,7610361,8187029],'--c-brasil'],
  br:['Brasil',[190755799,203080756,213421037],'--c-ipca'],
};

/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);
const brl = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const brl2 = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2});
const usd = v => 'US$ '+Math.round(v).toLocaleString('pt-BR');
const pct = (v,d=2) => (v*100).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})+'%';
const p1 = v => v.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
function lerNum(t){ t=String(t??'').trim().replace(/\s|R\$/g,''); if(!t) return 0;
  if(t.includes(',')) t=t.replace(/\./g,'').replace(',','.'); else if(/^-?\d{1,3}(\.\d{3})+$/.test(t)) t=t.replace(/\./g,'');
  const v=parseFloat(t); return isFinite(v)?v:0; }
const num = id => lerNum($(id).value);
// campos numéricos: texto com ponto de milhar e vírgula decimal (900.000,00)
function casasDe(el){ return el.dataset.casas!=null?+el.dataset.casas:0; }
function formatarCampo(el){ if(el.dataset.num==null) return; const v=lerNum(el.value), c=casasDe(el); el.value=v.toLocaleString('pt-BR',{minimumFractionDigits:c,maximumFractionDigits:Math.max(c,2)}); }
function setNum(id,v,c){ const el=$(id); if(c!=null) el.dataset.casas=c; el.value=v; formatarCampo(el); if(el.dataset.dinheiro!=null) extenso(el); }
function prepararCampos(){
  document.querySelectorAll('form input[type=number]').forEach(el=>{
    const dinheiro=[...el.parentElement.querySelectorAll('span')].some(x=>x.textContent.trim()==='R$');
    const passo=parseFloat(el.getAttribute('step')||'1');
    el.dataset.num=''; el.dataset.casas = dinheiro ? (passo<1 ? 2 : 0) : (Number.isInteger(passo) ? 0 : 1);
    if(dinheiro) prepararDinheiro(el, passo>=1000);
    el.type='text'; el.inputMode='decimal'; el.autocomplete='off';
    el.removeAttribute('step'); el.removeAttribute('min'); el.removeAttribute('max');
    formatarCampo(el);
  });
  document.addEventListener('focusout',e=>{ if(e.target.dataset&&e.target.dataset.num!=null){ formatarCampo(e.target); extenso(e.target); } });
  // pontos de milhar enquanto digita (só campos em R$); roda antes dos cálculos (fase de captura)
  document.addEventListener('input',e=>{ const el=e.target; if(el.dataset&&el.dataset.dinheiro!=null){ milharAoDigitar(el); extenso(el); } },true);
}
function prepararDinheiro(el,grande){
  el.dataset.dinheiro=''; el.inputMode='numeric';
  if(grande && !el.parentElement.parentElement.querySelector('.extenso')){
    const x=document.createElement('span'); x.className='extenso'; x.setAttribute('aria-hidden','true'); el.parentElement.after(x);
  }
}
function porExtenso(v){
  if(!(v>0)) return '';
  const f=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:2});
  if(v>=1e9){ const n=v/1e9; return `R$ ${f(n)} ${n<2?L('bilhão','mil millones'):L('bilhões','mil millones')}`; }
  if(v>=1e6){ const n=v/1e6; return `R$ ${f(n)} ${n<2?L('milhão','millón'):L('milhões','millones')}`; }
  if(v>=1e3) return `R$ ${f(v/1e3)} mil`;
  return '';
}
function extenso(el){ const x=el.parentElement&&el.parentElement.nextElementSibling; if(x&&x.classList.contains('extenso')) x.textContent=porExtenso(lerNum(el.value)); }
function milharAoDigitar(el){
  const v=el.value, pos=el.selectionStart??v.length;
  const conta=t=>t.replace(/[^\d,]/g,'').length;           // dígitos (e vírgula) antes do cursor
  const antes=conta(v.slice(0,pos));
  let limpo=v.replace(/[^\d,]/g,''); const i=limpo.indexOf(',');
  if(i>=0) limpo=limpo.slice(0,i+1)+limpo.slice(i+1).replace(/,/g,'').slice(0,casasDe(el)||0);
  let [int,dec]=limpo.split(','); int=(int||'').replace(/^0+(?=\d)/,'');
  const novo=int.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(dec!=null&&casasDe(el)>0?','+dec:'');
  if(novo===v) return;
  el.value=novo;
  let k=0,p=0; while(p<novo.length&&k<antes){ if(/[\d,]/.test(novo[p])) k++; p++; }
  try{ el.setSelectionRange(p,p); }catch{}
}
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const mensal = a => Math.pow(1+a,1/12)-1;
const irRegressivo = m => m<=6?0.225:m<=12?0.20:m<=24?0.175:0.15;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NOMES_MES = ES ? ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'] : ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const fmtMes = k => { const [y,m]=k.split('-'); return NOMES_MES[+m-1]+'/'+y; };
const fmtCurto = k => { const [y,m]=k.split('-'); return NOMES_MES[+m-1]+'/'+y.slice(2); };
const mesesEntre = (a,b) => { const [y1,m1]=a.split('-').map(Number), [y2,m2]=b.split('-').map(Number); return (y2-y1)*12+(m2-m1); };
const BASE='2020-12';

/* ---------- impostos (regras conferidas em 13/11/2026) ---------- */
// IR sobre ganho de capital da pessoa física: fator de redução FR2 = 1/1,0035^meses (Lei 11.196/2005, art. 40)
// e alíquotas progressivas por faixa de ganho (Lei 13.259/2016).
const FAIXAS_GC=[[5e6,0.15],[10e6,0.175],[30e6,0.20],[Infinity,0.225]];
function irProgressivo(base){ let ir=0, ini=0; for(const [teto,a] of FAIXAS_GC){ if(base>ini) ir+=(Math.min(base,teto)-ini)*a; ini=teto; } return ir; }
const fatorReducao = meses => 1/Math.pow(1.0035,Math.max(0,meses));
function irGanhoPF(vendaLiq, custo, meses, isento=false){
  const ganho=Math.max(0,vendaLiq-custo), trib=ganho*fatorReducao(meses);
  return {ganho, trib, ir: isento?0:irProgressivo(trib)};
}
// ITCMD de SC, progressivo por parcela (Lei 13.136/2004, art. 9º; faixa de 8% revogada pela Lei 19.053/2024)
const FAIXAS_ITCMD=[[20000,0.01],[50000,0.03],[150000,0.05],[Infinity,0.07]];
function itcmdSC(base){ let t=0, ini=0; for(const [teto,a] of FAIXAS_ITCMD){ if(base>ini) t+=(Math.min(base,teto)-ini)*a; ini=teto; } return t; }

/* ---------- estado derivado dos dados ---------- */
let S, months, iEnd, poupAA, bcbAoVivo=false;
function prepBCB(){
  const B=D.bcb; S=B.series;
  const [y,m]=B.start.split('-').map(Number);
  months=S.cdi.map((_,i)=>{const t=y*12+m-1+i; return `${Math.floor(t/12)}-${String(t%12+1).padStart(2,'0')}`;});
  iEnd=Math.min(...['ivgr','cdi','ipca','igpm','incc'].map(k=>lastIdx(S[k])));
  poupAA=Math.pow(1+B.poup_m/100,12)-1;
}
function lastIdx(a){ if(!a) return -1; for(let i=a.length-1;i>=0;i--) if(a[i]!=null) return i; return -1; }
function acum(k,i0,i1){ if(k==='ivgr') return S.ivgr[i1]/S.ivgr[i0]; let f=1; for(let i=i0+1;i<=i1;i++) f*=1+(S[k][i]||0)/100; return f; }
const mi = k => { const i=months.indexOf(k); return i<0?months.length-1:i; };
const at = (k,key) => Math.min(mi(key), lastIdx(S[k]));
const i12 = k => acum(k,lastIdx(S[k])-12,lastIdx(S[k]))-1;
const anualBCB = (k,anos) => Math.pow(acum(k,iEnd-12*anos,iEnd),1/anos)-1;
const usdEm = key => { const u=S.usd; if(!u) return null; const i=Math.min(mi(key),lastIdx(u)); return u[i]; };

const FZ = D.fipezap;
const PTS = FZ.pontos.slice().sort((a,b)=>a.mes.localeCompare(b.mes));
if(!PTS.some(p=>p.mes===FZ.ultimo.mes)) PTS.push(FZ.ultimo);
const PERKEY=[BASE,...PTS.map(p=>p.mes)], LAST=PERKEY.length-1, LASTKEY=PERKEY[LAST];
const PER=PERKEY.map(fmtCurto);
const anosPer=mesesEntre(BASE,LASTKEY)/12;
const CID={itapema:['Itapema','--c-itapema'],bc:['Balneário Camboriú','--c-bc'],floripa:['Florianópolis','--c-floripa'],brasil:[L('Média Brasil (FipeZap)','Promedio Brasil (FipeZap)'),'--c-brasil']};
const REG={};
for(const [k,[nome,cor]] of Object.entries(CID)){
  const m2=PTS.map(p=>p[k]?p[k][0]:null), vr=PTS.map(p=>p[k]?(p.mes.endsWith('-12')?p[k][1]:p[k][2]):null);
  REG[k]={nome,cor,m2:[m2[0]/(1+vr[0]/100),...m2].map(v=>v==null?null:Math.round(v)),var:vr};
}
const fimDe = k => { const a=REG[k].m2; for(let i=a.length-1;i>=0;i--) if(a[i]!=null) return i; return 0; };
const labAnual=PTS.map(p=>p.mes.endsWith('-12')?p.mes.slice(0,4):'12m '+fmtCurto(p.mes));
const CUB=D.cub, cubIni=CUB.inicio.v, cubFim=CUB.serie.at(-1)[1], cubFimKey=CUB.serie.at(-1)[0];
const cubMap=Object.fromEntries(CUB.serie);
const it=REG.itapema.m2;
const idxBCB = k => PERKEY.map(p=>100*acum(k,mi(BASE),at(k,p)));
const varBCB = k => PTS.map(p=>{ const ini=p.mes.endsWith('-12')?`${+p.mes.slice(0,4)-1}-12`:`${+p.mes.slice(0,4)-1}${p.mes.slice(4)}`; return 100*(acum(k,mi(ini),at(k,p.mes))-1); });

/* ---------- gráficos ---------- */
const charts={};
function baseOpts(fmt,extra={}){
  const mut=css('--muted'), line=css('--line');
  return Object.assign({responsive:true,maintainAspectRatio:false,animation:(reduce||imprimindo)?false:{duration:1200,easing:'easeOutQuart'},interaction:{mode:'index',intersect:false},
    plugins:{legend:{labels:{color:css('--ink'),boxWidth:10,boxHeight:10,usePointStyle:true,font:{family:'Outfit'}}},tooltip:{callbacks:{label:c=>c.parsed.y==null?null:`${c.dataset.label}: ${fmt(c.parsed.y)}`}}},
    scales:{x:{ticks:{color:mut,maxRotation:0,autoSkipPadding:14},grid:{display:false},border:{color:line}},y:{ticks:{color:mut,callback:v=>fmt(v)},grid:{color:line},border:{display:false}}}},extra);
}
const ds=(label,data,color,extra={})=>({label,data,borderColor:color,backgroundColor:color,borderWidth:2,pointRadius:0,pointHoverRadius:4,tension:.25,...extra});
function draw(id,cfg){ if(typeof Chart==='undefined') return; if(charts[id]) charts[id].destroy(); charts[id]=new Chart($(id),cfg); }
const brlK=v=>Math.abs(v)>=1e6?'R$ '+(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+L(' mi',' M'):'R$ '+Math.round(v/1000).toLocaleString('pt-BR')+' mil';
function countUp(el,to,fmt,ms=1300){
  if(reduce){el.textContent=fmt(to);return;}
  const t0=performance.now();
  const step=t=>{const k=Math.min(1,(t-t0)/ms), e=1-Math.pow(1-k,3); el.textContent=fmt(to*e); if(k<1) requestAnimationFrame(step); else el.textContent=fmt(to);};
  requestAnimationFrame(step);
}
const kpiHTML=kp=>kp.map(([l,v,n,c])=>`<div class="kpi"><div class="lb">${l}</div><div class="v ${c||''}">${v}</div><div class="n">${n}</div></div>`).join('');

/* ---------- herói ---------- */
function status(){
  const dt=D.atualizado.split('-').reverse().join('/');
  $('stamp').innerHTML=`<span class="chip ${bcbAoVivo?'live':''}">${bcbAoVivo?L('● Banco Central ao vivo','● Banco Central en vivo'):L('Banco Central: dados salvos em ','Banco Central: datos guardados el ')+dt}</span> FipeZap ${fmtMes(LASTKEY)} · CUB/SC ${fmtMes(cubFimKey)}. ${L('Imóvel sem contar o aluguel recebido.','Inmueble sin contar el alquiler recibido.')}`;
}
function hero(animar=true){
  const ratio=it[LAST]/it[0];
  $('heroTitle').innerHTML = ratio>=1.9
    ? L('Quem comprou aqui em 2020 viu o metro quadrado <em>dobrar</em>.','Quien compró aquí en 2020 vio el metro cuadrado <em>duplicarse</em>.')
    : L(`Quem comprou aqui em 2020 viu o metro quadrado <em>subir ${pct(ratio-1,0)}</em>.`,`Quien compró aquí en 2020 vio el metro cuadrado <em>subir ${pct(ratio-1,0)}</em>.`);
  $('heroLb').textContent=L(`R$ 100 aplicados em dez/2020 viraram, em ${fmtMes(LASTKEY)}:`,`R$ 100 invertidos en dic/2020 se convirtieron, en ${fmtMes(LASTKEY)}, en:`);
  const cdi=idxBCB('cdi'), ipca=idxBCB('ipca');
  const rows=[[L('Imóvel em Itapema','Inmueble en Itapema'),100*ratio,'#FFC350'],['CDI (bruto)',cdi[LAST],'#f0a35a'],[L('CDI após IR','CDI neto de impuestos'),100+(cdi[LAST]-100)*0.85,'#c98a4e'],[L('Inflação (IPCA)','Inflación (IPCA)'),ipca[LAST],'#ef7d99']];
  if(ES){ const u0=usdEm(BASE), u1=usdEm(LASTKEY); if(u0&&u1) rows.push(['Guardado en dólares',100*u1/u0,'#9fb4c8']); }
  const max=Math.max(...rows.map(r=>r[1]));
  $('thesisBars').innerHTML=rows.map(([n,v,c])=>`<div class="bar"><span>${n}</span><div class="track"><div class="fill" data-w="${(v/max*100).toFixed(1)}" style="background:${c}${animar?'':';width:'+(v/max*100).toFixed(1)+'%'}"></div></div><b data-v="${v}">R$ ${Math.round(v)}</b></div>`).join('');
  if(animar) requestAnimationFrame(()=>requestAnimationFrame(()=>{
    document.querySelectorAll('#thesisBars .fill').forEach(f=>f.style.width=f.dataset.w+'%');
    document.querySelectorAll('#thesisBars b').forEach(b=>countUp(b,+b.dataset.v,v=>'R$ '+Math.round(v)));
  }));
  status();
}
function waves(){
  const c=$('waves'), ctx=c.getContext('2d'); let t=0;
  const fit=()=>{c.width=c.clientWidth*devicePixelRatio; c.height=c.clientHeight*devicePixelRatio;}; fit(); addEventListener('resize',fit);
  const frame=()=>{
    const w=c.width,h=c.height; ctx.clearRect(0,0,w,h);
    [['rgba(255,255,255,.05)',0.9,22,0],['rgba(255,195,80,.12)',1.3,16,2],['rgba(255,195,80,.2)',0.7,12,4]].forEach(([col,sp,amp,ph],i)=>{
      ctx.beginPath(); ctx.moveTo(0,h);
      for(let x=0;x<=w;x+=8) ctx.lineTo(x,h*(0.45+i*0.15)+Math.sin(x/(140*devicePixelRatio)+t*sp+ph)*amp*devicePixelRatio);
      ctx.lineTo(w,h); ctx.closePath(); ctx.fillStyle=col; ctx.fill();
    });
    t+=0.012; if(!reduce) requestAnimationFrame(frame);
  }; frame();
}

/* ---------- por que investir ---------- */
function pouPer(){ let f=1; for(let i=mi(BASE)+1;i<=at('cdi',LASTKEY);i++){ const s=S.selic[i]; f*= s>8.5 ? 1.005*1.0008 : 1+mensal(0.7*s/100);} return f-1; }
function renderWhy(){
  const valIt=it[LAST]/it[0]-1, cagrIt=Math.pow(1+valIt,1/anosPer)-1, cdi=idxBCB('cdi'), ipca=idxBCB('ipca'), real=it[LAST]/it[0]/(ipca[LAST]/100)-1;
  const kp=[
    ['m² Porto Belo',REFS.m2PortoBelo.v,v=>'R$ '+Math.round(v).toLocaleString('pt-BR'),L('imóveis novos · 1º sem/2026 (DWV)','inmuebles nuevos · 1er sem/2026 (DWV)'),''],
    [L('m² médio em Itapema','m² medio en Itapema'),it[LAST],v=>'R$ '+Math.round(v).toLocaleString('pt-BR'),`FipeZap ${fmtMes(LASTKEY)}`,''],
    [L('Valorização desde dez/2020','Valorización desde dic/2020'),valIt*100,v=>'+'+p1(v),L(`${pct(cagrIt,1)} ao ano em média`,`${pct(cagrIt,1)} anual promedio`),'up'],
    [L('Ganho acima da inflação','Ganancia sobre la inflación'),real*100,v=>'+'+p1(v),L('valorização real, já descontado o IPCA','valorización real, descontado el IPCA'),'up'],
    ['CUB/SC',cubFim,v=>'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),L(`+${p1(CUB.v12m)} em 12 meses`,`+${p1(CUB.v12m)} en 12 meses`),''],
    [L('Selic hoje','Selic hoy'),D.bcb.selicMeta,v=>v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%',L('meta do Copom, ao ano','meta del Copom, anual'),''],
  ];
  $('kpisWhy').innerHTML=kp.map(([l,,,n,c],i)=>`<div class="kpi"><div class="lb">${l}</div><div class="v ${c}" id="kw${i}">0</div><div class="n">${n}</div></div>`).join('');
  kp.forEach(([,v,f],i)=>countUp($('kw'+i),v,f));
  const r8=CUB.padroes.itens.find(p=>p[0]==='R8-A')[2], br=REG.brasil.m2;
  const crPB=POP.portobelo[1][1]/POP.portobelo[1][0]-1;
  const reasons=[
    [L('R$ 2,5 bi','R$ 2.500 M'),L('em vendas em Porto Belo em 6 meses','en ventas en Porto Belo en 6 meses'),L(`No 1º semestre de 2026, Porto Belo, com cerca de 31 mil moradores, movimentou ${REFS.vendasPortoBelo.v} em imóveis novos e lançamentos, a ${brl(REFS.m2PortoBelo.v)}/m² em média, ainda abaixo de Itapema e de Balneário Camboriú. A população cresceu ${pct(crPB,0)} entre os Censos de 2010 e 2022.`,`En el 1er semestre de 2026, Porto Belo, con cerca de 31 mil habitantes, movió R$ 2.500 millones en inmuebles nuevos y lanzamientos, a ${brl(REFS.m2PortoBelo.v)}/m² en promedio, todavía por debajo de Itapema y Balneário Camboriú. La población creció ${pct(crPB,0)} entre los censos de 2010 y 2022.`),L('DWV via Portas e NSC Total · IBGE','DWV vía Portas y NSC Total · IBGE')],
    [pct(valIt,0),L('de valorização desde dez/2020','de valorización desde dic/2020'),L(`O metro quadrado em Itapema saiu de ${brl(it[0])} para ${brl(it[LAST])}. No mesmo período o CDI bruto rendeu ${p1(cdi[LAST]-100)} e a inflação foi ${p1(ipca[LAST]-100)}.`,`El metro cuadrado en Itapema pasó de ${brl(it[0])} a ${brl(it[LAST])}. En el mismo período el CDI bruto rindió ${p1(cdi[LAST]-100)} y la inflación fue ${p1(ipca[LAST]-100)}.`),L('FipeZap e Banco Central','FipeZap y Banco Central')],
    [(it[LAST]/br[fimDe('brasil')]).toLocaleString('pt-BR',{maximumFractionDigits:1})+'×',L('o preço médio do Brasil','el precio medio de Brasil'),L(`O m² da região custa ${brl(it[LAST])}, contra ${brl(br[fimDe('brasil')])} na média das cidades do FipeZap. É um mercado de alto padrão, com compradores de todo o país.`,`El m² de la región cuesta ${brl(it[LAST])}, contra ${brl(br[fimDe('brasil')])} en el promedio de las ciudades de FipeZap. Es un mercado de alto estándar, con compradores de todo el país y del exterior.`),`FipeZap ${fmtMes(LASTKEY)}`],
    ['+'+pct(cubFim/cubIni-1,0),L('no custo de construir desde 2020','en el costo de construir desde 2020'),L(`O CUB/SC passou de ${brl2(cubIni)} para ${brl2(cubFim)} por m². Obra nova fica mais cara todo mês, o que dá sustentação ao preço do imóvel pronto.`,`El CUB/SC pasó de ${brl2(cubIni)} a ${brl2(cubFim)} por m². Construir es más caro cada mes, lo que sostiene el precio del inmueble terminado.`),'Sinduscon Grande Florianópolis'],
    [L('Renda + valorização','Renta + valorización'),L('dois ganhos no mesmo ativo','dos ganancias en el mismo activo'),L('Além da valorização, o imóvel gera aluguel, com picos na temporada de verão. Na renda fixa o ganho é só o juro, e o IR incide sobre todo o rendimento.','Además de la valorización, el inmueble genera alquiler, con picos en la temporada de verano. En la renta fija la ganancia es solo el interés, y paga impuesto sobre todo el rendimiento.'),L('Veja o simulador','Vea el simulador')],
    [L('Ativo real','Activo real'),L('proteção contra a inflação','protección contra la inflación'),L(`Imóvel acompanha o custo de construção e a inflação no longo prazo. Desde dez/2020 Itapema subiu ${pct(real,0)} acima do IPCA.`,`El inmueble acompaña el costo de construcción y la inflación a largo plazo. Desde dic/2020 Itapema subió ${pct(real,0)} por encima del IPCA.`),'FipeZap e IBGE'],
    [L('Escassez','Escasez'),L('faixa litorânea limitada','franja costera limitada'),L('Entre o mar e a BR-101 há pouco terreno disponível. Por isso a região vem verticalizando e o m² segue entre os mais altos do país, à frente de capitais.','Entre el mar y la ruta BR-101 hay poco terreno disponible. Por eso la región se verticaliza y el m² sigue entre los más altos del país, por delante de capitales.'),L('Contexto de mercado','Contexto de mercado')],
  ];
  $('reasons').innerHTML=reasons.map(([b,s,p,src])=>`<article class="reason"><span class="big">${b}</span><h3>${s}</h3><p>${p}</p><span class="src">${src}</span></article>`).join('');

  const sets=Object.keys(CID).map(k=>ds(REG[k].nome,REG[k].m2.map(v=>v==null?null:100*v/REG[k].m2[0]),css(REG[k].cor),k==='itapema'?{borderWidth:3.5,pointRadius:3}:{pointRadius:2}));
  sets.push(ds('CDI',idxBCB('cdi'),css('--c-cdi'),{borderDash:[6,4],pointRadius:2}));
  sets.push(ds('IPCA',idxBCB('ipca'),css('--c-ipca'),{borderDash:[3,3],pointRadius:2}));
  sets.push(ds('CUB/SC',PERKEY.map((k,i)=>i===0?100:(cubMap[k]?100*cubMap[k]/cubIni:(i===LAST?100*cubFim/cubIni:null))),css('--c-cub'),{borderDash:[2,4],pointRadius:3,spanGaps:true}));
  draw('chAcum',{type:'line',data:{labels:PER,datasets:sets},options:baseOpts(v=>'R$ '+Math.round(v))});
  const bars=['itapema','bc','brasil'].map(k=>({label:REG[k].nome,data:REG[k].var,backgroundColor:css(REG[k].cor),borderRadius:4}));
  bars.push({label:'CDI',data:varBCB('cdi'),backgroundColor:css('--c-cdi'),borderRadius:4});
  bars.push({label:'IPCA',data:varBCB('ipca'),backgroundColor:css('--c-ipca'),borderRadius:4});
  draw('chAnual',{type:'bar',data:{labels:labAnual,datasets:bars},options:baseOpts(p1)});
  draw('chM2',{type:'line',data:{labels:PER,datasets:Object.keys(CID).map(k=>ds(REG[k].nome,REG[k].m2,css(REG[k].cor),{pointRadius:3,borderWidth:k==='itapema'?3.5:2}))},options:baseOpts(v=>'R$ '+Math.round(v/1000)+' mil')});

  const cdiTot=idxBCB('cdi')[LAST]/100-1;
  const rk=[
    ...Object.keys(CID).map(k=>{const r=REG[k], i=fimDe(k), anos=mesesEntre(BASE,PERKEY[i])/12; return {n:r.nome,c:r.cor,tot:r.m2[i]/r.m2[0]-1,aa:Math.pow(r.m2[i]/r.m2[0],1/anos)-1,obs:L('até ','hasta ')+fmtCurto(PERKEY[i])};}),
    {n:'CDI (bruto)',c:'--c-cdi',tot:cdiTot},{n:L('CDI após IR (15%)','CDI neto (15% impuesto)'),c:'--c-cdi',tot:cdiTot*0.85},{n:L('Poupança','Caja de ahorro (poupança)'),c:'--c-poup',tot:pouPer()},{n:'IPCA',c:'--c-ipca',tot:idxBCB('ipca')[LAST]/100-1},
    {n:'CUB/SC',c:'--c-cub',tot:cubFim/cubIni-1,aa:Math.pow(cubFim/cubIni,12/mesesEntre(CUB.inicio.mes,cubFimKey))-1,obs:`${fmtCurto(CUB.inicio.mes)} a ${fmtCurto(cubFimKey)}`},
  ].map(r=>({obs:L('até ','hasta ')+fmtCurto(LASTKEY),...r,aa:r.aa??Math.pow(1+r.tot,1/anosPer)-1})).sort((a,b)=>b.aa-a.aa);
  $('tblRank').innerHTML=`<thead><tr><th>#</th><th style="text-align:left">${L('Investimento / índice','Inversión / índice')}</th><th>${L('Acumulado','Acumulado')}</th><th>${L('Média ao ano','Promedio anual')}</th><th>${L('R$ 100 viraram','R$ 100 se volvieron')}</th><th>${L('Período','Período')}</th></tr></thead><tbody>`+
    rk.map((r,i)=>`<tr><td>${i+1}º</td><td style="text-align:left"><span class="dot" style="background:var(${r.c})"></span>${r.n}</td><td>${pct(r.tot,1)}</td><td><b>${pct(r.aa,1)}</b></td><td>R$ ${Math.round(100*(1+r.tot))}</td><td>${r.obs}</td></tr>`).join('')+
    `</tbody><caption class="note">${L('Imóveis: só a valorização do preço, sem somar o aluguel. Poupança pela regra atual (0,5% ao mês + TR com Selic acima de 8,5%, ou 70% da Selic abaixo disso).','Inmuebles: solo la valorización del precio, sin sumar el alquiler. Poupança según la regla actual (0,5% mensual + TR con Selic arriba de 8,5%, o 70% de la Selic por debajo).')}</caption>`;
  draw('chCub',{type:'line',data:{labels:CUB.serie.map(x=>fmtCurto(x[0])),datasets:[ds('CUB/SC',CUB.serie.map(x=>x[1]),css('--c-cub'),{fill:true,backgroundColor:css('--c-cub')+'26',borderWidth:3})]},
    options:baseOpts(v=>'R$ '+v.toLocaleString('pt-BR',{maximumFractionDigits:0}),{plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>brl2(c.parsed.y)}}}})});
  $('cubRef').textContent=L(`R$/m², valores de ${CUB.padroes.ref}`,`R$/m², valores de ${CUB.padroes.ref.replace('maio','mayo')}`);
  const tipoES={'Casa térrea, padrão normal':'Casa de una planta, estándar normal','Prédio 8 pav., padrão normal':'Edificio 8 pisos, estándar normal','Prédio 16 pav., padrão normal':'Edificio 16 pisos, estándar normal','Casa, alto padrão':'Casa, alto estándar','Prédio 8 pav., alto padrão':'Edificio 8 pisos, alto estándar','Prédio 16 pav., alto padrão':'Edificio 16 pisos, alto estándar'};
  $('tblCubPad').innerHTML=`<thead><tr><th>${L('Padrão','Tipo')}</th><th style="text-align:left">${L('Tipo','Descripción')}</th><th>R$/m²</th></tr></thead><tbody>`+CUB.padroes.itens.map(([c,d,v])=>`<tr><td><b>${c}</b></td><td style="text-align:left">${ES?(tipoES[d]||d):d}</td><td>${brl2(v)}</td></tr>`).join('')+'</tbody>';
  $('cubCallout').innerHTML=L(`Construir um prédio alto padrão (R8-A) custa <b>${brl2(r8)}/m²</b> só de obra, sem terreno, projeto, elevador, impostos e lucro do incorporador. O m² médio vendido em Itapema é <b>${brl(it[LAST])}</b>.`,`Construir un edificio de alto estándar (R8-A) cuesta <b>${brl2(r8)}/m²</b> solo de obra, sin terreno, proyecto, ascensor, impuestos ni ganancia del desarrollador. El m² medio vendido en Itapema es <b>${brl(it[LAST])}</b>.`);
  const cr=k=>POP[k][1][1]/POP[k][1][0]-1;
  $('popKpis').innerHTML=['portobelo','bombinhas','itapema'].map(k=>`<div class="kpi"><div class="lb">${POP[k][0]}</div><div class="v">+${pct(cr(k),0)}</div><div class="n">${POP[k][1][0].toLocaleString('pt-BR')} → ${POP[k][1][1].toLocaleString('pt-BR')} ${L('moradores (2010 → 2022). Estimativa 2025:','habitantes (2010 → 2022). Estimación 2025:')} ${POP[k][1][2].toLocaleString('pt-BR')}</div></div>`).join('')+
    `<div class="kpi"><div class="lb">${L('Para comparar','Para comparar')}</div><div class="v" style="color:var(--muted)">+${pct(cr('br'),1)}</div><div class="n">${L('Brasil no mesmo período. Santa Catarina:','Brasil en el mismo período. Santa Catarina:')} +${pct(cr('sc'),1)}</div></div>`;
  draw('chPop',{type:'bar',data:{labels:['Itapema','Porto Belo','Bombinhas'],datasets:[['2010','--c-brasil'],['2022','--c-floripa'],['2025 (estim.)','--c-itapema']].map(([l,c],i)=>({label:l,data:['itapema','portobelo','bombinhas'].map(k=>POP[k][1][i]),backgroundColor:css(c),borderRadius:4}))},options:baseOpts(v=>Math.round(v/1000)+' mil')});
  draw('chPopCresc',{type:'bar',data:{labels:Object.values(POP).map(p=>p[0]),datasets:[{label:L('Crescimento 2010–2022','Crecimiento 2010–2022'),data:Object.keys(POP).map(k=>100*cr(k)),backgroundColor:Object.values(POP).map(p=>css(p[2])),borderRadius:4}]},
    options:baseOpts(p1,{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>'+'+p1(c.parsed.x)}}},scales:{x:{ticks:{color:css('--muted'),callback:v=>v+'%'},grid:{color:css('--line')}},y:{ticks:{color:css('--ink')},grid:{display:false}}}})});
}

/* ---------- simulador ---------- */
let viewAuto=false, resAberto=null; // qual cenário os resultados mostram; resultados fechados até o clique
function premissas(){ return viewAuto ? autoP() : premissasSeu(); }
function premissasSeu(){
  return {valor:num('valor'),entrada:Math.min(num('entrada'),num('valor')),custos:$('incEscritura').checked?num('custos')/100:0,mob:$('incMobilia').checked?SITE_CONFIG.mobiliaPadraoPct/100:0,juros:num('juros')/100,prazo:Math.max(1,Math.round(num('prazo'))),
    sistema:$('sistema').value,modo:$('modo').value,aluguel:num('aluguel'),reaj:num('reajAluguel')/100,vac:num('vacancia')/100,
    dA:num('diariaAlta'),oA:num('ocupAlta')/100,mA:Math.min(12,Math.max(0,Math.round(num('mesesAlta')))),dB:num('diariaBaixa'),oB:num('ocupBaixa')/100,
    adm:num('adm')/100,desp:num('desp'),irAl:num('irAluguel')/100,
    valoriz:num('valoriz')/100,anos:Math.min(35,Math.max(1,Math.round(num('anos')))),corr:num('corretagem')/100,isento:$('isento180').checked,desc:0,
    cdi:num('cdi')/100,pctCdi:num('pctCdi')/100,poup:num('poup')/100,ipca:num('ipca')/100,spread:num('spread')/100};
}
const DIAS_MES=30.4;
const ehAlta=(mes0,n)=>n>0&&(mes0===11||mes0<n-1);
function rendaMes(p,m){
  if(p.modo==='nenhum') return 0;
  if(p.modo!=='temporada') return p.aluguel*(1-p.vac);
  return ehAlta((m-1)%12,p.mA) ? p.dA*p.oA*DIAS_MES : p.dB*p.oB*DIAS_MES;
}
const rendaAno1=p=>{let s=0; for(let m=1;m<=12;m++) s+=rendaMes(p,m); return s;};
// p.desc: desconto à vista sobre o preço; o valor de mercado (base da valorização) continua p.valor
function simular(p){
  const N=p.anos*12, iFin=mensal(p.juros), preco=p.valor*(1-(p.desc||0)), entrada=Math.min(p.entrada,preco), P0=preco-entrada, custoCompra=preco*p.custos, mobilia=preco*(p.mob||0), C0=entrada+custoCompra+mobilia;
  const pmt=P0>0?P0*iFin/(1-Math.pow(1+iFin,-p.prazo)):0;
  const rCdb=mensal(p.cdi*p.pctCdi), rCaixa=mensal(p.cdi*0.85), rPoup=mensal(p.poup), rIpca=mensal((1+p.ipca)*(1+p.spread)-1);
  let saldo=P0, caixa=0, aportes=0; const alt={cdb:C0,poup:C0,ipca:C0};
  const fluxos=[-C0], aport=[0], anual=[], ano1={aluguel:0,adm:0,ir:0,desp:0,parcela:0,juros:0};
  const liq=m=>{const vI=p.valor*Math.pow(1+p.valoriz,m/12), venda=vI*(1-p.corr), g=irGanhoPF(venda,preco+custoCompra,m,p.isento), inv=C0+aportes, a=irRegressivo(m);
    return {imovel:venda-saldo-g.ir+caixa,vI,venda,irVenda:g.ir,ganho:g,investido:inv,cdb:alt.cdb-Math.max(0,alt.cdb-inv)*a,poup:alt.poup,ipca:alt.ipca-Math.max(0,alt.ipca-inv)*a};};
  anual.push({ano:0,...liq(0)});
  for(let m=1;m<=N;m++){
    const y=Math.floor((m-1)/12), al=rendaMes(p,m)*Math.pow(1+p.reaj,y), adm=al*p.adm, ir=al*p.irAl, desp=p.desp*Math.pow(1+p.ipca,y);
    let parc=0,jur=0;
    if(saldo>0.005&&m<=p.prazo){jur=saldo*iFin; if(p.sistema==='SAC'){const am=P0/p.prazo; parc=am+jur; saldo-=am;} else {parc=pmt; saldo-=pmt-jur;} if(saldo<0) saldo=0;}
    const cf=al-adm-ir-desp-parc;
    if(m<=12){ano1.aluguel+=al;ano1.adm+=adm;ano1.ir+=ir;ano1.desp+=desp;ano1.parcela+=parc;ano1.juros+=jur;}
    caixa=caixa*(1+rCaixa)+Math.max(cf,0);
    const ap=Math.max(-cf,0); aportes+=ap; aport.push(ap);
    alt.cdb=alt.cdb*(1+rCdb)+ap; alt.poup=alt.poup*(1+rPoup)+ap; alt.ipca=alt.ipca*(1+rIpca)+ap;
    fluxos.push(cf);
    if(m%12===0) anual.push({ano:m/12,...liq(m)});
  }
  const fim=anual.at(-1);
  fluxos[N]+=fim.venda-saldo-fim.irVenda;
  return {p,preco,C0,P0,mobilia,custoCompra,fluxos,aport,anual,fim,ano1,aportes};
}
function tir(fl){
  const npv=r=>fl.reduce((s,c,t)=>s+c/Math.pow(1+r,t),0);
  let lo=-0.08, hi=0.2; if(npv(lo)*npv(hi)>0) return NaN;
  for(let k=0;k<200;k++){const mid=(lo+hi)/2; npv(lo)*npv(mid)<=0?hi=mid:lo=mid;}
  return Math.pow(1+(lo+hi)/2,12)-1;
}
const fluxAlt=(r,final)=>{const fl=r.aport.map((a,i)=>i===0?-r.C0:-a); fl[fl.length-1]+=final; return fl;};
function empate(p){
  const d=v=>{const r=simular({...p,valoriz:v}); return r.fim.imovel-r.fim.cdb;};
  let lo=-0.1,hi=0.3; if(d(lo)>0) return -Infinity; if(d(hi)<0) return Infinity;
  for(let k=0;k<50;k++){const m=(lo+hi)/2; d(m)<0?lo=m:hi=m;} return (lo+hi)/2;
}
let presetSel='mod';
function presets(){
  const lastDec=PERKEY.lastIndexOf(PERKEY.filter(k=>k.endsWith('-12')&&k!==LASTKEY).at(-1));
  const cons = LASTKEY.endsWith('-12') ? REG.itapema.var.at(-1)/100 : Math.pow(it[LAST]/it[lastDec],12/mesesEntre(PERKEY[lastDec],LASTKEY))-1;
  const i3=Math.max(0,PERKEY.indexOf(`${+LASTKEY.slice(0,4)-3}-12`));
  const P=[['cons','Conservador',cons],['mod','Moderado',Math.pow(REG.brasil.m2[fimDe('brasil')]/REG.brasil.m2[0],1/anosPer)-1],['oti',L('Otimista','Optimista'),Math.pow(it[LAST]/it[i3],12/mesesEntre(PERKEY[i3],LASTKEY))-1]];
  $('presets').innerHTML=P.map(([k,n,v])=>`<button type="button" data-v="${(v*100).toFixed(1)}" data-k="${k}" aria-pressed="${k===presetSel}">${n} ${p1(v*100)}</button>`).join('');
  return P;
}
const nomeAlt=(k,p)=>({imovel:L('Imóvel','Inmueble'),cdb:`CDB ${Math.round(p.pctCdi*100)}% ${L('do CDI','del CDI')}`,ipca:`${L('Tesouro','Tesoro')} IPCA+ ${p1(p.spread*100)}`,poup:L('Poupança','Caja de ahorro')})[k];
function renderSim(){
  const p=premissas(), r=simular(p), f=r.fim, T=tir(r.fluxos), inv=f.investido, roi=f.imovel/inv-1;
  const alts=[['imovel','--c-itapema'],['cdb','--c-cdi'],['ipca','--c-floripa'],['poup','--c-poup']].map(([k,c])=>({k,c,n:nomeAlt(k,p),v:f[k]}));
  const bruto1=p.modo==='temporada'?rendaAno1(p):p.modo==='nenhum'?0:p.aluguel*12;
  const best=alts.slice(1).reduce((a,b)=>b.v>a.v?b:a), ganha=f.imovel>=best.v, be=empate(p), yb=bruto1/p.valor;
  if(p.modo==='temporada'){ const alta=p.dA*p.oA*DIAS_MES, baixa=p.dB*p.oB*DIAS_MES;
    $('tempResumo').textContent=L(`Receita bruta: ${brl(alta)}/mês na alta e ${brl(baixa)}/mês no resto do ano. Total no 1º ano: ${brl(bruto1)} (média ${brl(bruto1/12)}/mês).`,`Ingreso bruto: ${brl(alta)}/mes en temporada alta y ${brl(baixa)}/mes el resto del año. Total del 1er año: ${brl(bruto1)} (promedio ${brl(bruto1/12)}/mes).`); }
  const noi=r.ano1.aluguel-r.ano1.adm-r.ano1.desp, cf1=r.fluxos.slice(1,13).reduce((a,b)=>a+b,0);
  const beTxt=isFinite(be)?L(`O imóvel empata com o CDB se valorizar <b>${pct(be,1)} ao ano</b>. Itapema fez ${pct(Math.pow(it[LAST]/it[0],1/anosPer)-1,1)} ao ano desde 2020.`,`El inmueble empata con el CDB si se valoriza <b>${pct(be,1)} al año</b>. Itapema hizo ${pct(Math.pow(it[LAST]/it[0],1/anosPer)-1,1)} anual desde 2020.`):(be<0?L('O imóvel supera o CDB mesmo sem valorização.','El inmueble supera al CDB incluso sin valorización.'):L('Nem com 30% ao ano de valorização o imóvel supera o CDB neste cenário.','Ni con 30% anual de valorización el inmueble supera al CDB en este escenario.'));
  $('verdict').className='verdict '+(ganha?'good':'bad');
  $('verdict').innerHTML=(ganha?L(`<b>Em ${p.anos} anos o imóvel rende mais: ${brl(f.imovel)} contra ${brl(best.v)} em ${best.n}.</b>`,`<b>En ${p.anos} años el inmueble rinde más: ${brl(f.imovel)} contra ${brl(best.v)} en ${best.n}.</b>`):L(`<b>Em ${p.anos} anos ${best.n} rende mais: ${brl(best.v)} contra ${brl(f.imovel)} no imóvel.</b>`,`<b>En ${p.anos} años ${best.n} rinde más: ${brl(best.v)} contra ${brl(f.imovel)} en el inmueble.</b>`))+`<span>${beTxt}</span>`;
  $('kpis').innerHTML=kpiHTML([[L('TIR do imóvel','TIR del inmueble'),isFinite(T)?pct(T):'—',L('retorno anual do seu dinheiro','retorno anual de su dinero')],['ROI total',pct(roi,1),L(`lucro de ${brl(f.imovel-inv)}`,`ganancia de ${brl(f.imovel-inv)}`)],[L('Desembolso total','Desembolso total'),brl(inv),L(`${brl(r.C0)} na compra + ${brl(r.aportes)} em aportes`,`${brl(r.C0)} en la compra + ${brl(r.aportes)} en aportes`)],
    [L('Yield bruto','Rentabilidad bruta'),pct(yb),L('aluguel anual ÷ valor','alquiler anual ÷ valor')],[L('Cap rate líquido','Cap rate neto'),pct(noi/p.valor),L('após ocupação, adm. e despesas','tras ocupación, adm. y gastos')],[L('Imóvel na venda','Inmueble en la venta'),brl(f.vI),L(`${pct(p.valoriz,1)} ao ano por ${p.anos} anos`,`${pct(p.valoriz,1)} anual por ${p.anos} años`)]]);
  renderVantagemCDI(p,f); renderTicket(p.valor);
  $('tblComp').innerHTML=`<thead><tr><th>${L('Alternativa','Alternativa')}</th><th>${L('Patrimônio final','Patrimonio final')}</th><th>${L('Lucro','Ganancia')}</th><th>${L('Retorno total','Retorno total')}</th><th>${L('Equivalente ao ano','Equivalente anual')}</th></tr></thead><tbody>`+
    alts.slice().sort((a,b)=>b.v-a.v).map(a=>{const l=a.v-inv, eq=a.k==='imovel'?T:tir(fluxAlt(r,a.v)); return `<tr><td><span class="dot" style="background:var(${a.c})"></span>${a.n}</td><td>${brl(a.v)}</td><td class="${l>=0?'pos':'neg'}">${brl(l)}</td><td>${pct(a.v/inv-1,1)}</td><td>${isFinite(eq)?pct(eq):'—'}</td></tr>`;}).join('')+'</tbody>';
  const hs=[5,10,15,20,25];
  $('tblGanho').innerHTML=`<thead><tr><th>${L('Vendendo em','Vendiendo en')}</th><th>${L('Lucro na venda','Ganancia en la venta')}</th><th>${L('Parte tributada','Parte gravada')}</th><th>${L('IR com a regra atual','Impuesto con la regla actual')}</th><th>${L('Se fosse 15% cheio','Si fuera 15% pleno')}</th><th>${L('Economia','Ahorro')}</th></tr></thead><tbody>`+
    hs.map(a=>{const rr=simular({...p,anos:a,isento:false}), g=rr.fim.ganho, cheio=g.ganho*0.15; return `<tr${a===p.anos?' class="sel"':''}><td>${a} ${L('anos','años')}</td><td>${brl(g.ganho)}</td><td>${pct(fatorReducao(a*12),0)}</td><td>${brl(g.ir)}</td><td>${brl(cheio)}</td><td class="pos">${brl(cheio-g.ir)}</td></tr>`;}).join('')+
    `</tbody><caption class="note">${p.isento?L('<b>Marcado: reinvestimento em até 180 dias.</b> Nesse caso o IR sobre o ganho é zero (Lei 11.196/2005, art. 39). ','<b>Marcado: reinversión dentro de 180 días.</b> En ese caso el impuesto sobre la ganancia es cero (Ley 11.196/2005, art. 39). '):''}${L('Fator de redução = 1 ÷ 1,0035 elevado ao número de meses com o imóvel. Lucro = venda menos corretagem, preço pago e custos de compra.','Factor de reducción = 1 ÷ 1,0035 elevado al número de meses con el inmueble. Ganancia = venta menos comisión, precio pagado y costos de compra.')}</caption>`;
  const vs=[-4,-2,0,2,4].map(d=>Math.round((p.valoriz+d/100)*1000)/1000);
  let h=`<thead><tr><th>${L('Valorização a.a.','Valorización anual')}</th>${hs.map(a=>`<th>${a} ${L('anos','años')}</th>`).join('')}</tr></thead><tbody>`;
  for(const vv of vs){ h+=`<tr><td>${pct(vv,1)}</td>`; for(const a of hs){const rr=simular({...p,valoriz:vv,anos:a}), t=tir(rr.fluxos), c=tir(fluxAlt(rr,rr.fim.cdb)); h+=`<td class="${t>=c?'hit':'miss'}${vv===Math.round(p.valoriz*1000)/1000&&a===p.anos?' base':''}">${isFinite(t)?pct(t,1):'—'}</td>`;} h+='</tr>'; }
  $('tblSens').innerHTML=h+'</tbody>';
  const a1=r.ano1, mm=x=>brl(x/12);
  $('tblFluxo').innerHTML=`<tbody><tr><td>${p.modo==='temporada'?L('Diárias recebidas (com ocupação)','Diarias cobradas (con ocupación)'):L('Aluguel recebido (com vacância)','Alquiler cobrado (con vacancia)')}</td><td class="pos">${mm(a1.aluguel)}</td></tr><tr><td>${L('Administração / plataforma','Administración / plataforma')}</td><td class="neg">−${mm(a1.adm)}</td></tr><tr><td>${L('IR sobre aluguel','Impuesto sobre el alquiler')}</td><td class="neg">−${mm(a1.ir)}</td></tr><tr><td>${L('Despesas do proprietário','Gastos del propietario')}</td><td class="neg">−${mm(a1.desp)}</td></tr><tr><td>${L('Parcela do financiamento','Cuota de la financiación')}</td><td class="neg">−${mm(a1.parcela)}</td></tr><tr><td><b>${L('Sobra (ou aporte) por mês','Sobrante (o aporte) por mes')}</b></td><td class="${cf1>=0?'pos':'neg'}"><b>${mm(cf1)}</b></td></tr><tr><td>${L('dos quais juros pagos ao banco','de los cuales intereses al banco')}</td><td>${mm(a1.juros)}</td></tr></tbody>`;
  const sets=alts.map(a=>ds(a.n,r.anual.map(x=>x[a.k]),css(a.c),a.k==='imovel'?{borderWidth:3.5}:{}));
  sets.push(ds(L('Dinheiro investido','Dinero invertido'),r.anual.map(x=>x.investido),css('--muted'),{borderDash:[5,4],borderWidth:1.5}));
  draw('chEvol',{type:'line',data:{labels:r.anual.map(x=>L('Ano ','Año ')+x.ano),datasets:sets},options:baseOpts(brlK,{animation:false})});
  const rendaTxt=p.modo==='nenhum'?L('Perfil: apenas valorização (sem aluguel)','Perfil: solo valorización (sin alquiler)'):p.modo==='temporada'?L(`Temporada: diária ${brl(p.dA)} na alta (${p.mA} meses, ${Math.round(p.oA*100)}% ocupação) e ${brl(p.dB)} no resto do ano (${Math.round(p.oB*100)}%)\nReceita bruta do 1º ano: ${brl(bruto1)} (${pct(yb)} sobre o valor do imóvel)`,`Temporada: diaria ${brl(p.dA)} en temporada alta (${p.mA} meses, ${Math.round(p.oA*100)}% ocupación) y ${brl(p.dB)} el resto del año (${Math.round(p.oB*100)}%)\nIngreso bruto del 1er año: ${brl(bruto1)} (${pct(yb)} sobre el valor del inmueble)`):L(`Aluguel: ${brl(p.aluguel)}/mês (${pct(yb)} ao ano sobre o valor)`,`Alquiler: ${brl(p.aluguel)}/mes (${pct(yb)} anual sobre el valor)`);
  $('resumo').value=L(`Simulação de investimento – Costa Esmeralda (SC)
Imóvel: ${brl(p.valor)} | Entrada: ${brl(p.entrada)}${r.P0>0?` | Financiado: ${brl(r.P0)} (${pct(p.juros,1)} a.a., ${p.prazo} meses, ${p.sistema})`:' (à vista)'}
${rendaTxt}${r.custoCompra>0?`\nCustos de escritura (ITBI + registro): ${brl(r.custoCompra)}`:''}${r.mobilia>0?`\nMobília e decoração: ${brl(r.mobilia)}`:''}
Valorização considerada: ${pct(p.valoriz,1)} ao ano

Em ${p.anos} anos, colocando ${brl(inv)} do próprio bolso:
- Imóvel: ${brl(f.imovel)} (retorno de ${isFinite(T)?pct(T):'—'} ao ano)
- ${nomeAlt('cdb',p)}: ${brl(f.cdb)}
- ${nomeAlt('ipca',p)}: ${brl(f.ipca)}
- Poupança: ${brl(f.poup)}
Valores líquidos de IR (com fator de redução), corretagem e saldo devedor.

Histórico real (dez/2020 a ${fmtMes(LASTKEY)}):
- m² em Itapema: ${brl(it[0])} → ${brl(it[LAST])} (+${pct(it[LAST]/it[0]-1,0)}) – FipeZap
- CDI no período: +${pct(idxBCB('cdi')[LAST]/100-1,0)} (bruto) | IPCA: +${pct(idxBCB('ipca')[LAST]/100-1,0)} – Banco Central
- CUB/SC hoje: ${brl2(cubFim)}/m² (+${p1(CUB.v12m)} em 12 meses) – Sinduscon
Selic hoje: ${p1(D.bcb.selicMeta)}.
Simulação ilustrativa. Rentabilidade passada não garante rentabilidade futura.`,
`Simulación de inversión – Costa Esmeralda (SC, Brasil)
Inmueble: ${brl(p.valor)} | Anticipo: ${brl(p.entrada)}${r.P0>0?` | Financiado: ${brl(r.P0)} (${pct(p.juros,1)} anual, ${p.prazo} meses, ${p.sistema})`:' (al contado)'}
${rendaTxt}${r.custoCompra>0?`\nCostos de escritura (ITBI + registro): ${brl(r.custoCompra)}`:''}${r.mobilia>0?`\nMuebles y decoración: ${brl(r.mobilia)}`:''}
Valorización considerada: ${pct(p.valoriz,1)} anual

En ${p.anos} años, poniendo ${brl(inv)} de su bolsillo:
- Inmueble: ${brl(f.imovel)} (retorno de ${isFinite(T)?pct(T):'—'} anual)
- ${nomeAlt('cdb',p)}: ${brl(f.cdb)}
- ${nomeAlt('ipca',p)}: ${brl(f.ipca)}
- Caja de ahorro: ${brl(f.poup)}
Valores netos de impuestos (con factor de reducción), comisión y saldo de deuda.

Historia real (dic/2020 a ${fmtMes(LASTKEY)}):
- m² en Itapema: ${brl(it[0])} → ${brl(it[LAST])} (+${pct(it[LAST]/it[0]-1,0)}) – FipeZap
- CDI en el período: +${pct(idxBCB('cdi')[LAST]/100-1,0)} (bruto) | IPCA: +${pct(idxBCB('ipca')[LAST]/100-1,0)} – Banco Central de Brasil
- CUB/SC hoy: ${brl2(cubFim)}/m² (+${p1(CUB.v12m)} en 12 meses) – Sinduscon
Tasa Selic hoy: ${p1(D.bcb.selicMeta)}.
Simulación ilustrativa. Rentabilidad pasada no garantiza rentabilidad futura.`)+`\n\n${L('Veja a simulação completa:','Vea la simulación completa:')} ${linkEstado()}\n${assinatura()}`;
  if(viewAuto) $('resumo').value=L('[Cenário de mercado: premissas automáticas do site com dados de hoje]\n','[Escenario de mercado: supuestos automáticos del sitio con datos de hoy]\n')+$('resumo').value;
  const perfil={nenhum:L('apenas valorização','solo valorización'),anual:L('locação anual','alquiler anual'),temporada:L('temporada','temporada')}[p.modo];
  const finTxt=r.P0>0?L(`financiado em ${p.prazo} meses`,`financiado en ${p.prazo} meses`):L('à vista','al contado');
  ultimoResumoWA=L(`Olá ${CONTATO.primeiroNome}! Fiz uma simulação no site Investir na Costa Esmeralda:\n• Imóvel: ${brl(p.valor)}\n• Entrada: ${brl(p.entrada)} (${finTxt})\n• Perfil: ${perfil}\n• Horizonte: ${p.anos} anos\n• Retorno projetado: ${isFinite(T)?pct(T):'—'} ao ano (patrimônio final ${brl(f.imovel)} x ${brl(f.cdb)} no CDB)\nQuero conversar sobre isso.`,
    `¡Hola ${CONTATO.primeiroNome}! Hice una simulación en el sitio Invertir en la Costa Esmeralda:\n• Inmueble: ${brl(p.valor)}\n• Anticipo: ${brl(p.entrada)} (${finTxt})\n• Perfil: ${perfil}\n• Horizonte: ${p.anos} años\n• Retorno proyectado: ${isFinite(T)?pct(T):'—'} anual (patrimonio final ${brl(f.imovel)} x ${brl(f.cdb)} en el CDB)\nQuiero conversar sobre esto.`)+`\n${linkEstado()}`;
  atualizaWA();
}

/* ---------- investidor à vista ---------- */
function renderAvista(){
  const base=premissas(), d=(viewAuto?RM().descontoAvista:num('desconto'))/100;
  const pv={...base,entrada:Infinity,desc:d};
  const r=simular(pv), T=tir(r.fluxos), f=r.fim;
  const rendaLiq1=r.fluxos.slice(1,13).reduce((a,b)=>a+b,0)/12;
  let acc=0, pb=null; for(let m=1;m<=600;m++){ const y=Math.floor((m-1)/12), al=rendaMes(pv,m)*Math.pow(1+pv.reaj,y); acc+=al*(1-pv.adm-pv.irAl)-pv.desp*Math.pow(1+pv.ipca,y); if(acc>=r.C0){pb=m;break;} }
  $('avistaPrem').textContent=L(`Usa as premissas do Simulador: imóvel de ${brl(base.valor)}, ${base.modo==='temporada'?'aluguel por temporada':'aluguel anual'}, ${pct(base.valoriz,1)} de valorização ao ano, venda em ${base.anos} anos e CDI de ${pct(base.cdi,1)}.`,`Usa los supuestos del Simulador: inmueble de ${brl(base.valor)}, ${base.modo==='temporada'?'alquiler por temporada':'alquiler anual'}, ${pct(base.valoriz,1)} de valorización anual, venta en ${base.anos} años y CDI de ${pct(base.cdi,1)}.`);
  const ganha=f.imovel>=f.cdb;
  $('aVerdict').className='verdict '+(ganha?'good':'bad');
  $('aVerdict').innerHTML=L(`<b>Comprando à vista com ${pct(d,1)} de desconto, o imóvel coloca ${brl(rendaLiq1)} por mês no seu bolso já no 1º ano.</b><span>Em ${base.anos} anos: ${brl(f.imovel)} no imóvel contra ${brl(f.cdb)} no CDB, retorno de ${isFinite(T)?pct(T):'—'} ao ano.</span>`,`<b>Comprando al contado con ${pct(d,1)} de descuento, el inmueble pone ${brl(rendaLiq1)} por mes en su bolsillo ya en el 1er año.</b><span>En ${base.anos} años: ${brl(f.imovel)} en el inmueble contra ${brl(f.cdb)} en el CDB, retorno de ${isFinite(T)?pct(T):'—'} anual.</span>`);
  $('aKpis').innerHTML=kpiHTML([
    [L('Preço à vista','Precio al contado'),brl(r.preco),L(`${brl(base.valor-r.preco)} de desconto`,`${brl(base.valor-r.preco)} de descuento`)],
    [L('Renda líquida por mês','Renta neta por mes'),brl(rendaLiq1),L('1º ano, após taxas, IR e despesas','1er año, tras comisiones, impuesto y gastos'),'up'],
    // ganho médio por mês no horizonte, os dois lados com tudo incluído e líquido (IR, corretagem, despesas)
    ...(()=>{ const meses=base.anos*12, gI=(f.imovel-f.investido)/meses, gC=(f.cdb-f.investido)/meses;
      return [[L('Ganho médio por mês','Ganancia media por mes'),brl(gI),L(`em ${base.anos} anos, aluguel + valorização, líquido · no CDB: ${brl(gC)}/mês`,`en ${base.anos} años, alquiler + valorización, neto · en el CDB: ${brl(gC)}/mes`),gI>=gC?'up':'']]; })(),
    [L('Renda líquida ao ano','Renta neta anual'),pct(rendaLiq1*12/r.C0),L('sobre o total desembolsado','sobre el total desembolsado')],
    [L('O aluguel paga o imóvel em','El alquiler paga el inmueble en'),pb?(pb/12).toLocaleString('pt-BR',{maximumFractionDigits:1})+L(' anos',' años'):'—',L('sem contar a valorização','sin contar la valorización')],
    ['TIR',isFinite(T)?pct(T):'—',L(`com venda em ${base.anos} anos`,`con venta en ${base.anos} años`)],
  ]);
  $('aDesc').innerHTML=`<thead><tr><th>${L('Desconto','Descuento')}</th><th>${L('Preço','Precio')}</th><th>TIR</th><th>${L('Patrimônio final','Patrimonio final')}</th></tr></thead><tbody>`+
    [0,0.05,0.10,0.15,0.20].map(x=>{const rr=simular({...pv,desc:x}), t=tir(rr.fluxos); return `<tr${Math.abs(x-d)<1e-9?' class="sel"':''}><td>${pct(x,0)}</td><td>${brl(rr.preco)}</td><td><b>${isFinite(t)?pct(t,2):'—'}</b></td><td>${brl(rr.fim.imovel)}</td></tr>`;}).join('')+
    `</tbody><caption class="note">${L('Cada ponto de desconto entra direto no seu retorno: o imóvel continua valendo o preço de mercado.','Cada punto de descuento entra directo en su retorno: el inmueble sigue valiendo el precio de mercado.')}</caption>`;
  const rf=simular({...base,desc:0}), Tf=tir(rf.fluxos), ra=simular({...pv,desc:0}), Ta=tir(ra.fluxos);
  const linha=(n,a,b)=>`<tr><td>${n}</td><td>${a}</td><td>${b}</td></tr>`;
  $('aFin').innerHTML=`<thead><tr><th></th><th>${L('À vista','Al contado')}</th><th>${L('Financiado','Financiado')}</th></tr></thead><tbody>`+
    linha(L('Desembolso total','Desembolso total'),brl(ra.fim.investido),brl(rf.fim.investido))+
    linha(L('Patrimônio final','Patrimonio final'),brl(ra.fim.imovel),brl(rf.fim.imovel))+
    linha(L('Lucro','Ganancia'),brl(ra.fim.imovel-ra.fim.investido),brl(rf.fim.imovel-rf.fim.investido))+
    linha('ROI',pct(ra.fim.imovel/ra.fim.investido-1,1),pct(rf.fim.imovel/rf.fim.investido-1,1))+
    linha('TIR',isFinite(Ta)?pct(Ta):'—',isFinite(Tf)?pct(Tf):'—')+
    `</tbody><caption class="note">${L(`Sem desconto, nos dois casos. Financiado: entrada de ${brl(base.entrada)} e juros de ${pct(base.juros,1)} ao ano (ajuste no Simulador). Quando os juros do financiamento são maiores que o retorno do imóvel, comprar à vista rende mais.`,`Sin descuento, en ambos casos. Financiado: anticipo de ${brl(base.entrada)} e interés de ${pct(base.juros,1)} anual (ajuste en el Simulador). Cuando el interés de la financiación supera el retorno del inmueble, comprar al contado rinde más.`)}</caption>`;
  const u=PERKEY.map((k,i)=>{const x=usdEm(k); return x&&it[i]?it[i]/x:null;});
  const u0=usdEm(BASE), u1=usdEm(LASTKEY);
  if(u0&&u1){
    $('usdKpis').innerHTML=kpiHTML([[L('m² em Itapema hoje','m² en Itapema hoy'),usd(u.at(-1)),`PTAX ${fmtMes(LASTKEY)}: R$ ${u1.toLocaleString('pt-BR',{minimumFractionDigits:2})}`],[L('Em dólar desde dez/2020','En dólares desde dic/2020'),'+'+pct(u.at(-1)/u[0]-1,0),`${usd(u[0])} → ${usd(u.at(-1))}`,'up'],[L('Variação do dólar','Variación del dólar'),pct(u1/u0-1,1),L('no mesmo período','en el mismo período')]]);
    draw('chUsd',{type:'line',data:{labels:PER,datasets:[ds(L('m² em Itapema (US$)','m² en Itapema (US$)'),u,css('--c-itapema'),{borderWidth:3.5,pointRadius:3,fill:true,backgroundColor:css('--c-itapema')+'22'})]},options:baseOpts(v=>usd(v),{plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>usd(c.parsed.y)}}}})});
  }
  ultimoResumoWA=L(`Olá ${CONTATO.primeiroNome}! Vi no site o painel do investidor à vista: imóvel de ${brl(base.valor)} com ${pct(d,1)} de desconto, renda líquida de ${brl(rendaLiq1)} por mês. Quero conversar.`,`¡Hola ${CONTATO.primeiroNome}! Vi en el sitio el panel del inversor al contado: inmueble de ${brl(base.valor)} con ${pct(d,1)} de descuento, renta neta de ${brl(rendaLiq1)} por mes. Quiero conversar.`)+`\n${linkEstado()}`;
  atualizaWA();
}

/* ---------- na planta ---------- */
function simPlanta(g=num){
  const V=g('pValor'), N=Math.min(72,Math.max(6,Math.round(g('pObra')))), e=g('pEntrada')/100, ms=g('pMensais')/100, rf=g('pReforcos')/100;
  const ch=Math.max(0,1-e-ms-rf), c=mensal(g('pCorrecao')/100), v=g('pValoriz')/100, corr=g('pCorretagem')/100, rCdi=mensal(g('pCdi')/100);
  const nRef=Math.max(1,Math.floor(N/12)), fat=t=>Math.pow(1+c,t);
  const pag=new Array(N+1).fill(0), tipo={ato:V*e,mensalIni:V*ms/N*fat(1),mensalFim:V*ms/N*fat(N),reforcos:[]};
  pag[0]+=V*e;
  for(let t=1;t<=N;t++) pag[t]+=V*ms/N*fat(t);
  for(let k=1;k<=nRef;k++){ const t=Math.min(N,12*k); pag[t]+=V*rf/nRef*fat(t); tipo.reforcos.push([t,V*rf/nRef*fat(t)]); }
  const saldoChaves=V*ch*fat(N);
  const M=g('pMercado')||V, vm=t=>M*Math.pow(1+v,t/12);
  const totalPago=pag.reduce((a,b)=>a+b,0);
  const venda=vm(N)*(1-corr), ir=irGanhoPF(venda,totalPago+saldoChaves,N).ir;
  const liquido=venda-saldoChaves-ir, lucro=liquido-totalPago;
  let cdb=0, acc=0; const serie=[];
  for(let t=0;t<=N;t++){ cdb=cdb*(1+rCdi)+pag[t]; acc+=pag[t]; serie.push({t,vm:vm(t),pago:acc,cdb}); }
  const cdbLiq=cdb-Math.max(0,cdb-totalPago)*irRegressivo(N);
  const fl=pag.map(x=>-x); fl[N]+=liquido;
  return {V,M,N,e,ms,rf,ch,nRef,tipo,saldoChaves,totalPago,venda,ir,liquido,lucro,roi:lucro/totalPago,tir:tir(fl),cdbLiq,serie,vmN:vm(N),patrimonio:vm(N)-saldoChaves};
}
function renderPlanta(){
  const gP=viewAuto?autoPlantaG():num, r=simPlanta(gP), soma=r.e+r.ms+r.rf;
  $('pCorrHint').textContent=L(`CUB/SC subiu ${p1(CUB.v12m)} em 12 meses`,`El CUB/SC subió ${p1(CUB.v12m)} en 12 meses`);
  $('pChavesTxt').innerHTML = soma>1 ? `<span class="neg">${L('Entrada + mensais + reforços passam de 100%. Ajuste os percentuais.','Anticipo + cuotas + refuerzos superan el 100%. Ajuste los porcentajes.')}</span>` : L(`Saldo nas chaves: <b>${pct(r.ch,0)}</b> do valor (${brl(r.saldoChaves)} já corrigido), pago com financiamento ou pelo comprador.`,`Saldo a la entrega: <b>${pct(r.ch,0)}</b> del valor (${brl(r.saldoChaves)} ya ajustado), pagado con financiación o por el comprador.`);
  const ganha=r.liquido>r.cdbLiq, mult=r.lucro/(r.cdbLiq-r.totalPago);
  $('pVerdict').className='verdict '+(ganha?'good':'bad');
  $('pVerdict').innerHTML=ganha?L(`<b>Vendendo na entrega das chaves, o lucro é de ${brl(r.lucro)} sobre ${brl(r.totalPago)} pagos.</b>`,`<b>Vendiendo a la entrega, la ganancia es de ${brl(r.lucro)} sobre ${brl(r.totalPago)} pagados.</b>`)+`<span>${isFinite(mult)&&mult>1?L(`É ${mult.toLocaleString('pt-BR',{maximumFractionDigits:1})}× o lucro que o mesmo dinheiro daria no CDB (${brl(r.cdbLiq-r.totalPago)}).`,`Es ${mult.toLocaleString('pt-BR',{maximumFractionDigits:1})}× la ganancia que el mismo dinero daría en el CDB (${brl(r.cdbLiq-r.totalPago)}).`):L(`O CDB com os mesmos pagamentos daria ${brl(r.cdbLiq-r.totalPago)} de lucro.`,`El CDB con los mismos pagos daría ${brl(r.cdbLiq-r.totalPago)} de ganancia.`)}</span>`
    :L(`<b>Neste cenário o CDB rende mais: ${brl(r.cdbLiq-r.totalPago)} contra ${brl(r.lucro)} no imóvel.</b>`,`<b>En este escenario el CDB rinde más: ${brl(r.cdbLiq-r.totalPago)} contra ${brl(r.lucro)} en el inmueble.</b>`)+`<span>${r.M===r.V?L('Informe o preço de um imóvel pronto parecido: se a tabela do lançamento é mais barata, essa diferença vira ganho na entrega.','Informe el precio de un inmueble terminado similar: si la lista del lanzamiento es más barata, esa diferencia se vuelve ganancia a la entrega.'):L('A valorização esperada não cobre a correção das parcelas neste cenário.','La valorización esperada no cubre el ajuste de las cuotas en este escenario.')}</span>`;
  $('pKpis').innerHTML=kpiHTML([[L('Você paga até as chaves','Usted paga hasta la entrega'),brl(r.totalPago),L(`em ${r.N} meses, já corrigido`,`en ${r.N} meses, ya ajustado`)],[L('Valor na entrega','Valor a la entrega'),brl(r.vmN),L(`${pct(gP('pValoriz')/100,1)} ao ano de valorização`,`${pct(gP('pValoriz')/100,1)} anual de valorización`)],[L('Lucro na venda','Ganancia en la venta'),brl(r.lucro),L('após saldo, corretagem e IR','tras saldo, comisión e impuesto')],
    [L('ROI sobre o que pagou','ROI sobre lo pagado'),pct(r.roi,1),L('retorno total','retorno total')],['TIR',isFinite(r.tir)?pct(r.tir):'—',L('retorno ao ano','retorno anual')],[L('Se ficar com o imóvel','Si se queda con el inmueble'),brl(r.patrimonio),L('valor menos o saldo das chaves','valor menos el saldo a la entrega')]]);
  renderAlavancagem(r);
  $('pTbl').innerHTML=`<tbody>${r.M!==r.V?`<tr><td>${r.M>r.V?L('Tabela abaixo do pronto parecido','Lista por debajo del terminado similar'):L('Tabela acima do pronto parecido','Lista por encima del terminado similar')}</td><td class="${r.M>r.V?'pos':'neg'}">${pct(Math.abs(1-r.V/r.M),1)}</td></tr>`:''}<tr><td>${L('Valor de venda na entrega','Valor de venta a la entrega')}</td><td>${brl(r.vmN)}</td></tr><tr><td>${L('Corretagem','Comisión')}</td><td class="neg">−${brl(r.vmN-r.venda)}</td></tr><tr><td>${L('Saldo devedor nas chaves','Saldo a la entrega')}</td><td class="neg">−${brl(r.saldoChaves)}</td></tr><tr><td>${L('IR sobre o ganho (com fator de redução)','Impuesto sobre la ganancia (con factor de reducción)')}</td><td class="neg">−${brl(r.ir)}</td></tr>
    <tr><td><b>${L('Você recebe','Usted recibe')}</b></td><td><b>${brl(r.liquido)}</b></td></tr><tr><td>${L('Você pagou','Usted pagó')}</td><td>${brl(r.totalPago)}</td></tr><tr><td><b>${L('Lucro','Ganancia')}</b></td><td class="${r.lucro>=0?'pos':'neg'}"><b>${brl(r.lucro)}</b></td></tr><tr><td>${L('Mesmo dinheiro no CDB (líquido)','El mismo dinero en el CDB (neto)')}</td><td>${brl(r.cdbLiq)}</td></tr></tbody>`;
  $('pCron').innerHTML=`<thead><tr><th>${L('Parcela','Cuota')}</th><th>${L('Qtd.','Cant.')}</th><th>${L('Valor','Valor')}</th></tr></thead><tbody><tr><td>${L('Entrada (ato)','Anticipo (firma)')}</td><td>1</td><td>${brl(r.tipo.ato)}</td></tr>
    <tr><td>${L('Mensais','Mensuales')}</td><td>${r.N}</td><td>${brl(r.tipo.mensalIni)} → ${brl(r.tipo.mensalFim)}</td></tr>
    <tr><td>${L('Reforços anuais','Refuerzos anuales')}</td><td>${r.nRef}</td><td>${brl(r.tipo.reforcos[0][1])} → ${brl(r.tipo.reforcos.at(-1)[1])}</td></tr>
    <tr><td>${L('Chaves','Entrega')}</td><td>1</td><td>${brl(r.saldoChaves)}</td></tr></tbody><caption class="note">${L('Valores corrigidos mês a mês pelo índice da obra.','Valores ajustados mes a mes por el índice de la obra.')}</caption>`;
  const lab=r.serie.map(x=>x.t===0?'Compra':x.t===r.N?L('Chaves','Entrega'):L('Mês ','Mes ')+x.t);
  draw('chPlanta',{type:'line',data:{labels:lab,datasets:[ds(L('Valor do imóvel','Valor del inmueble'),r.serie.map(x=>x.vm),css('--c-itapema'),{borderWidth:3.5}),ds(L('Quanto você já pagou','Cuánto ya pagó'),r.serie.map(x=>x.pago),css('--c-bc'),{stepped:true,tension:0}),ds(L('Mesmos pagamentos no CDB','Los mismos pagos en el CDB'),r.serie.map(x=>x.cdb),css('--c-cdi'),{borderDash:[6,4]})]},options:baseOpts(brlK,{animation:false})});
  ultimoResumoWA=L(`Olá ${CONTATO.primeiroNome}! Vi a simulação de imóvel na planta no site: tabela ${brl(r.V)}, entrega em ${r.N} meses, lucro estimado de ${brl(r.lucro)} na entrega. Quero conversar sobre isso.`,`¡Hola ${CONTATO.primeiroNome}! Vi la simulación de inmueble en pozo en el sitio: lista ${brl(r.V)}, entrega en ${r.N} meses, ganancia estimada de ${brl(r.lucro)} a la entrega. Quiero conversar.`)+`\n${linkEstado()}`;
  atualizaWA();
}

/* ---------- PF x Holding ---------- */
// Holding no lucro presumido com receita até R$ 5 mi/ano (acima disso a LC 224/2025 aumenta a presunção em 10%).
const PISCOFINS=0.0365, PRES_ALUGUEL=0.32, VENDA_ESTOQUE=PISCOFINS+0.08*0.15+0.08*0.10+0.12*0.09; // ~6,73%
function simHolding(g=num){
  const V=g('hValor'), Q=Math.max(1,Math.round(g('hQtd'))), A=g('hAluguel')*12, anos=Math.max(1,Math.round(g('hAnos'))), v=g('hValoriz')/100;
  const irPf=g('hIrPf')/100, honor=g('hHonor')/100, reg=$('hRegistro').value, socios=Math.max(1,Math.round(g('hSocios')));
  const abertura=g('hAbertura'), contab=g('hContab')*12, itbi=g('hItbi')/100;
  const reforma=$('hReforma').checked, distVenda=$('hDistVenda').checked, vende=$('hVende').checked, suc=$('hSucessao').checked;
  const ano0=new Date().getFullYear(), reaj=0.045;
  const pf={aluguel:0,venda:0,sucessao:0,custos:0}, hd={aluguel:0,venda:0,sucessao:0,custos:abertura+V*itbi};
  for(let y=0;y<anos;y++){
    const bruto=A*Math.pow(1+reaj,y), ano=ano0+1+y;
    pf.aluguel+=bruto*irPf;
    const pres=bruto*PRES_ALUGUEL;
    let t=pres*0.15+Math.max(0,pres-240000)*0.10+pres*0.09;
    t += (reforma&&ano>=2027) ? Math.max(0,bruto-600*12*Q)*0.08 : bruto*PISCOFINS;
    const dist=bruto-t-contab;
    if(dist/socios/12>50000) t+=dist*0.10;
    hd.aluguel+=t; hd.custos+=contab;
  }
  const vFim=V*Math.pow(1+v,anos);
  if(vende){
    const vl=vFim*0.94; // corretagem de 6%
    pf.venda=irGanhoPF(vl,V,anos*12).ir;
    let tv = reg==='estoque' ? vFim*VENDA_ESTOQUE : Math.max(0,vl-V)*0.34;
    const lucroDist=vl-tv-V; // o capital investido volta como redução de capital
    if(distVenda && (vl-tv)/socios>50000 && lucroDist>0) tv+=lucroDist*0.10;
    hd.venda=tv;
  }
  if(suc){
    const patr = vende ? vFim*0.94-pf.venda : vFim;
    pf.sucessao=itcmdSC(patr)+patr*honor;      // inventário no fim do período
    hd.sucessao=itcmdSC(V);                     // doação das cotas em vida, na criação da holding
  }
  const tot=o=>o.aluguel+o.venda+o.sucessao+o.custos;
  return {pf,hd,totPf:tot(pf),totHd:tot(hd),anos,vFim,V,A};
}
function renderHolding(){
  const r=simHolding(viewAuto?autoHoldingG():num), eco=r.totPf-r.totHd;
  $('hPeriodo').textContent=`${r.anos} ${L('anos','años')}`;
  $('hVerdict').className='verdict '+(eco>0?'good':'bad');
  $('hVerdict').innerHTML = eco>0
    ? L(`<b>A holding economiza ${brl(eco)} em ${r.anos} anos (${pct(eco/r.totPf,0)} a menos em impostos e custos).</b><span>Pessoa física: ${brl(r.totPf)} · Holding: ${brl(r.totHd)}</span>`,`<b>La holding ahorra ${brl(eco)} en ${r.anos} años (${pct(eco/r.totPf,0)} menos en impuestos y costos).</b><span>Persona física: ${brl(r.totPf)} · Holding: ${brl(r.totHd)}</span>`)
    : L(`<b>Neste cenário, ficar na pessoa física sai ${brl(-eco)} mais barato.</b><span>Holding costuma compensar com mais imóveis, aluguel maior ou quando a sucessão pesa. Pessoa física: ${brl(r.totPf)} · Holding: ${brl(r.totHd)}</span>`,`<b>En este escenario, quedarse como persona física sale ${brl(-eco)} más barato.</b><span>La holding suele compensar con más inmuebles, alquiler mayor o cuando la sucesión pesa. Persona física: ${brl(r.totPf)} · Holding: ${brl(r.totHd)}</span>`);
  const cats=[['aluguel',L('Impostos sobre o aluguel','Impuestos sobre el alquiler'),'--c-cdi'],['venda',L('Imposto na venda','Impuesto en la venta'),'--c-bc'],['sucessao',L('Sucessão (ITCMD + inventário)','Sucesión (ITCMD + sucesorio)'),'--c-floripa'],['custos',L('Custos da estrutura','Costos de la estructura'),'--c-brasil']];
  draw('chHolding',{type:'bar',data:{labels:[L('Pessoa física','Persona física'),'Holding'],datasets:cats.map(([k,n,c])=>({label:n,data:[r.pf[k],r.hd[k]],backgroundColor:css(c),borderRadius:4}))},
    options:baseOpts(brlK,{indexAxis:'y',plugins:{tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${brl(c.parsed.x)}`}},legend:{labels:{color:css('--ink'),boxWidth:10,boxHeight:10,usePointStyle:true}}},scales:{x:{stacked:true,ticks:{color:css('--muted'),callback:v=>brlK(v)},grid:{color:css('--line')}},y:{stacked:true,ticks:{color:css('--ink')},grid:{display:false}}}})});
  $('hTbl').innerHTML=`<thead><tr><th></th><th>${L('Pessoa física','Persona física')}</th><th>Holding</th><th>${L('Diferença','Diferencia')}</th></tr></thead><tbody>`+
    cats.map(([k,n])=>`<tr><td>${n}</td><td>${brl(r.pf[k])}</td><td>${brl(r.hd[k])}</td><td class="${r.pf[k]-r.hd[k]>=0?'pos':'neg'}">${brl(r.pf[k]-r.hd[k])}</td></tr>`).join('')+
    `<tr><td><b>Total</b></td><td><b>${brl(r.totPf)}</b></td><td><b>${brl(r.totHd)}</b></td><td class="${eco>=0?'pos':'neg'}"><b>${brl(eco)}</b></td></tr></tbody>`;
  const regras=L([
    'Aluguel na pessoa física: alíquota informada (carnê-leão chega a 27,5%).',
    'Aluguel na holding (lucro presumido): IRPJ 15% + CSLL 9% sobre 32% da receita, adicional de 10% do IRPJ acima de R$ 240 mil por ano de lucro presumido e PIS/COFINS 3,65%. Total de ~11,33% a ~14,53%.',
    'Reforma tributária (LC 214/2025): a partir de 2027, IBS/CBS de cerca de 8% sobre o aluguel (alíquota cheia com redução de 70%), com redutor social de R$ 600 por imóvel por mês, no lugar do PIS/COFINS. As alíquotas finais ainda serão fixadas.',
    'Dividendos (Lei 15.270/2025): desde 2026, retenção de 10% quando a holding paga mais de R$ 50 mil por mês ao mesmo sócio. Lucros entram no imposto mínimo de quem ganha mais de R$ 600 mil por ano (não simulado).',
    'Venda pela holding: imóvel em estoque paga ~6,73% sobre o valor de venda; imóvel como investimento paga 34% sobre o lucro. Pessoa física: 15% a 22,5% sobre o lucro, com fator de redução pelo tempo.',
    'Sucessão em SC: ITCMD de 1% a 7% por faixas (Lei 13.136/2004). Na holding, considera doação das cotas em vida, na criação. Na pessoa física, inventário no fim do período, sobre o valor da época.',
    'Não incluídos: imposto mínimo anual, IPTU, reformas e a liminar contra a LC 224/2025. Valores de abertura, contabilidade e advogado são estimativas: ajuste com orçamentos reais.'
  ],[
    'Alquiler como persona física: alícuota informada (llega a 27,5%).',
    'Alquiler en la holding (lucro presumido): IRPJ 15% + CSLL 9% sobre el 32% del ingreso, adicional de 10% del IRPJ por encima de R$ 240 mil por año de lucro presumido y PIS/COFINS 3,65%. Total de ~11,33% a ~14,53%.',
    'Reforma tributaria (LC 214/2025): desde 2027, IBS/CBS de cerca de 8% sobre el alquiler (alícuota plena con reducción de 70%), con reductor social de R$ 600 por inmueble por mes, en lugar del PIS/COFINS. Las alícuotas finales aún se fijarán.',
    'Dividendos (Ley 15.270/2025): desde 2026, retención de 10% cuando la holding paga más de R$ 50 mil por mes al mismo socio. Las utilidades entran en el impuesto mínimo de quien gana más de R$ 600 mil por año (no simulado).',
    'Venta por la holding: inmueble en stock paga ~6,73% sobre el valor de venta; inmueble como inversión paga 34% sobre la ganancia. Persona física: 15% a 22,5% sobre la ganancia, con factor de reducción por el tiempo.',
    'Sucesión en SC: ITCMD de 1% a 7% por tramos (Ley 13.136/2004). En la holding, considera donación de cuotas en vida, al crearla. Como persona física, sucesorio al final del período, sobre el valor de ese momento.',
    'No incluidos: impuesto mínimo anual, IPTU, reformas y la medida cautelar contra la LC 224/2025. Valores de apertura, contador y abogado son estimaciones: ajuste con presupuestos reales.'
  ]);
  $('hRegras').innerHTML=regras.map(x=>`<li>${x}</li>`).join('');
  ultimoResumoWA=L(`Olá ${CONTATO.primeiroNome}! Vi no site a comparação pessoa física x holding para ${brl(r.V)} em imóveis. Quero entender melhor.`,`¡Hola ${CONTATO.primeiroNome}! Vi en el sitio la comparación persona física x holding para ${brl(r.V)} en inmuebles. Quiero entender mejor.`)+`\n${linkEstado()}`;
  atualizaWA();
}

/* ---------- soja (Grão Direto, atualizado pelo robô todo dia útil) ---------- */
// Fethab soja (MT): 21,15% da UPF/MT por tonelada (10% Fethab + 10% adicional até 31/12/2026 + 1,15% entidade).
// UPF/MT 2026 = R$ 254,36 (Portaria 186/2025-SEFAZ) → R$ 53,80/t → R$ 3,23 por saca de 60 kg.
const UPF_MT=254.36, FETHAB_PCT=0.2115, FETHAB_SC=+(UPF_MT*FETHAB_PCT*0.06).toFixed(2);
const fmtDia = s => { const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; };
const fmtEntrega = e => e ? L('Entrega ','Entrega ')+NOMES_MES[+e.slice(5,7)-1]+'/'+e.slice(2,4) : L('Disponível','Disponible');
const sc = v => brl2(v)+'/sc';
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function limparTextos(o){ if(Array.isArray(o)) return o.map(limparTextos); if(o&&typeof o==='object'){ for(const k in o) o[k]=limparTextos(o[k]); return o; } return typeof o==='string'?esc(o):o; }
if(D.soja){ const mun=D.soja.municipios; delete D.soja.municipios; limparTextos(D.soja); D.soja.municipios=mun; } // nomes do IBGE vão por textContent/option
const UF_NOMES={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
const slugGD=n=>n.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const semAcento=n=>String(n).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
let selUF='MT', selNome='Comodoro', ofertaSel=null;
const detalhadas=()=>Object.values(D.soja?.cidades||{}).filter(c=>c.nome).sort((a,b)=>(a.ordem??99)-(b.ordem??99));
const ofertasLocais=c=>(c.ofertas||[]).filter(o=>o.cidade===c.nome);
const munUF=uf=>(D.soja?.municipios?.uf?.[uf])||[];
function infoCidade(uf,nome){
  const n=semAcento(nome), S0=D.soja;
  const det=detalhadas().find(c=>c.uf===uf&&semAcento(c.nome)===n);
  const est=S0.estados?.[uf]||{regioes:[],cidades:[]};
  const cot=est.cidades.find(c=>semAcento(c.nome)===n);
  const m=munUF(uf).find(x=>semAcento(x[0])===n);
  const meso=m?S0.municipios.mesos[m[1]]:(det?.regiao||null);
  const reg=meso?(est.regioes.find(r=>semAcento(r.nome)===semAcento(meso))||S0.regioes.find(r=>semAcento(r.nome)===semAcento(meso))):null;
  const hist=S0.historicoCidades?.[`${uf}|${cot?.nome}`]||[];
  return {uf,nome:m?m[0]:(det?.nome||nome),det,cot,meso,reg,est,hist,existe:!!m||!!det};
}
function spark(pts){
  if(!pts||pts.length<2) return '';
  const w=70,h=20,mn=Math.min(...pts),mx=Math.max(...pts),r=mx-mn||1;
  const d=pts.map((v,i)=>`${(i/(pts.length-1)*w).toFixed(1)},${(h-2-(v-mn)/r*(h-4)).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${d}" fill="none" stroke="${pts.at(-1)>=pts[0]?'var(--good)':'var(--bad)'}" stroke-width="1.6"/></svg>`;
}
function montarFiltroSoja(){
  const ufs=Object.keys(UF_NOMES);
  const comDado=uf=>{const e=D.soja.estados?.[uf]; return (e&&(e.regioes.length||e.cidades.length))||detalhadas().some(c=>c.uf===uf);};
  $('sUF').innerHTML=`<optgroup label="${L('Com cotação no Grão Direto','Con cotización en Grão Direto')}">`+ufs.filter(comDado).map(u=>`<option value="${u}">${UF_NOMES[u]}</option>`).join('')+
    `</optgroup><optgroup label="${L('Outros estados','Otros estados')}">`+ufs.filter(u=>!comDado(u)).map(u=>`<option value="${u}">${UF_NOMES[u]}</option>`).join('')+'</optgroup>';
  $('sUF').value=selUF;
  // datalist com todos os municípios do estado
  const dl=$('sListaCidades'); dl.replaceChildren(...munUF(selUF).map(x=>{const o=document.createElement('option'); o.value=x[0]; return o;}));
  $('sCidadeTxt').value=selNome;
  // atalhos: cidades com dados neste estado + Comodoro/Vilhena
  const e=D.soja.estados?.[selUF]||{cidades:[]};
  const nomes=[...new Set([...detalhadas().filter(c=>c.uf===selUF).map(c=>c.nome),...e.cidades.map(c=>c.nome)])];
  const fixos=[['MT','Comodoro'],['RO','Vilhena']].filter(([u])=>u!==selUF);
  $('sAtalhos').innerHTML=[...fixos.map(([u,n])=>`<button type="button" data-uf="${u}" data-n="${n}" aria-pressed="false">${n}/${u}</button>`),
    ...nomes.map(n=>`<button type="button" data-uf="${selUF}" data-n="${n}" aria-pressed="${semAcento(n)===semAcento(selNome)}">${n}</button>`)].join('');
  $('sAtalhosLb').textContent=nomes.length?L(`Cidades com dados em ${UF_NOMES[selUF]}:`,`Ciudades con datos en ${UF_NOMES[selUF]}:`):L(`Sem cotação de cidades em ${UF_NOMES[selUF]} hoje. Atalhos:`,`Sin cotización de ciudades en ${UF_NOMES[selUF]} hoy. Atajos:`);
}
function selecionarCidade(uf,nome){ if(!Object.prototype.hasOwnProperty.call(UF_NOMES,uf)) return; selUF=uf; selNome=nome; ofertaSel=null; delete $('sFethab').dataset.manual; delete $('sFrete').dataset.manual; renderSoja(); }
function renderSoja(){
  const S0=D.soja;
  if(!S0||!S0.cidades){ $('sKpis').innerHTML=`<p class="note">${L('Cotações da soja ainda não carregadas.','Cotizaciones de soja aún no cargadas.')}</p>`; return; }
  montarFiltroSoja();
  renderAgro();
  const I=infoCidade(selUF,selNome), c=I.det, nomeH=esc(I.nome), mesoH=esc(I.meso||'—'), nomeC=`${nomeH}/${esc(I.uf)}`;
  const loc=c?ofertasLocais(c):[], todas=c?(c.ofertas||[]):[], melhor=(loc.length?loc:todas).length?(loc.length?loc:todas).reduce((a,b)=>b.preco>a.preco?b:a):null;
  const regs=S0.regioes.slice().sort((a,b)=>b.valor-a.valor);
  const linkGD=`https://www.graodireto.com.br/ofertas/soja/${I.uf.toLowerCase()}/${slugGD(I.nome)}/`;
  if(!I.existe) { $('sAviso').hidden=false; $('sAviso').textContent=L(`Não encontramos "${selNome}" em ${UF_NOMES[selUF]}. Escolha um nome da lista.`,`No encontramos "${selNome}" en ${UF_NOMES[selUF]}. Elija un nombre de la lista.`); }
  else $('sAviso').hidden=true;
  // KPIs
  const kp=[];
  if(melhor) kp.push([loc.length?L('Melhor oferta em ','Mejor oferta en ')+nomeC:L('Melhor oferta próxima','Mejor oferta cercana'),sc(melhor.preco),`${loc.length?'':melhor.cidade+' · '}${fmtEntrega(melhor.entrega)} · ${melhor.fob?'FOB':'CIF'}`,'up']);
  if(I.cot) kp.push([L('Cotação da cidade','Cotización de la ciudad'),sc(I.cot.preco),`${I.cot.tipo||''} · ${fmtDia(I.cot.data)} · ${(I.cot.var>=0?'▲ +':'▼ ')}${(I.cot.var||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`,'up']);
  if(I.reg) kp.push([L('Cotação da região','Cotización de la región'),sc(I.reg.preco??I.reg.valor),`${I.reg.nome} · ${(I.reg.data||'').includes('-')?fmtDia(I.reg.data):(I.reg.data||'')}`]);
  if(loc.length) kp.push([L('Média das ofertas na cidade','Promedio de ofertas en la ciudad'),sc(loc.reduce((a,b)=>a+b.preco,0)/loc.length),L(`${loc.length} ofertas de compradores`,`${loc.length} ofertas de compradores`)]);
  if(!kp.length) kp.push([nomeC,'—',L(`Sem cotação publicada para a cidade ou a região (${mesoH}).`,`Sin cotización publicada para la ciudad o la región (${mesoH}).`)]);
  kp.push([L('Maior preço do país','Mayor precio del país'),sc(regs[0].valor),regs[0].nome]);
  $('sKpis').innerHTML=kpiHTML(kp.slice(0,4));
  $('sLinkGD').href=linkGD; $('sLinkGD').textContent=L(`Ver ofertas de ${nomeH} ao vivo no Grão Direto ↗`,`Ver ofertas de ${nomeH} en vivo en Grão Direto ↗`);
  // gráfico
  $('sTitGraf').textContent=L(`Preços em ${nomeC}`,`Precios en ${nomeC}`);
  const ser=c?.serie||[], hist=c?.historico||[], hc=I.hist;
  const dias=[...new Set([...ser.map(x=>x[0]),...hist.map(x=>x[0]),...hc.map(x=>x[0])])].sort();
  if(dias.length>1){
    const mS=Object.fromEntries(ser), mH=Object.fromEntries(hist.map(h=>[h[0],h])), mC=Object.fromEntries(hc), sets=[];
    if(hc.length) sets.push(ds(L('Cotação da cidade','Cotización de la ciudad'),dias.map(d=>mC[d]??null),css('--c-bc'),{borderWidth:3,pointRadius:3,spanGaps:true}));
    if(ser.length) sets.push(ds(L(`Cotação da região (${c.regiao})`,`Cotización de la región (${c.regiao})`),dias.map(d=>mS[d]??null),css('--c-itapema'),{borderWidth:3,pointRadius:3,spanGaps:true}));
    if(hist.length){ sets.push(ds(L('Melhor oferta na cidade','Mejor oferta en la ciudad'),dias.map(d=>mH[d]?.[3]??null),css('--good'),{pointRadius:3,spanGaps:true})); sets.push(ds(L('Média das ofertas','Promedio de ofertas'),dias.map(d=>mH[d]?.[2]??null),css('--c-cdi'),{pointRadius:3,borderDash:[5,4],spanGaps:true})); }
    draw('chSoja',{type:'line',data:{labels:dias.map(d=>fmtDia(d).slice(0,5)),datasets:sets},options:baseOpts(v=>'R$ '+Math.round(v),{plugins:{legend:{labels:{color:css('--ink'),boxWidth:10,boxHeight:10,usePointStyle:true}},tooltip:{callbacks:{label:x=>x.parsed.y==null?null:`${x.dataset.label}: ${sc(x.parsed.y)}`}}}})});
  } else if(loc.length){
    const l=loc.slice().sort((a,b)=>(a.entrega||'').localeCompare(b.entrega||''));
    draw('chSoja',{type:'bar',data:{labels:l.map(o=>fmtEntrega(o.entrega)+(o.fob?' FOB':' CIF')),datasets:[{label:nomeC,data:l.map(o=>o.preco),backgroundColor:css('--c-bc'),borderRadius:4}]},options:baseOpts(v=>'R$ '+Math.round(v),{plugins:{legend:{display:false},tooltip:{callbacks:{label:x=>sc(x.parsed.y)}}}})});
  } else {
    // sem histórico local: preços das regiões e cidades do estado
    const it_=[...I.est.regioes.map(r=>[r.nome,r.preco]),...I.est.cidades.map(r=>[r.nome,r.preco])];
    draw('chSoja',{type:'bar',data:{labels:it_.map(x=>x[0]),datasets:[{label:UF_NOMES[I.uf],data:it_.map(x=>x[1]),backgroundColor:it_.map(x=>semAcento(x[0])===semAcento(I.meso||'')?css('--c-itapema'):css('--c-brasil')),borderRadius:4}]},
      options:baseOpts(v=>'R$ '+Math.round(v),{plugins:{legend:{display:false},tooltip:{callbacks:{label:x=>sc(x.parsed.y)}}}})});
  }
  $('sNotaGraf').textContent = c&&c.uf==='MT'
    ? L(`No Mato Grosso, o Grão Direto publica uma cotação por região: ${nomeH} usa a da região ${c.regiao||mesoH}. O que muda de cidade para cidade são as ofertas dos compradores.`,`En Mato Grosso, Grão Direto publica una cotización por región: ${nomeH} usa la de la región ${c.regiao||mesoH}. Lo que cambia entre ciudades son las ofertas de los compradores.`)
    : c ? L(`${nomeH} não tem cotação diária no Grão Direto. Mostramos as ofertas de compradores e guardamos a média de cada dia.`,`${nomeH} no tiene cotización diaria en Grão Direto. Mostramos las ofertas de compradores y guardamos el promedio de cada día.`)
    : I.cot ? L(`Cotação diária de ${nomeH} no Grão Direto. O histórico cresce a cada dia útil.`,`Cotización diaria de ${nomeH} en Grão Direto. El histórico crece cada día hábil.`)
    : L(`${nomeH} fica na mesorregião ${mesoH}. ${I.reg?'Usamos a cotação dessa região como referência.':'O Grão Direto não publica cotação para essa região; o gráfico mostra as cotações do estado.'} Para as ofertas da cidade, use o link acima.`,`${nomeH} está en la mesorregión ${mesoH}. ${I.reg?'Usamos la cotización de esa región como referencia.':'Grão Direto no publica cotización para esa región; el gráfico muestra las cotizaciones del estado.'} Para las ofertas de la ciudad, use el enlace de arriba.`);
  // ofertas
  $('sTitOf').textContent=c?L(`Ofertas de compradores para ${nomeC}`,`Ofertas de compradores para ${nomeC}`):L(`Cotações em ${UF_NOMES[I.uf]}`,`Cotizaciones en ${UF_NOMES[I.uf]}`);
  let ofs=[];
  if(c){
    ofs=(c.ofertas||[]).slice().sort((a,b)=>(a.cidade===c.nome?0:1)-(b.cidade===c.nome?0:1)||(a.entrega||'').localeCompare(b.entrega||'')||b.preco-a.preco);
    $('tblOfertas').innerHTML=`<thead><tr><th>${L('Modalidade','Modalidad')}</th><th style="text-align:left">${L('Local','Lugar')}</th><th>${L('Frete','Flete')}</th><th>${L('Preço','Precio')}</th></tr></thead><tbody>`+
      ofs.map(o=>`<tr${o.cidade===c.nome?' class="sel"':''}><td>${fmtEntrega(o.entrega)}</td><td style="text-align:left">${o.cidade} - ${o.uf}</td><td>${o.fob?'FOB':'CIF'}</td><td><b>${sc(o.preco)}</b></td></tr>`).join('')+
      `</tbody><caption class="note">${L('Em destaque, compradores na própria cidade. FOB: comprador busca (frete por conta dele). CIF: produtor entrega. Preço bruto por saca de 60 kg.','Destacados, compradores en la propia ciudad. FOB: el comprador retira (flete a su cargo). CIF: el productor entrega. Precio bruto por saca de 60 kg.')}</caption>`;
  } else {
    const rows=[...I.est.regioes.map(r=>({...r,t:L('Região','Región')})),...I.est.cidades.map(r=>({...r,t:L('Cidade','Ciudad')}))];
    $('tblOfertas').innerHTML=rows.length?`<thead><tr><th style="text-align:left">${L('Local','Lugar')}</th><th>${L('Tipo','Tipo')}</th><th>${L('Preço','Precio')}</th><th>${L('No dia','En el día')}</th></tr></thead><tbody>`+
      rows.map(r=>`<tr${(I.cot&&r.nome===I.cot.nome)||(I.reg&&r.nome===I.reg.nome)?' class="sel"':''}><td style="text-align:left">${r.nome}</td><td>${r.t}</td><td><b>${sc(r.preco)}</b></td><td class="${(r.var||0)>=0?'pos':'neg'}">${(r.var>=0?'+':'')+(r.var||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}%</td></tr>`).join('')+'</tbody>'
      :`<tbody><tr><td>${L(`O Grão Direto não publica cotações em ${UF_NOMES[I.uf]} hoje. Veja as ofertas da cidade pelo link acima.`,`Grão Direto no publica cotizaciones en ${UF_NOMES[I.uf]} hoy. Vea las ofertas de la ciudad en el enlace de arriba.`)}</td></tr></tbody>`;
    const base=I.cot?{cidade:I.nome,uf:I.uf,preco:I.cot.preco,fob:true,entrega:null,comFrete:null,rot:L('Cotação da cidade','Cotización de la ciudad')}:I.reg?{cidade:I.reg.nome,uf:I.uf,preco:I.reg.preco??I.reg.valor,fob:true,entrega:null,comFrete:null,rot:L('Cotação da região','Cotización de la región')}:null;
    ofs=base?[base]:[];
  }
  // última oferta vista por mês de entrega (fica mesmo depois de sair do Grão Direto)
  const ult=c?.ultimas||{}, chaves=Object.keys(ult).sort((a,b)=>a==='disp'?-1:b==='disp'?1:a.localeCompare(b));
  $('boxUltimas').hidden=!chaves.length;
  if(chaves.length){
    const ativa=k=>(c.ofertas||[]).some(o=>(o.entrega?o.entrega.slice(0,7):'disp')===k);
    const mesTxt=k=>k==='disp'?L('Disponível','Disponible'):NOMES_MES[+k.slice(5,7)-1]+'/'+k.slice(2,4);
    $('tblUltimas').innerHTML=`<thead><tr><th>${L('Entrega','Entrega')}</th><th>${L('Preço','Precio')}</th><th style="text-align:left">${L('Local','Lugar')}</th><th>${L('Visto em','Visto el')}</th><th>${L('Situação','Situación')}</th></tr></thead><tbody>`+
      chaves.map(k=>{const u=ult[k], on=ativa(k); return `<tr><td>${mesTxt(k)}</td><td><b>${sc(u.preco)}</b></td><td style="text-align:left">${u.cidade} - ${u.uf} · ${u.fob?'FOB':'CIF'}</td><td>${fmtDia(u.visto)}</td><td><span class="tag${on?' on':''}">${on?L('Ativa agora','Activa ahora'):L('Saiu do Grão Direto','Salió de Grão Direto')}</span></td></tr>`;}).join('')+
      `</tbody><caption class="note">${L('A melhor oferta vista para cada mês de entrega, guardada pelo site todo dia útil. "Saiu do Grão Direto" é referência de preço recente, não oferta disponível.','La mejor oferta vista para cada mes de entrega, guardada por el sitio cada día hábil. "Salió de Grão Direto" es referencia de precio reciente, no oferta disponible.')}</caption>`;
  }
  // custos
  if(ofertaSel==null||!ofs[ofertaSel]) ofertaSel=Math.max(0,ofs.indexOf(melhor??ofs[0]));
  $('sOferta').innerHTML=ofs.map((o,i)=>`<option value="${i}"${i===ofertaSel?' selected':''}>${o.rot?o.rot+' · '+o.cidade:`${o.cidade} · ${fmtEntrega(o.entrega)} · ${o.fob?'FOB':'CIF'}`} · ${brl2(o.preco)}</option>`).join('');
  if(!$('sFethab').dataset.manual) setNum('sFethab', I.uf==='MT'?FETHAB_SC:0, 2);
  $('sFethabHint').textContent = I.uf==='MT' ? L(`21,15% da UPF/MT por tonelada = R$ ${FETHAB_SC.toLocaleString('pt-BR',{minimumFractionDigits:2})}/sc`,`21,15% de la UPF/MT por tonelada = R$ ${FETHAB_SC.toLocaleString('pt-BR',{minimumFractionDigits:2})}/sc`) : L(`Fethab é só do Mato Grosso. Se ${UF_NOMES[I.uf]} tiver fundo estadual, informe aqui.`,`Fethab es solo de Mato Grosso. Si ${UF_NOMES[I.uf]} tiene fondo estatal, infórmelo aquí.`);
  const o=ofs[ofertaSel];
  const freteGD = o&&o.comFrete!=null ? Math.max(0,+(o.preco-o.comFrete).toFixed(2)) : 0;
  if(!$('sFrete').dataset.manual) setNum('sFrete', freteGD, 2);
  $('sFreteHint').textContent = o&&o.comFrete!=null ? L(`Estimativa do Grão Direto até ${o.cidade}: R$ ${freteGD.toLocaleString('pt-BR',{minimumFractionDigits:2})}/sc`,`Estimación de Grão Direto hasta ${o.cidade}: R$ ${freteGD.toLocaleString('pt-BR',{minimumFractionDigits:2})}/sc`) : L('Informe o frete até o comprador, se for por sua conta','Informe el flete hasta el comprador, si corre por su cuenta');
  renderCustos(o,{nome:I.nome,uf:I.uf});
  sojaOfertasAtuais=ofs;
  // cidades acompanhadas no Brasil
  const linhas=[...detalhadas().map(x=>{const l=ofertasLocais(x); return {uf:x.uf,nome:x.nome,preco:l.length?Math.max(...l.map(y=>y.preco)):((x.serie||[]).at(-1)?.[1]??null),fonte:l.length?L(`melhor de ${l.length} ofertas`,`mejor de ${l.length} ofertas`):L('cotação da região','cotización de la región')};}),
    ...Object.entries(S0.estados||{}).flatMap(([uf,e])=>e.cidades.filter(cq=>!detalhadas().some(d=>d.uf===uf&&semAcento(d.nome)===semAcento(cq.nome))).map(cq=>({uf,nome:cq.nome,preco:cq.preco,fonte:L('cotação da cidade','cotización de la ciudad'),pts:(S0.historicoCidades?.[`${uf}|${cq.nome}`]||[]).map(h=>h[1])})))]
    .filter(x=>x.preco).sort((a,b)=>(a.uf===selUF?0:1)-(b.uf===selUF?0:1)||a.uf.localeCompare(b.uf)||b.preco-a.preco);
  $('tblCidades').innerHTML=`<thead><tr><th style="text-align:left">${L('Cidade','Ciudad')}</th><th>UF</th><th>${L('Preço','Precio')}</th><th style="text-align:left">${L('Base','Base')}</th></tr></thead><tbody>`+
    linhas.map(x=>`<tr data-uf="${x.uf}" data-n="${x.nome}"${x.uf===selUF&&semAcento(x.nome)===semAcento(I.nome)?' class="sel"':''}><td style="text-align:left">${x.nome}</td><td>${x.uf}</td><td><b>${sc(x.preco)}</b></td><td style="text-align:left">${x.fonte}</td></tr>`).join('')+'</tbody>';
  // regiões
  $('sRegData').textContent=`R$/sc 60 kg · ${regs[0].data}`;
  $('tblRegioes').innerHTML=`<thead><tr><th style="text-align:left">${L('Região','Región')}</th><th>${L('Preço','Precio')}</th><th>${L('No dia','En el día')}</th><th>${L('Últimos 7 dias','Últimos 7 días')}</th></tr></thead><tbody>`+
    regs.map(r=>`<tr${I.reg&&semAcento(r.nome)===semAcento(I.reg.nome)?' class="sel"':''}><td style="text-align:left">${r.nome}</td><td><b>${sc(r.valor)}</b></td><td class="${(r.var||0)>=0?'pos':'neg'}">${(r.var>=0?'+':'')+(r.var||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%</td><td>${spark(r.pontos)}</td></tr>`).join('')+'</tbody>';
  const at_=S0.atualizado.split(' ');
  $('sFonte').innerHTML=L(`Fonte: <a href="https://www.graodireto.com.br/precos/soja/" target="_blank" rel="noopener">Grão Direto</a> (cotações e ofertas públicas de compradores), atualizado em ${fmtDia(at_[0])} às ${at_[1]}, todo dia útil às 19h. Lista de municípios e mesorregiões: IBGE. Fethab: Lei MT 7.263/2000 e UPF/MT 2026 (Portaria 186/2025-SEFAZ). Funrural: LC 224/2025. Confirme os custos com seu contador.`,
    `Fuente: <a href="https://www.graodireto.com.br/precos/soja/" target="_blank" rel="noopener">Grão Direto</a> (cotizaciones y ofertas públicas de compradores), actualizado el ${fmtDia(at_[0])} a las ${at_[1]}, cada día hábil a las 19h. Municipios y mesorregiones: IBGE. Fethab: Ley MT 7.263/2000 y UPF/MT 2026 (Portaria 186/2025-SEFAZ). Funrural: LC 224/2025. Confirme los costos con su contador.`);
}
let sojaOfertasAtuais=[];

function renderCustos(o,c){
  if(!o){ $('tblCustos').innerHTML=''; $('sSacas').innerHTML=''; return; }
  const p=o.preco, fet=num('sFethab'), fun=p*num('sFunrural')/100, fr=num('sFrete'), arm=num('sArmaz'), com=p*num('sComissao')/100, out=num('sOutros'), n=num('sProducao');
  const liq=p-fet-fun-fr-arm-com-out;
  const lin=(t,v,cls='neg')=>{ if(cls==='neg'&&Math.abs(v)<0.005) cls=''; return `<tr><td>${t}</td><td class="${cls}">${v<0?'−':''}${brl2(Math.abs(v))}</td><td class="${cls}">${v<0?'−':''}${brl(Math.abs(v)*n)}</td></tr>`; };
  $('sCustoCid').textContent=`${c.nome}/${c.uf} · ${o.rot||fmtEntrega(o.entrega)+' · '+(o.fob?'FOB':'CIF')}`;
  $('tblCustos').innerHTML=`<thead><tr><th></th><th>${L('Por saca','Por saca')}</th><th>${L(`Em ${n.toLocaleString('pt-BR')} sacas`,`En ${n.toLocaleString('pt-BR')} sacas`)}</th></tr></thead><tbody>`+
    lin(L('Preço bruto da oferta','Precio bruto de la oferta'),p,'')+
    lin(c.uf==='MT'?'Fethab + entidade':'Fethab',-fet)+
    lin(L(`Funrural + Senar (${num('sFunrural').toLocaleString('pt-BR')}%)`,`Funrural + Senar (${num('sFunrural').toLocaleString('pt-BR')}%)`),-fun)+
    lin(L('Frete','Flete'),-fr)+
    lin(L('Secagem, armazenagem e recepção','Secado, almacenaje y recepción'),-arm)+
    lin(L('Comissão','Comisión'),-com)+
    lin(L('Outros custos','Otros costos'),-out)+
    `<tr class="total"><td>${L('Sobra para o produtor','Queda para el productor')}</td><td class="pos">${brl2(liq)}</td><td class="pos">${brl(liq*n)}</td></tr>`+
    `<tr><td>${L('Sobra por tonelada','Queda por tonelada')}</td><td colspan="2">${brl2(liq/0.06)}</td></tr><tr><td>${L('Custos sobre o preço bruto','Costos sobre el precio bruto')}</td><td colspan="2">${pct((p-liq)/p)}</td></tr></tbody>`;
  const m2=it[LAST]/liq, ap=num('valor');
  $('sSacas').innerHTML=L(`<b>Do campo para o litoral:</b> vendendo a ${brl2(liq)} líquidos por saca, <b>${Math.round(m2)} sacas</b> compram 1 m² em Itapema (${brl(it[LAST])}/m², FipeZap). ${n.toLocaleString('pt-BR')} sacas rendem ${brl(liq*n)}, o equivalente a <b>${(liq*n/it[LAST]).toLocaleString('pt-BR',{maximumFractionDigits:0})} m²</b> ou a ${pct(liq*n/ap,0)} de um imóvel de ${brl(ap)}.`,
    `<b>Del campo a la costa:</b> vendiendo a ${brl2(liq)} netos por saca, <b>${Math.round(m2)} sacas</b> compran 1 m² en Itapema (${brl(it[LAST])}/m², FipeZap). ${n.toLocaleString('pt-BR')} sacas rinden ${brl(liq*n)}, el equivalente a <b>${(liq*n/it[LAST]).toLocaleString('pt-BR',{maximumFractionDigits:0})} m²</b> o al ${pct(liq*n/ap,0)} de un inmueble de ${brl(ap)}.`);
  renderProjAgro(liq,n,c);
}

/* ---------- Projeção agro: por que compensa trocar a safra por m² ----------
   Mesmo capital (sacas × preço líquido) em 3 caminhos, ano a ano:
   imóvel (valorização do Simulador + aluguel anual líquido, pela referência de mercado do SITE_CONFIG),
   CDI líquido de IR (15%, prazo longo) e soja guardada (tendência do Cepea Paranaguá dez/2021 → hoje). */
let projH=10, projV='cub'; // cenário de valorização: cub (custo de obra), sim (Simulador), ritmo (Porto Belo 2021-26)
function renderProjAgro(liq,n,c){
  const el=$('projAgro'); if(!el) return;
  if(!(liq>0)||!(n>0)){ el.innerHTML=''; return; }
  const R=SITE_CONFIG.referenciaMercado, S0=REFS.soja, pb=agroCid==='portobelo', cidNome=pb?'Porto Belo':'Itapema';
  const m2=pb?REFS.m2PortoBelo.v:it[LAST], C=liq*n, H=projH;
  // aluguel anual líquido: 0,5%/mês, menos vacância, administração, IR e despesas do proprietário
  const y=Math.max(0,(R.aluguelMensalPctValor*12/100)*(1-R.vacancia/100)*(1-R.admAnual/100)*(1-R.irAluguel/100)-R.despesasAnoPctValor/100);
  const anosSoja=(new Date(S0.hoje.data.split('/').reverse().join('-'))-new Date(S0.antes.data.split('/').reverse().join('-')))/(365.25*864e5);
  const gS=Math.pow(S0.hoje.v/S0.antes.v,1/anosSoja)-1;
  const pbS=REFS.serieDWVPortoBelo.pontos, m21=pbS.find(p=>p.rot==='2021').v, m2Var=pb?REFS.m2PortoBelo.v/m21-1:it[LAST]/it[PERKEY.indexOf('2021-12')]-1;
  const cubAA=Math.pow(cubFim/cubIni,12/mesesEntre(CUB.inicio.mes,cubFimKey))-1;
  const pbFim=pbS.at(-1), ritmoAA=pb?Math.pow(pbFim.v/m21,1/(pbFim.t-2021.5))-1:Math.pow(it[LAST]/it[PERKEY.indexOf('2021-12')],12/mesesEntre('2021-12',LASTKEY))-1;
  const cen={cub:[cubAA,L('Custo de obra (CUB/SC)','Costo de obra (CUB/SC)')],sim:[num('valoriz')/100,L('Simulador','Simulador')],ritmo:[ritmoAA,L(`Ritmo de ${cidNome} desde 2021`,`Ritmo de ${cidNome} desde 2021`)]};
  const v=Math.max(-0.5,cen[projV][0]), cdiL=Math.max(0,num('cdi')/100)*0.85;
  const imo=[],alu=[],cdi=[],soja=[]; let acum=0;
  for(let t=0;t<=H;t++){ const vt=C*Math.pow(1+v,t); if(t>0) acum+=y*C*Math.pow(1+v,t-1); imo.push(vt); alu.push(vt+acum); cdi.push(C*Math.pow(1+cdiL,t)); soja.push(C*Math.pow(1+gS,t)); }
  const precoH=liq*Math.pow(1+gS,H), emSc=x=>x/precoH;
  const fim={imo:alu[H],cdi:cdi[H],soja:soja[H]}, vant=fim.imo-fim.soja, alugAno=y*C/liq;
  const sc0=n.toLocaleString('pt-BR');
  const melhor=fim.imo>=fim.cdi;
  const tile=(ic,lb,vv,nn,cor,cls='')=>`<div class="pa-tile ${cls}" style="--pa-c:${cor}"><span class="ic" aria-hidden="true">${ic}</span><div class="lb">${lb}</div><div class="v">${vv}</div><div class="n">${nn}</div></div>`;
  const maxB=Math.max(emSc(fim.imo),emSc(fim.cdi),emSc(fim.soja));
  const bar=(rot,val,cls,det)=>`<div class="sc-row"><span>${rot}</span><div class="sc-t"><div class="sc-f ${cls}" style="width:${(emSc(val)/maxB*100).toFixed(1)}%"></div></div><b>${fmtN(emSc(val))} sc</b><small>${det}</small></div>`;
  const msgWA=L(`Olá, ${CONTATO.primeiroNome}! Vi a projeção do Investidor Agro: ${sc0} sacas em um imóvel em ${cidNome} em ${H} anos. Quero conversar sobre permuta.`,`¡Hola, ${CONTATO.primeiroNome}! Vi la proyección del Inversor Agro: ${sc0} sacas en un inmueble en ${cidNome} en ${H} años. Quiero conversar sobre permuta.`);
  el.innerHTML=`<div class="pa-top"><div>
      <span class="badge">${L('Projeção','Proyección')}</span>
      <h2 id="projAgroTit">${L(`Por que compensa trocar ${sc0} sacas por m² em ${cidNome}`,`Por qué conviene cambiar ${sc0} sacas por m² en ${cidNome}`)}</h2>
      <p class="note">${L(`O mesmo dinheiro da venda (${brl(C)} líquidos, de ${esc(c.nome)}/${esc(c.uf)}) em três caminhos.`,`El mismo dinero de la venta (${brl(C)} netos, de ${esc(c.nome)}/${esc(c.uf)}) en tres caminos.`)}</p></div>
    <div class="pa-ctrl"><span class="note">${L('Horizonte','Horizonte')}</span><div class="chips" role="group" aria-label="${L('Horizonte da projeção','Horizonte de la proyección')}">${[5,10,15].map(a=>`<button type="button" data-ph="${a}" aria-pressed="${a===H}">${a} ${L('anos','años')}</button>`).join('')}</div>
      <span class="note">${L('Valorização','Valorización')}</span><div class="chips" role="group" aria-label="${L('Cenário de valorização','Escenario de valorización')}">${Object.entries(cen).map(([k,[x,t]])=>`<button type="button" data-pv="${k}" aria-pressed="${k===projV}">${t} · ${pct(x,1)}</button>`).join('')}</div></div></div>
    <div class="pa-hero">
      ${tile('🌾',L('Sua safra compra hoje','Su cosecha compra hoy'),`${fmtN(C/m2)} m²`,L(`em ${cidNome}, a ${brl(m2)}/m²`,`en ${cidNome}, a ${brl(m2)}/m²`),'var(--c-itapema)')}
      ${tile('🏠',L(`Imóvel em ${H} anos`,`Inmueble en ${H} años`),brlK(imo[H]),L(`${pct(v,1)} ao ano · ${cen[projV][1]}`,`${pct(v,1)} anual · ${cen[projV][1]}`),'var(--gold)')}
      ${tile('🔑',L('Aluguel paga por ano','El alquiler paga por año'),`≈ ${fmtN(alugAno)} sc`,L(`${brlK(acum)} somados em ${H} anos, já líquidos`,`${brlK(acum)} sumados en ${H} años, ya netos`),'var(--c-bc)')}
      ${tile('📈',L('A mais que guardar a soja','Más que guardar la soja'),(vant>=0?'+':'−')+brlK(Math.abs(vant)),L(`≈ ${fmtN(emSc(vant))} sacas a mais em ${H} anos`,`≈ ${fmtN(emSc(vant))} sacas más en ${H} años`),'var(--good)',vant>=0?'win':'')}
    </div>
    <div class="pa-grid">
      <div><h3>${L('Patrimônio ano a ano','Patrimonio año a año')}</h3><p class="sub">${L('R$ nominais, sem vender o imóvel','R$ nominales, sin vender el inmueble')}</p><div class="chartbox sm"><canvas id="chProjAgro" role="img" aria-label="${L('Projeção do patrimônio em três caminhos','Proyección del patrimonio en tres caminos')}"></canvas></div></div>
      <div><h3>${L(`Em ${H} anos, medido em sacas`,`En ${H} años, medido en sacas`)}</h3><p class="sub">${L(`ao preço projetado da soja: ${brl2(precoH)}/sc`,`al precio proyectado de la soja: ${brl2(precoH)}/sc`)}</p>
        <div class="sacas pa-bars">
          ${bar(L('Imóvel + aluguel','Inmueble + alquiler'),fim.imo,'imo',`${brlK(fim.imo)} · ${L(`${pct(emSc(fim.imo)/n-1,0)} sobre as ${sc0} sc`,`${pct(emSc(fim.imo)/n-1,0)} sobre las ${sc0} sc`)}`)}
          ${bar(L('Vender e pôr no CDI','Vender y poner en CDI'),fim.cdi,'cdi',`${brlK(fim.cdi)} · CDI ${pct(num('cdi')/100,1)} − IR 15%`)}
          ${bar(L('Guardar a soja','Guardar la soja'),fim.soja,'soja',`${brlK(fim.soja)} · ${L('saca','saca')} ${gS>=0?'+':''}${pct(gS,1)} ${L('ao ano','anual')}`)}
        </div>
        <p class="note" style="margin-top:10px">${melhor?L(`Neste cenário o imóvel fica à frente do CDI por ${brlK(fim.imo-fim.cdi)}, e ainda é um bem real, que não depende do preço da saca.`,`En este escenario el inmueble queda por delante del CDI por ${brlK(fim.imo-fim.cdi)}, y además es un bien real, que no depende del precio de la saca.`):L(`Neste cenário o CDI fica à frente por ${brlK(fim.cdi-fim.imo)}. O imóvel passa à frente quando a valorização acompanha o custo de obra (CUB/SC) ou quando o aluguel é maior, como na temporada.`,`En este escenario el CDI queda por delante por ${brlK(fim.cdi-fim.imo)}. El inmueble pasa adelante cuando la valorización acompaña el costo de obra (CUB/SC) o cuando el alquiler es mayor, como en temporada.`)}</p>
      </div>
    </div>
    <div class="pa-why">
      <div><span class="ic" aria-hidden="true">⚖️</span><span><b class="big">${m2Var>=0?'+':''}${pct(m2Var,0)} × ${pct(S0.hoje.v/S0.antes.v-1,0)}</b>${L(`m² de ${cidNome} × saca de soja, de dez/2021 até hoje`,`m² de ${cidNome} × saca de soja, de dic/2021 a hoy`)}</span></div>
      <div><span class="ic" aria-hidden="true">🧱</span><span><b class="big">+${pct(cubAA,1)} ${L('ao ano','anual')}</b>${L('CUB/SC: o custo de construir sobe e segura o preço do imóvel','CUB/SC: el costo de construir sube y sostiene el precio del inmueble')}</span></div>
      <div><span class="ic" aria-hidden="true">🛡️</span><span><b class="big">${L('Sem quebra de safra','Sin pérdida de cosecha')}</b>${L('não estraga no silo, não paga armazenagem e passa para os filhos','no se echa a perder en el silo, no paga almacenaje y pasa a los hijos')}</span></div>
    </div>
    <div class="pa-cta"><p class="note" style="margin:0;max-width:80ch">${L(`Premissas: valorização pelo cenário escolhido acima (CUB/SC: média anual desde ${fmtMes(CUB.inicio.mes)}; ritmo: m² ${pb?'DWV':'FipeZap'} de 2021 até hoje, que pode não se repetir); CDI do Simulador; aluguel de ${fmtN(R.aluguelMensalPctValor,2)}% do valor ao mês (FipeZap Locação, Florianópolis), com ${R.vacancia}% de vacância, ${R.admAnual}% de administração, ${R.irAluguel}% de IR e ${fmtN(R.despesasAnoPctValor,2)}% ao ano de despesas (≈ ${pct(y,1)} líquidos ao ano); soja seguindo a mesma variação anual do Cepea Paranaguá entre ${S0.antes.data} e ${S0.hoje.data}, sem custo de armazenagem. É uma projeção, não promessa de rentabilidade.`,`Supuestos: valorización según el escenario elegido arriba (CUB/SC: promedio anual desde ${fmtMes(CUB.inicio.mes)}; ritmo: m² ${pb?'DWV':'FipeZap'} de 2021 a hoy, que puede no repetirse); CDI del Simulador; alquiler de ${fmtN(R.aluguelMensalPctValor,2)}% del valor por mes (FipeZap Alquiler, Florianópolis), con ${R.vacancia}% de vacancia, ${R.admAnual}% de administración, ${R.irAluguel}% de impuesto y ${fmtN(R.despesasAnoPctValor,2)}% anual de gastos (≈ ${pct(y,1)} netos al año); soja siguiendo la misma variación anual del Cepea Paranaguá entre ${S0.antes.data} y ${S0.hoje.data}, sin costo de almacenaje. Es una proyección, no promesa de rentabilidad.`)}</p>
      <a class="btn" href="${waURL(msgWA)}" target="_blank" rel="noopener">${L('Conversar sobre permuta no WhatsApp','Conversar sobre permuta por WhatsApp')}</a></div>`;
  const anos=Array.from({length:H+1},(_,t)=>t===0?L('hoje','hoy'):L(`ano ${t}`,`año ${t}`));
  draw('chProjAgro',{type:'line',data:{labels:anos,datasets:[
    ds(L('Imóvel + aluguel','Inmueble + alquiler'),alu,css('--gold'),{borderWidth:3,fill:'+1',backgroundColor:css('--gold')+'2e'}),
    ds(L('Imóvel (só valorização)','Inmueble (solo valorización)'),imo,css('--c-cub'),{borderDash:[4,4]}),
    ds(L('CDI líquido','CDI neto'),cdi,css('--c-cdi')),
    ds(L('Soja guardada','Soja guardada'),soja,css('--c-brasil'))]},
    options:baseOpts(brlK)});
}

/* ---------- Área do corretor: tabelas cifradas (AES-256-GCM, PBKDF2-SHA256) ----------
   O arquivo dados/tabelas.enc.json é gerado por scripts/cifrar_tabelas.py. A senha nunca sai do navegador
   e as tabelas abertas ficam só na memória desta aba (somem ao recarregar ou ao clicar em Sair). */
let TAB=null, cEmp=null, cPav='*', cUni=null;
const b64=s=>Uint8Array.from(atob(s),ch=>ch.charCodeAt(0));
async function abrirTabelas(senha){
  const r=await fetch('dados/tabelas.enc.json',{cache:'no-store'});
  if(r.status===404) throw new Error('vazio');
  if(!r.ok) throw new Error('rede');
  const e=await r.json();
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(senha),'PBKDF2',false,['deriveKey']);
  const chave=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(e.salt),iterations:e.iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
  let claro;
  try{ claro=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(e.iv)},chave,b64(e.ct)); }catch{ throw new Error('senha'); }
  return limparTextos(JSON.parse(new TextDecoder().decode(claro)));
}
const STATUS={disponivel:L('Disponível','Disponible'),reservado:L('Reservado','Reservado'),vendido:L('Vendido','Vendido')};
const fmtMesAno=k=>k?NOMES_MES[+k.slice(5,7)-1]+'/'+k.slice(0,4):'—';
function renderCorretor(){
  $('formLogin').hidden=!!TAB; $('areaCorretor').hidden=!TAB;
  if(!TAB) return;
  const emps=TAB.empreendimentos;
  if(!emps.some(e=>e.id===cEmp)) cEmp=emps[0].id;
  $('cEmp').innerHTML=emps.map(e=>`<option value="${e.id}"${e.id===cEmp?' selected':''}>${e.nome}${e.cidade?' · '+e.cidade:''}</option>`).join('');
  const e=emps.find(x=>x.id===cEmp);
  const pavs=[...new Set(e.unidades.map(u=>`${u.torre||''}|${u.pavimento??''}`))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  if(cPav!=='*'&&!pavs.includes(cPav)) cPav='*';
  $('cPav').innerHTML=`<option value="*">${L('Todos','Todos')}</option>`+pavs.map(p=>{const [t,v]=p.split('|'); return `<option value="${p}"${p===cPav?' selected':''}>${t?L('Torre ','Torre ')+t+' · ':''}${v!==''?v+'º '+L('pavimento','piso'):''}</option>`;}).join('');
  const fx=e.fluxo||{};
  $('cEmpInfo').innerHTML=[e.incorporadora,e.entrega?L('Entrega ','Entrega ')+fmtMesAno(e.entrega):'',fx.entrada!=null?L(`Fluxo: ${fx.entrada}% entrada, ${fx.mensais}% mensais, ${fx.reforcos}% reforços, ${Math.max(0,100-fx.entrada-fx.mensais-fx.reforcos)}% chaves`,`Plan: ${fx.entrada}% anticipo, ${fx.mensais}% cuotas, ${fx.reforcos}% refuerzos, ${Math.max(0,100-fx.entrada-fx.mensais-fx.reforcos)}% entrega`):'',e.atualizado?L('tabela de ','tabla del ')+fmtDia(e.atualizado):'',e.observacoes||''].filter(Boolean).join(' · ');
  const us=e.unidades.filter(u=>cPav==='*'||`${u.torre||''}|${u.pavimento??''}`===cPav);
  $('tblUnidades').innerHTML=`<thead><tr><th style="text-align:left">${L('Unidade','Unidad')}</th><th>${L('Pavimento','Piso')}</th><th style="text-align:left">${L('Tipo','Tipo')}</th><th>${L('Área','Área')}</th><th>${L('Valor de tabela','Precio de lista')}</th><th>R$/m²</th><th>${L('Situação','Situación')}</th></tr></thead><tbody>`+
    us.map(u=>{const i=e.unidades.indexOf(u); return `<tr data-i="${i}"${cUni===i?' class="sel"':''}><td style="text-align:left"><b>${u.torre?u.torre+'-':''}${u.unidade??''}</b></td><td>${u.pavimento??'—'}</td><td style="text-align:left">${u.tipo||''}</td><td>${u.area?u.area.toLocaleString('pt-BR')+' m²':'—'}</td><td><b>${brl(u.valor)}</b></td><td>${u.area?brl(u.valor/u.area):'—'}</td><td><span class="st ${u.status||''}">${STATUS[u.status]||u.status||''}</span></td></tr>`;}).join('')+'</tbody>';
  renderUnidade();
}
function renderUnidade(){
  const e=TAB?.empreendimentos.find(x=>x.id===cEmp), u=e?.unidades[cUni];
  $('cUniBox').hidden=!u; if(!u) return;
  const fx=u.fluxo||e.fluxo||{}, m2=u.area?u.valor/u.area:null;
  $('cUniTit').textContent=`${e.nome} · ${u.torre?u.torre+'-':''}${u.unidade??''}`.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  $('cUniSub').textContent=L('Valores já enviados para as simulações','Valores ya enviados a las simulaciones');
  $('cUniKpis').innerHTML=kpiHTML([
    [L('Valor de tabela','Precio de lista'),brl(u.valor),u.tipo||''],
    [L('Preço por m²','Precio por m²'),m2?brl(m2):'—',m2?L(`Itapema (FipeZap): ${brl(it[LAST])}/m²`,`Itapema (FipeZap): ${brl(it[LAST])}/m²`):''],
    [L('Entrega','Entrega'),fmtMesAno(e.entrega),e.cidade||''],
    [L('Fluxo','Plan de pagos'),fx.entrada!=null?`${fx.entrada}/${fx.mensais}/${fx.reforcos}/${Math.max(0,100-fx.entrada-fx.mensais-fx.reforcos)}`:'—',L('entrada / mensais / reforços / chaves (%)','anticipo / cuotas / refuerzos / entrega (%)')],
  ]);
}
function usarUnidade(i){
  cUni=i; const e=TAB.empreendimentos.find(x=>x.id===cEmp), u=e.unidades[i], fx=u.fluxo||e.fluxo||{};
  // Simulador e Investidor à vista: mantém a proporção de entrada que estava
  const prop=num('valor')>0?Math.min(1,num('entrada')/num('valor')):0.3;
  setNum('valor',u.valor); setNum('entrada',Math.round(u.valor*prop));
  // Na planta: tabela, prazo até a entrega e fluxo
  setNum('pValor',u.valor); setNum('pMercado',u.valor);
  if(e.entrega){ const hoje=new Date(), [y,m]=e.entrega.split('-').map(Number); setNum('pObra',Math.min(72,Math.max(6,(y-hoje.getFullYear())*12+(m-1-hoje.getMonth())))); }
  if(fx.entrada!=null){ setNum('pEntrada',fx.entrada); setNum('pMensais',fx.mensais); setNum('pReforcos',fx.reforcos); }
  // PF x Holding
  setNum('hValor',u.valor);
  $('cUniMsg').textContent=L('Pronto: Simulador, Investidor à vista, Na planta e PF x Holding foram preenchidos com esta unidade. Na planta, ajuste "Imóvel pronto parecido hoje" se a tabela estiver abaixo do mercado.','Listo: Simulador, Inversor al contado, En pozo y Persona física x Holding se completaron con esta unidad. En pozo, ajuste "Inmueble terminado similar hoy" si la lista está por debajo del mercado.');
  renderCorretor();
}
async function entrarCorretor(){
  const s=$('senhaCorretor').value; if(!s) return;
  $('btnEntrar').disabled=true; $('loginMsg').textContent=L('Abrindo…','Abriendo…');
  try{ TAB=await abrirTabelas(s); $('senhaCorretor').value=''; $('loginMsg').textContent=''; cUni=null; renderCorretor(); }
  catch(err){ $('loginMsg').textContent= err.message==='senha'?L('Senha incorreta.','Contraseña incorrecta.'):err.message==='vazio'?L('Nenhuma tabela publicada ainda.','Todavía no hay tablas publicadas.'):L('Não consegui carregar as tabelas. Verifique a internet.','No pude cargar las tablas. Verifique internet.'); }
  finally{ $('btnEntrar').disabled=false; }
}

/* ---------- contato / WhatsApp ---------- */
let ultimoResumoWA='';
const assinatura=()=>`${CONTATO.nome}${CONTATO.creci?L(' · Corretor de imóveis · CRECI ',' · Corredor inmobiliario · CRECI ')+CONTATO.creci:''} · ${CONTATO.imobiliaria} · WhatsApp ${CONTATO.whatsappTxt}`;
const waURL=msg=>`https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent(msg)}`;
function atualizaWA(){
  const generico=L(`Olá ${CONTATO.primeiroNome}! Vi o site Investir na Costa Esmeralda e quero saber mais sobre imóveis em Porto Belo e região.`,`¡Hola ${CONTATO.primeiroNome}! Vi el sitio Invertir en la Costa Esmeralda y quiero saber más sobre inmuebles en Porto Belo y la región.`);
  const msg=['sim','planta','avista','holding','soja'].includes(tab)&&ultimoResumoWA?ultimoResumoWA:generico;
  $('wa').href=waURL(msg); $('waBox').href=waURL(msg); if($('waAss')) $('waAss').href=waURL(msg);
}
function contato(){
  $('waLabel').textContent=L(`Fale com ${CONTATO.primeiroNome}`,`Hable con ${CONTATO.primeiroNome}`);
  $('contatoTxt').textContent=assinatura()+L('. Atendimento em Porto Belo (Perequê). Monto a simulação com o valor, o aluguel e o fluxo de pagamento do imóvel que você está avaliando.','. Atención en Porto Belo (Perequê). Armo la simulación con el valor, el alquiler y el plan de pagos del inmueble que usted está evaluando. Atiendo en español.');
}

/* ---------- link personalizado ---------- */
const FORMS='#form input, #form select, #formPlanta input, #formAvista input, #formHolding input, #formHolding select';
const CAMPOS=()=>[...document.querySelectorAll(FORMS)].filter(el=>el.id);
function linkEstado(){
  const q=new URLSearchParams();
  if(ES) q.set('lang','es');
  for(const el of CAMPOS()){
    if(el.type==='checkbox'){ if(el.checked!==el.defaultChecked) q.set(el.id,el.checked?'1':'0'); }
    else if(el.tagName==='SELECT'){ if(el.selectedIndex!==0) q.set(el.id,el.value); }
    else if(el.value!==el.defaultValue||el.id==='modo') q.set(el.id,el.value);
  }
  if(tab==='soja') q.set('cidade',`${selUF}|${selNome}`);
  if(resAberto) q.set('cen',viewAuto?'mercado':'seu');
  if(autoFiltro!=='media') q.set('filtro',autoFiltro);
  if(autoValorManual&&autoValor) q.set('vauto',Math.round(autoValor));
  q.set('aba',['planta','avista','holding','soja'].includes(tab)?tab:'sim');
  return location.origin+location.pathname+'?'+q.toString();
}
function aplicarLink(){
  const q=new URLSearchParams(location.search);
  for(const el of CAMPOS()){ if(!q.has(el.id)) continue; if(el.type==='checkbox') el.checked=q.get(el.id)==='1'; else el.value=q.get(el.id); }
  if(q.has('valoriz')){ presetSel=''; presets(); }
  if(q.get('cidade')){ const v=q.get('cidade'); if(v.includes('|')){ const [u,n]=v.split('|'); if(Object.prototype.hasOwnProperty.call(UF_NOMES,u)){ selUF=u; selNome=String(n||'').slice(0,80); } } else { const d=Object.values(D.soja?.cidades||{}).find(c=>c.slug===v); if(d){ selUF=d.uf; selNome=d.nome; } } }
  CAMPOS().forEach(formatarCampo);
  setModo($('modo').value);
  return q.get('aba');
}
function setModo(m){
  $('modo').value=m;
  document.querySelectorAll('#modoAluguel button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===m));
  $('grpAnual').hidden=m!=='anual'; $('grpTemp').hidden=m!=='temporada';
  const seg=$('modoAluguel'), i=['nenhum','anual','temporada'].indexOf(m); if(seg) seg.style.setProperty('--i',Math.max(0,i));
  $('incMobilia').closest('label').classList.toggle('dim',m==='nenhum');
}
async function copiar(txt,msgEl){
  try{ await navigator.clipboard.writeText(txt); msgEl.textContent=L('Link copiado. Cole no WhatsApp do cliente.','Enlace copiado. Péguelo en el WhatsApp del cliente.'); }
  catch{ prompt(L('Copie o link:','Copie el enlace:'),txt); }
}

/* ---------- PDF da proposta ---------- */
function gerarPDF(){
  const hoje=new Date().toLocaleDateString(ES?'es-AR':'pt-BR');
  const titulos={soja:L('Soja: preço e custos por saca','Soja: precio y costos por saca'),planta:L('Simulação de imóvel na planta','Simulación de inmueble en pozo'),avista:L('Investidor à vista','Inversor al contado'),holding:L('Pessoa física x Holding','Persona física x Holding')};
  $('printTitle').textContent=(titulos[tab]||L('Simulação de investimento imobiliário','Simulación de inversión inmobiliaria'))+' · Costa Esmeralda (SC)';
  $('printSub').textContent=`${assinatura()} · ${hoje} · ${L('Dados: FipeZap, Banco Central, Sinduscon, IBGE','Datos: FipeZap, Banco Central de Brasil, Sinduscon, IBGE')}`;
  const form={planta:'formPlanta',sim:'form',avista:'form',holding:'formHolding',soja:'formCustos'}[tab];
  const el=form&&$(form);
  $('printPrem').textContent = el ? L('Premissas: ','Supuestos: ')+[...el.querySelectorAll('.f')].filter(f=>!f.closest('[hidden]')).map(f=>{
    const l=f.querySelector('label').childNodes[0].textContent.trim(), inp=f.querySelector('input,select'), un=[...f.querySelectorAll('.in span')].map(x=>x.textContent).filter(x=>x!=='IPCA+').join(' ').trim();
    const val=inp.tagName==='SELECT'?inp.options[inp.selectedIndex].text:inp.value;
    return `${l}: ${un.startsWith('R$')?'R$ '+val+un.slice(2):val+(un?' '+un:'')}`;}).join(' · ') : '';
  if(['sim','avista','planta','holding'].includes(tab)){
    if(!resAberto) abrirResultados('seu');
    if(viewAuto) $('printPrem').textContent=L('Premissas (cenário de mercado, automáticas): ','Supuestos (escenario de mercado, automáticos): ')+linhasPremissas(tab).map(([n,v])=>`${n}: ${String(v).replace(/<[^>]+>/g,'')}`).join(' · ');
  }
  window.print();
}
addEventListener('beforeprint',()=>{imprimindo=true; renders[tab]();});
addEventListener('afterprint',()=>{imprimindo=false; renders[tab]();});

/* ---------- índices Brasil ---------- */
const HIST=[['ivgr',L('Imóveis Brasil (IVG-R)','Inmuebles Brasil (IVG-R)'),'--c-itapema'],['cdi','CDI','--c-cdi'],['ipca','IPCA','--c-ipca'],['igpm','IGP-M','--c-bc'],['incc','INCC','--c-cub']];
let histMeses=60;
function renderIdx(){
  const B=D.bcb;
  $('ticker').innerHTML=kpiHTML([['Selic',pct(B.selicMeta/100),L('meta Copom, ao ano','meta Copom, anual')],['CDI',pct(B.cdiAA/100),'anualizado'],['IPCA 12m',pct(i12('ipca')),L('até ','hasta ')+fmtMes(months[lastIdx(S.ipca)])],['IGP-M 12m',pct(i12('igpm')),L('reajuste de aluguel','ajuste de alquileres')],['INCC 12m',pct(i12('incc')),L('custo da construção','costo de la construcción')],[L('Poupança','Caja de ahorro'),pct(poupAA),L('ao ano','anual')]]);
  const histStart=Math.max(0,iEnd-histMeses);
  const opts=[[L('1 ano','1 año'),12],[L('3 anos','3 años'),36],[L('5 anos','5 años'),60],['Desde 2016',9999]];
  $('segStart').innerHTML=opts.map(([l,n])=>`<button type="button" data-n="${n}" aria-pressed="${n===histMeses}">${l}</button>`).join('');
  const idx=[]; for(let i=histStart;i<=iEnd;i++) idx.push(i);
  draw('chHist',{type:'line',data:{labels:idx.map(i=>fmtMes(months[i])),datasets:HIST.map(([k,n,c])=>ds(n,idx.map(i=>100*acum(k,histStart,i)),css(c),k==='ivgr'?{borderWidth:3}:{}))},options:baseOpts(v=>'R$ '+Math.round(v))});
  $('histEnd').textContent=L(`Janelas terminando em ${fmtMes(months[iEnd])}, último mês com todos os índices publicados.`,`Ventanas que terminan en ${fmtMes(months[iEnd])}, último mes con todos los índices publicados.`);
  const jan=[12,36,60,iEnd];
  $('tblHist').innerHTML=`<thead><tr><th>Indicador</th>${jan.map(n=>`<th>${n===iEnd?L('Desde jan/2016','Desde ene/2016'):n/12+(n===12?L(' ano',' año'):L(' anos',' años'))}</th>`).join('')}<th>${L('Média a.a. (5 anos)','Promedio anual (5 años)')}</th></tr></thead><tbody>`+
    HIST.map(([k,n,c])=>`<tr><td><span class="dot" style="background:var(${c})"></span>${n}</td>${jan.map(j=>`<td>${pct(acum(k,iEnd-j,iEnd)-1,1)}</td>`).join('')}<td><b>${pct(anualBCB(k,5))}</b></td></tr>`).join('')+'</tbody>';
  const all=[]; for(let i=0;i<=lastIdx(S.selic);i++) all.push(i);
  draw('chSelic',{type:'line',data:{labels:all.map(i=>fmtMes(months[i])),datasets:[ds(L('Selic (% ao ano)','Selic (% anual)'),all.map(i=>S.selic[i]),css('--c-cdi'),{fill:true,backgroundColor:css('--c-cdi')+'22',stepped:true,tension:0})]},options:baseOpts(p1)});
  const v12=[]; for(let i=12;i<=iEnd;i++) v12.push(i);
  draw('chVal',{type:'line',data:{labels:v12.map(i=>fmtMes(months[i])),datasets:[ds(L('Imóveis Brasil','Inmuebles Brasil'),v12.map(i=>100*(acum('ivgr',i-12,i)-1)),css('--c-itapema'),{borderWidth:3}),ds('IPCA',v12.map(i=>100*(acum('ipca',i-12,i)-1)),css('--c-ipca')),ds('IGP-M',v12.map(i=>100*(acum('igpm',i-12,i)-1)),css('--c-bc'))]},options:baseOpts(p1)});
}

/* ---------- correção ---------- */
function opcoesCorr(){
  const anos=PERKEY.filter(k=>k.endsWith('-12')&&k!==LASTKEY).map(k=>k.slice(0,4));
  $('cAno').innerHTML=anos.map(a=>`<option${a==='2021'?' selected':''}>${a}</option>`).join('');
}
function renderCorr(){
  const v=num('cValor'), ano=$('cAno').value, j=PERKEY.indexOf(ano+'-12'), ini=ano+'-12', anos=mesesEntre(ini,LASTKEY)/12;
  // Itapema: FipeZap real do período. Porto Belo: a série DWV é anual e tem buracos, então usa a valorização média ao ano da série (mesma dos outros simuladores) aplicada ao período.
  const fIt=it[LAST]/it[j], aaIt=Math.pow(fIt,1/anos)-1, fPB=Math.pow(1+taxaPB(),anos), fMed=Math.pow(1+(taxaPB()+aaIt)/2,anos);
  const Lr=[[L('Média Porto Belo + Itapema','Promedio Porto Belo + Itapema'),'--gold',fMed,'media'],[L('Porto Belo (DWV, média ao ano)','Porto Belo (DWV, promedio anual)'),'--gold-2',fPB,'portobelo'],['Itapema (FipeZap)','--c-itapema',fIt,'itapema'],[L('Média Brasil (FipeZap)','Promedio Brasil (FipeZap)'),'--c-brasil',REG.brasil.m2[fimDe('brasil')]/REG.brasil.m2[j]],
    ['CDI (bruto)','--c-cdi',acum('cdi',mi(ini),at('cdi',LASTKEY))],['IPCA','--c-ipca',acum('ipca',mi(ini),at('ipca',LASTKEY))],['IGP-M','--c-bc',acum('igpm',mi(ini),at('igpm',LASTKEY))]];
  const sel=Lr.find(r=>r[3]===autoFiltro)||Lr[0], ipca=Lr.find(r=>r[1]==='--c-ipca')[2], cdi=Lr.find(r=>r[1]==='--c-cdi')[2];
  const seg=$('corrFiltro'); seg.style.setProperty('--i',['media','portobelo','itapema'].indexOf(sel[3])); seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.f===sel[3]));
  $('corrKpis').innerHTML=kpiHTML([[L('Valor estimado hoje','Valor estimado hoy'),brl(v*sel[2]),L(`pela valorização: ${FILTROS[sel[3]].nome()}`,`según la valorización: ${FILTROS[sel[3]].nome()}`),'up'],[L('Se ficasse no CDI','Si hubiera quedado en el CDI'),brl(v*cdi),L('bruto, antes do IR','bruto, antes de impuestos')],[L('Ganho real','Ganancia real'),pct(sel[2]/ipca-1,1),L('acima do IPCA','por encima del IPCA'),'up']]);
  $('tblCorr').innerHTML=`<thead><tr><th>${L('Corrigido por','Actualizado por')}</th><th>${L('Valor hoje','Valor hoy')}</th><th>${L('Variação','Variación')}</th><th>${L('Média ao ano','Promedio anual')}</th></tr></thead><tbody>`+
    Lr.map(([n,c,f])=>`<tr><td><span class="dot" style="background:var(${c})"></span>${n}</td><td>${brl(v*f)}</td><td>${pct(f-1,1)}</td><td>${pct(Math.pow(f,1/anos)-1)}</td></tr>`).join('')+
    `</tbody><caption class="note">${L(`De dez/${ano} até ${fmtMes(LASTKEY)}. Porto Belo usa a valorização média ao ano da série DWV (${REFS.serieDWVPortoBelo.pontos[0].rot} a ${REFS.serieDWVPortoBelo.pontos.at(-1).rot}); a média soma essa taxa com a de Itapema no período e divide por dois. É a média da cidade; localização, vista para o mar e padrão mudam bastante o valor de cada imóvel.`,`De dic/${ano} hasta ${fmtMes(LASTKEY)}. Porto Belo usa la valorización media anual de la serie DWV (${REFS.serieDWVPortoBelo.pontos[0].rot} a ${REFS.serieDWVPortoBelo.pontos.at(-1).rot}); el promedio suma esa tasa con la de Itapema en el período y divide por dos. Es el promedio de la ciudad; ubicación, vista al mar y estándar cambian mucho el valor de cada inmueble.`)}</caption>`;
}

/* ---------- Banco Central ao vivo ---------- */
const chaveData=r=>r.data.split('/').reverse().join('');
const maisRecente=rs=>rs.reduce((a,b)=>chaveData(b)>chaveData(a)?b:a);
async function bcbAoVivoCarregar(){
  const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),9000);
  const get=async u=>{const r=await fetch(u,{signal:ctrl.signal}); if(!r.ok) throw new Error(r.status); return r.json();};
  const base='https://api.bcb.gov.br/dados/serie/bcdata.sgs.';
  const cods={selic:4189,cdi:4391,ipca:433,igpm:189,incc:192,ivgr:21340,usd:3698};
  const n=Object.keys(cods).length;
  try{
    const res=await Promise.all([...Object.values(cods).map(c=>get(`${base}${c}/dados?formato=json&dataInicial=01/01/2016`)),
      get(`${base}432/dados/ultimos/5?formato=json`),get(`${base}4389/dados/ultimos/5?formato=json`),get(`${base}195/dados/ultimos/20?formato=json`)]);
    const brutos={}; Object.keys(cods).forEach((k,i)=>{brutos[k]={}; for(const r of res[i]){const [,mm,aa]=r.data.split('/'); brutos[k][`${aa}-${mm}`]=parseFloat(r.valor);}});
    const hoje=new Date(), atual=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
    delete brutos.cdi[atual]; delete brutos.selic[atual]; delete brutos.usd[atual];
    const fim=Object.values(brutos).map(o=>Object.keys(o).sort().at(-1)).sort().at(-1);
    const ms=[]; let y=2016, m=1; while(true){ const k=`${y}-${String(m).padStart(2,'0')}`; if(k>fim) break; ms.push(k); m++; if(m>12){y++;m=1;} }
    const poup=res[n+2].map(r=>parseFloat(r.valor));
    const nova={start:'2016-01',series:Object.fromEntries(Object.keys(cods).map(k=>[k,ms.map(mm=>brutos[k][mm]??null)])),poup_m:poup.reduce((a,b)=>a+b,0)/poup.length,
      selicMeta:parseFloat(maisRecente(res[n]).valor),cdiAA:parseFloat(maisRecente(res[n+1]).valor)};
    if(nova.series.cdi.length<100||!isFinite(nova.selicMeta)) throw new Error('resposta incompleta');
    D.bcb=nova; bcbAoVivo=true; prepBCB(); hints(); hero(false); renders[tab]();
  }catch(e){ console.info('Banco Central indisponível, usando dados salvos:',e.message); }
  finally{ clearTimeout(timer); }
}

/* =====================================================================
   V2: quebra de objeções, atalho guiado, modo corretor, extras
   ===================================================================== */
const URLQ = new URLSearchParams(location.search);
const MODO_CORRETOR = (()=>{ try{ if(URLQ.get('modo')==='corretor') sessionStorage.setItem('modoCorretor','1'); return sessionStorage.getItem('modoCorretor')==='1'; }catch{ return URLQ.get('modo')==='corretor'; } })();
const cagrItapema = () => Math.pow(it[LAST]/it[0],1/anosPer)-1;
const fmtN = (v,d=0) => v.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});

/* ---------- #objecao-cdi: vantagem real sobre o CDB líquido ---------- */
function renderVantagemCDI(p,f){
  const el=$('vantagemCDI'); if(!el) return;
  const d=f.imovel-f.cdb, bom=d>=0;
  el.className='vantagem '+(bom?'good':'bad');
  el.innerHTML=`<span class="vl">${L('Diferença líquida no fim de','Diferencia neta al final de')} ${p.anos} ${L('anos','años')}</span>
    <b class="vv">${bom?'+':'−'}${brl(Math.abs(d))}</b>
    <span class="vn">${bom?L('a favor do imóvel, já descontado o IR sobre o ganho de capital, a corretagem e o saldo devedor, contra o CDB líquido de IR.','a favor del inmueble, ya descontado el impuesto sobre la ganancia, la comisión y el saldo de deuda, contra el CDB neto de impuestos.'):L('a favor do CDB líquido neste cenário. Ajuste a valorização, o aluguel ou o horizonte.','a favor del CDB neto en este escenario. Ajuste la valorización, el alquiler o el horizonte.')}</span>`;
}

/* ---------- Tradutor de ticket ---------- */
function arquetipo(area){
  if(area<55) return L('studio ou 1 dormitório compacto','studio o 1 dormitorio compacto');
  if(area<80) return L('2 dormitórios, 1 suíte','2 dormitorios, 1 suite');
  if(area<115) return L('2 a 3 suítes, padrão família','2 a 3 suites, estándar familiar');
  if(area<170) return L('3 suítes amplas, alto padrão','3 suites amplias, alto estándar');
  if(area<260) return L('3 a 4 suítes, apartamento de alto luxo','3 a 4 suites, departamento de alto lujo');
  return L('4+ suítes ou cobertura','4+ suites o penthouse');
}
function renderTicket(valor){
  const el=$('ticket'); if(!el||!(valor>0)) return;
  const reg=[[L('Porto Belo · Balneário Perequê e entorno','Porto Belo · Balneário Perequê y alrededores'),REFS.m2PortoBelo.v,L('média dos imóveis novos vendidos em 2026 (DWV)','promedio de inmuebles nuevos vendidos en 2026 (DWV)')],
             [L('Itapema · Meia Praia e entorno','Itapema · Meia Praia y alrededores'),it[LAST],`FipeZap ${fmtMes(LASTKEY)}`]];
  el.innerHTML=`<div class="ph"><h2>${L('O que','Lo que')} ${brl(valor)} ${L('compra na prática','compra en la práctica')}</h2><span class="note">${L('pela média do m² de cada cidade','según el m² medio de cada ciudad')}</span></div>
    <div class="ticket-grid">${reg.map(([n,m2,src])=>{const a=valor/m2; return `<div class="tk"><span class="tk-lb">${n}</span><b class="tk-a">~${fmtN(a)} m²</b><span class="tk-t">${arquetipo(a)}</span><span class="tk-s">${brl(m2)}/m² · ${src}</span></div>`;}).join('')}</div>
    <p class="note" style="margin-top:10px">${L('São médias da cidade. Frente-mar e quadra-mar custam bem mais que a média, e bairros em expansão costumam custar menos. Não é anúncio de imóvel: serve para calibrar a expectativa.','Son promedios de la ciudad. Frente al mar y a una cuadra del mar cuestan bastante más, y los barrios en expansión suelen costar menos. No es un anuncio: sirve para calibrar la expectativa.')}</p>`;
}

/* ---------- #objecao-espera: custo de esperar 12 meses ---------- */
function renderEspera(){
  if(!$('espValor')) return;
  const v=+$('espValor').value, r=cagrItapema(), futuro=v*(1+r), dif=futuro-v, mensalNec=Math.pow(1+r,1/12)-1;
  const cdbLiqMes=mensal(D.bcb.cdiAA/100)*(1-0.175);
  $('espValorTxt').textContent=brl(v);
  $('espOut').innerHTML=kpiHTML([
    [L('Preço daqui a 12 meses','Precio dentro de 12 meses'),brl(futuro),L(`${pct(r,1)} ao ano: média de Itapema desde dez/2020 (FipeZap)`,`${pct(r,1)} anual: promedio de Itapema desde dic/2020 (FipeZap)`)],
    [L('Custa a mais para entrar depois','Cuesta más entrar después'),'+'+brl(dif),L('só pela valorização média','solo por la valorización media'),'neg'],
    [L('Renda fixa precisa render','La renta fija necesita rendir'),pct(mensalNec,2)+L(' ao mês',' al mes'),L(`líquido, só para empatar. CDB 100% do CDI hoje: ~${pct(cdbLiqMes,2)}/mês líquido (IR 17,5%)`,`neto, solo para empatar. CDB 100% del CDI hoy: ~${pct(cdbLiqMes,2)}/mes neto (impuesto 17,5%)`)],
  ]);
}

/* ---------- #objecao-teto: 3 pisos de sustentação ---------- */
function renderTeto(){
  if(!$('chRegional')) return;
  const u=usdEm(LASTKEY), m2usd=u?it[LAST]/u:null;
  $('pisosKpis').innerHTML=kpiHTML([
    [L('Piso 1 · CUB/SC','Piso 1 · CUB/SC'),brl2(cubFim),L(`custo só da obra por m² (+${p1(CUB.v12m)} em 12 meses)`,`costo solo de obra por m² (+${p1(CUB.v12m)} en 12 meses)`)],
    [L('Piso 2 · m² em dólar','Piso 2 · m² en dólares'),m2usd?usd(m2usd):'—',L('Itapema ÷ PTAX: barato para quem ganha em dólar','Itapema ÷ PTAX: barato para quien gana en dólares')],
    [L('Piso 3 · vizinho mais caro','Piso 3 · vecino más caro'),brl(REG.bc.m2[fimDe('bc')]),L('m² de Balneário Camboriú: teto de referência regional','m² de Balneário Camboriú: techo de referencia regional')],
  ]);
  const rows=[['Balneário Camboriú',REG.bc.m2[fimDe('bc')],'--c-brasil',`FipeZap ${fmtMes(LASTKEY)}`],['Itapema',it[LAST],'--c-itapema',`FipeZap ${fmtMes(LASTKEY)}`],['Porto Belo ★',REFS.m2PortoBelo.v,'--gold',L('imóveis novos, 1º sem/2026 (DWV)','inmuebles nuevos, 1er sem/2026 (DWV)')]];
  draw('chRegional',{type:'bar',data:{labels:rows.map(r=>r[0]),datasets:[{label:'R$/m²',data:rows.map(r=>r[1]),backgroundColor:rows.map(r=>css(r[2])),borderRadius:6}]},
    options:baseOpts(v=>'R$ '+Math.round(v/1000)+' mil',{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${brl(c.parsed.x)}/m² · ${rows[c.dataIndex][3]}`}}},scales:{x:{beginAtZero:true,ticks:{color:css('--muted'),callback:v=>'R$ '+Math.round(v/1000)+' mil'},grid:{color:css('--line')}},y:{ticks:{color:css('--ink'),font:{weight:'600'}},grid:{display:false}}}})});
  const gap=1-REFS.m2PortoBelo.v/REG.bc.m2[fimDe('bc')];
  $('regionalNota').innerHTML=L(`Porto Belo ainda negocia cerca de <b>${pct(gap,0)} abaixo</b> do m² de Balneário Camboriú, com os grandes projetos de bairro planejado e orla em andamento. Atenção: o número de Porto Belo vem de outra metodologia (imóveis novos vendidos, ${REFS.m2PortoBelo.txt}), porque a cidade não tem índice FipeZap.`,`Porto Belo todavía negocia cerca de <b>${pct(gap,0)} por debajo</b> del m² de Balneário Camboriú, con grandes proyectos de barrio planificado y costanera en marcha. Atención: el dato de Porto Belo usa otra metodología (inmuebles nuevos vendidos, encuesta DWV), porque la ciudad no tiene índice FipeZap.`)+selo(REFS.m2PortoBelo);
}

/* ---------- Porto Belo: série DWV ---------- */
function renderPBSerie(){
  if(!$('chPBSerie')) return;
  const S=REFS.serieDWVPortoBelo.pontos, a=S[0], b=S.at(-1), anos=b.t-a.t, cagr=Math.pow(b.v/a.v,1/anos)-1;
  $('pbSerieKpis').innerHTML=kpiHTML([
    [L('m² em Porto Belo hoje','m² en Porto Belo hoy'),brl(b.v),L('1º semestre de 2026 · DWV','1er semestre de 2026 · DWV'),''],
    [L('Valorização desde 2020','Valorización desde 2020'),'+'+pct(b.v/a.v-1,0),`${brl(a.v)} → ${brl(b.v)}`,'up'],
    [L('Média ao ano','Promedio anual'),pct(cagr,1),L(`em cerca de ${fmtN(anos,1)} anos`,`en cerca de ${fmtN(anos,1)} años`),'up'],
    [L('Ainda abaixo de Itapema','Todavía por debajo de Itapema'),pct(1-b.v/it[LAST],0),L(`Itapema: ${brl(it[LAST])}/m² (FipeZap)`,`Itapema: ${brl(it[LAST])}/m² (FipeZap)`)],
  ]);
  $('pbSerieSelo').innerHTML=selo(REFS.serieDWVPortoBelo);
  draw('chPBSerie',{type:'bar',data:{labels:S.map(p=>p.rot),datasets:[{label:L('m² médio de venda em Porto Belo (DWV)','m² medio de venta en Porto Belo (DWV)'),data:S.map(p=>p.v),backgroundColor:S.map((p,i)=>i===S.length-1?css('--gold'):'rgba(255,195,80,.55)'),borderColor:css('--gold-2'),borderWidth:1,borderRadius:6}]},
    options:baseOpts(v=>'R$ '+Math.round(v/1000)+' mil',{plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${brl(c.parsed.y)}/m² · DWV, via ${S[c.dataIndex].f}`}}}})});
  renderPBItbi();
}

/* ---------- Porto Belo: dinheiro movimentado em escrituras, estimado pelo ITBI (Tesouro Nacional) ----------
   volume ≈ ITBI arrecadado ÷ alíquota. Só a partir de 2019, quando a alíquota já era 2% o ano todo. */
function renderPBItbi(){
  const R=REFS.itbiPortoBelo; if(!$('chPBItbi')||!R) return;
  const S=R.serie.filter(x=>x[0]>=R.aliquotaDesde).map(([a,v])=>({a,itbi:v,vol:v/R.aliquota}));
  if(S.length<2) return;
  const fv=v=>v>=1e9?'R$ '+(v/1e9).toLocaleString('pt-BR',{maximumFractionDigits:2})+L(' bi',' mil M'):'R$ '+Math.round(v/1e6).toLocaleString('pt-BR')+L(' mi',' M');
  const a=S[0], b=S.at(-1), n=b.a-a.a, cagr=Math.pow(b.vol/a.vol,1/n)-1;
  $('pbItbiKpis').innerHTML=kpiHTML([
    [L(`Movimentado em ${b.a}`,`Movido en ${b.a}`),fv(b.vol),L(`estimado pelo ITBI de ${fv(b.itbi)}`,`estimado por el ITBI de ${fv(b.itbi)}`),''],
    [L(`Crescimento desde ${a.a}`,`Crecimiento desde ${a.a}`),'×'+fmtN(b.vol/a.vol,1),`${fv(a.vol)} → ${fv(b.vol)}`,'up'],
    [L('Média ao ano','Promedio anual'),'+'+pct(cagr,0),L(`de ${a.a} a ${b.a}, em valores da época`,`de ${a.a} a ${b.a}, en valores de cada año`),'up'],
  ]);
  $('pbItbiSelo').innerHTML=selo(R);
  draw('chPBItbi',{type:'bar',data:{labels:S.map(x=>String(x.a)),datasets:[{label:L('Dinheiro movimentado em compras de imóveis (estimado)','Dinero movido en compras de inmuebles (estimado)'),data:S.map(x=>x.vol),backgroundColor:S.map((x,i)=>i===S.length-1?css('--c-itapema'):css('--c-itapema')+'8c'),borderRadius:6}]},
    options:baseOpts(fv,{plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>[`${L('Movimentado','Movido')}: ${fv(S[c.dataIndex].vol)}`,`${L('ITBI arrecadado','ITBI recaudado')}: ${brl(S[c.dataIndex].itbi)}`]}}}})});
}

/* ---------- m² internacional (aba Investidor à vista) ---------- */
function renderInternacional(){
  const el=$('intlBox'); if(!el) return;
  const u=usdEm(LASTKEY); if(!u) return;
  const ce=it[LAST]/u, pb=REFS.m2PortoBelo.v/u;
  const rows=[[L('Porto Belo (novos)','Porto Belo (nuevos)'),pb,usd(pb),L('DWV 2026 ÷ PTAX','DWV 2026 ÷ PTAX')],['Itapema',ce,usd(ce),`FipeZap ÷ PTAX ${fmtMes(LASTKEY)}`],...REFS.internacional.itens.map(r=>[r.nome,r.ref,r.faixa,r.txt])];
  const max=Math.max(...rows.map(r=>r[1]));
  el.innerHTML=`<div class="ph"><h2>${L('Costa Esmeralda x mercados internacionais','Costa Esmeralda x mercados internacionales')}</h2><span class="note">${L('US$ por m²','US$ por m²')}</span></div>
    <div class="intl">${rows.map(([n,v,t,s],i)=>`<div class="intl-row${i<2?' ce':''}"><span class="intl-n">${n}</span><div class="intl-t"><div class="intl-f" style="width:${(v/max*100).toFixed(1)}%"></div></div><b>${t}</b><small>${s}</small></div>`).join('')}</div>
    <p class="note" style="margin-top:10px">${L('Fontes de segmentos diferentes: compare como ordem de grandeza. Para Punta del Este e Miami a barra usa o topo da faixa citada.','Fuentes de segmentos distintos: compare como orden de magnitud. Para Punta del Este y Miami la barra usa el tope del rango citado.')}${selo(REFS.internacional)}</p>`;
}

/* ---------- #objecao-cub-imposto: alavancagem na obra ---------- */
function renderAlavancagem(r){
  const el=$('alavanca'); if(!el) return;
  const valoriz=r.vmN-r.M, correcao=r.totalPago+r.saldoChaves-r.V;
  const bom=valoriz>correcao;
  el.innerHTML=`<div class="alav-grid">
    <div><span class="vl">${L('Valorização sobre 100% do imóvel','Valorización sobre el 100% del inmueble')}</span><b class="pos">+${brl(valoriz)}</b></div>
    <div><span class="vl">${L('Correção pelo CUB (parcelas + saldo das chaves)','Ajuste por CUB (cuotas + saldo a la entrega)')}</span><b class="neg">−${brl(correcao)}</b></div>
    <div class="alav-roi"><span class="vl">${L('ROI líquido sobre o capital desembolsado','ROI neto sobre el capital desembolsado')}</span><b>${pct(r.roi,1)}</b><small>${L(`lucro de ${brl(r.lucro)} sobre ${brl(r.totalPago)} pagos até as chaves`,`ganancia de ${brl(r.lucro)} sobre ${brl(r.totalPago)} pagados hasta la entrega`)}</small></div></div>
    <p class="note" style="margin-top:8px">${bom?L(`A valorização incide sobre o valor <b>inteiro</b> do imóvel, mas a correção só incide sobre as parcelas que faltam. Por isso o ganho supera a correção em ${brl(valoriz-correcao)}.`,`La valorización se aplica sobre el valor <b>total</b> del inmueble, pero el ajuste solo sobre las cuotas pendientes. Por eso la ganancia supera al ajuste en ${brl(valoriz-correcao)}.`):L('Neste cenário a correção das parcelas supera a valorização. Revise a valorização esperada ou o preço de tabela.','En este escenario el ajuste de las cuotas supera la valorización. Revise la valorización esperada o el precio de lista.')}</p>`;
}

/* ---------- #objecao-agro: poder de compra em sacas ---------- */
function precoSojaLocal(){
  // cotação da cidade escolhida na aba; senão média das ofertas locais; senão a da região
  if(!D.soja||!selUF||!selNome) return null;
  const I=infoCidade(selUF,selNome), c=I.det, loc=c?ofertasLocais(c):[];
  const nome=`${esc(I.nome)}/${esc(I.uf)}`;
  if(I.cot?.preco) return {v:I.cot.preco,nome,fonte:L(`cotação da cidade em ${fmtDia(I.cot.data)} (Grão Direto)`,`cotización de la ciudad el ${fmtDia(I.cot.data)} (Grão Direto)`)};
  if(loc.length) return {v:loc.reduce((a,b)=>a+b.preco,0)/loc.length,nome,fonte:L(`média de ${loc.length} ofertas de compradores na cidade (Grão Direto)`,`promedio de ${loc.length} ofertas de compradores en la ciudad (Grão Direto)`)};
  const r=I.reg; if(r&&(r.preco??r.valor)) return {v:r.preco??r.valor,nome,fonte:L(`cotação da região ${esc(r.nome)} (Grão Direto)`,`cotización de la región ${esc(r.nome)} (Grão Direto)`)};
  return null;
}
let agroCid='portobelo'; // Porto Belo em destaque por padrão
function renderAgro(){
  const el=$('agroBox'); if(!el) return;
  const S0=REFS.soja, area=S0.areaPadrao, iDez21=PERKEY.indexOf('2021-12'), pb=agroCid==='portobelo';
  const cidNome=pb?'Porto Belo':'Itapema';
  // Porto Belo: m² de hoje = DWV 2026; dez/2021 estimado com a valorização de Itapema (FipeZap) no período
  const m2Hoje=pb?REFS.m2PortoBelo.v:it[LAST], m2Antes=pb?REFS.serieDWVPortoBelo.pontos.find(p=>p.rot==='2021').v:it[iDez21];
  const loc=precoSojaLocal(), fatorPorto=S0.antes.v/S0.hoje.v;
  // hoje: preço da cidade; dez/2021: estimado aplicando a variação de Paranaguá ao preço da cidade
  const pHoje=loc?loc.v:S0.hoje.v, pAntes=loc?loc.v*fatorPorto:S0.antes.v;
  const v0=m2Antes*area, v1=m2Hoje*area, s0=v0/pAntes, s1=v1/pHoje;
  const max=Math.max(s0,s1);
  const onde=loc?L(` · soja em ${loc.nome}`,` · soja en ${loc.nome}`):L(' · soja em Paranaguá',' · soja en Paranaguá');
  const notaImovel=pb
    ? L(`Imóvel: m² médio de Porto Belo segundo a DWV: ${brl(m2Antes)} em 2021 e ${brl(m2Hoje)} no 1º semestre de 2026 (imóveis novos vendidos).`,`Inmueble: m² medio de Porto Belo según DWV: ${brl(m2Antes)} en 2021 y ${brl(m2Hoje)} en el 1er semestre de 2026 (inmuebles nuevos vendidos).`)
    : L(`Imóvel: m² médio de Itapema (FipeZap) dez/2021 e ${fmtMes(LASTKEY)}.`,`Inmueble: m² medio de Itapema (FipeZap) dic/2021 y ${fmtMes(LASTKEY)}.`);
  el.innerHTML=`<div class="agro-cid chips" role="group" aria-label="${L('Cidade do imóvel','Ciudad del inmueble')}"><button type="button" data-cid="portobelo" aria-pressed="${pb}">Porto Belo</button><button type="button" data-cid="itapema" aria-pressed="${!pb}">Itapema</button></div>
    <div class="ph"><h2>${L(`Quantas sacas compram um apartamento de ${area} m² em ${cidNome}`,`Cuántas sacas compran un departamento de ${area} m² en ${cidNome}`)}</h2><span class="note">${L('sacas de 60 kg','sacas de 60 kg')}${onde}</span></div>
    <div class="sacas">
      <div class="sc-row"><span>${S0.antes.data}</span><div class="sc-t"><div class="sc-f old" style="width:${(s0/max*100).toFixed(1)}%"></div></div><b>${fmtN(s0)} sc</b><small>${brl(v0)} · ${L('soja','soja')} ${loc?'~':''}${brl2(pAntes)}/sc${loc?L(' (estimado)',' (estimado)'):''}</small></div>
      <div class="sc-row"><span>${L('hoje','hoy')}</span><div class="sc-t"><div class="sc-f" style="width:${(s1/max*100).toFixed(1)}%"></div></div><b>${fmtN(s1)} sc</b><small>${brl(v1)} · ${L('soja','soja')} ${brl2(pHoje)}/sc</small></div>
    </div>
    <div class="callout" style="margin-top:12px">${L(`Quem trocou <b>${fmtN(s0)} sacas</b> por um imóvel em dez/2021 tem hoje um patrimônio que equivale a <b>${fmtN(s1)} sacas</b>, ${pct(s1/s0-1,0)} a mais. A saca caiu e o m² subiu: o imóvel guardou o valor da safra.`,`Quien cambió <b>${fmtN(s0)} sacas</b> por un inmueble en dic/2021 hoy tiene un patrimonio equivalente a <b>${fmtN(s1)} sacas</b>, ${pct(s1/s0-1,0)} más. La saca bajó y el m² subió: el inmueble guardó el valor de la cosecha.`)}</div>
    <p class="note" style="margin-top:8px">${loc
      ? L(`Soja hoje: ${loc.fonte}. Dez/2021: estimado aplicando ao preço da cidade a mesma variação do porto de Paranaguá no período (Cepea/Esalq: ${brl2(S0.antes.v)} em ${S0.antes.data} → ${brl2(S0.hoje.v)} em ${S0.hoje.data}), porque não há histórico por cidade daquela época. ${notaImovel}`,
          `Soja hoy: ${loc.fonte}. Dic/2021: estimado aplicando al precio de la ciudad la misma variación del puerto de Paranaguá en el período (Cepea/Esalq: ${brl2(S0.antes.v)} el ${S0.antes.data} → ${brl2(S0.hoje.v)} el ${S0.hoje.data}), porque no hay histórico por ciudad de esa época. ${notaImovel}`)
      : L(`Sem cotação para a cidade escolhida: usamos o porto de Paranaguá. Soja: ${S0.antes.txt}; ${S0.hoje.txt}. ${notaImovel}`,`Sin cotización para la ciudad elegida: usamos el puerto de Paranaguá (Cepea/Esalq, ${S0.antes.data} y ${S0.hoje.data}). ${notaImovel}`)}${vencido(S0.hoje)?selo(S0.hoje):""}${agroCid==='portobelo'?selo(REFS.serieDWVPortoBelo):''}</p>`;
}

/* ---------- Atalho guiado: monte seu cenário em 30 segundos ---------- */
const wiz={obj:null,faixa:null,forma:null};
const FAIXA_VALOR={ate12:900000,'12a25':1800000,acima:3200000};
function wizStep(){
  const passo=!wiz.obj?1:!wiz.faixa?2:!wiz.forma?3:4;
  document.querySelectorAll('.wiz-step').forEach(s=>{ const n=+s.dataset.step; s.classList.toggle('done',n<passo); s.classList.toggle('active',n===passo); s.hidden=n>passo; });
  document.querySelectorAll('.wiz-opt').forEach(b=>b.setAttribute('aria-pressed',wiz[b.dataset.k]===b.dataset.v));
  $('wizReset').hidden=passo===1;
}
function wizAplicar(){
  const v=FAIXA_VALOR[wiz.faixa]; let aba='sim', alvo='objecao-cdi';
  setNum('valor',v); setNum('hValor',v); setNum('pValor',v); setNum('pMercado',v);
  if($('espValor')){ $('espValor').value=Math.min(+$('espValor').max,v); }
  if(wiz.forma==='soja'){ aba='soja'; alvo='objecao-agro'; }
  else if(wiz.forma==='fluxo'){ aba='planta'; alvo='objecao-cub-imposto'; }
  else if(wiz.obj==='patrimonio'){ aba='holding'; alvo='p-holding'; setNum('entrada',v); }
  else if(wiz.obj==='renda'){ aba=wiz.forma==='avista'?'avista':'sim'; alvo=aba==='avista'?'p-avista':'objecao-cdi'; setNum('entrada',wiz.forma==='avista'?v:Math.round(v*0.3)); setModo('temporada'); }
  else { setNum('entrada',wiz.forma==='avista'?v:Math.round(v*0.3)); setModo('nenhum'); }
  show(aba); if(!resAberto&&['sim','avista','planta','holding'].includes(aba)) abrirResultados('seu'); irPara(alvo,true);
  $('wizMsg').textContent=L('Pronto! Montamos o cenário abaixo. Ajuste qualquer número quando quiser.','¡Listo! Armamos el escenario abajo. Ajuste cualquier número cuando quiera.');
}

/* ---------- Roteamento por âncora #objecao-... ---------- */
const ANCORA_ABA={'objecao-cdi':'sim','objecao-teto':'why','objecao-espera':'why','objecao-temporada':'why','objecao-cub-imposto':'planta','objecao-agro':'soja','porto-belo':'why','microrregioes':'why','seguranca':'why'};
function irPara(id,destacar=true){
  const el=$(id); if(!el) return;
  const caixa=el.closest('.resultados'); if(caixa&&caixa.hidden) abrirResultados(viewAuto?'auto':'seu');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
    if(destacar){ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),2200); }
  }));
}
function rotaHash(){
  const id=decodeURIComponent(location.hash.slice(1)); if(!id) return;
  const aba=ANCORA_ABA[id]; if(!aba&&!$(id)) return;
  if(aba&&aba!==tab) show(aba);
  irPara(id);
}

/* ---------- Copiar com confirmação animada ---------- */
async function copiarAnimado(btn,txt){
  let ok=true; try{ await navigator.clipboard.writeText(txt); }catch{ ok=false; }
  const orig=btn.dataset.orig||(btn.dataset.orig=btn.innerHTML);
  btn.classList.add(ok?'ok':'falhou');
  btn.innerHTML=ok?`<svg class="chk-ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10.5l4 4 8-9"/></svg>${btn.dataset.okTxt||L('Copiado!','¡Copiado!')}`:L('Selecione e copie (Ctrl+C)','Seleccione y copie (Ctrl+C)');
  setTimeout(()=>{ btn.innerHTML=orig; btn.classList.remove('ok','falhou'); },2000);
  return ok;
}
function linkPublico(id){ const q=new URLSearchParams(); if(ES) q.set('lang','es'); const s=q.toString(); return location.origin+location.pathname+(s?'?'+s:'')+'#'+id; }

function initV2(){
  // Área restrita só no modo corretor
  const tc=document.querySelector('.tabs [data-tab="corretor"]'); if(tc) tc.hidden=!MODO_CORRETOR;
  document.body.classList.toggle('modo-corretor',MODO_CORRETOR);
  // botões "Link do argumento"
  document.querySelectorAll('[data-objecao]').forEach(sec=>{
    if(!MODO_CORRETOR) return;
    const b=document.createElement('button'); b.type='button'; b.className='btn-util btn-arg no-print';
    b.innerHTML=`🔗 ${L('Link do argumento','Enlace del argumento')}`; b.dataset.okTxt=L('Link copiado!','¡Enlace copiado!');
    b.addEventListener('click',()=>copiarAnimado(b,linkPublico(sec.id)));
    sec.prepend(b);
  });
  // atalho guiado
  document.querySelectorAll('.wiz-opt').forEach(b=>b.addEventListener('click',()=>{ wiz[b.dataset.k]=b.dataset.v; wizStep(); if(wiz.obj&&wiz.faixa&&wiz.forma) wizAplicar(); }));
  $('wizReset').addEventListener('click',()=>{ wiz.obj=wiz.faixa=wiz.forma=null; $('wizMsg').textContent=''; wizStep(); });
  wizStep();
  // custo de esperar
  $('espValor').addEventListener('input',renderEspera);
  // checkboxes de custos
  if(typeof Chart!=='undefined') Chart.defaults.font.family='Outfit, system-ui, sans-serif';
  $('incMobilia').nextElementSibling.textContent=L(`Incluir mobília e decoração (${fmtN(SITE_CONFIG.mobiliaPadraoPct,1)}% do valor)`,`Incluir muebles y decoración (${fmtN(SITE_CONFIG.mobiliaPadraoPct,1)}% del valor)`);
  // copiar resumo
  $('copy').addEventListener('click',e=>{ e.stopImmediatePropagation(); copiarAnimado($('copy'),$('resumo').value); },true);
  // referência de temporada
  { const R=SITE_CONFIG.referenciaMercado;
    $('tempRef').textContent=L(`Referência: ${R.fonteTemporada.pt}: ocupação de ${R.ocupAlta}% de dezembro a março e ${R.ocupBaixa}% no resto do ano. Imóvel bem administrado costuma ficar acima da média.`,`Referencia: ${R.fonteTemporada.es}: ocupación de ${R.ocupAlta}% de diciembre a marzo y ${R.ocupBaixa}% el resto del año. Un inmueble bien administrado suele quedar por encima del promedio.`); }
  // assinatura e selo
  $('pbHero').innerHTML=L(`<b>★ Porto Belo</b> movimentou <b>${REFS.vendasPortoBelo.v}</b> em imóveis novos no 1º semestre de 2026, a ${brl(REFS.m2PortoBelo.v)}/m², ainda abaixo dos vizinhos. <a href="#porto-belo">Veja o que está sendo construído →</a>`,`<b>★ Porto Belo</b> movió <b>R$ 2.500 millones</b> en inmuebles nuevos en el 1er semestre de 2026, a ${brl(REFS.m2PortoBelo.v)}/m², todavía por debajo de sus vecinos. <a href="#porto-belo">Vea lo que se está construyendo →</a>`);
  document.querySelectorAll('.selo-projetos').forEach(e=>e.innerHTML=selo(REFS.projetos));
  document.querySelectorAll('.selo-orla').forEach(e=>e.innerHTML=selo(REFS.orlaItapema));
  $('assNome').textContent=SITE_CONFIG.consultorNome;
  $('assCargo').textContent=(SITE_CONFIG.creci?L('Corretor de imóveis · CRECI ','Corredor inmobiliario · CRECI ')+SITE_CONFIG.creci+' · ':'')+SITE_CONFIG.imobiliaria;
  $('assWa').textContent='WhatsApp '+SITE_CONFIG.whatsappTxt;
  // renders extras
  const rw=renders.why, ra=renders.avista;
  renders.why=()=>{ rw(); renderPBSerie(); renderTeto(); renderEspera(); };
  renders.avista=()=>{ ra(); renderInternacional(); };
  $('agroBox').addEventListener('click',e=>{ const b=e.target.closest('[data-cid]'); if(b){ agroCid=b.dataset.cid; renderAgro(); renderCustos(sojaOfertasAtuais[ofertaSel],{nome:selNome,uf:selUF}); } });
$('projAgro').addEventListener('click',e=>{ const b=e.target.closest('[data-ph]'), bv=e.target.closest('[data-pv]'); if(b) projH=+b.dataset.ph; if(bv) projV=bv.dataset.pv; if(b||bv) renderCustos(sojaOfertasAtuais[ofertaSel],{nome:selNome,uf:selUF}); });
  addEventListener('hashchange',rotaHash);
  // janelas entram suavemente ao rolar (só contêineres fixos; o conteúdo interno é redesenhado sem afetar)
  if('IntersectionObserver' in window && !reduce){
    const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visivel'); io.unobserve(e.target); } }),{rootMargin:'0px 0px -6% 0px'});
    document.querySelectorAll('section[id^="p-"] > *, .contato, .assinatura, #seguranca').forEach((el,i)=>{ if(el.closest('.wizard')) return; el.classList.add('sobe'); el.style.transitionDelay=Math.min(i%4,3)*60+'ms'; io.observe(el); });
    addEventListener('beforeprint',()=>document.querySelectorAll('.sobe').forEach(el=>el.classList.add('visivel')));
  }
}


/* =====================================================================
   CENÁRIO DE MERCADO (automático): só o valor do imóvel e o filtro de valorização mudam.
   Taxas oficiais vêm do Banco Central / FipeZap / DWV / CUB; o resto vem de SITE_CONFIG.referenciaMercado.
   A estrutura (perfil de renda, entrada %, prazo, horizonte, opções marcadas) segue o "Seu cenário".
   ===================================================================== */
let autoValor=null, autoValorManual=false, autoFiltro='media', JUROS_IMOB=null;
const taxaPB=()=>{ const S=REFS.serieDWVPortoBelo.pontos, a=S[0], b=S.at(-1); return Math.pow(b.v/a.v,1/(b.t-a.t))-1; };
const FILTROS={
  media:{nome:()=>L('Média Porto Belo + Itapema','Promedio Porto Belo + Itapema'),taxa:()=>(taxaPB()+cagrItapema())/2,fonte:()=>L('média de DWV (Porto Belo) e FipeZap (Itapema)','promedio de DWV (Porto Belo) y FipeZap (Itapema)')},
  portobelo:{nome:()=>'Porto Belo',taxa:taxaPB,fonte:()=>L(`DWV, ${REFS.serieDWVPortoBelo.pontos[0].rot} a ${REFS.serieDWVPortoBelo.pontos.at(-1).rot}`,`DWV, ${REFS.serieDWVPortoBelo.pontos[0].rot} a ${REFS.serieDWVPortoBelo.pontos.at(-1).rot}`)},
  itapema:{nome:()=>'Itapema',taxa:cagrItapema,fonte:()=>`FipeZap, dez/2020 a ${fmtMes(LASTKEY)}`},
};
const RM=()=>SITE_CONFIG.referenciaMercado;
const juros=()=>(JUROS_IMOB??REFS.jurosImob.v)/100;
function vAuto(){ if(!autoValorManual||!autoValor) autoValor=num({planta:'pValor',holding:'hValor'}[tab]||'valor'); return autoValor; }

function autoP(){ // premissas do Simulador no cenário de mercado
  const u=premissasSeu(), V=vAuto(), r=RM(), ent=u.valor>0?Math.min(1,u.entrada/u.valor):r.entradaPct/100;
  return {...u,valor:V,entrada:V*ent,custos:u.custos>0?SITE_CONFIG.itbiRegistroPct/100:0,mob:u.mob>0?SITE_CONFIG.mobiliaPadraoPct/100:0,juros:juros(),
    aluguel:V*r.aluguelMensalPctValor/100,vac:r.vacancia/100,dA:V*r.diariaAltaPctValor/100,oA:r.ocupAlta/100,mA:r.mesesAlta,dB:V*r.diariaBaixaPctValor/100,oB:r.ocupBaixa/100,
    adm:(u.modo==='temporada'?r.admTemporada:r.admAnual)/100,desp:V*r.despesasAnoPctValor/100/12,irAl:r.irAluguel/100,reaj:i12('ipca'),
    valoriz:FILTROS[autoFiltro].taxa(),corr:r.corretagem/100,cdi:D.bcb.cdiAA/100,pctCdi:1,poup:poupAA,ipca:i12('ipca')};
}
function autoPlantaG(){ const V=vAuto(), r=RM(), razao=num('pValor')>0?num('pMercado')/num('pValor'):1;
  const m={pValor:V,pMercado:V*razao,pEntrada:r.fluxoPlanta.entrada,pMensais:r.fluxoPlanta.mensais,pReforcos:r.fluxoPlanta.reforcos,pCorrecao:CUB.v12m,pValoriz:FILTROS[autoFiltro].taxa()*100,pCorretagem:r.corretagem,pCdi:D.bcb.cdiAA};
  return id=>id in m?m[id]:num(id); }
function autoHoldingG(){ const V=vAuto(), p=autoP(), m={hValor:V,hAluguel:(p.modo==='nenhum'?V*RM().aluguelMensalPctValor/100:rendaAno1(p)/12),hValoriz:FILTROS[autoFiltro].taxa()*100,hHonor:RM().honorInventario};
  return id=>id in m?m[id]:num(id); }

const PROV=()=>RM().provisorio?` <span class="tag prov">${L('referência provisória','referencia provisoria')}</span>`:` <span class="tag">${L('referência da consultoria','referencia de la consultoría')}</span>`;
function linhasPremissas(aba){
  const p=autoP(), r=RM(), F=FILTROS[autoFiltro], bc=L('Banco Central','Banco Central'), jd=JUROS_IMOB!=null?L('ao vivo','en vivo'):REFS.jurosImob.data;
  const rows=[[L('Valorização ao ano','Valorización anual'),pct(F.taxa(),1),F.fonte()]];
  if(aba==='sim'||aba==='avista'){
    rows.push([L('CDI hoje','CDI hoy'),pct(p.cdi,2),bc+(bcbAoVivo?L(', ao vivo',', en vivo'):'')],[L('IPCA 12 meses (reajuste e despesas)','IPCA 12 meses (ajuste y gastos)'),pct(p.ipca,2),bc],[L('Poupança','Caja de ahorro'),pct(p.poup,2),bc]);
    if(aba==='sim') rows.push([L('Juros do financiamento','Interés de la financiación'),pct(p.juros,2),`${bc} (SGS 20772), ${jd}`]);
    if(p.custos>0) rows.push([L('ITBI + registro','ITBI + registro'),p1(SITE_CONFIG.itbiRegistroPct),L('configuração do site','configuración del sitio')]);
    if(p.modo==='temporada') rows.push([L('Diária alta / resto do ano','Diaria alta / resto del año'),`${brl(p.dA)} / ${brl(p.dB)}`,L(`ocupação ${r.ocupAlta}% / ${r.ocupBaixa}%, ${r.mesesAlta} meses de alta`,`ocupación ${r.ocupAlta}% / ${r.ocupBaixa}%, ${r.mesesAlta} meses de alta`)+(r.fonteTemporada?` <span class="tag">${L(r.fonteTemporada.pt,r.fonteTemporada.es)}</span>`:PROV())]);
    if(p.modo==='anual') rows.push([L('Aluguel por mês','Alquiler por mes'),brl(p.aluguel),L(`${fmtN(r.aluguelMensalPctValor,2)}% do valor, vacância ${r.vacancia}%`,`${fmtN(r.aluguelMensalPctValor,2)}% del valor, vacancia ${r.vacancia}%`)+(r.fonteAluguel?` <span class="tag">${L(r.fonteAluguel.pt,r.fonteAluguel.es)}</span>`:PROV())]);
    if(p.modo!=='nenhum') rows.push([L('Administração / plataforma','Administración / plataforma'),p1(p.adm*100),PROV()]);
    rows.push([L('Despesas do proprietário','Gastos del propietario'),brl(p.desp)+L('/mês','/mes'),L(`${p1(r.despesasAnoPctValor)} do valor ao ano`,`${p1(r.despesasAnoPctValor)} del valor por año`)+PROV()],[L('Corretagem na venda','Comisión en la venta'),p1(r.corretagem),PROV()]);
    if(aba==='avista') rows.push([L('Desconto à vista','Descuento al contado'),p1(r.descontoAvista),PROV()]);
  }
  if(aba==='planta'){ const f=r.fluxoPlanta;
    rows.push([L('Correção das parcelas','Ajuste de las cuotas'),p1(CUB.v12m),L('CUB/SC, últimos 12 meses (Sinduscon)','CUB/SC, últimos 12 meses (Sinduscon)')],[L('Fluxo (entrada / mensais / reforços / chaves)','Plan (anticipo / cuotas / refuerzos / entrega)'),`${f.entrada}/${f.mensais}/${f.reforcos}/${Math.max(0,100-f.entrada-f.mensais-f.reforcos)}%`,PROV()],[L('CDI para comparar','CDI para comparar'),pct(D.bcb.cdiAA/100,2),bc],[L('Corretagem na venda','Comisión en la venta'),p1(r.corretagem),PROV()]);
  }
  if(aba==='holding'){ const g=autoHoldingG();
    rows.push([L('Aluguel bruto por mês','Alquiler bruto por mes'),brl(g('hAluguel')),L('mesma referência do Simulador','misma referencia del Simulador')+PROV()],[L('Advogado e custas do inventário','Abogado y costas del sucesorio'),p1(r.honorInventario),PROV()]);
  }
  return rows;
}
function painelAuto(aba){
  const el=$('auto-'+aba); if(!el) return;
  if(!el.dataset.pronto){
    el.dataset.pronto='1';
    el.innerHTML=`<div class="auto-h"><span class="badge" style="margin:0">${L('Automático','Automático')}</span><h2>${L('Cenário de mercado','Escenario de mercado')}</h2></div>
      <p class="note">${L('Percentuais gerados pelo site com os dados de hoje. Você só escolhe o valor do imóvel e a referência de valorização.','Porcentajes generados por el sitio con los datos de hoy. Usted solo elige el valor del inmueble y la referencia de valorización.')}</p>
      <div class="f auto-valor"><label for="autoValor-${aba}">${L('Valor do imóvel','Valor del inmueble')}</label><div class="in"><span>R$</span><input id="autoValor-${aba}" class="auto-valor-in" inputmode="numeric" autocomplete="off"></div></div>
      <div class="seg3 auto-filtro" role="group" aria-label="${L('Referência de valorização','Referencia de valorización')}">
        <button type="button" data-f="media">${L('Média PB + Itapema','Promedio PB + Itapema')}</button><button type="button" data-f="portobelo">Porto Belo</button><button type="button" data-f="itapema">Itapema</button></div>
      <div class="tblwrap"><table class="auto-tbl"></table></div>
      <p class="note auto-igual">${L('Igual ao seu cenário: perfil de renda, entrada (%), prazo, horizonte e opções marcadas.','Igual a su escenario: perfil de renta, anticipo (%), plazo, horizonte y opciones marcadas.')}</p>`;
    const inp=el.querySelector('.auto-valor-in'); inp.dataset.num=''; inp.dataset.casas=0; prepararDinheiro(inp,true);
    inp.addEventListener('input',()=>{ const v=lerNum(inp.value); if(v>0){ autoValor=v; autoValorManual=true; renders[tab](); } });
    inp.addEventListener('blur',()=>{ inp.value=fmtN(vAuto()); });
    el.querySelector('.auto-filtro').addEventListener('click',e=>{ const b=e.target.closest('[data-f]'); if(b){ autoFiltro=b.dataset.f; renders[tab](); } });
  }
  const inp=el.querySelector('.auto-valor-in'); if(document.activeElement!==inp) inp.value=fmtN(vAuto()); extenso(inp);
  const seg=el.querySelector('.auto-filtro'); seg.style.setProperty('--i',['media','portobelo','itapema'].indexOf(autoFiltro));
  seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.f===autoFiltro));
  el.querySelector('.auto-tbl').innerHTML='<tbody>'+linhasPremissas(aba).map(([n,v,f])=>`<tr><td>${n}<small>${f}</small></td><td><b>${v}</b></td></tr>`).join('')+'</tbody>';
}
function comparativo(aba,linhas){ // linhas: [rótulo, valorAuto, valorSeu, maiorÉMelhor?]
  const el=$('cmp-'+aba); if(!el) return;
  el.innerHTML=`<div class="ph"><h2>${L('Cenário de mercado x Seu cenário','Escenario de mercado x Su escenario')}</h2><span class="note">${L(`valorização: ${FILTROS[autoFiltro].nome()} (${pct(FILTROS[autoFiltro].taxa(),1)} ao ano)`,`valorización: ${FILTROS[autoFiltro].nome()} (${pct(FILTROS[autoFiltro].taxa(),1)} anual)`)}</span></div>
    <div class="tblwrap"><table class="cmp-tbl"><thead><tr><th></th><th class="c-auto">${L('Mercado (automático)','Mercado (automático)')}</th><th class="c-seu">${L('Seu cenário','Su escenario')}</th></tr></thead><tbody>`+
    linhas.map(([n,a,b])=>`<tr><td>${n}</td><td class="c-auto">${a}</td><td class="c-seu">${b}</td></tr>`).join('')+`</tbody></table></div>`;
}
const tirTxt=t=>isFinite(t)?pct(t):'—';
function renderAutoSim(){
  painelAuto('sim');
  const pa=autoP(), ra=simular(pa), ps=premissasSeu(), rs=simular(ps), Ta=tir(ra.fluxos), Ts=tir(rs.fluxos);
  const dif=(r)=>{const d=r.fim.imovel-r.fim.cdb; return `<span class="${d>=0?'pos':'neg'}">${d>=0?'+':'−'}${brl(Math.abs(d))}</span>`;};
  const b1=p=>p.modo==='temporada'?rendaAno1(p):p.modo==='nenhum'?0:p.aluguel*12*(1-p.vac);
  comparativo('sim',[[L('Valor do imóvel','Valor del inmueble'),brl(pa.valor),brl(ps.valor)],[L(`Patrimônio em ${ps.anos} anos`,`Patrimonio en ${ps.anos} años`),brl(ra.fim.imovel),brl(rs.fim.imovel)],
    [L('Vantagem sobre o CDB líquido','Ventaja sobre el CDB neto'),dif(ra),dif(rs)],[L('TIR (retorno ao ano)','TIR (retorno anual)'),tirTxt(Ta),tirTxt(Ts)],
    [L('Renda bruta por mês (1º ano)','Renta bruta por mes (1er año)'),brl(b1(pa)/12),brl(b1(ps)/12)],[L('Desembolso total','Desembolso total'),brl(ra.fim.investido),brl(rs.fim.investido)]]);
}
function renderAutoAvista(){
  painelAuto('avista');
  const r=RM(), pa={...autoP(),entrada:Infinity,desc:r.descontoAvista/100}, ps={...premissasSeu(),entrada:Infinity,desc:num('desconto')/100};
  const ra=simular(pa), rs=simular(ps), mes=x=>x.fluxos.slice(1,13).reduce((a,b)=>a+b,0)/12;
  comparativo('avista',[[L('Preço à vista','Precio al contado'),brl(ra.preco),brl(rs.preco)],[L('Renda líquida por mês (1º ano)','Renta neta por mes (1er año)'),brl(mes(ra)),brl(mes(rs))],
    [L(`Patrimônio em ${ps.anos} anos`,`Patrimonio en ${ps.anos} años`),brl(ra.fim.imovel),brl(rs.fim.imovel)],[L('Mesmo dinheiro no CDB','El mismo dinero en el CDB'),brl(ra.fim.cdb),brl(rs.fim.cdb)],['TIR',tirTxt(tir(ra.fluxos)),tirTxt(tir(rs.fluxos))]]);
}
function renderAutoPlanta(){
  painelAuto('planta');
  const a=simPlanta(autoPlantaG()), s=simPlanta(num);
  comparativo('planta',[[L('Valor de tabela','Precio de lista'),brl(a.V),brl(s.V)],[L('Você paga até as chaves','Usted paga hasta la entrega'),brl(a.totalPago),brl(s.totalPago)],[L('Valor na entrega','Valor a la entrega'),brl(a.vmN),brl(s.vmN)],
    [L('Lucro vendendo na entrega','Ganancia vendiendo a la entrega'),`<span class="${a.lucro>=0?'pos':'neg'}">${brl(a.lucro)}</span>`,`<span class="${s.lucro>=0?'pos':'neg'}">${brl(s.lucro)}</span>`],[L('ROI sobre o que pagou','ROI sobre lo pagado'),pct(a.roi,1),pct(s.roi,1)],['TIR',tirTxt(a.tir),tirTxt(s.tir)]]);
}
function renderAutoHolding(){
  painelAuto('holding');
  const a=simHolding(autoHoldingG()), s=simHolding(num);
  const eco=r=>{const e=r.totPf-r.totHd; return `<span class="${e>=0?'pos':'neg'}">${e>=0?'':'−'}${brl(Math.abs(e))}</span>`;};
  comparativo('holding',[[L('Valor dos imóveis','Valor de los inmuebles'),brl(a.V??vAuto()),brl(num('hValor'))],[L('Impostos e custos na pessoa física','Impuestos y costos como persona física'),brl(a.totPf),brl(s.totPf)],[L('Impostos e custos na holding','Impuestos y costos en la holding'),brl(a.totHd),brl(s.totHd)],[L('Economia com a holding','Ahorro con la holding'),eco(a),eco(s)]]);
}
async function jurosAoVivo(){
  try{ const r=await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.20772/dados/ultimos/3?formato=json'); if(!r.ok) return;
    const rs=await r.json(), m=rs.reduce((a,b)=>b.data.split('/').reverse().join('')>a.data.split('/').reverse().join('')?b:a);
    const v=parseFloat(m.valor); if(v>3&&v<40){ JUROS_IMOB=v; if(['sim','avista','planta','holding'].includes(tab)) renders[tab](); } }catch{}
}
function abrirResultados(v){ // v: 'auto' | 'seu' | null (fecha)
  resAberto=v; if(v) viewAuto=v==='auto';
  document.querySelectorAll('.resultados').forEach(c=>c.hidden=!resAberto);
  document.querySelectorAll('.vercen').forEach(b=>{
    b.querySelectorAll('button').forEach(x=>{ x.setAttribute('aria-pressed',x.dataset.v===resAberto); x.setAttribute('aria-expanded',x.dataset.v===resAberto); });
    b.classList.toggle('aberto',!!resAberto); b.classList.toggle('mercado',resAberto==='auto');
    b.querySelector('.vercen-st').textContent = !resAberto ? L('Escolha um cenário para ver gráficos, tabelas e o resumo completo.','Elija un escenario para ver gráficos, tablas y el resumen completo.')
      : resAberto==='auto' ? L('Mostrando: Cenário de mercado (automático). Clique de novo para fechar.','Mostrando: Escenario de mercado (automático). Haga clic de nuevo para cerrar.')
      : L('Mostrando: Seu cenário. Clique de novo para fechar.','Mostrando: Su escenario. Haga clic de nuevo para cerrar.');
  });
  document.body.classList.toggle('ver-auto',resAberto==='auto');
  if(['sim','avista','planta','holding'].includes(tab)) renders[tab]();
}
function montarResultados(){
  for(const aba of ['sim','avista','planta','holding']){
    const cmp=$('cmp-'+aba); if(!cmp) continue;
    const bar=document.createElement('div'); bar.className='vercen no-print';
    bar.innerHTML=`<div class="vercen-btns" role="group" aria-label="${L('Ver resultados','Ver resultados')}">
      <button type="button" data-v="auto" aria-pressed="false" aria-expanded="false"><small>${L('Ver resultados','Ver resultados')}</small>${L('Cenário de mercado','Escenario de mercado')}</button>
      <button type="button" data-v="seu" aria-pressed="false" aria-expanded="false"><small>${L('Ver resultados','Ver resultados')}</small>${L('Seu cenário','Su escenario')}</button></div>
      <span class="vercen-st"></span>`;
    bar.addEventListener('click',e=>{ const b=e.target.closest('button[data-v]'); if(!b) return; abrirResultados(resAberto===b.dataset.v?null:b.dataset.v); if(resAberto) bar.nextElementSibling.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); });
    const box=document.createElement('div'); box.className='resultados stack'; box.hidden=true;
    while(cmp.nextElementSibling) box.appendChild(cmp.nextElementSibling);
    cmp.after(bar); bar.after(box);
  }
  addEventListener('beforeprint',()=>{ if(!resAberto&&['sim','avista','planta','holding'].includes(tab)) abrirResultados('seu'); });
}
function initAuto(){
  montarResultados();
  { const c=URLQ.get('cen'), f=URLQ.get('filtro'), va=+URLQ.get('vauto');
    if(FILTROS[f]) autoFiltro=f; if(va>0){ autoValor=va; autoValorManual=true; }
    if(c==='mercado'||c==='seu'){ resAberto=c==='mercado'?'auto':'seu'; viewAuto=c==='mercado'; } }
  abrirResultados(resAberto);
  const w={sim:renderAutoSim,avista:renderAutoAvista,planta:renderAutoPlanta,holding:renderAutoHolding};
  for(const [k,f] of Object.entries(w)){ const orig=renders[k]; renders[k]=()=>{ orig(); f(); }; }
  // o "Seu cenário" redesenha só a própria aba: acompanha também o automático
  $('form').addEventListener('input',()=>renderAutoSim());
  $('formAvista').addEventListener('input',()=>renderAutoAvista());
  $('formPlanta').addEventListener('input',()=>renderAutoPlanta());
  $('formHolding').addEventListener('input',()=>renderAutoHolding());
  $('modoAluguel').addEventListener('click',()=>setTimeout(renderAutoSim,0));
  jurosAoVivo();
}

/* ---------- eventos ---------- */
let tab='why';
const renders={why:renderWhy,sim:renderSim,avista:renderAvista,planta:renderPlanta,holding:renderHolding,soja:renderSoja,idx:renderIdx,corr:renderCorr,corretor:renderCorretor};
function show(t){ if(!renders[t]) t='why'; if(t==='corretor'&&!MODO_CORRETOR) t='why'; tab=t;
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));
  for(const k of Object.keys(renders)) $('p-'+k).hidden=k!==t;
  renders[t](); atualizaWA();
}
function hints(){
  $('cdiHint').textContent=L(`Hoje: ${pct(D.bcb.cdiAA/100)}`,`Hoy: ${pct(D.bcb.cdiAA/100)}`);
  $('poupHint').textContent=L(`Hoje: ${pct(poupAA)}`,`Hoy: ${pct(poupAA)}`);
  $('ipcaHint').textContent=`${L('Últimos 12m','Últimos 12m')}: ${pct(i12('ipca'))}`;
}
traduzirEstatico();
document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('button'); if(b) show(b.dataset.tab);});
$('segStart').addEventListener('click',e=>{const b=e.target.closest('button'); if(b){histMeses=+b.dataset.n; renderIdx();}});
$('presets').addEventListener('click',e=>{const b=e.target.closest('button'); if(!b) return; presetSel=b.dataset.k; setNum('valoriz',+b.dataset.v); presets(); renderSim();});
$('form').addEventListener('input',e=>{ if(e.target.id==='valoriz'){presetSel=''; presets();} renderSim(); });
$('formPlanta').addEventListener('input',renderPlanta);
$('formAvista').addEventListener('input',renderAvista);
$('formHolding').addEventListener('input',renderHolding);
$('formLogin').addEventListener('submit',e=>{ e.preventDefault(); entrarCorretor(); });
$('cEmp').addEventListener('change',e=>{ cEmp=e.target.value; cPav='*'; cUni=null; renderCorretor(); });
$('cPav').addEventListener('change',e=>{ cPav=e.target.value; renderCorretor(); });
$('tblUnidades').addEventListener('click',e=>{ const tr=e.target.closest('tr[data-i]'); if(tr) usarUnidade(+tr.dataset.i); });
$('btnSair').addEventListener('click',()=>{ TAB=null; cUni=null; $('loginMsg').textContent=L('Você saiu. As tabelas foram apagadas desta tela.','Usted salió. Las tablas se borraron de esta pantalla.'); renderCorretor(); });
document.querySelectorAll('[data-ir]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.ir)));
$('sUF').addEventListener('change',e=>{ const uf=e.target.value, est=D.soja.estados?.[uf], det=detalhadas().find(c=>c.uf===uf);
  const nome=det?.nome||est?.cidades?.[0]?.nome||munUF(uf)[0]?.[0]||''; selecionarCidade(uf,nome); });
$('sCidadeTxt').addEventListener('change',e=>{ if(e.target.value.trim()) selecionarCidade(selUF,e.target.value.trim()); });
$('sAtalhos').addEventListener('click',e=>{const b=e.target.closest('button'); if(b) selecionarCidade(b.dataset.uf,b.dataset.n);});
$('tblCidades').addEventListener('click',e=>{const tr=e.target.closest('tr[data-uf]'); if(!tr) return; selecionarCidade(tr.dataset.uf,tr.dataset.n); $('sKpis').scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});});
$('formCustos').addEventListener('input',e=>{
  if(e.target.id==='sOferta'){ ofertaSel=+e.target.value; delete $('sFrete').dataset.manual; renderSoja(); return; }
  if(e.target.id==='sFethab'||e.target.id==='sFrete') e.target.dataset.manual='1';
  renderCustos(sojaOfertasAtuais[ofertaSel],{nome:selNome,uf:selUF});
});
['cValor','cAno'].forEach(id=>$(id).addEventListener('input',renderCorr));
$('corrFiltro').addEventListener('click',e=>{ const b=e.target.closest('[data-f]'); if(b){ autoFiltro=b.dataset.f; renderCorr(); } });
$('modoAluguel').addEventListener('click',e=>{const b=e.target.closest('button'); if(!b) return; setModo(b.dataset.m); renderSim();});
document.querySelectorAll('[data-pdf]').forEach(b=>b.addEventListener('click',gerarPDF));
document.querySelectorAll('[data-link]').forEach(b=>b.addEventListener('click',()=>copiar(linkEstado(),b.parentElement.querySelector('[data-msg]'))));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.goto)));
$('copy').addEventListener('click',()=>{const ta=$('resumo');
  navigator.clipboard.writeText(ta.value).then(()=>$('copyMsg').textContent=L('Copiado. Cole no WhatsApp ou e-mail.','Copiado. Péguelo en WhatsApp o e-mail.')).catch(()=>{ta.focus();ta.select();$('copyMsg').textContent=L('Texto selecionado. Use Ctrl+C para copiar.','Texto seleccionado. Use Ctrl+C para copiar.');});});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{hero(false); renders[tab]();});

prepBCB(); hints(); opcoesCorr();
prepararCampos();
setNum('poup',+(poupAA*100).toFixed(1));
const P0=presets(); setNum('valoriz',+(P0[1][2]*100).toFixed(1));
setNum('pCorrecao',+CUB.v12m.toFixed(1));
setNum('pValoriz',+(P0[2][2]*100).toFixed(1));
setNum('hValoriz',+(P0[1][2]*100).toFixed(1));
{ const p=premissas(); setNum('hValor',p.valor); setNum('hAluguel',Math.round(rendaAno1(p)/12/10)*10); }
setNum('custos',SITE_CONFIG.itbiRegistroPct);
CAMPOS().forEach(el=>{ if(el.type!=='checkbox') el.defaultValue=el.value; });
contato(); setModo('temporada');
const abaLink=aplicarLink();
initV2(); initAuto();
waves(); hero(); show(abaLink||(ANCORA_ABA[location.hash.slice(1)])||'why'); rotaHash();
bcbAoVivoCarregar();
