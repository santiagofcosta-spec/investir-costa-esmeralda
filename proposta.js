/* Proposta para o cliente (Área restrita).
   A "proposta inicial" vem pronta da tabela cifrada (condicoes do empreendimento: à vista e/ou parcelado).
   A "proposta ajustada" começa igual e o Santiago mexe nos campos; a tela compara as duas a cada mudança.
   O PDF para o cliente mostra só a proposta final (pedido do Santiago, 16/11/2026).
   Tudo roda só nesta aba: nada é salvo nem enviado. Textos da tabela já chegam escapados (limparTextos). */
(function(){
  const box=document.getElementById('propBox'), out=document.getElementById('propPrint');
  if(!box||!out||typeof renderUnidade!=='function') return;

  const CDI_LIQ=()=>(D.bcb.cdiAA/100)*(1-0.15);           // custo de oportunidade: CDI com IR de 15% (prazo longo)
  const IMG=s=>/^img\/[a-z0-9_\/-]+\.(jpg|png|webp)$/i.test(String(s||''))?s:'';
  const n0=v=>Math.max(0,Math.round(+v||0));
  let P=null; // {e,u,base,ini,aj,cliente,validade}

  const ctx=()=>{ const e=TAB?.empreendimentos.find(x=>x.id===cEmp); return {e,u:e?.unidades[cUni]}; };
  const conds=(e,u)=>(u&&u.condicoes)||(e&&e.condicoes)||null;
  const copia=c=>({entrada:n0(c.entrada),
    mensais:{n:n0(c.mensais?.n),valor:n0(c.mensais?.valor),inicio:Math.max(1,n0(c.mensais?.inicio)||1)},
    baloes:{n:n0(c.baloes?.n),valor:n0(c.baloes?.valor),cada:Math.max(1,n0(c.baloes?.cada)||12),inicio:Math.max(1,n0(c.baloes?.inicio)||12)},
    unico:{valor:n0(c.unico?.valor),mes:Math.max(1,n0(c.unico?.mes)||1)},
    correcao:c.correcao||''});
  const mesesAte=k=>{ if(!k) return null; const h=new Date(), [y,m]=k.split('-').map(Number); return Math.max(0,(y-h.getFullYear())*12+(m-1-h.getMonth())); };
  const mesRot=m=>{ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+m); return `${NOMES_MES[d.getMonth()]}/${d.getFullYear()}`; };

  function pagamentos(p){
    const l=[]; if(p.entrada) l.push([0,p.entrada]);
    for(let i=0;i<p.mensais.n;i++) l.push([p.mensais.inicio+i,p.mensais.valor]);
    for(let j=0;j<p.baloes.n;j++) l.push([p.baloes.inicio+j*p.baloes.cada,p.baloes.valor]);
    if(p.unico.valor) l.push([p.unico.mes,p.unico.valor]);
    return l.filter(x=>x[1]>0);
  }
  function metricas(p){
    const cub=p.correcao?CUB.v12m/100:0, cdi=CDI_LIQ(), chaves=mesesAte(P.e.entrega);
    let total=0,corr=0,vp=0,ateChaves=0,prazo=0;
    for(const [m,v] of pagamentos(p)){
      const vc=v*Math.pow(1+cub,m/12);
      total+=v; corr+=vc; vp+=vc/Math.pow(1+cdi,m/12); prazo=Math.max(prazo,m);
      if(chaves==null||m<=chaves) ateChaves+=vc;
    }
    return {total,entrada:p.entrada,mensal:p.mensais.n?p.mensais.valor:0,ateChaves,correcao:corr-total,corr,vp,prazo,m2:P.u.area?total/P.u.area:null};
  }

  /* ---------- tela ---------- */
  // campos em R$: ponto de milhar enquanto digita e valor por extenso embaixo (igual aos simuladores)
  const campo=(id,rot,val,un,pre)=>pre==='R$'
    ?`<div class="f"><label for="${id}">${rot}</label><div class="in"><span>R$</span><input id="${id}" type="text" data-num data-dinheiro data-casas="0" inputmode="numeric" autocomplete="off" value="${n0(val).toLocaleString('pt-BR')}"></div><span class="extenso" aria-hidden="true">${porExtenso(n0(val))}</span></div>`
    :`<div class="f"><label for="${id}">${rot}</label><div class="in">${pre?`<span>${pre}</span>`:''}<input id="${id}" type="number" min="0" step="1" value="${val}" inputmode="numeric">${un?`<span>${un}</span>`:''}</div></div>`;
  function resumo(p){
    const it=[];
    if(p.entrada) it.push([L('Entrada (na assinatura)','Anticipo (a la firma)'),brl(p.entrada)]);
    if(p.mensais.n&&p.mensais.valor) it.push([L('Mensais','Cuotas'),`${p.mensais.n} × ${brl(p.mensais.valor)} · ${L('a partir de','desde')} ${mesRot(p.mensais.inicio)}`]);
    if(p.baloes.n&&p.baloes.valor) it.push([L('Balões','Refuerzos'),`${p.baloes.n} × ${brl(p.baloes.valor)} · ${p.baloes.cada===12?L('anuais','anuales'):L(`a cada ${p.baloes.cada} meses`,`cada ${p.baloes.cada} meses`)} · ${L('1º em','1º en')} ${mesRot(p.baloes.inicio)}`]);
    if(p.unico.valor) it.push([P.base==='avista'?L('Saldo','Saldo'):(P.e.entrega&&Math.abs(p.unico.mes-mesesAte(P.e.entrega))<=1?L('Nas chaves','En la entrega'):L('Parcela única','Cuota única')),`${brl(p.unico.valor)} · ${p.unico.mes===1?L('em 30 dias','en 30 días'):mesRot(p.unico.mes)}`]);
    return it;
  }
  function montar(){
    const {e,u}=P, c=conds(e,u), bases=Object.keys(c).filter(k=>c[k]&&typeof c[k]==='object');
    const us=e.unidades.filter(x=>conds(e,x)), a=P.aj;
    box.innerHTML=`<div class="ph"><h2>📄 ${L('Proposta','Propuesta')} · ${e.nome}</h2><span class="note">${L('Só nesta tela: nada é salvo nem enviado','Solo en esta pantalla: nada se guarda ni se envía')}</span></div>
      <div class="prop-top">
        <div class="f2"><label for="prCliente">${L('Cliente','Cliente')}</label><div class="in"><input id="prCliente" type="text" maxlength="60" value="${esc(P.cliente)}" placeholder="${L('Nome do cliente (opcional)','Nombre del cliente (opcional)')}" style="text-align:left"></div></div>
        <div class="f2"><label for="prUni">${L('Unidade','Unidad')}</label><div class="in"><select id="prUni">${us.map(x=>{const i=e.unidades.indexOf(x);return `<option value="${i}"${x===u?' selected':''}>${x.unidade} · ${x.area?x.area.toLocaleString('pt-BR',{minimumFractionDigits:2})+' m²':''}</option>`;}).join('')}</select></div></div>
        <div class="f2"><label for="prBase">${L('Proposta inicial','Propuesta inicial')}</label><div class="in"><select id="prBase">${bases.map(k=>`<option value="${k}"${k===P.base?' selected':''}>${c[k].nome||k} · ${brl(metricasDe(copia(c[k])).total)}</option>`).join('')}</select></div></div>
        <div class="f2"><label for="prVal">${L('Válida até','Válida hasta')}</label><div class="in"><input id="prVal" type="date" value="${esc(P.validade)}"></div></div>
      </div>
      <div class="prop-cols">
        <div class="prop-ini"><h3 class="av-sub">${L('Proposta inicial (automática)','Propuesta inicial (automática)')}</h3>
          <ul class="prop-res">${resumo(P.ini).map(([k,v])=>`<li><span>${k}</span><b>${v}</b></li>`).join('')}</ul>
          <p class="note">${P.ini.correcao?L(`Parcelas corrigidas pelo ${esc(P.ini.correcao)}.`,`Cuotas ajustadas por ${esc(P.ini.correcao)}.`):L('Sem correção.','Sin ajuste.')}</p></div>
        <div class="prop-aj inputs"><h3 class="av-sub">${L('Proposta ajustada (mexa à vontade)','Propuesta ajustada (modifique libremente)')}</h3>
          ${campo('prEnt',L('Entrada','Anticipo'),a.entrada,'','R$')}
          <div class="prop-g"><span>${L('Mensais','Cuotas')}</span>${campo('prMn',L('Quantidade','Cantidad'),a.mensais.n,'x')}${campo('prMv',L('Valor','Valor'),a.mensais.valor,'','R$')}${campo('prMi',L('1ª no mês','1ª en el mes'),a.mensais.inicio,'º')}</div>
          <div class="prop-g"><span>${L('Balões','Refuerzos')}</span>${campo('prBn',L('Quantidade','Cantidad'),a.baloes.n,'x')}${campo('prBv',L('Valor','Valor'),a.baloes.valor,'','R$')}${campo('prBc',L('A cada','Cada'),a.baloes.cada,L('meses','meses'))}${campo('prBi',L('1º no mês','1º en el mes'),a.baloes.inicio,'º')}</div>
          <div class="prop-g"><span>${P.base==='avista'?L('Saldo','Saldo'):L('Parcela única / chaves','Cuota única / entrega')}</span>${campo('prUv',L('Valor','Valor'),a.unico.valor,'','R$')}${campo('prUm',L('No mês','En el mes'),a.unico.mes,'º')}</div>
          <p class="note">${L('Mês 1 = 30 dias depois da assinatura.','Mes 1 = 30 días después de la firma.')}</p>
        </div>
      </div>
      <div id="prComp"></div>
      <div class="actions" style="margin-top:12px">
        <button class="btn ghost" type="button" id="prReset">${L('Voltar à proposta inicial','Volver a la propuesta inicial')}</button>
        <button class="btn" type="button" id="prPdf">${L('📄 Gerar PDF para o cliente','📄 Generar PDF para el cliente')}</button>
        <button class="btn ghost" type="button" id="prFechar">${L('Fechar','Cerrar')}</button>
      </div>
      <p class="note" id="prMsg" aria-live="polite"></p><div class="actions" id="prArq"></div>`;
    const ler=()=>{ const g=id=>n0(lerNum(document.getElementById(id).value));
      P.aj.entrada=g('prEnt'); P.aj.mensais={n:g('prMn'),valor:g('prMv'),inicio:Math.max(1,g('prMi'))};
      P.aj.baloes={n:g('prBn'),valor:g('prBv'),cada:Math.max(1,g('prBc')),inicio:Math.max(1,g('prBi'))};
      P.aj.unico={valor:g('prUv'),mes:Math.max(1,g('prUm'))}; comparar(); };
    box.querySelectorAll('.prop-aj input').forEach(i=>i.addEventListener('input',ler));
    box.querySelector('#prCliente').addEventListener('input',ev=>{P.cliente=ev.target.value;});
    box.querySelector('#prVal').addEventListener('input',ev=>{P.validade=ev.target.value;});
    box.querySelector('#prBase').addEventListener('change',ev=>{abrir(ev.target.value,P.u);});
    box.querySelector('#prUni').addEventListener('change',ev=>{abrir(P.base,P.e.unidades[+ev.target.value]);});
    box.querySelector('#prReset').addEventListener('click',()=>abrir(P.base,P.u));
    box.querySelector('#prFechar').addEventListener('click',()=>{P=null; box.hidden=true; box.innerHTML='';});
    box.querySelector('#prPdf').addEventListener('click',pdf);
    comparar();
  }
  const metricasDe=p=>metricas(p);

  function comparar(){
    const a=metricas(P.ini), b=metricas(P.aj);
    const dif=(x,y,menorMelhor=true)=>{ const d=Math.round(y-x); if(!d) return `<span class="note">${L('igual','igual')}</span>`;
      const bom=menorMelhor?d<0:d>0; return `<b class="${bom?'pos':'neg'}">${d>0?'+':'−'} ${brl(Math.abs(d))} ${bom?'✅':''}</b>`; };
    const difM=(x,y)=>{ const d=y-x; if(!d) return `<span class="note">${L('igual','igual')}</span>`; return `<b class="${d<0?'pos':'neg'}">${d>0?'+':'−'} ${Math.abs(d)} ${L('meses','meses')}</b>`; };
    const linhas=[
      [L('Valor total','Valor total'),brl(a.total),brl(b.total),dif(a.total,b.total)],
      [L('Entrada','Anticipo'),brl(a.entrada),brl(b.entrada),dif(a.entrada,b.entrada)],
      [L('Mensal','Cuota mensual'),a.mensal?brl(a.mensal):'—',b.mensal?brl(b.mensal):'—',dif(a.mensal,b.mensal)],
      [L(`Pago até as chaves (${fmtMesAno(P.e.entrega)})`,`Pagado hasta la entrega (${fmtMesAno(P.e.entrega)})`),brl(a.ateChaves),brl(b.ateChaves),dif(a.ateChaves,b.ateChaves)],
      [L('Prazo total','Plazo total'),a.prazo?`${a.prazo} ${L('meses','meses')}`:L('à vista','contado'),b.prazo?`${b.prazo} ${L('meses','meses')}`:L('à vista','contado'),difM(a.prazo,b.prazo)],
      [L('Correção estimada','Ajuste estimado'),brl(a.correcao),brl(b.correcao),dif(a.correcao,b.correcao)],
      [L('Total com correção','Total con ajuste'),brl(a.corr),brl(b.corr),dif(a.corr,b.corr)],
      [L('<b>Custo real em valor de hoje</b>','<b>Costo real en valor de hoy</b>'),`<b>${brl(a.vp)}</b>`,`<b>${brl(b.vp)}</b>`,dif(a.vp,b.vp)],
      ['R$/m²',a.m2?brl(a.m2):'—',b.m2?brl(b.m2):'—',a.m2?dif(a.m2,b.m2):''],
    ];
    const c=conds(P.e,P.u), outras=Object.keys(c).filter(k=>k!==P.base&&c[k]&&typeof c[k]==='object').map(k=>[c[k].nome||k,metricas(copia(c[k]))]);
    const ganho=Math.round(a.vp-b.vp);
    document.getElementById('prComp').innerHTML=`<h3 class="av-sub">${L('Comparação','Comparación')}</h3>
      <div class="tblwrap"><table class="prop-tbl"><thead><tr><th style="text-align:left"></th><th>${L('Inicial','Inicial')}</th><th>${L('Ajustada','Ajustada')}</th><th>${L('Diferença para o cliente','Diferencia para el cliente')}</th></tr></thead><tbody>`+
      linhas.map(r=>`<tr><td style="text-align:left">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')+`</tbody></table></div>
      <p class="prop-veredito ${ganho>0?'pos':ganho<0?'neg':''}">${ganho>0?L(`A proposta ajustada é <b>${brl(ganho)} melhor</b> para o cliente, em valor de hoje.`,`La propuesta ajustada es <b>${brl(ganho)} mejor</b> para el cliente, en valor de hoy.`):ganho<0?L(`A proposta ajustada fica <b>${brl(-ganho)} mais cara</b> para o cliente, em valor de hoje.`,`La propuesta ajustada queda <b>${brl(-ganho)} más cara</b> para el cliente, en valor de hoy.`):L('A proposta ajustada é igual à inicial.','La propuesta ajustada es igual a la inicial.')}</p>
      ${outras.map(([nm,m])=>`<p class="note">${L(`Para comparar: a condição "${nm}" custa ${brl(m.vp)} em valor de hoje (${m.vp<b.vp?`${brl(b.vp-m.vp)} a menos que a ajustada`:`${brl(m.vp-b.vp)} a mais que a ajustada`}).`,`Para comparar: la condición "${nm}" cuesta ${brl(m.vp)} en valor de hoy (${m.vp<b.vp?`${brl(b.vp-m.vp)} menos que la ajustada`:`${brl(m.vp-b.vp)} más que la ajustada`}).`)}</p>`).join('')}
      <p class="note">${L(`Correção estimada pelo CUB/SC dos últimos 12 meses (${p1(CUB.v12m)} ao ano). "Custo real em valor de hoje" desconta cada pagamento pelo CDI líquido (${pct(CDI_LIQ(),1)} ao ano): mostra quanto o cliente precisaria ter aplicado hoje para pagar tudo. Serve para comparar à vista com parcelado.`,`Ajuste estimado por el CUB/SC de los últimos 12 meses (${p1(CUB.v12m)} anual). "Costo real en valor de hoy" descuenta cada pago por el CDI neto (${pct(CDI_LIQ(),1)} anual).`)}</p>`;
  }

  function abrir(base,u){
    const e=TAB.empreendimentos.find(x=>x.id===cEmp), c=conds(e,u); if(!c) return;
    if(!c[base]) base=c.fluxo?'fluxo':Object.keys(c)[0];
    const ant=P;
    P={e,u,base,ini:copia(c[base]),aj:copia(c[base]),cliente:ant?.cliente||'',validade:ant?.validade||e.validade||''};
    box.hidden=false; montar();
  }

  /* usado pela vitrine (vitrine.js): abre a proposta de uma unidade, opcionalmente já com um fluxo ajustado */
  window.abrirPropostaCom=(u,base,aj)=>{ if(!TAB||!u) return; abrir(base||'fluxo',u); if(!P) return;
    if(aj){ P.aj=copia(aj); montar(); }
    box.scrollIntoView({behavior:'smooth',block:'start'}); };

  /* ---------- páginas extras do PDF (17/11/2026): proposta em detalhe, valorização, renda e região ----------
     Taxas: Conservador = CUB/SC 12 meses (custo de construir); Histórico = média Porto Belo (DWV) + Itapema (FipeZap)
     desde 2020, a mesma do "Cenário de mercado"; Moderado = meio-termo entre as duas. Renda: premissas de SITE_CONFIG. */
  const HORIZ=[5,10,15];
  function cenariosVal(){
    const cons=CUB.v12m/100, hist=(typeof FILTROS!=='undefined'?FILTROS.media.taxa():cagrItapema());
    return [
      {k:'cons',nome:L('Conservador','Conservador'),taxa:cons,fonte:L(`alta do CUB/SC em 12 meses: o custo de construir um imóvel novo`,`suba del CUB/SC en 12 meses: el costo de construir un inmueble nuevo`)},
      {k:'mod',nome:L('Moderado','Moderado'),taxa:(cons+hist)/2,fonte:L('meio-termo entre o conservador e o histórico','punto medio entre el conservador y el histórico')},
      {k:'hist',nome:L('Histórico da região','Histórico de la región'),taxa:hist,fonte:L(`média de Porto Belo (DWV) e Itapema (FipeZap) desde 2020`,`promedio de Porto Belo (DWV) e Itapema (FipeZap) desde 2020`)}];
  }
  // ---- renda pela localização do imóvel (17/11/2026) ----
  // Aluguel anual: bairro do empreendimento (referencias.json > aluguelBairros); bairro sem dado usa a média da cidade.
  // Temporada: cidade + nº de quartos (referencias.json > temporadaCidades). Sem cidade conhecida: referência antiga (% do valor).
  const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  const achar=(obj,k)=>{ if(!obj||!k) return null; const n=norm(k), kk=Object.keys(obj).find(x=>norm(x)===n); return kk?[kk,obj[kk]]:null; };
  const quartosDe=u=>{ if(u.quartos) return +u.quartos; let n=0; String(u.tipo||'').replace(/(\d+)\s*(su[ií]tes?|quartos?|dorm\w*)/gi,(_,k)=>{n+=+k;}); return n||null; };   // "1 suíte + 1 dormitório" = 2
  const m2f=v=>v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
  const arred=v=>Math.round(v/50)*50;
  function localRenda(e,u,V){
    const r=RM(), area=u.area, AB=REFS.aluguelBairros, TC=REFS.temporadaCidades;
    let an=null; const cid=AB&&area?achar(AB.cidades,e.cidade):null;
    if(cid){ const [cn,c]=cid, b=achar(c.bairros,e.bairro);
      if(b&&b[1].ref){ const [bn,x]=b, perto=Math.abs(area/x.areaRef-1)<=0.09, k=perto?1:area/x.areaRef;
        an={mes:perto?x.ref:arred(x.ref*k),faixa:x.faixa?[x.faixa[0]*k,x.faixa[1]*k]:null,onde:`${bn}, ${cn}`,
          fonte:L(`levantamento da consultoria para ${bn} (${cn}): apartamentos de ~${x.areaRef} m² alugam de ${brl(x.faixa[0])} a ${brl(x.faixa[1])} por mês, nov/2026${perto?'':'; valor proporcional à área'}`,
                  `relevamiento de la consultoría para ${bn} (${cn}): departamentos de ~${x.areaRef} m² se alquilan de ${brl(x.faixa[0])} a ${brl(x.faixa[1])} por mes, nov/2026${perto?'':'; valor proporcional al área'}`)};
      } else if(b&&b[1].m2){ const [bn,x]=b;
        an={mes:arred(x.m2*area),m2:x.m2,onde:`${bn}, ${cn}`,fonte:L(`${AB.fonte.pt}: ${bn} (${cn}), R$ ${m2f(x.m2)}/m² por mês, ${x.n} anúncios`,`${AB.fonte.es}: ${bn} (${cn}), R$ ${m2f(x.m2)}/m² por mes, ${x.n} anuncios`)};
      } else {
        an={mes:arred(c.m2*area),m2:c.m2,onde:cn,media:true,fonte:L(`${AB.fonte.pt}: média de ${cn}, R$ ${m2f(c.m2)}/m² por mês (${c.n} anúncios); ${e.bairro?`${e.bairro} ainda não tem`:'o bairro não tem'} anúncios suficientes`,`${AB.fonte.es}: promedio de ${cn}, R$ ${m2f(c.m2)}/m² por mes (${c.n} anuncios); ${e.bairro?`${e.bairro} todavía no tiene`:'el barrio no tiene'} anuncios suficientes`)};
      }
    }
    const semDado=e.cidade?L(` (${e.cidade} ainda sem dado próprio)`,` (${e.cidade} todavía sin dato propio)`):'';
    if(!an) an={mes:V*r.aluguelMensalPctValor/100,onde:'',fonte:L(r.fonteAluguel.pt,r.fonteAluguel.es)+semDado};
    let tp=null; const tc=TC?achar(TC.cidades,e.cidade):null;
    if(tc){ const [cn,c]=tc, q0=quartosDe(u), q=q0?Math.min(3,q0):null, qq=q?c.quartos[String(q)]:null, fd=qq?qq.diaria/c.diaria:1, fo=qq?qq.ocup/c.ocup:1;
      // conservador: a diária não passa da referência proporcional ao preço do imóvel (evita dar a média da cidade, puxada pela frente-mar, a imóvel mais simples)
      const dAv=V*r.diariaAltaPctValor/100, dBv=V*r.diariaBaixaPctValor/100, lim=c.alta.diaria*fd>dAv;
      tp={dA:Math.min(c.alta.diaria*fd,dAv),oA:Math.min(.95,c.alta.ocup*fo/100),dB:Math.min(c.baixa.diaria*fd,dBv),oB:Math.min(.95,c.baixa.ocup*fo/100),onde:cn,q:qq?q0:null,lim,
        fonte:L(`${TC.fonte.pt}, ${cn} (${c.n.toLocaleString('pt-BR')} anúncios)${qq?`, ajustado para ${q0} ${q0===1?'quarto':'quartos'}`:''}${lim?`; diária limitada à referência proporcional ao valor do imóvel (conservador)`:''}`,`${TC.fonte.es}, ${cn} (${c.n.toLocaleString('pt-BR')} anuncios)${qq?`, ajustado a ${q0} ${q0===1?'dormitorio':'dormitorios'}`:''}${lim?`; diaria limitada a la referencia proporcional al valor del inmueble (conservador)`:''}`)};
    } else tp={dA:V*r.diariaAltaPctValor/100,oA:r.ocupAlta/100,dB:V*r.diariaBaixaPctValor/100,oB:r.ocupBaixa/100,onde:'',fonte:L(r.fonteTemporada.pt,r.fonteTemporada.es)+semDado};
    return {an,tp};
  }
  function renda(V,modo,lr){
    const r=RM(); let bruto, adm;
    if(modo==='temporada'){ const t=lr.tp; bruto=t.dA*t.oA*DIAS_MES*r.mesesAlta+t.dB*t.oB*DIAS_MES*(12-r.mesesAlta); adm=bruto*r.admTemporada/100; }
    else { bruto=lr.an.mes*12*(1-r.vacancia/100); adm=bruto*r.admAnual/100; }
    const ir=bruto*r.irAluguel/100, desp=V*r.despesasAnoPctValor/100, liq=bruto-adm-ir-desp;
    return {bruto,adm,ir,desp,liq,mes:liq/12,yb:bruto/V,yl:liq/V};
  }
  // renda líquida somada do mês das chaves até o ano H, crescendo junto com o imóvel (taxa g)
  function rendaAcum(liqAno,g,mChaves,H){ let s=0; for(let k=Math.max(1,mChaves+1);k<=H*12;k++) s+=liqAno/12*Math.pow(1+g,k/12); return s; }

  // fotos do lazer para a página 2 (até 6, sem as de fachada), com legenda tirada do nome do arquivo
  const LEG={piscinas:['Piscinas','Piscinas'],piscina:['Piscina','Piscina'],academia:['Academia','Gimnasio'],'salao-jogos':['Salão de jogos','Sala de juegos'],
    'terraco-jogos':['Terraço de jogos','Terraza de juegos'],quiosque:['Quiosque','Quincho'],playground:['Playground','Juegos infantiles'],
    brinquedoteca:['Brinquedoteca','Sala infantil'],'sala-jogos':['Sala de jogos','Sala de juegos'],'piscina-aquecida':['Piscina aquecida','Piscina climatizada'],'fire-place':['Fire place','Fogón exterior'],'espaco-pet':['Espaço pet','Espacio pet'],solarium:['Solário','Solárium'],'planta-lazer':['Planta do lazer','Planta de amenities'],'praia-pereque':['Praia do Perequê','Playa del Perequê'],pereque:['Balneário Perequê','Balneário Perequê'],'ilha-porto-belo':['Ilha de Porto Belo','Isla de Porto Belo'],enseada:['Enseada de Porto Belo','Ensenada de Porto Belo'],'localizacao-aerea':['Vista aérea do terreno','Vista aérea del terreno'],'salao-festas':['Salão de festas','Salón de fiestas'],'espaco-zen':['Espaço zen','Espacio zen']};
  const legenda=src=>{ const k=src.split('/').pop().replace(/\.[a-z]+$/i,''); const t=LEG[k]; return t?L(t[0],t[1]):k.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase()); };
  const fotosLazer=e=>((e.fotos&&e.fotos.galeria)||[]).map(IMG).filter(s=>s&&!/fachada/i.test(s)).slice(0,6).map(s=>[s,legenda(s)]);

  // m² de referência da cidade do imóvel, para a caixa OPORTUNIDADE VIP.
  // Porto Belo: DWV (imóveis novos VENDIDOS, mais conservador). Itapema: FipeZap (índice oficial). Outra cidade: sem caixa.
  function refM2(e){
    const c=norm(e.cidade);
    if(c==='porto belo'&&REFS.m2PortoBelo) return {v:REFS.m2PortoBelo.v,cidade:'Porto Belo',
      nota:L(`Média de imóveis novos vendidos em Porto Belo no 1º semestre de 2026: ${brl(REFS.m2PortoBelo.v)}/m² (DWV, via Portas e NSC Total).`,`Promedio de inmuebles nuevos vendidos en Porto Belo en el 1er semestre de 2026: ${brl(REFS.m2PortoBelo.v)}/m² (DWV).`)};
    if(c==='itapema') return {v:it[LAST],cidade:'Itapema',
      nota:L(`Preço médio do m² residencial em Itapema: ${brl(it[LAST])}/m² (FipeZap, ${fmtMes(LASTKEY)}).`,`Precio promedio del m² residencial en Itapema: ${brl(it[LAST])}/m² (FipeZap, ${fmtMes(LASTKEY)}).`)};
    return null;
  }

  /* ---------- caixa de destaque da página 2 (17/11/2026): o site escolhe sozinho ----------
     1) ★ OPORTUNIDADE VIP ★ : condição especial (tabela: condicaoEspecial:true) E preço abaixo da média (escassez + prazo só aqui)
     2) PREÇO ABAIXO DA MÉDIA : R$/m² mais de 10% abaixo da média da cidade E do bairro (sem escassez nem prazo)
     3) ENTRADA FACILITADA    : nos demais casos com parcelamento (entrada, mensais, quanto até as chaves, lazer)
     A comparação usa sempre a média MAIS ALTA para o cliente (a que dá o menor desconto): cidade (DWV/FipeZap) ou bairro (anúncios). */
  function baseM2(e){
    const out=[], ref=refM2(e), VB=REFS.vendaBairros;
    if(ref) out.push({v:ref.v,nome:ref.cidade,tipo:'cidade',nota:ref.nota});
    const cid=VB?achar(VB.cidades,e.cidade):null, b=cid?achar(cid[1].bairros,e.bairro):null;
    if(b) out.push({v:b[1].v,nome:b[0],tipo:'bairro',nota:L(`Média do m² de apartamentos à venda em ${b[0]} (${cid[0]}): ${brl(b[1].v)}/m² (${VB.fonte.pt}, ${b[1].n} anúncios).`,`Promedio del m² de departamentos en venta en ${b[0]} (${cid[0]}): ${brl(b[1].v)}/m² (${VB.fonte.es}, ${b[1].n} anuncios).`)});
    return out;
  }
  function caixaDestaque(e,u,m){
    const m2u=u.area?m.total/u.area:null, bases=baseM2(e);
    let alvo=null, ab=null;
    if(m2u&&bases.length){ alvo=bases.reduce((a,b)=>(b.v<a.v?b:a)); ab=1-m2u/alvo.v; }   // menor média = menor desconto (conservador)
    const nota=bases.map(b=>b.nota).join(' ');
    const deQuem=b=>b.tipo==='bairro'?L(`do bairro ${b.nome}`,`del barrio ${b.nome}`):L(`de ${b.nome}`,`de ${b.nome}`);
    const especial=e.condicaoEspecial??!!e.validade;   // sem a marcação: condição com prazo de validade (ex.: Beni) conta como especial
    if(especial&&ab>0.03){
      const media=alvo.v*u.area, eco=media-m.total, nUn=e.unidades.filter(x=>conds(e,x)&&x.status!=='vendida').length;
      const val=/^\d{4}-\d{2}-\d{2}$/.test(P.validade||'')?P.validade.split('-').reverse().join('/'):'';
      return `<div class="pp-vip"><div class="selo">★ ${L('OPORTUNIDADE VIP','OPORTUNIDAD VIP')} ★</div>
        <h3>${L(`Você entra por ${brl(m2u)}/m²: ${pct(ab,0)} abaixo da média ${deQuem(alvo)}`,`Usted entra a ${brl(m2u)}/m²: ${pct(ab,0)} por debajo del promedio ${deQuem(alvo)}`)}</h3>
        <div class="vip-nums"><div><span>${L('Na média','Al promedio')}</span><s>${brl(media)}</s></div><div><span>${L('Seu valor','Su valor')}</span><b>${brl(m.total)}</b></div><div class="eco"><span>${L('Você começa ganhando','Usted empieza ganando')}</span><b>${brl(eco)}</b></div></div>
        <p class="vip-txt">${L(`Condição de pré-lançamento reservada para poucos investidores${nUn?`: <b>${nUn===1?'apenas 1 unidade':`apenas ${nUn} unidades`}</b> nesta condição`:''}${val?`, válida até <b>${val}</b>`:''}. Os melhores negócios da cidade não chegam aos portais: ficam com quem decide primeiro. Quem entra antes do mercado é quem leva a valorização.`,`Condición de prelanzamiento reservada para pocos inversores${nUn?`: <b>${nUn===1?'solo 1 unidad':`solo ${nUn} unidades`}</b> en esta condición`:''}${val?`, válida hasta <b>${val}</b>`:''}. Los mejores negocios de la ciudad no llegan a los portales: quedan para quien decide primero. Quien entra antes que el mercado es quien se lleva la valorización.`)}</p>
        <small>${nota} ${L('As médias reúnem todos os padrões e localizações; são referência, não avaliação.','Los promedios reúnen todos los estándares y ubicaciones; son referencia, no tasación.')}</small></div>`;
    }
    if(ab>0.10){
      const media=alvo.v*u.area, eco=media-m.total;
      return `<div class="pp-vip pp-abaixo"><div class="selo">${L('PREÇO ABAIXO DA MÉDIA','PRECIO POR DEBAJO DEL PROMEDIO')}</div>
        <h3>${L(`${brl(m2u)}/m²: ${pct(ab,0)} abaixo da média ${deQuem(alvo)}`,`${brl(m2u)}/m²: ${pct(ab,0)} por debajo del promedio ${deQuem(alvo)}`)}</h3>
        <div class="vip-nums"><div><span>${L('Na média','Al promedio')}</span><s>${brl(media)}</s></div><div><span>${L('Seu valor','Su valor')}</span><b>${brl(m.total)}</b></div><div class="eco"><span>${L('Diferença a seu favor','Diferencia a su favor')}</span><b>${brl(eco)}</b></div></div>
        <p class="vip-txt">${L('Comprar na planta, pelo preço de lançamento, é entrar antes do mercado: o imóvel fica pronto valendo o preço de um imóvel novo da região.','Comprar en pozo, al precio de lanzamiento, es entrar antes que el mercado: el inmueble queda listo valiendo el precio de un inmueble nuevo de la zona.')}</p>
        <small>${nota} ${L('Comparamos com a média mais alta para você, a que dá o menor desconto. As médias reúnem todos os padrões e localizações; são referência, não avaliação.','Comparamos con el promedio más alto para usted, el que da el menor descuento. Los promedios reúnen todos los estándares y ubicaciones; son referencia, no tasación.')}</small></div>`;
    }
    const a=P.aj; if(!a.mensais.n&&!a.baloes.n) return '';
    const ent=m.total?m.entrada/m.total:0, ch=m.corr?m.ateChaves/m.corr:0;
    const itens=[
      [L('Entrada','Anticipo'),`${pct(ent,0)}`,brl(m.entrada)],
      a.mensais.n?[L('Mensais','Cuotas'),`${a.mensais.n}×`,brl(a.mensais.valor)]:null,
      a.baloes.n?[L('Reforços','Refuerzos'),`${a.baloes.n}×`,brl(a.baloes.valor)]:null,
      e.entrega?[L('Até as chaves','Hasta la entrega'),pct(ch,0),fmtMesAno(e.entrega)]:null].filter(Boolean);
    return `<div class="pp-vip pp-facil"><div class="selo">${L('ENTRADA FACILITADA','ANTICIPO FACILITADO')}</div>
      <h3>${L(`Entre com ${brl(m.entrada)} e pague o resto em parcelas que cabem no mês`,`Entre con ${brl(m.entrada)} y pague el resto en cuotas que caben en el mes`)}</h3>
      <div class="vip-nums q${itens.length}">${itens.map(([t,g,s])=>`<div><span>${t}</span><b>${g}</b><em>${s}</em></div>`).join('')}</div>
      <p class="vip-txt">${L(`Na planta, o dinheiro trabalha enquanto o prédio sobe: você paga aos poucos e recebe um imóvel novo${e.lazer?', com lazer completo,':''} no lugar onde a região mais cresce.`,`En pozo, el dinero trabaja mientras el edificio sube: usted paga de a poco y recibe un inmueble nuevo${e.lazer?', con amenities completos,':''} donde más crece la región.`)}</p></div>`;
  }

  function pagDetalhe(e,u,a,m){
    const cub=a.correcao?CUB.v12m/100:0, anos={};
    const chaves=mesesAte(e.entrega);
    for(const [mm,v] of pagamentos(a)){
      const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+mm); const y=d.getFullYear();
      const tipo=mm===0?'ent':(a.mensais.n&&mm>=a.mensais.inicio&&mm<a.mensais.inicio+a.mensais.n&&v===a.mensais.valor?'men':'out');
      const o=anos[y]||(anos[y]={ent:0,men:0,bal:0,out:0,tot:0,corr:0});
      const ehBalao=a.baloes.n&&v===a.baloes.valor&&mm>=a.baloes.inicio&&(mm-a.baloes.inicio)%a.baloes.cada===0&&(mm-a.baloes.inicio)/a.baloes.cada<a.baloes.n;
      if(tipo==='ent') o.ent+=v; else if(ehBalao) o.bal+=v; else if(tipo==='men') o.men+=v; else o.out+=v;
      o.tot+=v; o.corr+=v*Math.pow(1+cub,mm/12);
    }
    const ys=Object.keys(anos).sort(), z=v=>v?brl(v):'—';
    const m2u=u.area?m.total/u.area:null;
    const pctEnt=m.total?m.entrada/m.total:0, pctCh=m.corr?m.ateChaves/m.corr:0;
    return `<div class="pp-pag">
      <div class="pp-kick">${L('Proposta em detalhe','Propuesta en detalle')}</div>
      <h1>${L('Como você paga','Cómo usted paga')}</h1>
      <div class="pp-kpis">
        <div><span>${L('Valor total','Valor total')}</span><b>${brl(m.total)}</b><small>${u.area?brl(m2u)+'/m²':''}</small></div>
        <div><span>${L('Entrada','Anticipo')}</span><b>${brl(m.entrada)}</b><small>${pct(pctEnt,0)} ${L('do total','del total')}</small></div>
        ${e.entrega?`<div><span>${L('Até as chaves','Hasta la entrega')}</span><b>${brl(m.ateChaves)}</b><small>${pct(pctCh,0)} · ${fmtMesAno(e.entrega)}</small></div>`:`<div><span>${L('Entrega','Entrega')}</span><b>${L('a confirmar','a confirmar')}</b><small>${L('data com a construtora','fecha con la constructora')}</small></div>`}
        <div><span>${L('Prazo','Plazo')}</span><b>${m.prazo?`${m.prazo} ${L('meses','meses')}`:L('à vista','contado')}</b><small>${m.prazo?L(`última em ${mesRot(m.prazo)}`,`última en ${mesRot(m.prazo)}`):''}</small></div>
      </div>
      <h2>${L('Calendário de pagamentos, ano a ano','Calendario de pagos, año por año')}</h2>
      <table class="pp-grade"><thead><tr><th>${L('Ano','Año')}</th><th>${L('Entrada','Anticipo')}</th><th>${L('Mensais','Cuotas')}</th><th>${L('Balões','Refuerzos')}</th><th>${L('Outros','Otros')}</th><th>${L('Total do ano','Total del año')}</th>${cub?`<th>${L('Com CUB estimado','Con CUB estimado')}</th>`:''}</tr></thead><tbody>
        ${ys.map(y=>{const o=anos[y];return `<tr><td>${y}${chaves!=null&&+y===new Date(e.entrega+'-01T12:00').getFullYear()?' 🔑':''}</td><td>${z(o.ent)}</td><td>${z(o.men)}</td><td>${z(o.bal)}</td><td>${z(o.out)}</td><td><b>${brl(o.tot)}</b></td>${cub?`<td>${brl(o.corr)}</td>`:''}</tr>`;}).join('')}
        <tr class="tot"><td>${L('Total','Total')}</td><td>${z(m.entrada)}</td><td>${z(ys.reduce((s,y)=>s+anos[y].men,0))}</td><td>${z(ys.reduce((s,y)=>s+anos[y].bal,0))}</td><td>${z(ys.reduce((s,y)=>s+anos[y].out,0))}</td><td>${brl(m.total)}</td>${cub?`<td>${brl(m.corr)}</td>`:''}</tr>
      </tbody></table>
      <p class="pp-obs">${cub?L(`Os valores da tabela de vendas são corrigidos pelo ${esc(a.correcao)}. A última coluna estima a correção usando a alta do CUB/SC dos últimos 12 meses (${p1(CUB.v12m)} ao ano); o valor real depende do índice de cada mês.`,`Los valores se ajustan por ${esc(a.correcao)}. La última columna estima el ajuste con la suba del CUB/SC de los últimos 12 meses (${p1(CUB.v12m)} anual).`):''} 🔑 = ${L('ano da entrega das chaves','año de entrega')}.</p>
      ${caixaDestaque(e,u,m)}
      <h2>${L('O que está incluído','Qué incluye')}</h2>
      <ul class="pp-lista">
        <li>${[u.tipo,u.area?`${u.area.toLocaleString('pt-BR',{minimumFractionDigits:2})} m² ${L('privativos','privados')}`:'',u.vagas?`${u.vagas} ${u.vagas==1?L('vaga de garagem','cochera'):L('vagas de garagem','cocheras')}`:'',u.pavimento?`${u.pavimento}º ${L('andar','piso')}`:''].filter(Boolean).join(' · ')}</li>
        ${e.lazer?`<li>${e.lazer}</li>`:''}
        ${e.distanciaMar?`<li>${L(`≈ ${Math.round(e.distanciaMar).toLocaleString('pt-BR')} m do mar em linha reta`,`≈ ${Math.round(e.distanciaMar).toLocaleString('pt-BR')} m del mar en línea recta`)}${e.praia?` (${e.praia})`:''}</li>`:''}
        ${e.incorporacao?`<li>${L('Registro de Incorporação nº','Registro de Incorporación nº')} ${e.incorporacao}: ${L('o empreendimento está registrado em cartório, como exige a Lei 4.591/64','el emprendimiento está registrado, como exige la Ley 4.591/64')}</li>`:''}
      </ul>
      ${fotosLazer(e).length?`<div class="pp-fotos">${fotosLazer(e).map(([src,leg])=>`<figure><img src="${src}" alt=""><figcaption>${leg}</figcaption></figure>`).join('')}</div>`:''}
    </div>`;
  }

  /* "Quem já escolheu a Costa Esmeralda" (17/11/2026): só nomes com investimento/projeto confirmado pela imprensa.
     Conferidos e DEIXADOS DE FORA: Chitãozinho & Xororó e Kevin Kisner (nada encontrado; o golfe do All Resort é de Erik Larsen),
     Cristiano Ronaldo (Balneário Camboriú, fonte fraca). Sem fotos (direito de imagem). */
  const FAMOSOS=[
    {nome:'Neymar Jr.',cid:'Porto Belo · Itapema',pt:'Complexo esportivo e de lazer da família no bairro planejado Porto Belo Lagos (~R$ 250 mi); tem imóveis em Itapema e Balneário Camboriú.',es:'Complejo deportivo y de ocio de la familia en el barrio planificado Porto Belo Lagos (~R$ 250 M); tiene inmuebles en Itapema y Balneário Camboriú.',src:'NSC Total, Portas'},
    {nome:'Rafael Nadal',cid:'Porto Belo',pt:'O 1º Rafa Nadal Tennis Center da América do Sul será no All Resort, com previsão para 2028.',es:'El 1er Rafa Nadal Tennis Center de Sudamérica estará en el All Resort, previsto para 2028.',src:'InfoMoney, NSC Total'},
    {nome:'Celso Portiolli',cid:'Porto Belo',pt:'Comprou apartamento no Electra Tower e chamou a cidade de "diamante do Brasil".',es:'Compró un departamento en el Electra Tower y llamó a la ciudad "el diamante de Brasil".',src:'NSC Total'},
    {nome:'Família Werninghaus (WEG)',cid:'Porto Belo',pt:'Martin Werninghaus, do conselho da WEG, é sócio da All Wert, dona do All Resort Club Residence.',es:'Martin Werninghaus, del directorio de WEG, es socio de All Wert, dueña del All Resort Club Residence.',src:'NSC Total'},
    {nome:'Paris Saint-Germain (PSG)',cid:'Porto Belo',pt:'Escola oficial do próprio clube, a "Paris Saint-Germain Academy Vivapark", para crianças e jovens de 2 a 17 anos, com campo oficial e áreas cobertas. Anunciada em dez/2025.',es:'Escuela oficial del propio club, la "Paris Saint-Germain Academy Vivapark", para niños y jóvenes de 2 a 17 años, con cancha oficial y áreas cubiertas. Anunciada en dic/2025.',src:'Vokkan (incorporadora do VivaPark), Diarinho'},
    {nome:'Pedro Barros',cid:'Porto Belo',pt:'O campeão de skate fez a curadoria e inaugurou o skate park do All Resort.',es:'El campeón de skate hizo la curaduría e inauguró el skate park del All Resort.',src:'IstoÉ'},
    {nome:'Zezé Di Camargo',cid:'Itapema',pt:'Cobertura no Abu Dhabi Residence, na Meia Praia.',es:'Penthouse en el Abu Dhabi Residence, en Meia Praia.',src:'imprensa e mercado local'},
    {nome:'Ratinho',cid:'Itapema',pt:'Casa no Canto da Praia de Itapema.',es:'Casa en el Canto da Praia de Itapema.',src:'imprensa e mercado local'}];

  // caso real de valorização (estudo de investimento do Santiago, nov/2026: exemplo fornecido pela Holze Inc)
  const CASO_REAL={fonte:'Holze Inc',etapas:[{pt:'Pré-lançamento',es:'Prelanzamiento',ano:2021,v:660000},{pt:'Em obra',es:'En obra',ano:2023,v:865307},{pt:'Obra entregue',es:'Obra entregada',ano:2026,v:1299000}]};
  function pagValorizacao(V){
    const C=cenariosVal(), max=V*Math.pow(1+Math.max(...C.map(c=>c.taxa)),15), mod=C[1];
    const v=(c,h)=>V*Math.pow(1+c.taxa,h), w=x=>Math.max(4,Math.round(x/max*100));
    const cdiL=CDI_LIQ(), cdi10=V*Math.pow(1+cdiL,10);
    return `<div class="pp-pag">
      <div class="pp-kick">${L('Simulação','Simulación')}</div>
      <h1>${L('Quanto seu imóvel pode valer','Cuánto puede valer su inmueble')}</h1>
      <p class="pp-lead">${L(`Partindo do valor desta proposta (${brl(V)}), projetamos a valorização do imóvel em 5, 10 e 15 anos, em três cenários construídos com dados oficiais da região.`,`Partiendo del valor de esta propuesta (${brl(V)}), proyectamos la valorización del inmueble en 5, 10 y 15 años, en tres escenarios construidos con datos oficiales de la región.`)}</p>
      <table class="pp-grade pp-val"><thead><tr><th style="text-align:left">${L('Cenário','Escenario')}</th><th>${L('ao ano','anual')}</th>${HORIZ.map(h=>`<th>${h} ${L('anos','años')}</th>`).join('')}</tr></thead><tbody>
        ${C.map(c=>`<tr class="${c.k==='mod'?'dest':''}"><td style="text-align:left"><b>${c.nome}</b><small>${c.fonte}</small></td><td>${p1(c.taxa*100)}</td>${HORIZ.map(h=>`<td><b>${brl(v(c,h))}</b><small>+${brl(v(c,h)-V)}</small></td>`).join('')}</tr>`).join('')}
      </tbody></table>
      <h2>${L('Caso real: do pré-lançamento à entrega','Caso real: del prelanzamiento a la entrega')}</h2>
      <div class="pp-caso">${CASO_REAL.etapas.map((x,i)=>`<div><span>${L(x.pt,x.es)} · ${x.ano}</span><b>${brl(x.v)}</b>${i?`<em>+${(Math.round((x.v/CASO_REAL.etapas[0].v-1)*1000)/10).toLocaleString('pt-BR')}%</em>`:''}</div>`).join('<i>→</i>')}</div>
      <p class="pp-obs">${L(`Imóvel comprado no pré-lançamento por ${brl(CASO_REAL.etapas[0].v)} e avaliado em ${brl(CASO_REAL.etapas.at(-1).v)} na entrega: R$ ${(CASO_REAL.etapas.at(-1).v-CASO_REAL.etapas[0].v).toLocaleString('pt-BR')} a mais em cerca de 5 anos. Exemplo informado pela ${CASO_REAL.fonte}; valorização do preço, sem descontar custos e impostos.`,`Inmueble comprado en el prelanzamiento por ${brl(CASO_REAL.etapas[0].v)} y valuado en ${brl(CASO_REAL.etapas.at(-1).v)} en la entrega: R$ ${(CASO_REAL.etapas.at(-1).v-CASO_REAL.etapas[0].v).toLocaleString('pt-BR')} más en cerca de 5 años. Ejemplo informado por ${CASO_REAL.fonte}; valorización del precio, sin descontar costos ni impuestos.`)}</p>
      <div class="pp-msg">
        <b>${L(`Em 10 anos, no cenário moderado, seu imóvel pode valer ${brl(v(mod,10))}: ${Math.round((v(mod,10)/V-1)*100)}% a mais do que você paga hoje.`,`En 10 años, en el escenario moderado, su inmueble puede valer ${brl(v(mod,10))}: ${Math.round((v(mod,10)/V-1)*100)}% más de lo que paga hoy.`)}</b>
        <span>${L(`Em 15 anos, ${brl(v(mod,15))}. E isso sem contar o aluguel, que aparece na próxima página. Imóvel é patrimônio real: protege da inflação, pode ser usado pela família e gera renda ao mesmo tempo.`,`En 15 años, ${brl(v(mod,15))}. Y eso sin contar el alquiler, que aparece en la página siguiente. El inmueble es patrimonio real: protege de la inflación, puede usarlo la familia y genera renta al mismo tiempo.`)}</span>
      </div>
      <h2>${L('Por que estas taxas fazem sentido','Por qué estas tasas tienen sentido')}</h2>
      <ul class="pp-lista">
        <li>${L(`<b>Custo de construir sobe sempre:</b> o CUB/SC subiu ${p1(CUB.v12m)} em 12 meses. Um prédio novo igual ao seu custa mais a cada mês, e isso sustenta o preço de quem já comprou.`,`<b>El costo de construir siempre sube:</b> el CUB/SC subió ${p1(CUB.v12m)} en 12 meses. Un edificio nuevo igual al suyo cuesta más cada mes, y eso sostiene el precio de quien ya compró.`)}</li>
        <li>${(()=>{const S=REFS.serieDWVPortoBelo.pontos,a=S[0],b=S.at(-1);return L(`<b>Porto Belo:</b> o m² de imóveis novos foi de ${brl(a.v)} (${a.rot}) para ${brl(b.v)} (${b.rot}), alta de ${Math.round((b.v/a.v-1)*100)}% (DWV).`,`<b>Porto Belo:</b> el m² de inmuebles nuevos pasó de ${brl(a.v)} (${a.rot}) a ${brl(b.v)} (${b.rot}), suba de ${Math.round((b.v/a.v-1)*100)}% (DWV).`);})()}</li>
        <li>${L(`<b>Itapema</b>, vizinha de Porto Belo, tem um dos m² mais caros do Brasil no FipeZap: ${brl(it[LAST])}/m², com ${p1(cagrItapema()*100)} de alta média ao ano desde dez/2020.`,`<b>Itapema</b>, vecina de Porto Belo, tiene uno de los m² más caros de Brasil en el FipeZap: ${brl(it[LAST])}/m², con ${p1(cagrItapema()*100)} de suba promedio anual desde dic/2020.`)}</li>
        <li>${L(`<b>Para comparar:</b> o mesmo valor aplicado no CDI líquido de IR (${pct(cdiL,1)} ao ano hoje) chegaria a ${brl(cdi10)} em 10 anos, mas sem aluguel, sem uso e sem o imóvel.`,`<b>Para comparar:</b> el mismo valor aplicado al CDI neto de impuesto (${pct(cdiL,1)} anual hoy) llegaría a ${brl(cdi10)} en 10 años, pero sin alquiler, sin uso y sin el inmueble.`)}</li>
      </ul>
      <h2>${L('Quem já escolheu a Costa Esmeralda','Quién ya eligió la Costa Esmeralda')}</h2>
      <div class="pp-famosos">${FAMOSOS.map(f=>`<div><b>${f.nome}</b><span class="cid">${f.cid}</span><p>${L(f.pt,f.es)}</p><small>${f.src}</small></div>`).join('')}</div>
      <p class="pp-obs">${L('Fatos publicados pela imprensa e pelo mercado. As pessoas e empresas citadas não têm relação com este empreendimento nem o recomendam.','Hechos publicados por la prensa y el mercado. Las personas y empresas citadas no tienen relación con este emprendimiento ni lo recomiendan.')}</p>
      <p class="pp-obs">${L('Projeção, não promessa: rentabilidade passada não garante rentabilidade futura. Valores sem descontar inflação, custos de venda e impostos.','Proyección, no promesa: la rentabilidad pasada no garantiza la futura. Valores sin descontar inflación, costos de venta e impuestos.')}</p>
    </div>`;
  }

  function pagRenda(e,u,V){
    const r=RM(), lr=localRenda(e,u,V), t=lr.tp, an=lr.an, T=renda(V,'temporada',lr), A=renda(V,'anual',lr), g=cenariosVal()[1].taxa, mCh=mesesAte(e.entrega)||0;
    const col=(tit,o,sub)=>`<div class="pp-renda"><h3>${tit}</h3><p class="sub">${sub}</p>
      <table class="pp-tab"><tbody>
        <tr><td>${L('Receita bruta no ano','Ingreso bruto anual')}</td><td>${brl(o.bruto)}</td></tr>
        <tr><td>${L('Administração / plataforma','Administración / plataforma')}</td><td>− ${brl(o.adm)}</td></tr>
        <tr><td>${L('Imposto de renda (estimado)','Impuesto a la renta (estimado)')}</td><td>− ${brl(o.ir)}</td></tr>
        <tr><td>${L('IPTU, manutenção e seguro','Impuestos, mantenimiento y seguro')}</td><td>− ${brl(o.desp)}</td></tr>
      </tbody></table>
      <div class="pp-total"><span>${L('Sobra por mês','Queda por mes')}</span><b>${brl(o.mes)}</b></div>
      <p class="sub">${L(`${brl(o.liq)} por ano · ${pct(o.yl,1)} líquido sobre o valor (${pct(o.yb,1)} bruto)`,`${brl(o.liq)} por año · ${pct(o.yl,1)} neto sobre el valor (${pct(o.yb,1)} bruto)`)}</p></div>`;
    const pat=(o,h)=>V*Math.pow(1+g,h)+rendaAcum(o.liq,g,mCh,h), oc=x=>Math.round(x*100);
    const subT=L(`${t.onde?`<b>Airbnb em ${t.onde}${t.q?`, ${t.q} ${t.q===1?'quarto':'quartos'}`:''}.</b> `:''}Diária média de ${brl(t.dA)} de dezembro a março (${oc(t.oA)}% ocupado) e ${brl(t.dB)} no resto do ano (${oc(t.oB)}% ocupado)`,
                 `${t.onde?`<b>Airbnb en ${t.onde}${t.q?`, ${t.q} ${t.q===1?'dormitorio':'dormitorios'}`:''}.</b> `:''}Diaria promedio de ${brl(t.dA)} de diciembre a marzo (${oc(t.oA)}% ocupado) y ${brl(t.dB)} el resto del año (${oc(t.oB)}% ocupado)`);
    const det=an.faixa?L(`faixa da região: ${brl(an.faixa[0])} a ${brl(an.faixa[1])}`,`rango de la zona: ${brl(an.faixa[0])} a ${brl(an.faixa[1])}`):an.m2?`R$ ${m2f(an.m2)}/m² × ${u.area.toLocaleString('pt-BR')} m²`:'';
    const subA=L(`${an.onde?`<b>${an.media?'Média de ':''}${an.onde}.</b> `:''}Contrato de 12 meses a ${brl(an.mes)} por mês${det?` (${det})`:''}, com ${r.vacancia}% de tempo vazio entre inquilinos`,
                 `${an.onde?`<b>${an.media?'Promedio de ':''}${an.onde}.</b> `:''}Contrato de 12 meses a ${brl(an.mes)} por mes${det?` (${det})`:''}, con ${r.vacancia}% de tiempo vacío entre inquilinos`);
    const loc=[e.bairro,e.cidade].filter(Boolean).join(', ');
    return `<div class="pp-pag">
      <div class="pp-kick">${L('Simulação','Simulación')}</div>
      <h1>${L('Quanto seu imóvel pode render','Cuánto puede rendir su inmueble')}</h1>
      <p class="pp-lead">${L(`Duas formas de alugar a partir das chaves${e.entrega?` (${fmtMesAno(e.entrega)})`:''}, num imóvel de ${brl(V)}${loc?`, com os valores praticados em <b>${loc}</b>`:''}. Valores do primeiro ano de aluguel, em valor de hoje.`,`Dos formas de alquilar desde la entrega${e.entrega?` (${fmtMesAno(e.entrega)})`:''}, en un inmueble de ${brl(V)}${loc?`, con los valores de <b>${loc}</b>`:''}. Valores del primer año de alquiler, en valor de hoy.`)}</p>
      <div class="pp-dois">
        ${col(L('🏖️ Temporada','🏖️ Temporada'),T,subT)}
        ${col(L('🏠 Aluguel anual','🏠 Alquiler anual'),A,subA)}
      </div>
      <h2>${L('Seu patrimônio somando imóvel + aluguel (cenário moderado)','Su patrimonio sumando inmueble + alquiler (escenario moderado)')}</h2>
      <table class="pp-grade"><thead><tr><th style="text-align:left"></th>${HORIZ.map(h=>`<th>${h} ${L('anos','años')}</th>`).join('')}</tr></thead><tbody>
        <tr><td style="text-align:left">${L('Imóvel valorizado','Inmueble valorizado')}</td>${HORIZ.map(h=>`<td>${brl(V*Math.pow(1+g,h))}</td>`).join('')}</tr>
        <tr><td style="text-align:left">${L('+ aluguel recebido (temporada)','+ alquiler cobrado (temporada)')}</td>${HORIZ.map(h=>`<td>${brl(rendaAcum(T.liq,g,mCh,h))}</td>`).join('')}</tr>
        <tr class="dest"><td style="text-align:left"><b>${L('= Patrimônio com temporada','= Patrimonio con temporada')}</b></td>${HORIZ.map(h=>`<td><b>${brl(pat(T,h))}</b></td>`).join('')}</tr>
        <tr><td style="text-align:left">${L('+ aluguel recebido (anual)','+ alquiler cobrado (anual)')}</td>${HORIZ.map(h=>`<td>${brl(rendaAcum(A.liq,g,mCh,h))}</td>`).join('')}</tr>
        <tr class="dest"><td style="text-align:left"><b>${L('= Patrimônio com aluguel anual','= Patrimonio con alquiler anual')}</b></td>${HORIZ.map(h=>`<td><b>${brl(pat(A,h))}</b></td>`).join('')}</tr>
      </tbody></table>
      <div class="pp-msg"><b>${L(`Em 10 anos, com temporada, o investimento de ${brl(V)} pode virar ${brl(pat(T,10))} em patrimônio e renda.`,`En 10 años, con temporada, la inversión de ${brl(V)} puede convertirse en ${brl(pat(T,10))} en patrimonio y renta.`)}</b>
        <span>${L(`Na alta temporada o imóvel rende até ${brl(t.dA*t.oA*DIAS_MES)} por mês. Fora dela, o aluguel anual dá renda estável o ano todo. Você escolhe o perfil, e pode mudar quando quiser.`,`En temporada alta el inmueble rinde hasta ${brl(t.dA*t.oA*DIAS_MES)} por mes. Fuera de ella, el alquiler anual da renta estable todo el año. Usted elige el perfil, y puede cambiarlo cuando quiera.`)}</span></div>
      <p class="pp-obs">${L(`Fontes: temporada = ${t.fonte}; aluguel anual = ${an.fonte}. Administração de ${r.admTemporada}% (temporada) e ${r.admAnual}% (anual), IR de ${r.irAluguel}% e despesas de ${p1(r.despesasAnoPctValor)} do valor ao ano são referências da consultoria. Para temporada, considere mobiliar o imóvel (cerca de ${p1(SITE_CONFIG.mobiliaPadraoPct)} do valor). O aluguel acompanha a valorização do cenário moderado. Simulação, não garantia de renda.`,`Fuentes: temporada = ${t.fonte}; alquiler anual = ${an.fonte}. Administración de ${r.admTemporada}% (temporada) y ${r.admAnual}% (anual), impuesto de ${r.irAluguel}% y gastos de ${p1(r.despesasAnoPctValor)} del valor por año son referencias de la consultoría. Para temporada, considere amueblar (cerca de ${p1(SITE_CONFIG.mobiliaPadraoPct)} del valor). El alquiler sigue la valorización del escenario moderado. Simulación, no garantía de renta.`)}</p>
    </div>`;
  }

  function pagRegiao(e){
    const S=REFS.serieDWVPortoBelo.pontos, a=S[0], b=S.at(-1);
    const cid=norm(e.cidade), pb=!cid||cid==='porto belo', ita=cid==='itapema', perequeBairro=/pereque/.test(norm(e.bairro));
    const valIt=Math.round((it[LAST]/it[0]-1)*100);
    const card=(ic,t,n,p,src)=>`<div class="pp-card"><div class="t"><span>${ic}</span><b>${t}</b></div>${n?`<div class="n">${n}</div>`:''}<p>${p}</p><small>${src}</small></div>`;
    const bloco=(t,cards)=>`<h2>${t}</h2><div class="pp-cards">${cards.join('')}</div>`;
    return `<div class="pp-pag">
      <div class="pp-kick">${L('Por que investir aqui','Por qué invertir aquí')}</div>
      <h1>${pb?L('Porto Belo está em transformação','Porto Belo está en transformación'):L('A Costa Esmeralda está em transformação','La Costa Esmeralda está en transformación')}</h1>
      <p class="pp-lead">${L(`Bilhões de reais em projetos privados e públicos estão chegando a ${pb?'Porto Belo e à Costa Esmeralda':'Porto Belo, Itapema e toda a Costa Esmeralda'}. Quem compra antes deles ficarem prontos captura a valorização.${ita?` Em Itapema, o preço do m² residencial subiu ${valIt}% desde dez/2020 (FipeZap), um dos maiores do Brasil.`:''} ${pb?'Em Porto Belo':'Na vizinha Porto Belo'}, o m² de imóveis novos subiu ${Math.round((b.v/a.v-1)*100)}% de ${a.rot} a ${b.rot}, e só no 1º semestre de 2026 a cidade vendeu ${REFS.vendasPortoBelo?.v||'R$ 2,5 bilhões'} em imóveis novos (DWV).`,`Miles de millones de reales en proyectos privados y públicos están llegando a ${pb?'Porto Belo y a la Costa Esmeralda':'Porto Belo, Itapema y toda la Costa Esmeralda'}. Quien compra antes de que estén listos captura la valorización.${ita?` En Itapema, el precio del m² residencial subió ${valIt}% desde dic/2020 (FipeZap), uno de los mayores de Brasil.`:''} ${pb?'En Porto Belo':'En la vecina Porto Belo'}, el m² de inmuebles nuevos subió ${Math.round((b.v/a.v-1)*100)}% de ${a.rot} a ${b.rot}, y solo en el 1er semestre de 2026 la ciudad vendió ${REFS.vendasPortoBelo?.v||'R$ 2,5 bilhões'} en inmuebles nuevos (DWV).`)}</p>
      ${bloco(L('🏗️ Grandes projetos','🏗️ Grandes proyectos'),[
        card('🌳','VivaPark Porto Belo','~R$ 1 bi',L('Primeiro "bairro parque" planejado do Brasil, às margens da BR-101, para até 30 mil moradores, com selo LEED. Já recebe moradores.','Primer "barrio parque" planificado de Brasil, junto a la BR-101, para hasta 30 mil habitantes, con sello LEED. Ya recibe residentes.'),'NSC Total, MySide'),
        card('🎾','All Resort Club Residence',L('VGV R$ 600 mi','VGV R$ 600 M'),L('182 mil m², o 1º campo de golfe totalmente iluminado da América do Sul (pronto) e o 1º Rafa Nadal Tennis Center do continente, previsto para 2028.','182 mil m², la 1ª cancha de golf totalmente iluminada de Sudamérica (lista) y el 1er Rafa Nadal Tennis Center del continente, previsto para 2028.'),'Panrotas, InfoMoney, NSC Total'),
        card('⚽',L('Porto Belo Lagos + Ecossistema Neymar Jr.','Porto Belo Lagos + Ecosistema Neymar Jr.'),'~R$ 250 mi',L('Complexo esportivo e de lazer da família Neymar dentro de um bairro planejado de cerca de 1 milhão de m². Em licenciamento, previsão 2027.','Complejo deportivo y de ocio de la familia Neymar dentro de un barrio planificado de cerca de 1 millón de m². En licenciamiento, previsión 2027.'),'NSC Total, MySide'),
        card('🏭',L('Fábrica da Neusoft Medical','Fábrica de Neusoft Medical'),'R$ 250 mi',L('Gigante chinesa de equipamentos médicos escolheu Porto Belo para sua 1ª fábrica no Brasil (ressonância magnética). Cerca de 100 empregos diretos e qualificados. Anunciada em jun/2026.','Gigante china de equipos médicos eligió Porto Belo para su 1ª fábrica en Brasil (resonancia magnética). Cerca de 100 empleos directos y calificados. Anunciada en jun/2026.'),L('Governo de SC, NSC Total, Baguete','Gobierno de SC, NSC Total, Baguete')),
        pb?'':card('🌊',L('Nova orla do Perequê','Nueva costanera del Perequê'),L('5 etapas · 36 meses','5 etapas · 36 meses'),L('Masterplan da Prefeitura com as construtoras (ACIP): molhes dos rios Perequê e Perequezinho, nova orla do Balneário Perequê e avenidas revitalizadas. '+(perequeBairro?'Bem na praia deste empreendimento.':''),'Masterplan de la Municipalidad con las constructoras (ACIP): escolleras de los ríos Perequê y Perequezinho, nueva costanera del Balneário Perequê y avenidas revitalizadas. '+(perequeBairro?'Justo en la playa de este emprendimiento.':'')),'NSC Total, MySide'),
        card('🏖️',L('Alargamento da Meia Praia','Ensanche de Meia Praia'),'~R$ 60 mi · 4,75 km',(ita?L('A orla de Itapema ganha até 60 m de faixa de areia: mais espaço, mais proteção e mais valor para a frente-mar.','La costa de Itapema gana hasta 60 m de franja de arena: más espacio, más protección y más valor para el frente al mar.'):L('Itapema, a 10 km, ganha até 60 m de faixa de areia: mais valor para toda a costa vizinha.','Itapema, a 10 km, gana hasta 60 m de franja de arena: más valor para toda la costa vecina.')),L('Prefeitura de Itapema e Governo de SC','Municipalidad de Itapema y Gobierno de SC'))])}
      ${bloco(L('🏥 Saúde','🏥 Salud'),[
        card('🏥',L('Complexo hospitalar de Porto Belo','Complejo hospitalario de Porto Belo'),'R$ 200 mi · 30 mil m²',L('Maior complexo hospitalar da Costa Esmeralda e 1º hospital de Porto Belo (6 mil m² só de hospital, mais consultórios), com 150 empregos. Primeira operação prevista para o início de 2027.','Mayor complejo hospitalario de la Costa Esmeralda y 1er hospital de Porto Belo (6 mil m² solo de hospital, más consultorios), con 150 empleos. Primera operación prevista para inicios de 2027.'),'NSC Total, Estado de Minas (ago/2026)'),
        card('🚑',L('UPA 24 horas','Guardia 24 horas'),'',L((pb?'Pronto atendimento 24h na cidade':'Pronto atendimento 24h em Porto Belo')+' (UPA Maurílio Manoel da Silva) e hospitais de referência em Itapema, Balneário Camboriú e Itajaí, a menos de 45 minutos.',(pb?'Guardia 24h en la ciudad':'Guardia 24h en Porto Belo')+' (UPA Maurílio Manoel da Silva) y hospitales de referencia en Itapema, Balneário Camboriú e Itajaí, a menos de 45 minutos.'),L('Prefeitura de Porto Belo','Municipalidad de Porto Belo'))])}
      ${bloco(L('🛣️ Mobilidade e acesso','🛣️ Movilidad y acceso'),[
        card('✈️',L('BR-101 e 2 aeroportos','BR-101 y 2 aeropuertos'),'~50 km · ~70 km',L('Acesso direto pela BR-101 duplicada, entre os aeroportos internacionais de Navegantes e Florianópolis.','Acceso directo por la BR-101 (autopista), entre los aeropuertos internacionales de Navegantes y Florianópolis.'),L('distâncias aproximadas por estrada','distancias aproximadas por ruta')),
        card('🛤️','Via Mar',L('145 km · 6 faixas','145 km · 6 carriles'),L('Nova rodovia litorânea do Governo de SC, paralela à BR-101, de Joinville à Grande Florianópolis, a até 120 km/h, para desafogar o litoral. Obras por etapas; 1º lote em licitação.','Nueva ruta costera del Gobierno de SC, paralela a la BR-101, de Joinville a la Gran Florianópolis, hasta 120 km/h, para descongestionar el litoral. Obras por etapas; 1er lote en licitación.'),'NSC Total, Canal Rural (2026)'),
        card('🚌',L('PROMOBIS: transporte regional','PROMOBIS: transporte regional'),'US$ 342 mi',L('Sistema de ônibus rápidos (BRT) integrando 11 cidades, incluindo Porto Belo, Itapema e Bombinhas, com financiamento do Banco Mundial. Obras previstas a partir de 2027.','Sistema de buses rápidos (BRT) que integra 11 ciudades, incluidas Porto Belo, Itapema y Bombinhas, con financiamiento del Banco Mundial. Obras previstas desde 2027.'),L('Banco Mundial, Governo de SC','Banco Mundial, Gobierno de SC')),
        card('🌉',L('Ponte Itapema ↔ Porto Belo','Puente Itapema ↔ Porto Belo'),'',L('Ponte da Rua 306 já construída, como rota alternativa à BR-101 entre as duas cidades; falta concluir o acesso do lado de Porto Belo.','Puente de la Calle 306 ya construido, como ruta alternativa a la BR-101 entre las dos ciudades; falta concluir el acceso del lado de Porto Belo.'),'ND+, Hora de Porto Belo (mai/2026)')])}
      <p class="pp-obs">${L('Projetos anunciados por empresas, governo e imprensa; valores e prazos podem mudar. Situação conferida em novembro de 2026.','Proyectos anunciados por empresas, gobierno y prensa; valores y plazos pueden cambiar. Situación verificada en noviembre de 2026.')}</p>
    </div>`;
  }

  /* ---------- página "Orla do Perequê: o que vem por aí" (17/11/2026) ----------
     Só para imóveis de Porto Belo. Obras estruturais do Masterplan do Perequê (Prefeitura + ACIP) e vizinhas.
     FOTOS_ORLA: imagens autorizadas (ACIP/Prefeitura/Píer Oporto) — vazio até o Santiago conseguir a autorização.
     Formato: {src:'img/regiao/arquivo.jpg', pt:'legenda', es:'leyenda', credito:'ACIP/Divulgação'} */
  const FOTOS_ORLA=[];
  // mapa das obras da orla (OpenStreetMap, desenhado por costa-esmeralda-docs/mapa_orla_desenhar.py): com o pino do empreendimento quando existe
  const MAPA_ORLA_EMP={beni:'img/beni/mapa-orla.jpg'};
  function pagOrla(e){
    if(norm(e.cidade)!=='porto belo') return '';
    const pereque=/pereque/.test(norm(e.bairro)), dist=e.distanciaMar?Math.round(e.distanciaMar).toLocaleString('pt-BR'):'';
    const ST={ok:['✅',L('Concluído','Concluido'),'ok'],obra:['🚧',L('Em obras','En obras'),'obra'],lic:['🔄',L('Em licenciamento','En licenciamiento'),'lic'],proj:['📐',L('Em projeto','En proyecto'),'proj']};
    const item=(st,tit,num,txt,src)=>{ const s=ST[st]; return `<div class="pp-tl-i"><div class="pp-tl-st ${s[2]}">${s[0]} ${s[1]}</div><div><div class="t"><b>${tit}</b>${num?`<span>${num}</span>`:''}</div><p>${txt}</p><small>${src}</small></div></div>`; };
    const fotos=FOTOS_ORLA.filter(f=>IMG(f.src)).slice(0,3), mapaOrla=IMG(e.fotos&&e.fotos.mapaOrla)||MAPA_ORLA_EMP[e.id]||'img/regiao/mapa-orla.jpg';
    return `<div class="pp-pag">
      <div class="pp-kick">${L('Obras estruturais','Obras estructurales')}</div>
      <h1>${L('Orla do Perequê: o que vem por aí','Costanera del Perequê: lo que viene')}</h1>
      <p class="pp-lead">${pereque&&dist?L(`Este empreendimento fica a <b>≈ ${dist} m da praia</b> que está recebendo um dos maiores pacotes de obras do litoral de SC: o <b>Masterplan do Perequê</b>, da Prefeitura de Porto Belo com a ACIP, associação das construtoras e incorporadoras da cidade. Quem compra antes das obras ficarem prontas compra pelo preço de hoje e recebe a orla de amanhã.`,`Este emprendimiento está a <b>≈ ${dist} m de la playa</b> que está recibiendo uno de los mayores paquetes de obras del litoral de SC: el <b>Masterplan del Perequê</b>, de la Municipalidad de Porto Belo con ACIP, asociación de constructoras de la ciudad. Quien compra antes de que las obras estén listas compra al precio de hoy y recibe la costanera de mañana.`)
        :L(`O Balneário Perequê, principal praia urbana de Porto Belo, está recebendo um dos maiores pacotes de obras do litoral de SC: o <b>Masterplan do Perequê</b>, da Prefeitura com a ACIP, associação das construtoras e incorporadoras da cidade. Obras que valorizam toda a cidade.`,`El Balneário Perequê, principal playa urbana de Porto Belo, está recibiendo uno de los mayores paquetes de obras del litoral de SC: el <b>Masterplan del Perequê</b>, de la Municipalidad con ACIP, asociación de constructoras de la ciudad. Obras que valorizan toda la ciudad.`)}</p>
      <div class="pp-mapa-orla"><img src="${mapaOrla}" alt=""></div>
      <div class="pp-tl">
        ${item('ok',L('Molhes dos rios Perequê e Perequezinho','Escolleras de los ríos Perequê y Perequezinho'),L('805 m · ~R$ 13 mi','805 m · ~R$ 13 M'),L('Três molhes interligados na foz dos rios. Melhoram a qualidade da água do mar, seguram a areia na praia e reduzem as cheias. A 1ª fase está pronta; o próximo passo é urbanizar os molhes e instalar uma marina, com opção de ir de barco até o centro de Porto Belo.','Tres escolleras interconectadas en la desembocadura de los ríos. Mejoran la calidad del agua, retienen la arena y reducen las crecidas. La 1ª fase está lista; el próximo paso es urbanizar las escolleras e instalar una marina, con opción de ir en barco al centro de Porto Belo.'),L('Recursos de outorga onerosa · MySide, Visor Notícias, OCP News','Recursos de otorga onerosa · MySide, Visor Notícias, OCP News'))}
        ${item('lic',L('Alargamento da faixa de areia','Ensanche de la franja de arena'),L('até 80 m a mais de areia','hasta 80 m más de arena'),L('No mesmo modelo de Balneário Camboriú e Balneário Piçarras: praia mais larga, mais protegida e com mais espaço para lazer. A ACIP pagou o projeto e o licenciamento ambiental; a documentação complementar foi entregue ao IMA em maio de 2026, com início das obras previsto para depois da licença.','Mismo modelo que Balneário Camboriú y Balneário Piçarras: playa más ancha, más protegida y con más espacio para el ocio. ACIP pagó el proyecto y el licenciamiento ambiental; la documentación complementaria se entregó al IMA en mayo de 2026, con inicio de obras previsto tras la licencia.'),'OCP News (21/05/2026), Jornal Razão, G7 SC')}
        ${item('proj',L('Nova orla e calçadão','Nueva costanera y paseo'),L('Masterplan Prefeitura + ACIP','Masterplan Municipalidad + ACIP'),L('Calçadão na orla, praças, quiosques, playground, espaço pet e uma arena esportiva gratuita com 6 quadras de areia (vôlei, futevôlei e beach tennis), além da revitalização das principais avenidas do bairro.','Paseo costero, plazas, quioscos, juegos infantiles, espacio pet y una arena deportiva gratuita con 6 canchas de arena (vóley, futvóley y beach tennis), además de la revitalización de las principales avenidas del barrio.'),'MySide, NSC Total')}
        ${item('proj',L('Passarela Perequê ↔ Meia Praia','Pasarela Perequê ↔ Meia Praia'),'65 m × 3,5 m',L('Passarela de pedestres sobre o rio Perequê, ligando a praia do Perequê à Meia Praia de Itapema pela orla. Projeto divulgado em julho de 2026 pelos sócios do Píer Oporto, que vão executá-la, dentro de um acordo com o Ministério Público de SC.','Pasarela peatonal sobre el río Perequê, que une la playa del Perequê con Meia Praia de Itapema por la costa. Proyecto divulgado en julio de 2026 por los socios del Píer Oporto, que la ejecutarán, en el marco de un acuerdo con el Ministerio Público de SC.'),'Santa Catarina em Pauta, Mesorregional (jul/2026)')}
        ${item('obra',L('Píer Oporto','Píer Oporto'),L('330 m sobre o mar','330 m sobre el mar'),L('Píer turístico na foz do rio Perequê, na divisa com Itapema: 18 mil m² com gastronomia, entretenimento e náutica.','Muelle turístico en la desembocadura del río Perequê, en el límite con Itapema: 18 mil m² con gastronomía, entretenimiento y náutica.'),'MySide, NSC Total')}
        ${item('proj',L('Avenidas do Perequê','Avenidas del Perequê'),'',L('Pavimentação e urbanização da Av. Santino Voltolini e da Rua Dorvalino Voltolini (projeto pago pela ACIP), dentro do Plano Mil do Governo de SC, que destinou cerca de R$ 22 milhões a obras em Porto Belo.','Pavimentación y urbanización de la Av. Santino Voltolini y la Calle Dorvalino Voltolini (proyecto pagado por ACIP), dentro del Plan Mil del Gobierno de SC, que destinó cerca de R$ 22 millones a obras en Porto Belo.'),'MySide')}
      </div>
      ${fotos.length?`<div class="pp-fotos">${fotos.map(f=>`<figure><img src="${IMG(f.src)}" alt=""><figcaption>${esc(L(f.pt,f.es||f.pt))}${f.credito?` · ${esc(f.credito)}`:''}</figcaption></figure>`).join('')}</div>`:''}
      <div class="pp-msg"><b>${L('Infraestrutura nova puxa o preço para cima.','La infraestructura nueva empuja el precio hacia arriba.')}</b>
        <span>${L('Praia mais larga, água mais limpa, orla urbanizada e ligação a pé com Itapema: é o caminho que fez Balneário Camboriú e Itapema terem alguns dos m² mais caros do Brasil. No Perequê, isso está acontecendo agora.','Playa más ancha, agua más limpia, costanera urbanizada y conexión a pie con Itapema: es el camino que llevó a Balneário Camboriú e Itapema a tener algunos de los m² más caros de Brasil. En el Perequê, esto está ocurriendo ahora.')}</span></div>
      <p class="pp-obs">${L('Projetos públicos e privados anunciados pela Prefeitura, pela ACIP, por empresas e pela imprensa; prazos e detalhes podem mudar, principalmente das obras que ainda dependem de licença. Situação conferida em novembro de 2026.','Proyectos públicos y privados anunciados por la Municipalidad, ACIP, empresas y prensa; plazos y detalles pueden cambiar, sobre todo en las obras que aún dependen de licencia. Situación verificada en noviembre de 2026.')}</p>
    </div>`;
  }

  /* ---------- PDF (só a proposta final) ---------- */
  function pdf(){
    const {e,u}=P, a=P.aj, m=metricas(a), f=e.fotos||{};
    const cap=IMG(f.capa), pl=IMG(u.planta), usadas=fotosLazer(e).map(x=>x[0]), gal=(f.galeria||[]).map(IMG).filter(s=>s&&!usadas.includes(s)).slice(0,6), mapa=IMG(f.mapa), mapaRua=IMG(f.mapaRua);
    const val=/^\d{4}-\d{2}-\d{2}$/.test(P.validade)?P.validade.split('-').reverse().join('/'):'';
    const hoje=new Date().toLocaleDateString(ES?'es-AR':'pt-BR');
    const ficha=[u.tipo,u.area?`${u.area.toLocaleString('pt-BR',{minimumFractionDigits:2})} m² ${L('privativos','privados')}`:'',u.vagas?`${u.vagas} ${u.vagas==1?L('vaga','cochera'):L('vagas','cocheras')}`:'',u.pavimento?`${u.pavimento}º ${L('andar','piso')}`:''].filter(Boolean).join(' · ');
    out.innerHTML=`<div class="pp-pag">
      <div class="pp-cab"><div><div class="pp-kick">${L('Proposta','Propuesta')}${P.cliente?` · ${L('para','para')} ${esc(P.cliente)}`:''}</div>
        <h1>${e.nome}</h1><p>${[e.endereco,e.bairro,e.cidade?e.cidade+' / SC':''].filter(Boolean).join(' · ')}</p></div>
        <div class="pp-uni"><span>${L('Unidade','Unidad')}</span><b>${u.unidade}</b></div></div>
      <div class="pp-dupla">${cap?`<img src="${cap}" alt="">`:''}
        <div><p class="pp-ficha">${ficha}</p>
          <p>${[e.fase,e.entrega?L('Entrega prevista ','Entrega prevista ')+fmtMesAno(e.entrega):''].filter(Boolean).join(' · ')}</p>
          ${e.incorporacao?`<p class="pp-inc">${L('Registro de Incorporação nº','Registro de Incorporación nº')} ${e.incorporacao}</p>`:''}
          <div class="pp-total"><span>${L('Valor total','Valor total')}</span><b>${brl(m.total)}</b></div>
          <table class="pp-tab"><tbody>${resumo(a).map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</tbody></table>
          <p class="pp-obs">${a.correcao?L(`Parcelas corrigidas mensalmente pelo ${esc(a.correcao)}.`,`Cuotas ajustadas mensualmente por ${esc(a.correcao)}.`):''} ${val?L(`<b>Proposta válida até ${val}</b>, sujeita à disponibilidade da unidade e à aprovação da incorporadora.`,`<b>Propuesta válida hasta ${val}</b>, sujeta a disponibilidad de la unidad y aprobación del desarrollador.`):L('Sujeita à disponibilidade da unidade e à aprovação da incorporadora.','Sujeta a disponibilidad de la unidad y aprobación del desarrollador.')}</p>
        </div></div>
      ${pl?`<div class="pp-planta"><h2>${L('Planta','Planta')} · ${u.area?u.area.toLocaleString('pt-BR',{minimumFractionDigits:2})+' m²':''}</h2><img src="${pl}" alt=""></div>`:''}
    </div>
    ${pagDetalhe(e,u,a,m)}
    ${pagValorizacao(m.total)}
    ${pagRenda(e,u,m.total)}
    ${pagRegiao(e)}
    ${pagOrla(e)}
    <div class="pp-pag">
      ${e.lazer?`<h2>${L('Lazer','Áreas comunes')}</h2><p>${e.lazer}</p>`:''}
      ${gal.length?`<div class="pp-gal">${gal.map(s=>`<img src="${s}" alt="">`).join('')}</div>`:''}
      ${mapa||mapaRua?`<h2>${L('Localização','Ubicación')}</h2>
        <p><b>${[e.endereco,e.bairro,e.cidade?e.cidade+' / SC':''].filter(Boolean).join(' · ')}</b>${e.distanciaMar?` · ${L(`≈ ${Math.round(e.distanciaMar).toLocaleString('pt-BR')} m do mar em linha reta`,`≈ ${Math.round(e.distanciaMar).toLocaleString('pt-BR')} m del mar en línea recta`)}${e.praia?` (${e.praia})`:''}`:''}</p>
        <div class="pp-loc"><img src="${mapaRua||mapa}" alt=""></div>`:''}
      <div class="pp-rod"><b>${esc(assinatura())}</b><br>${L(`Proposta preparada em ${hoje}. Imagens ilustrativas. Valores e condições sujeitos à confirmação no contrato.`,`Propuesta preparada el ${hoje}. Imágenes ilustrativas. Valores y condiciones sujetos a confirmación en el contrato.`)}</div>
    </div>`;
    const agora=new Date(), hora=`${String(agora.getDate()).padStart(2,'0')}-${String(agora.getMonth()+1).padStart(2,'0')} ${String(agora.getHours()).padStart(2,'0')}h${String(agora.getMinutes()).padStart(2,'0')}`;
    const nome=(`Proposta ${txt(e.nome)} ${u.unidade}${P.cliente?' - '+P.cliente:''} ${hora}`.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g,'').replace(/\s+/g,' ').replace(/^[.\s]+/,'').trim().slice(0,90)||'Proposta')+'.pdf';
    gerarArquivo(nome);
  }
  const txt=s=>{ const t=document.createElement('textarea'); t.innerHTML=String(s||''); return t.value; };

  /* PDF de verdade (arquivo), para mandar no WhatsApp. Cada .pp-pag vira uma página A4:
     html2canvas fotografa a página e o jsPDF monta o arquivo. Bibliotecas carregadas só quando precisa. */
  const LIBS=['lib/html2canvas-1.4.1.min.js','lib/jspdf-2.5.1.umd.min.js'];   // cópias guardadas no próprio site (cdnjs, versões fixas)
  let libPdf=null;
  const script=src=>new Promise((ok,erro)=>{ const sc=document.createElement('script'); sc.src=src; sc.onload=()=>ok(); sc.onerror=()=>erro(new Error('lib')); document.head.appendChild(sc); });
  const carregarLib=()=>libPdf||(libPdf=(window.html2canvas&&window.jspdf?Promise.resolve():Promise.all(LIBS.map(script))).catch(err=>{ libPdf=null; throw err; }));
  let urlPdf=null;
  async function gerarArquivo(nome){
    const msg=document.getElementById('prMsg'), acoes=document.getElementById('prArq');
    acoes.innerHTML=''; msg.textContent=L('Gerando o PDF… (alguns segundos)','Generando el PDF… (algunos segundos)');
    document.getElementById('prPdf').disabled=true;
    const el=document.createElement('div'); el.className='pp pp-pdf'; el.innerHTML=out.innerHTML;
    const palco=document.createElement('div'); palco.className='pp-palco'; palco.appendChild(el);
    const yAntes=scrollY;
    try{
      await carregarLib();
      document.body.appendChild(palco);
      await Promise.all([...el.querySelectorAll('img')].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r;})));
      if(document.fonts&&document.fonts.ready) await document.fonts.ready;
      scrollTo(0,0);                                       // html2canvas usa a rolagem da página
      const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
      const pags=[...el.querySelectorAll('.pp-pag')];
      for(let i=0;i<pags.length;i++){
        const cv=await window.html2canvas(pags[i],{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,scrollX:0,scrollY:0,windowWidth:900});
        let w=210, h=w*cv.height/cv.width; if(h>297){ h=297; w=h*cv.width/cv.height; }
        if(i) doc.addPage();
        doc.addImage(cv.toDataURL('image/jpeg',0.88),'JPEG',(210-w)/2,0,w,h);
      }
      scrollTo(0,yAntes);
      const blob=doc.output('blob');
      const arq=new File([blob],nome,{type:'application/pdf'});
      if(urlPdf) URL.revokeObjectURL(urlPdf); urlPdf=URL.createObjectURL(blob);
      // "Enviar" só no celular: no Windows a janela de compartilhar costuma vir vazia (WhatsApp do PC não aparece nela)
      const celular=(navigator.userAgentData&&navigator.userAgentData.mobile)||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
      const podeEnviar=celular&&!!(navigator.canShare&&navigator.canShare({files:[arq]}));
      acoes.innerHTML=(podeEnviar?`<button class="btn" type="button" id="prEnviar">${L('📤 Enviar (WhatsApp…)','📤 Enviar (WhatsApp…)')}</button>`:'')+
        `<a class="btn${podeEnviar?' ghost':''}" id="prBaixar" href="${urlPdf}" download="${esc(nome)}">${L('⬇️ Baixar PDF','⬇️ Descargar PDF')}</a>`+
        (podeEnviar?'':`<a class="btn ghost" href="https://web.whatsapp.com/" target="_blank" rel="noopener">${L('💬 Abrir WhatsApp Web','💬 Abrir WhatsApp Web')}</a>`);
      msg.textContent=podeEnviar?L(`Pronto: ${nome} (${Math.max(1,Math.round(blob.size/1024))} KB). Toque em "Enviar" e escolha o WhatsApp.`,`Listo: ${nome} (${Math.max(1,Math.round(blob.size/1024))} KB). Toque "Enviar" y elija WhatsApp.`)
        :L(`Pronto: o PDF foi baixado (${nome}, ${Math.max(1,Math.round(blob.size/1024))} KB, na pasta Downloads). Abra o WhatsApp Web ou o WhatsApp do computador, entre na conversa do cliente e arraste o arquivo para dentro dela (ou clipe 📎 → Documento).`,`Listo: el PDF se descargó (${nome}, ${Math.max(1,Math.round(blob.size/1024))} KB, carpeta Descargas). Abra WhatsApp Web o WhatsApp de escritorio, entre en la conversación del cliente y arrastre el archivo (o clip 📎 → Documento).`);
      const env=document.getElementById('prEnviar');
      if(env) env.addEventListener('click',async()=>{ try{ await navigator.share({files:[arq],title:nome.replace(/\.pdf$/,'')}); }
        catch(err){ if(err&&err.name!=='AbortError') msg.textContent=L('Não consegui abrir o envio. Use "Baixar PDF".','No pude abrir el envío. Use "Descargar PDF".'); } });
      if(!podeEnviar) document.getElementById('prBaixar').click();
    }catch(err){
      msg.textContent=L('Não consegui gerar o arquivo (sem internet?). Abrindo a impressão: escolha "Salvar como PDF".','No pude generar el archivo (¿sin internet?). Abriendo la impresión: elija "Guardar como PDF".');
      imprimir();
    }finally{ palco.remove(); document.getElementById('prPdf').disabled=false; }
  }
  function imprimir(){
    const {e,u}=P;
    Promise.all([...out.querySelectorAll('img')].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r;}))).then(()=>{
      document.body.classList.add('print-proposta');
      const tit=document.title; document.title=`Proposta ${txt(e.nome)} ${u.unidade}${P.cliente?' - '+P.cliente:''}`;
      const fim=()=>{ document.body.classList.remove('print-proposta'); document.title=tit; removeEventListener('afterprint',fim); };
      addEventListener('afterprint',fim);
      window.print();
    });
  }

  /* ---------- liga na Área restrita ---------- */
  const origUni=renderUnidade;
  renderUnidade=function(){
    origUni();
    const {e,u}=ctx(), acts=document.querySelector('#cUniBox .actions');
    let b=document.getElementById('btnProposta');
    if(!u||!conds(e,u)){ if(b) b.remove(); return; }
    if(!b&&acts){ b=document.createElement('button'); b.type='button'; b.id='btnProposta'; b.className='btn'; b.textContent=L('📄 Montar proposta','📄 Armar propuesta');
      b.addEventListener('click',()=>{ const c=ctx(); abrir(P&&P.u===c.u?P.base:'fluxo',c.u); box.scrollIntoView({behavior:'smooth',block:'start'}); });
      acts.prepend(b); }
  };
  const origCorr=renderCorretor;
  renderCorretor=function(){ origCorr(); if(!TAB||(P&&P.e!==TAB.empreendimentos.find(x=>x.id===cEmp))){ P=null; box.hidden=true; box.innerHTML=''; } };
  renders.corretor=renderCorretor;
})();
