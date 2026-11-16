/* =====================================================================
   TEMA LUXO · ajustes só de visual nos gráficos e no slider.
   Não altera dados, fórmulas nem IDs: só cores, fontes e tooltip.
   ===================================================================== */
(function(){
  'use strict';
  var GOLD='#D4AF37', FONT='"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';

  if(window.Chart){
    var D=Chart.defaults;
    D.font.family=FONT; D.color='#A1A1AA'; D.borderColor='rgba(255,255,255,.06)';
    var T=D.plugins.tooltip;
    T.backgroundColor='rgba(11,16,21,.92)'; T.borderColor='rgba(212,175,55,.55)'; T.borderWidth=1;
    T.titleColor='#F5E6B3'; T.bodyColor='#F4F4F5'; T.padding=12; T.cornerRadius=10; T.boxPadding=4;
    T.titleFont={family:FONT,weight:'700'}; T.bodyFont={family:FONT};

    var ehOuro=function(c){ return typeof c==='string' && c.replace(/\s/g,'').toUpperCase().indexOf('#D4AF37')===0; };

    Chart.register({
      id:'temaLuxo',
      beforeInit:function(ch){
        var o=ch.options, lg=o.plugins&&o.plugins.legend&&o.plugins.legend.labels;
        if(lg){ lg.font=Object.assign({},lg.font,{family:FONT}); lg.color='#E4E4E7'; }
        Object.keys(o.scales||{}).forEach(function(k){
          var s=o.scales[k];
          if(s.grid && s.grid.display!==false) s.grid.color='rgba(255,255,255,.06)';
          if(s.ticks){ s.ticks.color='#A1A1AA'; s.ticks.font=Object.assign({},s.ticks.font,{family:FONT}); }
          if(s.border) s.border.color='rgba(255,255,255,.08)';
        });
      },
      // série principal em ouro (linha) ganha preenchimento em degradê abaixo da curva
      beforeUpdate:function(ch){
        if(ch.config.type!=='line') return;
        ch.data.datasets.forEach(function(d){
          if(d._luxo || !ehOuro(d.borderColor)) return;
          d.fill=d.fill||'start'; d.pointBackgroundColor=GOLD; d._luxo=true;
          d.backgroundColor=function(c){
            var a=c.chart.chartArea; if(!a) return 'rgba(212,175,55,.12)';
            var g=c.chart.ctx.createLinearGradient(0,a.top,0,a.bottom);
            g.addColorStop(0,'rgba(212,175,55,.25)'); g.addColorStop(1,'rgba(212,175,55,0)'); return g;
          };
        });
      }
    });
  }

  // slider: pinta a trilha em ouro até o ponto escolhido
  function pinta(r){ var mn=+r.min||0, mx=+r.max||100, v=+r.value; r.style.setProperty('--p',((v-mn)/(mx-mn)*100)+'%'); }
  function liga(){
    document.querySelectorAll('input[type=range]').forEach(function(r){
      pinta(r); if(!r._luxo){ r.addEventListener('input',function(){pinta(r);}); r._luxo=true; }
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',liga); else liga();
  setTimeout(liga,1500);
})();
