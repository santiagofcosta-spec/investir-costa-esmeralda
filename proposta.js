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
    if(p.unico.valor) it.push([P.base==='avista'?L('Saldo','Saldo'):L('Parcela única','Cuota única'),`${brl(p.unico.valor)} · ${p.unico.mes===1?L('em 30 dias','en 30 días'):mesRot(p.unico.mes)}`]);
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

  /* ---------- PDF (só a proposta final) ---------- */
  function pdf(){
    const {e,u}=P, a=P.aj, m=metricas(a), f=e.fotos||{};
    const cap=IMG(f.capa), pl=IMG(u.planta), gal=(f.galeria||[]).map(IMG).filter(Boolean).slice(0,6), mapa=IMG(f.mapa), mapaRua=IMG(f.mapaRua);
    const val=/^\d{4}-\d{2}-\d{2}$/.test(P.validade)?P.validade.split('-').reverse().join('/'):'';
    const hoje=new Date().toLocaleDateString(ES?'es-AR':'pt-BR');
    const ficha=[u.tipo,u.area?`${u.area.toLocaleString('pt-BR',{minimumFractionDigits:2})} m² ${L('privativos','privados')}`:'',u.vagas?`${u.vagas} ${L('vagas','cocheras')}`:'',u.pavimento?`${u.pavimento}º ${L('andar','piso')}`:''].filter(Boolean).join(' · ');
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
    <div class="pp-pag">
      ${e.lazer?`<h2>${L('Lazer','Áreas comunes')}</h2><p>${e.lazer}</p>`:''}
      ${gal.length?`<div class="pp-gal">${gal.map(s=>`<img src="${s}" alt="">`).join('')}</div>`:''}
      ${mapa||mapaRua?`<h2>${L('Localização','Ubicación')}</h2>
        <p><b>${[e.endereco,e.bairro,e.cidade?e.cidade+' / SC':''].filter(Boolean).join(' · ')}</b>${e.distanciaMar?` · ${L(`≈ ${Math.round(e.distanciaMar).toLocaleString('pt-BR')} m do mar em linha reta`,`≈ ${Math.round(e.distanciaMar).toLocaleString('pt-BR')} m del mar en línea recta`)}${e.praia?` (${e.praia})`:''}`:''}</p>
        <div class="pp-loc"><img src="${mapaRua||mapa}" alt=""></div>`:''}
      <div class="pp-rod"><b>${esc(assinatura())}</b><br>${L(`Proposta preparada em ${hoje}. Imagens ilustrativas. Valores e condições sujeitos à confirmação no contrato.`,`Propuesta preparada el ${hoje}. Imágenes ilustrativas. Valores y condiciones sujetos a confirmación en el contrato.`)}</div>
    </div>`;
    const nome=(`Proposta ${txt(e.nome)} ${u.unidade}${P.cliente?' - '+P.cliente:''}`.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g,'').replace(/\s+/g,' ').replace(/^[.\s]+/,'').trim().slice(0,90)||'Proposta')+'.pdf';
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
