/* Calculadora Costa Esmeralda
   Dados: dados/dados.js (atualizado pelo robô mensal) + Banco Central ao vivo a cada abertura. */
const D = window.DADOS;
let imprimindo=false;

/* ---------- contato (CRECI: preencher quando sair, aí o título vira "Corretor de imóveis") ---------- */
const CONTATO = { nome:'Santiago F Costa', primeiroNome:'Santiago', whatsapp:'5547992176060', whatsappTxt:'(47) 99217-6060', creci:'' };

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
const pct = (v,d=2) => (v*100).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})+'%';
const p1 = v => v.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const num = id => { const v=parseFloat($(id).value); return isFinite(v)?v:0; };
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const mensal = a => Math.pow(1+a,1/12)-1;
const irRegressivo = m => m<=6?0.225:m<=12?0.20:m<=24?0.175:0.15;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NOMES_MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const fmtMes = k => { const [y,m]=k.split('-'); return NOMES_MES[+m-1]+'/'+y; };
const fmtCurto = k => { const [y,m]=k.split('-'); return NOMES_MES[+m-1]+'/'+y.slice(2); };
const mesesEntre = (a,b) => { const [y1,m1]=a.split('-').map(Number), [y2,m2]=b.split('-').map(Number); return (y2-y1)*12+(m2-m1); };
const BASE='2020-12';

/* ---------- estado derivado dos dados ---------- */
let S, months, iEnd, poupAA, bcbAoVivo=false;
function prepBCB(){
  const B=D.bcb; S=B.series;
  const [y,m]=B.start.split('-').map(Number);
  months=S.cdi.map((_,i)=>{const t=y*12+m-1+i; return `${Math.floor(t/12)}-${String(t%12+1).padStart(2,'0')}`;});
  iEnd=Math.min(...['ivgr','cdi','ipca','igpm','incc'].map(k=>lastIdx(S[k])));
  poupAA=Math.pow(1+B.poup_m/100,12)-1;
}
function lastIdx(a){ for(let i=a.length-1;i>=0;i--) if(a[i]!=null) return i; return -1; }
function acum(k,i0,i1){ if(k==='ivgr') return S.ivgr[i1]/S.ivgr[i0]; let f=1; for(let i=i0+1;i<=i1;i++) f*=1+(S[k][i]||0)/100; return f; }
const mi = k => { const i=months.indexOf(k); return i<0?months.length-1:i; };
const at = (k,key) => Math.min(mi(key), lastIdx(S[k]));
const i12 = k => acum(k,lastIdx(S[k])-12,lastIdx(S[k]))-1;
const anualBCB = (k,anos) => Math.pow(acum(k,iEnd-12*anos,iEnd),1/anos)-1;

// FipeZap: dez/2020 (derivado), cada dezembro e o último mês publicado
const FZ = D.fipezap;
const PTS = FZ.pontos.slice().sort((a,b)=>a.mes.localeCompare(b.mes));
if(!PTS.some(p=>p.mes===FZ.ultimo.mes)) PTS.push(FZ.ultimo);
const PERKEY=[BASE,...PTS.map(p=>p.mes)], LAST=PERKEY.length-1, LASTKEY=PERKEY[LAST];
const PER=PERKEY.map(fmtCurto);
const anosPer=mesesEntre(BASE,LASTKEY)/12;
const CID={itapema:['Itapema','--c-itapema'],bc:['Balneário Camboriú','--c-bc'],floripa:['Florianópolis','--c-floripa'],brasil:['Média Brasil (FipeZap)','--c-brasil']};
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

/* índices BCB nos pontos do FipeZap */
const idxBCB = k => PERKEY.map(p=>100*acum(k,mi(BASE),at(k,p)));
const varBCB = k => PTS.map((p,j)=>{ const ini=p.mes.endsWith('-12')?`${+p.mes.slice(0,4)-1}-12`:`${+p.mes.slice(0,4)-1}${p.mes.slice(4)}`; return 100*(acum(k,mi(ini),at(k,p.mes))-1); });

/* ---------- gráficos ---------- */
const charts={};
function baseOpts(fmt,extra={}){
  const mut=css('--muted'), line=css('--line');
  return Object.assign({responsive:true,maintainAspectRatio:false,animation:(reduce||imprimindo)?false:{duration:1200,easing:'easeOutQuart'},interaction:{mode:'index',intersect:false},
    plugins:{legend:{labels:{color:css('--ink'),boxWidth:10,boxHeight:10,usePointStyle:true,font:{family:'Inter'}}},tooltip:{callbacks:{label:c=>c.parsed.y==null?null:`${c.dataset.label}: ${fmt(c.parsed.y)}`}}},
    scales:{x:{ticks:{color:mut,maxRotation:0,autoSkipPadding:14},grid:{display:false},border:{color:line}},y:{ticks:{color:mut,callback:v=>fmt(v)},grid:{color:line},border:{display:false}}}},extra);
}
const ds=(label,data,color,extra={})=>({label,data,borderColor:color,backgroundColor:color,borderWidth:2,pointRadius:0,pointHoverRadius:4,tension:.25,...extra});
function draw(id,cfg){ if(typeof Chart==='undefined') return; if(charts[id]) charts[id].destroy(); charts[id]=new Chart($(id),cfg); }
const brlK=v=>Math.abs(v)>=1e6?'R$ '+(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi':'R$ '+Math.round(v/1000).toLocaleString('pt-BR')+' mil';

function countUp(el,to,fmt,ms=1300){
  if(reduce){el.textContent=fmt(to);return;}
  const t0=performance.now();
  const step=t=>{const k=Math.min(1,(t-t0)/ms), e=1-Math.pow(1-k,3); el.textContent=fmt(to*e); if(k<1) requestAnimationFrame(step); else el.textContent=fmt(to);};
  requestAnimationFrame(step);
}

/* ---------- herói ---------- */
function status(){
  const dt=D.atualizado.split('-').reverse().join('/');
  $('stamp').innerHTML=`<span class="chip ${bcbAoVivo?'live':''}">${bcbAoVivo?'● Banco Central ao vivo':'Banco Central: dados salvos em '+dt}</span> FipeZap ${fmtMes(LASTKEY)} · CUB/SC ${fmtMes(cubFimKey)}. Imóvel sem contar o aluguel recebido.`;
}
function hero(animar=true){
  const ratio=it[LAST]/it[0];
  $('heroTitle').innerHTML = ratio>=1.9 ? `Quem comprou aqui em 2020 viu o metro quadrado <em>dobrar</em>.` : `Quem comprou aqui em 2020 viu o metro quadrado <em>subir ${pct(ratio-1,0)}</em>.`;
  $('heroLb').textContent=`R$ 100 aplicados em dez/2020 viraram, em ${fmtMes(LASTKEY)}:`;
  const cdi=idxBCB('cdi'), ipca=idxBCB('ipca');
  const rows=[['Imóvel em Itapema',100*ratio,'#3dd6bf'],['CDI (bruto)',cdi[LAST],'#f0a35a'],['CDI após IR',100+(cdi[LAST]-100)*0.85,'#c98a4e'],['Inflação (IPCA)',ipca[LAST],'#ef7d99']];
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
    [['rgba(61,203,181,.18)',0.9,22,0],['rgba(61,203,181,.28)',1.3,16,2],['rgba(242,212,150,.16)',0.7,12,4]].forEach(([col,sp,amp,ph],i)=>{
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
    ['m² médio em Itapema',it[LAST],v=>'R$ '+Math.round(v).toLocaleString('pt-BR'),`FipeZap ${fmtMes(LASTKEY)}`,''],
    ['Valorização desde dez/2020',valIt*100,v=>'+'+p1(v),`${pct(cagrIt,1)} ao ano em média`,'up'],
    ['Ganho acima da inflação',real*100,v=>'+'+p1(v),'valorização real, já descontado o IPCA','up'],
    ['CUB/SC hoje',cubFim,v=>'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),`+${p1(CUB.v12m)} em 12 meses`,''],
    ['Selic hoje',D.bcb.selicMeta,v=>v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%','meta do Copom, ao ano',''],
  ];
  $('kpisWhy').innerHTML=kp.map(([l,,,n,c],i)=>`<div class="kpi"><div class="lb">${l}</div><div class="v ${c}" id="kw${i}">0</div><div class="n">${n}</div></div>`).join('');
  kp.forEach(([,v,f],i)=>countUp($('kw'+i),v,f));
  const r8=CUB.padroes.itens.find(p=>p[0]==='R8-A')[2], br=REG.brasil.m2;
  const reasons=[
    [pct(valIt,0),'de valorização desde dez/2020',`O metro quadrado em Itapema saiu de ${brl(it[0])} para ${brl(it[LAST])}. No mesmo período o CDI bruto rendeu ${p1(cdi[LAST]-100)} e a inflação foi ${p1(ipca[LAST]-100)}.`,'FipeZap e Banco Central'],
    [(it[LAST]/br[fimDe('brasil')]).toLocaleString('pt-BR',{maximumFractionDigits:1})+'×','o preço médio do Brasil',`O m² da região custa ${brl(it[LAST])}, contra ${brl(br[fimDe('brasil')])} na média das cidades do FipeZap. É um mercado de alto padrão, com compradores de todo o país.`,`FipeZap ${fmtMes(LASTKEY)}`],
    ['+'+pct(cubFim/cubIni-1,0),'no custo de construir desde 2020',`O CUB/SC passou de ${brl2(cubIni)} para ${brl2(cubFim)} por m². Obra nova fica mais cara todo mês, o que dá sustentação ao preço do imóvel pronto.`,'Sinduscon Grande Florianópolis'],
    ['Renda + valorização','dois ganhos no mesmo ativo','Além da valorização, o imóvel gera aluguel, com picos na temporada de verão. Na renda fixa o ganho é só o juro, e o IR incide sobre todo o rendimento.','Veja o simulador'],
    ['Ativo real','proteção contra a inflação',`Imóvel acompanha o custo de construção e a inflação no longo prazo. Desde dez/2020 Itapema subiu ${pct(real,0)} acima do IPCA.`,'FipeZap e IBGE'],
    ['Escassez','faixa litorânea limitada','Entre o mar e a BR-101 há pouco terreno disponível. Por isso a região vem verticalizando e o m² segue entre os mais altos do país, à frente de capitais.','Contexto de mercado'],
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
    ...Object.keys(CID).map(k=>{const r=REG[k], i=fimDe(k), anos=mesesEntre(BASE,PERKEY[i])/12; return {n:r.nome,c:r.cor,tot:r.m2[i]/r.m2[0]-1,aa:Math.pow(r.m2[i]/r.m2[0],1/anos)-1,obs:'até '+fmtCurto(PERKEY[i])};}),
    {n:'CDI (bruto)',c:'--c-cdi',tot:cdiTot},{n:'CDI após IR (15%)',c:'--c-cdi',tot:cdiTot*0.85},{n:'Poupança',c:'--c-poup',tot:pouPer()},{n:'IPCA',c:'--c-ipca',tot:idxBCB('ipca')[LAST]/100-1},
    {n:'CUB/SC',c:'--c-cub',tot:cubFim/cubIni-1,aa:Math.pow(cubFim/cubIni,12/mesesEntre(CUB.inicio.mes,cubFimKey))-1,obs:`${fmtCurto(CUB.inicio.mes)} a ${fmtCurto(cubFimKey)}`},
  ].map(r=>({obs:'até '+fmtCurto(LASTKEY),...r,aa:r.aa??Math.pow(1+r.tot,1/anosPer)-1})).sort((a,b)=>b.aa-a.aa);
  $('tblRank').innerHTML=`<thead><tr><th>#</th><th style="text-align:left">Investimento / índice</th><th>Acumulado</th><th>Média ao ano</th><th>R$ 100 viraram</th><th>Período</th></tr></thead><tbody>`+
    rk.map((r,i)=>`<tr><td>${i+1}º</td><td style="text-align:left"><span class="dot" style="background:var(${r.c})"></span>${r.n}</td><td>${pct(r.tot,1)}</td><td><b>${pct(r.aa,1)}</b></td><td>R$ ${Math.round(100*(1+r.tot))}</td><td>${r.obs}</td></tr>`).join('')+
    `</tbody><caption class="note">Imóveis: só a valorização do preço, sem somar o aluguel. Poupança pela regra atual (0,5% ao mês + TR com Selic acima de 8,5%, ou 70% da Selic abaixo disso).</caption>`;

  draw('chCub',{type:'line',data:{labels:CUB.serie.map(x=>fmtCurto(x[0])),datasets:[ds('CUB/SC residencial médio',CUB.serie.map(x=>x[1]),css('--c-cub'),{fill:true,backgroundColor:css('--c-cub')+'26',borderWidth:3})]},
    options:baseOpts(v=>'R$ '+v.toLocaleString('pt-BR',{maximumFractionDigits:0}),{plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>brl2(c.parsed.y)}}}})});
  $('cubRef').textContent=`R$/m², valores de ${CUB.padroes.ref}`;
  $('tblCubPad').innerHTML=`<thead><tr><th>Padrão</th><th style="text-align:left">Tipo</th><th>R$/m²</th></tr></thead><tbody>`+CUB.padroes.itens.map(([c,d,v])=>`<tr><td><b>${c}</b></td><td style="text-align:left">${d}</td><td>${brl2(v)}</td></tr>`).join('')+'</tbody>';
  // população
  const cr=k=>POP[k][1][1]/POP[k][1][0]-1;
  $('popKpis').innerHTML=['portobelo','bombinhas','itapema'].map(k=>`<div class="kpi"><div class="lb">${POP[k][0]}</div><div class="v">+${pct(cr(k),0)}</div><div class="n">${POP[k][1][0].toLocaleString('pt-BR')} → ${POP[k][1][1].toLocaleString('pt-BR')} moradores (2010 → 2022). Estimativa 2025: ${POP[k][1][2].toLocaleString('pt-BR')}</div></div>`).join('')+
    `<div class="kpi"><div class="lb">Para comparar</div><div class="v" style="color:var(--muted)">+${pct(cr('br'),1)}</div><div class="n">Brasil no mesmo período. Santa Catarina: +${pct(cr('sc'),1)}</div></div>`;
  draw('chPop',{type:'bar',data:{labels:['Itapema','Porto Belo','Bombinhas'],datasets:[['2010','--c-brasil'],['2022','--c-floripa'],['2025 (estim.)','--c-itapema']].map(([l,c],i)=>({label:l,data:['itapema','portobelo','bombinhas'].map(k=>POP[k][1][i]),backgroundColor:css(c),borderRadius:4}))},
    options:baseOpts(v=>Math.round(v/1000)+' mil')});
  draw('chPopCresc',{type:'bar',data:{labels:Object.values(POP).map(p=>p[0]),datasets:[{label:'Crescimento 2010–2022',data:Object.keys(POP).map(k=>100*cr(k)),backgroundColor:Object.values(POP).map(p=>css(p[2])),borderRadius:4}]},
    options:baseOpts(p1,{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>'+'+p1(c.parsed.x)}}},scales:{x:{ticks:{color:css('--muted'),callback:v=>v+'%'},grid:{color:css('--line')}},y:{ticks:{color:css('--ink')},grid:{display:false}}}})});

  $('cubCallout').innerHTML=`Construir um prédio alto padrão (R8-A) custa <b>${brl2(r8)}/m²</b> só de obra, sem terreno, projeto, elevador, impostos e lucro do incorporador. O m² médio vendido em Itapema é <b>${brl(it[LAST])}</b>.`;
}

/* ---------- simulador ---------- */
function premissas(){
  return {valor:num('valor'),entrada:Math.min(num('entrada'),num('valor')),custos:num('custos')/100,juros:num('juros')/100,prazo:Math.max(1,Math.round(num('prazo'))),
    sistema:$('sistema').value,modo:$('modo').value,aluguel:num('aluguel'),reaj:num('reajAluguel')/100,vac:num('vacancia')/100,
    dA:num('diariaAlta'),oA:num('ocupAlta')/100,mA:Math.min(12,Math.max(0,Math.round(num('mesesAlta')))),dB:num('diariaBaixa'),oB:num('ocupBaixa')/100,adm:num('adm')/100,desp:num('desp'),irAl:num('irAluguel')/100,
    valoriz:num('valoriz')/100,anos:Math.min(35,Math.max(1,Math.round(num('anos')))),corr:num('corretagem')/100,irGanho:$('irGanho').checked,
    cdi:num('cdi')/100,pctCdi:num('pctCdi')/100,poup:num('poup')/100,ipca:num('ipca')/100,spread:num('spread')/100};
}
// renda bruta recebida no mês m (1 = janeiro do 1º ano). Temporada: alta = dezembro + os (n-1) primeiros meses do ano
const DIAS_MES=30.4;
function ehAlta(mes0,n){ if(n<=0) return false; return mes0===11 || mes0<n-1; }
function rendaMes(p,m){
  if(p.modo!=='temporada') return p.aluguel*(1-p.vac);
  const mes0=(m-1)%12;
  return ehAlta(mes0,p.mA) ? p.dA*p.oA*DIAS_MES : p.dB*p.oB*DIAS_MES;
}
const rendaAno1=p=>{let s=0; for(let m=1;m<=12;m++) s+=rendaMes(p,m); return s;};
function simular(p){
  const N=p.anos*12, iFin=mensal(p.juros), P0=p.valor-p.entrada, custoCompra=p.valor*p.custos, C0=p.entrada+custoCompra;
  const pmt=P0>0?P0*iFin/(1-Math.pow(1+iFin,-p.prazo)):0;
  const rCdb=mensal(p.cdi*p.pctCdi), rCaixa=mensal(p.cdi*0.85), rPoup=mensal(p.poup), rIpca=mensal((1+p.ipca)*(1+p.spread)-1);
  let saldo=P0, caixa=0, aportes=0; const alt={cdb:C0,poup:C0,ipca:C0};
  const fluxos=[-C0], aport=[0], anual=[], ano1={aluguel:0,adm:0,ir:0,desp:0,parcela:0,juros:0};
  const liq=m=>{const vI=p.valor*Math.pow(1+p.valoriz,m/12), venda=vI*(1-p.corr), ir=p.irGanho?Math.max(0,venda-(p.valor+custoCompra))*0.15:0, inv=C0+aportes, a=irRegressivo(m);
    return {imovel:venda-saldo-ir+caixa,vI,venda,irVenda:ir,investido:inv,cdb:alt.cdb-Math.max(0,alt.cdb-inv)*a,poup:alt.poup,ipca:alt.ipca-Math.max(0,alt.ipca-inv)*a};};
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
  return {p,C0,P0,fluxos,aport,anual,fim,ano1,aportes};
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
  const P=[['cons','Conservador',cons,'ritmo de Itapema no ano atual'],
           ['mod','Moderado',Math.pow(REG.brasil.m2[fimDe('brasil')]/REG.brasil.m2[0],1/anosPer)-1,'média Brasil FipeZap desde 2020'],
           ['oti','Otimista',Math.pow(it[LAST]/it[i3],12/mesesEntre(PERKEY[i3],LASTKEY))-1,`Itapema desde ${fmtCurto(PERKEY[i3])}`]];
  $('presets').innerHTML=P.map(([k,n,v,d])=>`<button type="button" data-v="${(v*100).toFixed(1)}" data-k="${k}" aria-pressed="${k===presetSel}" title="${d}">${n} ${p1(v*100)}</button>`).join('');
  return P;
}
function renderSim(){
  const p=premissas(), r=simular(p), f=r.fim, T=tir(r.fluxos), inv=f.investido, roi=f.imovel/inv-1;
  const alts=[{k:'imovel',n:'Imóvel',c:'--c-itapema',v:f.imovel},{k:'cdb',n:`CDB ${Math.round(p.pctCdi*100)}% do CDI`,c:'--c-cdi',v:f.cdb},{k:'ipca',n:`Tesouro IPCA+ ${p1(p.spread*100)}`,c:'--c-floripa',v:f.ipca},{k:'poup',n:'Poupança',c:'--c-poup',v:f.poup}];
  const bruto1=p.modo==='temporada'?rendaAno1(p):p.aluguel*12;
  const best=alts.slice(1).reduce((a,b)=>b.v>a.v?b:a), ganha=f.imovel>=best.v, be=empate(p), yb=bruto1/p.valor;
  if(p.modo==='temporada'){ const alta=p.dA*p.oA*DIAS_MES, baixa=p.dB*p.oB*DIAS_MES;
    $('tempResumo').textContent=`Receita bruta: ${brl(alta)}/mês na alta e ${brl(baixa)}/mês no resto do ano. Total no 1º ano: ${brl(bruto1)} (média ${brl(bruto1/12)}/mês).`; }
  const noi=r.ano1.aluguel-r.ano1.adm-r.ano1.desp, cf1=r.fluxos.slice(1,13).reduce((a,b)=>a+b,0);
  const beTxt=isFinite(be)?`O imóvel empata com o CDB se valorizar <b>${pct(be,1)} ao ano</b>. Itapema fez ${pct(Math.pow(it[LAST]/it[0],1/anosPer)-1,1)} ao ano desde 2020.`:(be<0?'O imóvel supera o CDB mesmo sem valorização.':'Nem com 30% ao ano de valorização o imóvel supera o CDB neste cenário.');
  $('verdict').className='verdict '+(ganha?'good':'bad');
  $('verdict').innerHTML=(ganha?`<b>Em ${p.anos} anos o imóvel rende mais: ${brl(f.imovel)} contra ${brl(best.v)} em ${best.n}.</b>`:`<b>Em ${p.anos} anos ${best.n} rende mais: ${brl(best.v)} contra ${brl(f.imovel)} no imóvel.</b>`)+`<span>${beTxt}</span>`;
  const kp=[['TIR do imóvel',isFinite(T)?pct(T):'—','retorno anual do seu dinheiro'],['ROI total',pct(roi,1),`lucro de ${brl(f.imovel-inv)}`],['Desembolso total',brl(inv),`${brl(r.C0)} na compra + ${brl(r.aportes)} em aportes`],
    ['Yield bruto',pct(yb),'aluguel anual ÷ valor'],['Cap rate líquido',pct(noi/p.valor),'após vacância, adm. e despesas'],['Imóvel na venda',brl(f.vI),`${pct(p.valoriz,1)} ao ano por ${p.anos} anos`]];
  $('kpis').innerHTML=kp.map(([l,v,n])=>`<div class="kpi"><div class="lb">${l}</div><div class="v">${v}</div><div class="n">${n}</div></div>`).join('');
  $('tblComp').innerHTML=`<thead><tr><th>Alternativa</th><th>Patrimônio final</th><th>Lucro</th><th>Retorno total</th><th>Equivalente ao ano</th></tr></thead><tbody>`+
    alts.slice().sort((a,b)=>b.v-a.v).map(a=>{const l=a.v-inv, eq=a.k==='imovel'?T:tir(fluxAlt(r,a.v)); return `<tr><td><span class="dot" style="background:var(${a.c})"></span>${a.n}</td><td>${brl(a.v)}</td><td class="${l>=0?'pos':'neg'}">${brl(l)}</td><td>${pct(a.v/inv-1,1)}</td><td>${isFinite(eq)?pct(eq):'—'}</td></tr>`;}).join('')+'</tbody>';
  const vs=[-4,-2,0,2,4].map(d=>Math.round((p.valoriz+d/100)*1000)/1000), hs=[5,10,15,20,25];
  let h=`<thead><tr><th>Valorização a.a.</th>${hs.map(a=>`<th>${a} anos</th>`).join('')}</tr></thead><tbody>`;
  for(const vv of vs){ h+=`<tr><td>${pct(vv,1)}</td>`; for(const a of hs){const rr=simular({...p,valoriz:vv,anos:a}), t=tir(rr.fluxos), c=tir(fluxAlt(rr,rr.fim.cdb)); h+=`<td class="${t>=c?'hit':'miss'}${vv===Math.round(p.valoriz*1000)/1000&&a===p.anos?' base':''}">${isFinite(t)?pct(t,1):'—'}</td>`;} h+='</tr>'; }
  $('tblSens').innerHTML=h+'</tbody>';
  const a1=r.ano1, mm=x=>brl(x/12);
  $('tblFluxo').innerHTML=`<tbody><tr><td>${p.modo==='temporada'?'Diárias recebidas (com ocupação)':'Aluguel recebido (com vacância)'}</td><td class="pos">${mm(a1.aluguel)}</td></tr><tr><td>Taxa de administração</td><td class="neg">−${mm(a1.adm)}</td></tr><tr><td>IR sobre aluguel</td><td class="neg">−${mm(a1.ir)}</td></tr><tr><td>Despesas do proprietário</td><td class="neg">−${mm(a1.desp)}</td></tr><tr><td>Parcela do financiamento</td><td class="neg">−${mm(a1.parcela)}</td></tr><tr><td><b>Sobra (ou aporte) por mês</b></td><td class="${cf1>=0?'pos':'neg'}"><b>${mm(cf1)}</b></td></tr><tr><td>dos quais juros pagos ao banco</td><td>${mm(a1.juros)}</td></tr></tbody>`;
  const sets=alts.map(a=>ds(a.n,r.anual.map(x=>x[a.k]),css(a.c),a.k==='imovel'?{borderWidth:3.5}:{}));
  sets.push(ds('Dinheiro investido',r.anual.map(x=>x.investido),css('--muted'),{borderDash:[5,4],borderWidth:1.5}));
  draw('chEvol',{type:'line',data:{labels:r.anual.map(x=>'Ano '+x.ano),datasets:sets},options:baseOpts(brlK,{animation:false})});
  $('resumo').value=`Simulação de investimento – Costa Esmeralda (SC)
Imóvel: ${brl(p.valor)} | Entrada: ${brl(p.entrada)}${r.P0>0?` | Financiado: ${brl(r.P0)} (${pct(p.juros,1)} a.a., ${p.prazo} meses, ${p.sistema})`:' (à vista)'}
${p.modo==='temporada'?`Temporada: diária ${brl(p.dA)} na alta (${p.mA} meses, ${Math.round(p.oA*100)}% ocupação) e ${brl(p.dB)} no resto do ano (${Math.round(p.oB*100)}%)
Receita bruta do 1º ano: ${brl(bruto1)} (${pct(yb)} sobre o valor do imóvel)`:`Aluguel: ${brl(p.aluguel)}/mês (${pct(yb)} ao ano sobre o valor)`}
Valorização considerada: ${pct(p.valoriz,1)} ao ano

Em ${p.anos} anos, colocando ${brl(inv)} do próprio bolso:
- Imóvel: ${brl(f.imovel)} (retorno de ${isFinite(T)?pct(T):'—'} ao ano)
- CDB ${Math.round(p.pctCdi*100)}% do CDI: ${brl(f.cdb)}
- Tesouro IPCA+: ${brl(f.ipca)}
- Poupança: ${brl(f.poup)}
Valores líquidos de IR, corretagem e saldo devedor.

Histórico real (dez/2020 a ${fmtMes(LASTKEY)}):
- m² em Itapema: ${brl(it[0])} → ${brl(it[LAST])} (+${pct(it[LAST]/it[0]-1,0)}) – FipeZap
- CDI no período: +${pct(idxBCB('cdi')[LAST]/100-1,0)} (bruto) | IPCA: +${pct(idxBCB('ipca')[LAST]/100-1,0)} – Banco Central
- CUB/SC hoje: ${brl2(cubFim)}/m² (+${p1(CUB.v12m)} em 12 meses) – Sinduscon
Selic hoje: ${p1(D.bcb.selicMeta)}.
Simulação ilustrativa. Rentabilidade passada não garante rentabilidade futura.

Veja a simulação completa: ${linkEstado()}
${assinatura()}`;
  ultimoResumoWA=`Olá ${CONTATO.primeiroNome}! Vi a simulação no site Investir na Costa Esmeralda: imóvel de ${brl(p.valor)}, retorno de ${isFinite(T)?pct(T):'—'} ao ano em ${p.anos} anos. Quero conversar sobre isso.\n${linkEstado()}`;
  atualizaWA();
}

/* ---------- na planta ---------- */
function simPlanta(){
  const V=num('pValor'), N=Math.min(72,Math.max(6,Math.round(num('pObra')))), e=num('pEntrada')/100, ms=num('pMensais')/100, rf=num('pReforcos')/100;
  const ch=Math.max(0,1-e-ms-rf), c=mensal(num('pCorrecao')/100), v=num('pValoriz')/100, corr=num('pCorretagem')/100, rCdi=mensal(num('pCdi')/100);
  const nRef=Math.max(1,Math.floor(N/12)), fat=t=>Math.pow(1+c,t);
  const pag=new Array(N+1).fill(0), tipo={ato:V*e,mensalIni:V*ms/N*fat(1),mensalFim:V*ms/N*fat(N),reforcos:[]};
  pag[0]+=V*e;
  for(let t=1;t<=N;t++) pag[t]+=V*ms/N*fat(t);
  for(let k=1;k<=nRef;k++){ const t=Math.min(N,12*k); pag[t]+=V*rf/nRef*fat(t); tipo.reforcos.push([t,V*rf/nRef*fat(t)]); }
  const saldoChaves=V*ch*fat(N);
  const M=num('pMercado')||V, vm=t=>M*Math.pow(1+v,t/12);
  const totalPago=pag.reduce((a,b)=>a+b,0);
  const venda=vm(N)*(1-corr), ganho=venda-(totalPago+saldoChaves), ir=$('pIr').checked?Math.max(0,ganho)*0.15:0;
  const liquido=venda-saldoChaves-ir, lucro=liquido-totalPago;
  // CDB com os mesmos pagamentos
  let cdb=0, acum=0; const serie=[];
  for(let t=0;t<=N;t++){ cdb=cdb*(1+rCdi)+pag[t]; acum+=pag[t]; serie.push({t,vm:vm(t),pago:acum,cdb}); }
  const cdbLiq=cdb-Math.max(0,cdb-totalPago)*irRegressivo(N);
  const fl=pag.map(x=>-x); fl[N]+=liquido;
  return {V,M,N,e,ms,rf,ch,nRef,tipo,saldoChaves,totalPago,venda,ir,liquido,lucro,roi:lucro/totalPago,tir:tir(fl),cdbLiq,serie,vmN:vm(N),patrimonio:vm(N)-saldoChaves};
}
function renderPlanta(){
  const r=simPlanta(), soma=r.e+r.ms+r.rf;
  $('pChavesTxt').innerHTML = soma>1 ? `<span class="neg">Entrada + mensais + reforços passam de 100%. Ajuste os percentuais.</span>` : `Saldo nas chaves: <b>${pct(r.ch,0)}</b> do valor (${brl(r.saldoChaves)} já corrigido), pago com financiamento ou pelo comprador.`;
  const ganha=r.liquido>r.cdbLiq, mult=r.lucro/(r.cdbLiq-r.totalPago);
  $('pVerdict').className='verdict '+(ganha?'good':'bad');
  $('pVerdict').innerHTML=ganha?`<b>Vendendo na entrega das chaves, o lucro é de ${brl(r.lucro)} sobre ${brl(r.totalPago)} pagos.</b><span>${isFinite(mult)&&mult>1?`É ${mult.toLocaleString('pt-BR',{maximumFractionDigits:1})}× o lucro que o mesmo dinheiro daria no CDB (${brl(r.cdbLiq-r.totalPago)}).`:`O CDB com os mesmos pagamentos daria ${brl(r.cdbLiq-r.totalPago)} de lucro.`}</span>`
    :`<b>Neste cenário o CDB rende mais: ${brl(r.cdbLiq-r.totalPago)} contra ${brl(r.lucro)} no imóvel.</b><span>${r.M===r.V?'Informe o preço de um imóvel pronto parecido: se a tabela do lançamento é mais barata, essa diferença vira ganho na entrega.':'A valorização esperada não cobre a correção das parcelas neste cenário.'}</span>`;
  const kp=[['Você paga até as chaves',brl(r.totalPago),`em ${r.N} meses, já corrigido`],['Valor na entrega',brl(r.vmN),`${pct(num('pValoriz')/100,1)} ao ano de valorização`],['Lucro na venda',brl(r.lucro),'após saldo, corretagem e IR'],
    ['ROI sobre o que pagou',pct(r.roi,1),'retorno total'],['TIR',isFinite(r.tir)?pct(r.tir):'—','retorno ao ano'],['Se ficar com o imóvel',brl(r.patrimonio),'valor menos o saldo das chaves']];
  $('pKpis').innerHTML=kp.map(([l,v,n])=>`<div class="kpi"><div class="lb">${l}</div><div class="v">${v}</div><div class="n">${n}</div></div>`).join('');
  $('pTbl').innerHTML=`<tbody>${r.M!==r.V?`<tr><td>Tabela ${r.M>r.V?'abaixo':'acima'} do pronto parecido</td><td class="${r.M>r.V?'pos':'neg'}">${pct(Math.abs(1-r.V/r.M),1)}</td></tr>`:''}<tr><td>Valor de venda na entrega</td><td>${brl(r.vmN)}</td></tr><tr><td>Corretagem</td><td class="neg">−${brl(r.vmN-r.venda)}</td></tr><tr><td>Saldo devedor nas chaves</td><td class="neg">−${brl(r.saldoChaves)}</td></tr><tr><td>IR sobre o ganho</td><td class="neg">−${brl(r.ir)}</td></tr>
    <tr><td><b>Você recebe</b></td><td><b>${brl(r.liquido)}</b></td></tr><tr><td>Você pagou</td><td>${brl(r.totalPago)}</td></tr><tr><td><b>Lucro</b></td><td class="${r.lucro>=0?'pos':'neg'}"><b>${brl(r.lucro)}</b></td></tr><tr><td>Mesmo dinheiro no CDB (líquido)</td><td>${brl(r.cdbLiq)}</td></tr></tbody>`;
  $('pCron').innerHTML=`<thead><tr><th>Parcela</th><th>Qtd.</th><th>Valor</th></tr></thead><tbody><tr><td>Entrada (ato)</td><td>1</td><td>${brl(r.tipo.ato)}</td></tr>
    <tr><td>Mensais</td><td>${r.N}</td><td>${brl(r.tipo.mensalIni)} → ${brl(r.tipo.mensalFim)}</td></tr>
    <tr><td>Reforços anuais</td><td>${r.nRef}</td><td>${brl(r.tipo.reforcos[0][1])} → ${brl(r.tipo.reforcos.at(-1)[1])}</td></tr>
    <tr><td>Chaves</td><td>1</td><td>${brl(r.saldoChaves)}</td></tr></tbody><caption class="note">Valores corrigidos mês a mês pelo índice da obra.</caption>`;
  const lab=r.serie.map(x=>x.t===0?'Compra':x.t===r.N?'Chaves':'Mês '+x.t);
  draw('chPlanta',{type:'line',data:{labels:lab,datasets:[ds('Valor do imóvel',r.serie.map(x=>x.vm),css('--c-itapema'),{borderWidth:3.5}),ds('Quanto você já pagou',r.serie.map(x=>x.pago),css('--c-bc'),{stepped:true,tension:0}),ds('Mesmos pagamentos no CDB',r.serie.map(x=>x.cdb),css('--c-cdi'),{borderDash:[6,4]})]},
    options:baseOpts(brlK,{animation:false})});
  ultimoResumoWA=`Olá ${CONTATO.primeiroNome}! Vi a simulação de imóvel na planta no site: tabela ${brl(r.V)}, entrega em ${r.N} meses, lucro estimado de ${brl(r.lucro)} na entrega. Quero conversar sobre isso.\n${linkEstado()}`;
  atualizaWA();
}

/* ---------- contato / WhatsApp ---------- */
let ultimoResumoWA='';
const assinatura=()=>`${CONTATO.nome}${CONTATO.creci?' · Corretor de imóveis · CRECI '+CONTATO.creci:''} · WhatsApp ${CONTATO.whatsappTxt}`;
const waURL=msg=>`https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent(msg)}`;
function atualizaWA(){
  const generico=`Olá ${CONTATO.primeiroNome}! Vi o site Investir na Costa Esmeralda e quero saber mais sobre imóveis na região.`;
  const msg=(tab==='sim'||tab==='planta')&&ultimoResumoWA?ultimoResumoWA:generico;
  $('wa').href=waURL(msg); $('waBox').href=waURL(msg);
}
function contato(){
  $('waLabel').textContent=`Fale com ${CONTATO.primeiroNome}`;
  $('contatoTxt').textContent=`${CONTATO.nome}${CONTATO.creci?' · Corretor de imóveis · CRECI '+CONTATO.creci:''} · WhatsApp ${CONTATO.whatsappTxt}. Monto a simulação com o valor, o aluguel e o fluxo de pagamento do imóvel que você está avaliando.`;
}

/* ---------- link personalizado ---------- */
const CAMPOS=()=>[...document.querySelectorAll('#form input, #form select, #formPlanta input')].filter(el=>el.id);
function linkEstado(){
  const q=new URLSearchParams();
  for(const el of CAMPOS()){ if(el.type==='checkbox'){ if(!el.checked) q.set(el.id,'0'); } else if(el.value!==el.defaultValue||el.id==='valoriz'||el.id==='modo') q.set(el.id,el.value); }
  q.set('aba',tab==='planta'?'planta':'sim');
  return location.origin+location.pathname+'?'+q.toString();
}
function aplicarLink(){
  const q=new URLSearchParams(location.search); if(![...q.keys()].length) return null;
  for(const el of CAMPOS()){ if(!q.has(el.id)) continue; if(el.type==='checkbox') el.checked=q.get(el.id)!=='0'; else el.value=q.get(el.id); }
  if(q.has('valoriz')){ presetSel=''; presets(); }
  setModo($('modo').value);
  return q.get('aba');
}
function setModo(m){
  $('modo').value=m;
  document.querySelectorAll('#modoAluguel button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===m));
  $('grpAnual').hidden=m!=='anual'; $('grpTemp').hidden=m!=='temporada';
}
async function copiar(txt,msgEl){
  try{ await navigator.clipboard.writeText(txt); msgEl.textContent='Link copiado. Cole no WhatsApp do cliente.'; }
  catch{ prompt('Copie o link:',txt); }
}

/* ---------- PDF da proposta (impressão do navegador) ---------- */
function gerarPDF(){
  const hoje=new Date().toLocaleDateString('pt-BR');
  $('printTitle').textContent=tab==='planta'?'Simulação de imóvel na planta · Costa Esmeralda (SC)':'Simulação de investimento imobiliário · Costa Esmeralda (SC)';
  $('printSub').textContent=`${assinatura()} · ${hoje} · Dados: FipeZap, Banco Central, Sinduscon, IBGE`;
  const form=tab==='planta'?$('formPlanta'):tab==='sim'?$('form'):null;
  $('printPrem').textContent = form ? 'Premissas: '+[...form.querySelectorAll('.f')].filter(f=>!f.closest('[hidden]')).map(f=>{const l=f.querySelector('label').childNodes[0].textContent.trim(), el=f.querySelector('input,select'), un=[...f.querySelectorAll('.in span')].map(x=>x.textContent).join(' ').replace('IPCA+','').trim(); return `${l}: ${el.tagName==='SELECT'?el.value:Number(el.value).toLocaleString('pt-BR')}${un&&un!=='R$'?' '+un:''}`.replace(/: (\d)/, (m,d)=> un==='R$'?': R$ '+d:m);}).join(' · ') : '';
  window.print();
}
addEventListener('beforeprint',()=>{imprimindo=true; renders[tab]();});
addEventListener('afterprint',()=>{imprimindo=false; renders[tab]();});

/* ---------- índices Brasil ---------- */
const HIST=[['ivgr','Imóveis Brasil (IVG-R)','--c-itapema'],['cdi','CDI','--c-cdi'],['ipca','IPCA','--c-ipca'],['igpm','IGP-M','--c-bc'],['incc','INCC','--c-cub']];
let histMeses=60;
function renderIdx(){
  const B=D.bcb;
  const tk=[['Selic meta',B.selicMeta/100,'Copom, ao ano'],['CDI',B.cdiAA/100,'anualizado'],['IPCA 12m',i12('ipca'),'até '+fmtMes(months[lastIdx(S.ipca)])],['IGP-M 12m',i12('igpm'),'reajuste de aluguel'],['INCC 12m',i12('incc'),'custo da construção'],['Poupança',poupAA,'ao ano']];
  $('ticker').innerHTML=tk.map(([l,v,n])=>`<div class="kpi"><div class="lb">${l}</div><div class="v">${pct(v)}</div><div class="n">${n}</div></div>`).join('');
  const histStart=Math.max(0,iEnd-histMeses);
  const opts=[['1 ano',12],['3 anos',36],['5 anos',60],['Desde 2016',9999]];
  $('segStart').innerHTML=opts.map(([l,n])=>`<button type="button" data-n="${n}" aria-pressed="${n===histMeses}">${l}</button>`).join('');
  const idx=[]; for(let i=histStart;i<=iEnd;i++) idx.push(i);
  draw('chHist',{type:'line',data:{labels:idx.map(i=>fmtMes(months[i])),datasets:HIST.map(([k,n,c])=>ds(n,idx.map(i=>100*acum(k,histStart,i)),css(c),k==='ivgr'?{borderWidth:3}:{}))},options:baseOpts(v=>'R$ '+Math.round(v))});
  $('histEnd').textContent=`Janelas terminando em ${fmtMes(months[iEnd])}, último mês com todos os índices publicados.`;
  const jan=[12,36,60,iEnd];
  $('tblHist').innerHTML=`<thead><tr><th>Indicador</th>${jan.map(n=>`<th>${n===iEnd?'Desde jan/2016':n/12+(n===12?' ano':' anos')}</th>`).join('')}<th>Média a.a. (5 anos)</th></tr></thead><tbody>`+
    HIST.map(([k,n,c])=>`<tr><td><span class="dot" style="background:var(${c})"></span>${n}</td>${jan.map(j=>`<td>${pct(acum(k,iEnd-j,iEnd)-1,1)}</td>`).join('')}<td><b>${pct(anualBCB(k,5))}</b></td></tr>`).join('')+'</tbody>';
  const all=[]; for(let i=0;i<=lastIdx(S.selic);i++) all.push(i);
  draw('chSelic',{type:'line',data:{labels:all.map(i=>fmtMes(months[i])),datasets:[ds('Selic (% ao ano)',all.map(i=>S.selic[i]),css('--c-cdi'),{fill:true,backgroundColor:css('--c-cdi')+'22',stepped:true,tension:0})]},options:baseOpts(p1)});
  const v12=[]; for(let i=12;i<=iEnd;i++) v12.push(i);
  draw('chVal',{type:'line',data:{labels:v12.map(i=>fmtMes(months[i])),datasets:[ds('Imóveis Brasil',v12.map(i=>100*(acum('ivgr',i-12,i)-1)),css('--c-itapema'),{borderWidth:3}),ds('IPCA',v12.map(i=>100*(acum('ipca',i-12,i)-1)),css('--c-ipca')),ds('IGP-M',v12.map(i=>100*(acum('igpm',i-12,i)-1)),css('--c-bc'))]},options:baseOpts(p1)});
}

/* ---------- correção ---------- */
function opcoesCorr(){
  const anos=PERKEY.filter(k=>k.endsWith('-12')&&k!==LASTKEY).map(k=>k.slice(0,4));
  $('cAno').innerHTML=anos.map(a=>`<option${a==='2021'?' selected':''}>${a}</option>`).join('');
}
function renderCorr(){
  const v=num('cValor'), ano=$('cAno').value, j=PERKEY.indexOf(ano+'-12'), ini=ano+'-12', anos=mesesEntre(ini,LASTKEY)/12;
  const L=[['Itapema (FipeZap)','--c-itapema',it[LAST]/it[j]],['Média Brasil (FipeZap)','--c-brasil',REG.brasil.m2[fimDe('brasil')]/REG.brasil.m2[j]],
    ['CDI bruto','--c-cdi',acum('cdi',mi(ini),at('cdi',LASTKEY))],['IPCA','--c-ipca',acum('ipca',mi(ini),at('ipca',LASTKEY))],['IGP-M','--c-bc',acum('igpm',mi(ini),at('igpm',LASTKEY))]];
  $('corrKpis').innerHTML=`<div class="kpi"><div class="lb">Valor estimado hoje</div><div class="v up">${brl(v*L[0][2])}</div><div class="n">pela valorização média de Itapema</div></div>
    <div class="kpi"><div class="lb">Se ficasse no CDI</div><div class="v">${brl(v*L[2][2])}</div><div class="n">bruto, antes do IR</div></div>
    <div class="kpi"><div class="lb">Ganho real</div><div class="v up">${pct(L[0][2]/L[3][2]-1,1)}</div><div class="n">acima do IPCA</div></div>`;
  $('tblCorr').innerHTML=`<thead><tr><th>Corrigido por</th><th>Valor hoje</th><th>Variação</th><th>Média ao ano</th></tr></thead><tbody>`+
    L.map(([n,c,f])=>`<tr><td><span class="dot" style="background:var(${c})"></span>${n}</td><td>${brl(v*f)}</td><td>${pct(f-1,1)}</td><td>${pct(Math.pow(f,1/anos)-1)}</td></tr>`).join('')+
    `</tbody><caption class="note">De dez/${ano} até ${fmtMes(LASTKEY)}. É a média da cidade; localização, vista para o mar e padrão mudam bastante o valor de cada imóvel.</caption>`;
}

/* ---------- Banco Central ao vivo ---------- */
async function bcbAoVivoCarregar(){
  const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),9000);
  const get=async u=>{const r=await fetch(u,{signal:ctrl.signal}); if(!r.ok) throw new Error(r.status); return r.json();};
  const base='https://api.bcb.gov.br/dados/serie/bcdata.sgs.';
  const cods={selic:4189,cdi:4391,ipca:433,igpm:189,incc:192,ivgr:21340};
  try{
    const res=await Promise.all([...Object.values(cods).map(c=>get(`${base}${c}/dados?formato=json&dataInicial=01/01/2016`)),
      get(`${base}432/dados/ultimos/1?formato=json`),get(`${base}4389/dados/ultimos/1?formato=json`),get(`${base}195/dados/ultimos/20?formato=json`)]);
    const brutos={}; Object.keys(cods).forEach((k,i)=>{brutos[k]={}; for(const r of res[i]){const [dd,mm,aa]=r.data.split('/'); brutos[k][`${aa}-${mm}`]=parseFloat(r.valor);}});
    const hoje=new Date(), atual=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
    delete brutos.cdi[atual]; delete brutos.selic[atual];
    const fim=Object.values(brutos).map(o=>Object.keys(o).sort().at(-1)).sort().at(-1);
    const ms=[]; for(let y=2016,m=1; `${y}-${String(m).padStart(2,'0')}`<=fim; m++){ if(m>12){y++;m=1;} const k=`${y}-${String(m).padStart(2,'0')}`; if(k>fim) break; ms.push(k); }
    const poup=res[8].map(r=>parseFloat(r.valor));
    const nova={start:'2016-01',series:Object.fromEntries(Object.keys(cods).map(k=>[k,ms.map(m=>brutos[k][m]??null)])),poup_m:poup.reduce((a,b)=>a+b,0)/poup.length,
      selicMeta:parseFloat(res[6].at(-1).valor),cdiAA:parseFloat(res[7].at(-1).valor)};
    if(nova.series.cdi.length<100||!isFinite(nova.selicMeta)) throw new Error('resposta incompleta');
    D.bcb=nova; bcbAoVivo=true; prepBCB(); hints(); hero(false); renders[tab]();
  }catch(e){ console.info('Banco Central indisponível, usando dados salvos:',e.message); }
  finally{ clearTimeout(timer); }
}

/* ---------- eventos ---------- */
let tab='why';
const renders={why:renderWhy,sim:renderSim,planta:renderPlanta,idx:renderIdx,corr:renderCorr};
function show(t){ if(!renders[t]) t='why'; tab=t;
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));
  for(const k of Object.keys(renders)) $('p-'+k).hidden=k!==t;
  renders[t](); atualizaWA();
}
function hints(){
  $('cdiHint').textContent=`Hoje: ${pct(D.bcb.cdiAA/100)}`;
  $('poupHint').textContent=`Hoje: ${pct(poupAA)}`;
  $('ipcaHint').textContent=`Últimos 12m: ${pct(i12('ipca'))}`;
}
document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('button'); if(b) show(b.dataset.tab);});
$('segStart').addEventListener('click',e=>{const b=e.target.closest('button'); if(b){histMeses=+b.dataset.n; renderIdx();}});
$('presets').addEventListener('click',e=>{const b=e.target.closest('button'); if(!b) return; presetSel=b.dataset.k; $('valoriz').value=b.dataset.v; presets(); renderSim();});
$('form').addEventListener('input',e=>{ if(e.target.id==='valoriz'){presetSel=''; presets();} renderSim(); });
['cValor','cAno'].forEach(id=>$(id).addEventListener('input',renderCorr));
$('formPlanta').addEventListener('input',renderPlanta);
$('modoAluguel').addEventListener('click',e=>{const b=e.target.closest('button'); if(!b) return; setModo(b.dataset.m); renderSim();});
document.querySelectorAll('[data-pdf]').forEach(b=>b.addEventListener('click',gerarPDF));
document.querySelectorAll('[data-link]').forEach(b=>b.addEventListener('click',()=>copiar(linkEstado(),b.parentElement.querySelector('[data-msg]'))));
$('copy').addEventListener('click',()=>{const ta=$('resumo');
  navigator.clipboard.writeText(ta.value).then(()=>$('copyMsg').textContent='Copiado. Cole no WhatsApp ou e-mail.').catch(()=>{ta.focus();ta.select();$('copyMsg').textContent='Texto selecionado. Use Ctrl+C para copiar.';});});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{hero(false); renders[tab]();});

prepBCB(); hints(); opcoesCorr();
$('poup').value=(poupAA*100).toFixed(1);
const P0=presets(); $('valoriz').value=(P0[1][2]*100).toFixed(1);
$('pCorrecao').value=CUB.v12m.toFixed(1); $('pCorrHint').textContent=`CUB/SC subiu ${p1(CUB.v12m)} em 12 meses`;
$('pValoriz').value=(P0[2][2]*100).toFixed(1);
for(const id of ['valoriz','pCorrecao','pValoriz']) $(id).defaultValue=$(id).value;
contato(); setModo('temporada');
const abaLink=aplicarLink();
waves(); hero(); show(abaLink||'why');
bcbAoVivoCarregar();
