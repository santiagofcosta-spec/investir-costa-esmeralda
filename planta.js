/* Planta interativa (24/11/2026): planta oficial com pinos; o clique abre a foto do ambiente.
   Dados: dados/planta-<emp>.json (gerado por costa-esmeralda-docs/planta_interativa.py).
   Uso: PlantaInterativa.montar(elemento, 'dados/planta-oceanhill.json', {grande:false}) */
(function(){
  'use strict';
  const IMG=s=>/^img\/[a-z0-9_\/-]+\.(jpg|png|webp)$/i.test(String(s||''))?s:'';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CSS=`
.pi{--pi-g:#D4AF37;--pi-gl:#F5E6B3;--pi-ink:#F4F4F5;--pi-mu:#A1A1AA;--pi-ln:rgba(212,175,55,.22);color:var(--pi-ink)}
.pi-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px}
.pi-tabs{display:flex;gap:8px;flex-wrap:wrap}
.pi-tab{border:1px solid var(--pi-ln);background:rgba(18,25,33,.8);border-radius:999px;padding:8px 14px;font-size:13px;color:var(--pi-ink);cursor:pointer}
.pi-tab[aria-pressed="true"]{background:linear-gradient(135deg,#F5E6B3,#D4AF37 55%,#A67C2E);color:#14110a;border-color:transparent;font-weight:600}
.pi-tour{border:1px solid var(--pi-g);background:transparent;color:var(--pi-gl);border-radius:999px;padding:8px 14px;font-size:13px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.pi-tour[aria-pressed="true"]{background:rgba(212,175,55,.16)}
.pi-sub{color:var(--pi-mu);font-size:13px;margin:0 0 10px}
.pi-pal{position:relative;border-radius:18px;overflow:hidden;border:1px solid var(--pi-ln);background:#0d1418;box-shadow:0 30px 60px -30px #000}
.pi-pal>img{display:block;width:100%;height:auto;transition:filter .5s}
.pi-pal.aberto>img{filter:brightness(.55) saturate(.8)}
.pi-pin{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:0;padding:0;cursor:pointer;background:transparent;z-index:2}
.pi-pin i{position:absolute;inset:5px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c4,#D4AF37 45%,#8a6420);box-shadow:0 0 0 2px rgba(10,14,18,.85),0 4px 10px rgba(0,0,0,.6);transition:transform .25s}
.pi-pin::before{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid rgba(245,230,179,.85);animation:piPulso 2.4s ease-out infinite;animation-delay:var(--d,0s)}
.pi-pin:hover i,.pi-pin:focus-visible i,.pi-pin.on i{transform:scale(1.35)}
.pi-pin.on::before{animation-duration:1.2s}
@keyframes piPulso{0%{transform:scale(.6);opacity:.9}80%,100%{transform:scale(1.9);opacity:0}}
.pi-tip{position:absolute;z-index:3;pointer-events:none;transform:translate(-50%,calc(-100% - 16px));background:rgba(10,14,18,.92);border:1px solid var(--pi-ln);border-radius:10px;padding:6px 10px;font-size:12px;white-space:nowrap;opacity:0;transition:opacity .2s}
.pi-tip b{display:block;font-weight:600;color:var(--pi-gl)}
.pi-tip.v{opacity:1}
.pi-card{position:absolute;z-index:4;width:min(54%,560px);border-radius:16px;overflow:hidden;background:#0B1015;border:1px solid var(--pi-ln);box-shadow:0 30px 70px -10px rgba(0,0,0,.85);
  transform:scale(.15);opacity:0;transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .3s}
.pi-card.v{transform:none;opacity:1}
.pi-foto{position:relative;aspect-ratio:16/10;background:#111}
.pi-foto img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity .5s}
.pi-x{position:absolute;top:10px;right:10px;z-index:2;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(10,14,18,.7);color:#fff;font-size:17px;cursor:pointer}
.pi-dots{position:absolute;left:0;right:0;bottom:8px;display:flex;gap:6px;justify-content:center}
.pi-dots button{width:8px;height:8px;border-radius:50%;border:0;padding:0;background:rgba(255,255,255,.45);cursor:pointer}
.pi-dots button[aria-current="true"]{background:var(--pi-g)}
.pi-tx{display:flex;align-items:center;gap:10px;padding:12px 14px}
.pi-tx div{flex:1;min-width:0}
.pi-tx small{display:block;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--pi-g)}
.pi-tx b{display:block;font:600 20px/1.2 "Playfair Display",Georgia,serif;color:var(--pi-gl)}
.pi-tx span{font-size:12.5px;color:var(--pi-mu)}
.pi-nav{width:38px;height:38px;flex:none;border-radius:50%;border:1px solid var(--pi-ln);background:transparent;color:var(--pi-ink);font-size:18px;cursor:pointer}
.pi-nota{color:var(--pi-mu);font-size:12px;margin:8px 0 0}
.pi-dica{position:absolute;left:12px;bottom:12px;z-index:1;font-size:12px;background:rgba(10,14,18,.8);border:1px solid var(--pi-ln);border-radius:999px;padding:6px 12px;color:var(--pi-gl);transition:opacity .4s}
.pi-pal.aberto .pi-dica{opacity:0}
.pi.grande .pi-card{width:min(50%,760px)}
.pi.grande .pi-tx b{font-size:28px}
.pi.grande .pi-tx span{font-size:15px}
@media (max-width:760px){
  .pi-card{position:fixed;left:12px!important;right:12px;top:auto!important;bottom:12px;width:auto;transform:translateY(40px);transform-origin:50% 100%!important}
  .pi-pin{width:24px;height:24px;margin:-12px 0 0 -12px}
  .pi-pin i{inset:5px}
  .pi-dica{display:none}
}
@media (prefers-reduced-motion:reduce){.pi-pin::before{animation:none}.pi-card{transition:opacity .2s}}`;
  function estilo(){ if(document.getElementById('piCss')) return; const s=document.createElement('style'); s.id='piCss'; s.textContent=CSS; document.head.appendChild(s); }

  function montar(el,fonte,op){
    op=op||{}; estilo();
    let D=null, pv=0, at=-1, ft=0, tourT=0, ftT=0;
    el.classList.add('pi'); if(op.grande) el.classList.add('grande');
    const carregar=typeof fonte==='string'?fetch(fonte).then(r=>{if(!r.ok) throw 0; return r.json();}):Promise.resolve(fonte);
    return carregar.then(d=>{ D=d; if(!D.pavimentos||!D.pavimentos.length) throw 0; desenhar(); return api; })
      .catch(()=>{ el.innerHTML=''; el.hidden=true; return null; });

    function desenhar(){
      el.innerHTML=`<div class="pi-top"><div class="pi-tabs">${D.pavimentos.map((p,i)=>`<button type="button" class="pi-tab" data-i="${i}" aria-pressed="${i===pv}">${esc(p.nome)}</button>`).join('')}</div>
        <button type="button" class="pi-tour" aria-pressed="false">▶ Tour guiado</button></div>
        <p class="pi-sub"></p><div class="pi-pal"></div>${D.nota?`<p class="pi-nota">${esc(D.nota)}</p>`:''}`;
      el.querySelector('.pi-tabs').onclick=e=>{const b=e.target.closest('.pi-tab'); if(b){ pararTour(); trocar(+b.dataset.i); }};
      el.querySelector('.pi-tour').onclick=()=>tourT?pararTour():tour();
      trocar(pv);
    }
    function trocar(i){
      fechar(true); pv=i; const p=D.pavimentos[i];
      [...el.querySelectorAll('.pi-tab')].forEach((b,k)=>b.setAttribute('aria-pressed',k===i));
      el.querySelector('.pi-sub').textContent=p.sub||'';
      const pal=el.querySelector('.pi-pal');
      pal.innerHTML=`<img src="${IMG(p.planta)}" alt="${esc(p.nome)}" width="${+p.w||2400}" height="${+p.h||1715}">
        ${p.pinos.map((q,k)=>`<button type="button" class="pi-pin" data-k="${k}" style="left:${+q.x}%;top:${+q.y}%;--d:${(k%5)*.45}s" aria-label="${esc(q.nome)}"><i></i></button>`).join('')}
        <div class="pi-tip"></div><div class="pi-dica">Toque nos pontos dourados para ver cada ambiente</div>
        <div class="pi-card" role="dialog" aria-label="Ambiente"><div class="pi-foto"><button type="button" class="pi-x" aria-label="Fechar">✕</button><div class="pi-dots"></div></div>
          <div class="pi-tx"><button type="button" class="pi-nav" data-n="-1" aria-label="Ambiente anterior">‹</button><div><small></small><b></b><span></span></div><button type="button" class="pi-nav" data-n="1" aria-label="Próximo ambiente">›</button></div></div>`;
      const tip=pal.querySelector('.pi-tip');
      pal.onmouseover=e=>{const b=e.target.closest('.pi-pin'); if(!b||at>=0) return; const q=p.pinos[+b.dataset.k];
        tip.innerHTML=`<b>${esc(q.nome)}</b>${esc(q.info||'')}`; tip.style.left=q.x+'%'; tip.style.top=q.y+'%'; tip.classList.add('v');};
      pal.onmouseout=e=>{ if(e.target.closest('.pi-pin')) tip.classList.remove('v'); };
      pal.onclick=e=>{
        const b=e.target.closest('.pi-pin'); if(b){ pararTour(); abrir(+b.dataset.k); return; }
        if(e.target.closest('.pi-x')){ pararTour(); fechar(); return; }
        const n=e.target.closest('.pi-nav'); if(n){ pararTour(); abrir((at+ +n.dataset.n+p.pinos.length)%p.pinos.length); return; }
        const d=e.target.closest('.pi-dots button'); if(d){ foto(+d.dataset.f); return; }
        if(at>=0&&!e.target.closest('.pi-card')){ pararTour(); fechar(); }
      };
    }
    function abrir(k){
      const p=D.pavimentos[pv], q=p.pinos[k]; if(!q) return; at=k; ft=0;
      const pal=el.querySelector('.pi-pal'), c=pal.querySelector('.pi-card');
      pal.querySelector('.pi-tip').classList.remove('v');
      pal.querySelectorAll('.pi-pin').forEach(b=>b.classList.toggle('on',+b.dataset.k===k));
      const f=pal.querySelector('.pi-foto'); f.querySelectorAll('img').forEach(i=>i.remove());
      f.insertAdjacentHTML('afterbegin',(q.fotos||[]).map(IMG).filter(Boolean).map((s,i)=>`<img src="${s}" alt="${esc(q.nome)}" style="opacity:${i?0:1}" ${i?'loading="lazy"':''}>`).join(''));
      f.querySelector('.pi-dots').innerHTML=q.fotos.length>1?q.fotos.map((_,i)=>`<button type="button" data-f="${i}" aria-label="Foto ${i+1}" aria-current="${!i}"></button>`).join(''):'';
      c.querySelector('small').textContent=`${p.nome} · ${k+1} de ${p.pinos.length}`;
      c.querySelector('b').textContent=q.nome; c.querySelector('span').textContent=q.info||'';
      // cartão do lado oposto ao pino, saindo dele
      const W=pal.clientWidth, H=pal.clientHeight, cw=Math.min(W*(op.grande?.5:.54),op.grande?760:560), ch=cw*.625+70;
      const esq=q.x>50, x=esq?Math.max(12,q.x/100*W-cw-28):Math.min(W-cw-12,q.x/100*W+28), y=Math.min(Math.max(12,q.y/100*H-ch/2),Math.max(12,H-ch-12));
      c.style.left=x+'px'; c.style.top=y+'px'; c.style.transformOrigin=`${q.x/100*W-x}px ${q.y/100*H-y}px`;
      c.classList.remove('v'); void c.offsetWidth; c.classList.add('v'); pal.classList.add('aberto');
      clearInterval(ftT); if(q.fotos.length>1) ftT=setInterval(()=>foto((ft+1)%q.fotos.length),3200);
    }
    function foto(i){ const f=el.querySelector('.pi-foto'); ft=i;
      f.querySelectorAll('img').forEach((im,k)=>im.style.opacity=k===i?1:0);
      f.querySelectorAll('.pi-dots button').forEach((b,k)=>b.setAttribute('aria-current',k===i)); }
    function fechar(sem){ clearInterval(ftT); at=-1; const pal=el.querySelector('.pi-pal'); if(!pal) return;
      pal.classList.remove('aberto'); pal.querySelectorAll('.pi-pin.on').forEach(b=>b.classList.remove('on'));
      const c=pal.querySelector('.pi-card'); if(c) c.classList.remove('v'); }
    function tour(){ const b=el.querySelector('.pi-tour'); b.setAttribute('aria-pressed','true'); b.textContent='❚❚ Pausar tour';
      let k=at<0?0:at; abrir(k);
      tourT=setInterval(()=>{ k++; if(k>=D.pavimentos[pv].pinos.length){ if(pv<D.pavimentos.length-1){ trocar(pv+1); k=0; } else { pararTour(); fechar(); return; } } abrir(k); },op.passo||5200); }
    function pararTour(){ clearInterval(tourT); tourT=0; const b=el.querySelector('.pi-tour'); if(b){ b.setAttribute('aria-pressed','false'); b.textContent='▶ Tour guiado'; } }
    function tecla(e){ if(at<0||!el.isConnected) return; const n=D.pavimentos[pv].pinos.length;
      if(e.key==='Escape'){ pararTour(); fechar(); } else if(e.key==='ArrowRight'){ pararTour(); abrir((at+1)%n); } else if(e.key==='ArrowLeft'){ pararTour(); abrir((at-1+n)%n); } else return;
      e.preventDefault(); e.stopPropagation(); }
    document.addEventListener('keydown',tecla,true);
    var api={trocar:i=>trocar(i), abrir:k=>abrir(k), fechar:()=>fechar(), tour:()=>tour(), parar:()=>pararTour(), aberto:()=>at>=0,
      destruir:()=>{ pararTour(); clearInterval(ftT); document.removeEventListener('keydown',tecla,true); el.innerHTML=''; }};
  }
  window.PlantaInterativa={montar};
})();
