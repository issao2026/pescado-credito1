// bi-lagostao.js - v4.34 Análise Comercial enriquecida
// Substitui pgBILagostao com graficos Chart.js + analises cruzadas

(function(){
  const R$fmt = v => 'R$ '+(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});
  const R$fmt2 = v => 'R$ '+(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const num = v => (v||0).toLocaleString('pt-BR');

  const CORES = {
    verde:'#15746E', verdeDark:'#0A3332', verdeMedio:'#B8DDD9',
    amarelo:'#D97706', laranja:'#EA580C', vermelho:'#DC2626',
    verdeOk:'#059669', roxo:'#8B5CF6', azul:'#3B82F6', cinza:'#9CA3AF'
  };

  window._BI_LAG_FILTERS = window._BI_LAG_FILTERS || { vendedor:'', saida:'', risco:'', prazo:'', busca:'' };

  function aplicarFiltros(L){
    const F = window._BI_LAG_FILTERS;
    return L.filter(r => {
      if (F.vendedor && r.vendedor !== F.vendedor) return false;
      if (F.saida && !(r.saidas||[]).includes(F.saida)) return false;
      if (F.risco){
        const s = r.score;
        if (F.risco==='baixo' && !(s>700)) return false;
        if (F.risco==='moderado' && !(s>=601 && s<=700)) return false;
        if (F.risco==='elevado' && !(s>=501 && s<=600)) return false;
        if (F.risco==='alto' && !(s<501 && s>0)) return false;
        if (F.risco==='sem_score' && s>0) return false;
      }
      if (F.prazo && !((r.prazo||'').toLowerCase().includes(F.prazo.toLowerCase()))) return false;
      if (F.busca){
        const q = F.busca.toLowerCase();
        if (!((r.cliente||'').toLowerCase().includes(q) || (r.cnpj||'').includes(q))) return false;
      }
      return true;
    });
  }

  // KPI card
  function kpi(lbl, val, sub, cor){
    return `<div style="background:#fff;border:1px solid #E4EAF4;border-left:3px solid ${cor};border-radius:10px;padding:14px 16px">
      <div style="font-size:10px;font-weight:600;color:#9896A8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">${lbl}</div>
      <div style="font-family:'Poppins',sans-serif;font-size:22px;font-weight:800;color:#0A3332;letter-spacing:-.02em;line-height:1">${val}</div>
      ${sub?`<div style="font-size:10.5px;color:#5F7573;margin-top:4px">${sub}</div>`:''}
    </div>`;
  }

  // Card com titulo e canvas dentro
  function cardChart(titulo, canvasId, altura){
    return `<div style="background:#fff;border:1px solid #E4EAF4;border-radius:12px;padding:16px 18px">
      <div style="font-size:11px;font-weight:700;color:#0A3332;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">${titulo}</div>
      <div style="position:relative;height:${altura||220}px"><canvas id="${canvasId}"></canvas></div>
    </div>`;
  }

  function chipStyle(ativo){
    return `padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid ${ativo?'#15746E':'#D6DDDA'};background:${ativo?'#15746E':'#fff'};color:${ativo?'#fff':'#0A3332'};transition:.15s`;
  }

  // Principal
  window.pgBILagostao = function(){
    const L = (window.LAGOSTAO_DATA || []);
    if (!L.length) return '<div style="padding:40px;text-align:center;color:#5F7573">Carregando base historica...</div>';

    const F = window._BI_LAG_FILTERS;
    const filt = aplicarFiltros(L);

    // KPIs
    const scores = filt.map(r=>r.score).filter(s=>s>0);
    const scoreMedio = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    const limites = filt.map(r=>r.limite).filter(l=>l>0);
    const totalLimite = limites.reduce((a,b)=>a+b,0);
    const ticketMedio = limites.length ? totalLimite/limites.length : 0;
    const totalDividas = filt.reduce((a,b)=>a+(b.dividas||0),0);
    const clientesComDividas = filt.filter(r=>r.dividas > 100).length;
    const clientesLimite = limites.length;
    const maiorLimite = limites.length ? Math.max(...limites) : 0;
    const vendedoresUnicos = new Set(filt.map(r=>r.vendedor)).size;
    const vendedoresOpts = Array.from(new Set(L.map(r=>r.vendedor))).sort();

    // Faixas de risco
    const rBaixo = scores.filter(s=>s>700).length;
    const rModerado = scores.filter(s=>s>=601 && s<=700).length;
    const rElevado = scores.filter(s=>s>=501 && s<=600).length;
    const rAlto = scores.filter(s=>s<501 && s>0).length;
    const semScore = filt.length - scores.length;

    return `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
  <div>
    <div style="font-size:11px;color:#9896A8;text-transform:uppercase;letter-spacing:.09em;font-weight:700">Análise Comercial · Lagostão Pescados</div>
    <div style="font-family:'Poppins',sans-serif;font-size:22px;font-weight:700;color:#0A3332">Business Intelligence · ${filt.length} de ${L.length} clientes</div>
  </div>
  <div style="display:flex;gap:8px">
    <button onclick="exportarCSVLagostao()" style="background:#0A3332;color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:600;cursor:pointer">Exportar CSV</button>
    <button onclick="window._BI_LAG_FILTERS={vendedor:'',saida:'',risco:'',prazo:'',busca:''};render()" style="background:#fff;border:1px solid #D6DDDA;color:#5F7573;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:600;cursor:pointer">Limpar filtros</button>
  </div>
</div>

<!-- Filtros -->
<div style="background:#fff;border:1px solid #E4EAF4;border-radius:12px;padding:14px 16px;margin-bottom:16px">
  <div style="display:grid;grid-template-columns:1fr 200px 200px 150px;gap:10px;align-items:end">
    <div>
      <label style="font-size:10px;color:#9896A8;text-transform:uppercase;letter-spacing:.08em;font-weight:700;display:block;margin-bottom:4px">Buscar cliente ou CNPJ</label>
      <input value="${F.busca}" oninput="window._BI_LAG_FILTERS.busca=this.value;clearTimeout(window._bit);window._bit=setTimeout(render,250)" placeholder="Nome ou CNPJ" style="width:100%;padding:8px 10px;border:1px solid #D6DDDA;border-radius:8px;font-size:13px;font-family:Inter,sans-serif;background:#F5F7F6">
    </div>
    <div>
      <label style="font-size:10px;color:#9896A8;text-transform:uppercase;letter-spacing:.08em;font-weight:700;display:block;margin-bottom:4px">Vendedor</label>
      <select onchange="window._BI_LAG_FILTERS.vendedor=this.value;render()" style="width:100%;padding:8px 10px;border:1px solid #D6DDDA;border-radius:8px;font-size:13px;font-family:Inter,sans-serif;background:#F5F7F6">
        <option value="">Todos</option>
        ${vendedoresOpts.map(v=>`<option value="${v}" ${F.vendedor===v?'selected':''}>${v}</option>`).join('')}
      </select>
    </div>
    <div>
      <label style="font-size:10px;color:#9896A8;text-transform:uppercase;letter-spacing:.08em;font-weight:700;display:block;margin-bottom:4px">Rota de saída</label>
      <select onchange="window._BI_LAG_FILTERS.saida=this.value;render()" style="width:100%;padding:8px 10px;border:1px solid #D6DDDA;border-radius:8px;font-size:13px;font-family:Inter,sans-serif;background:#F5F7F6">
        <option value="">Todas</option>
        <option value="Lagostao" ${F.saida==='Lagostao'?'selected':''}>Lagostão</option>
        <option value="Global" ${F.saida==='Global'?'selected':''}>Global</option>
        <option value="JP" ${F.saida==='JP'?'selected':''}>JP</option>
      </select>
    </div>
    <div>
      <label style="font-size:10px;color:#9896A8;text-transform:uppercase;letter-spacing:.08em;font-weight:700;display:block;margin-bottom:4px">Prazo</label>
      <input value="${F.prazo}" oninput="window._BI_LAG_FILTERS.prazo=this.value;clearTimeout(window._bit2);window._bit2=setTimeout(render,250)" placeholder="Ex: 14, A vista" style="width:100%;padding:8px 10px;border:1px solid #D6DDDA;border-radius:8px;font-size:13px;font-family:Inter,sans-serif;background:#F5F7F6">
    </div>
  </div>
  <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
    <span style="font-size:11px;color:#9896A8;text-transform:uppercase;letter-spacing:.08em;font-weight:700;align-self:center">Faixa de risco:</span>
    <span onclick="window._BI_LAG_FILTERS.risco='';render()" style="${chipStyle(!F.risco)}">Todos</span>
    <span onclick="window._BI_LAG_FILTERS.risco='baixo';render()" style="${chipStyle(F.risco==='baixo')}">Baixo > 700</span>
    <span onclick="window._BI_LAG_FILTERS.risco='moderado';render()" style="${chipStyle(F.risco==='moderado')}">Moderado 601-700</span>
    <span onclick="window._BI_LAG_FILTERS.risco='elevado';render()" style="${chipStyle(F.risco==='elevado')}">Elevado 501-600</span>
    <span onclick="window._BI_LAG_FILTERS.risco='alto';render()" style="${chipStyle(F.risco==='alto')}">Alto < 500</span>
    <span onclick="window._BI_LAG_FILTERS.risco='sem_score';render()" style="${chipStyle(F.risco==='sem_score')}">Sem score</span>
  </div>
</div>

<!-- KPIs primeira linha -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
  ${kpi('Total analisado', filt.length, 'clientes na base', '#15746E')}
  ${kpi('Vendedores ativos', vendedoresUnicos, 'com fichas na selecao', '#0A3332')}
  ${kpi('Score médio', scoreMedio, scoreMedio>700?'Baixo risco':scoreMedio>=601?'Moderado':scoreMedio>=501?'Elevado':scoreMedio>0?'Alto risco':'-', scoreMedio>700?'#059669':scoreMedio>=501?'#D97706':'#DC2626')}
  ${kpi('Clientes com limite', clientesLimite, ((clientesLimite/filt.length*100)||0).toFixed(0)+'% da base filtrada', '#15746E')}
</div>

<!-- KPIs segunda linha -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
  ${kpi('Ticket médio', R$fmt(ticketMedio), 'limite concedido', '#15746E')}
  ${kpi('Total limite', R$fmt(totalLimite), 'carteira ativa', '#0A3332')}
  ${kpi('Maior limite', R$fmt(maiorLimite), 'concessão individual', '#059669')}
  ${kpi('Dívidas totais', R$fmt(totalDividas), clientesComDividas+' clientes inadimplentes', '#DC2626')}
</div>

<!-- Row 1: donut saidas + donut risco + barras vendedores -->
<div style="display:grid;grid-template-columns:1fr 1fr 1.5fr;gap:12px;margin-bottom:14px">
  ${cardChart('Rota de saída', 'ch-saidas', 220)}
  ${cardChart('Distribuição de risco', 'ch-risco', 220)}
  ${cardChart('Top vendedores por volume', 'ch-vendedores', 220)}
</div>

<!-- Row 2: score medio por vendedor + ticket medio por vendedor -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
  ${cardChart('Score médio por vendedor', 'ch-score-vend', 240)}
  ${cardChart('Ticket médio por vendedor (R$)', 'ch-ticket-vend', 240)}
</div>

<!-- Row 3: scatter + concentracao de risco por saida -->
<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin-bottom:14px">
  ${cardChart('Score x Limite (cada ponto é um cliente)', 'ch-scatter', 280)}
  ${cardChart('Risco por rota de saída', 'ch-risco-saida', 280)}
</div>

<!-- Row 4: tempo de mercado -->
<div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:14px">
  ${cardChart('Distribuição por tempo de atividade (anos)', 'ch-fundacao', 200)}
</div>

<!-- Tabela clientes -->
<div style="background:#fff;border:1px solid #E4EAF4;border-radius:12px;padding:0;overflow:hidden">
  <div style="padding:14px 18px;border-bottom:1px solid #E4EAF4;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:12px;font-weight:700;color:#0A3332;text-transform:uppercase;letter-spacing:.05em">Clientes filtrados (${filt.length}) — clique pra ver ficha</div>
    <div style="font-size:11px;color:#5F7573">Ordenacao: score decrescente</div>
  </div>
  <div style="max-height:520px;overflow-y:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead style="background:#F5F7F6;position:sticky;top:0">
        <tr style="text-align:left">
          <th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Cliente</th>
          <th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase;letter-spacing:.05em">CNPJ</th>
          <th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Vendedor</th>
          <th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Fundado</th>
          <th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Score</th>
          <th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Dívidas</th>
          <th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Prazo</th>
          <th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Limite</th>
          <th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Saída</th>
        </tr>
      </thead>
      <tbody>
        ${filt.slice().sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,300).map((r,i)=>{
          const cor = r.score>700?'#059669':r.score>=601?'#D97706':r.score>=501?'#EA580C':r.score>0?'#DC2626':'#9CA3AF';
          return `<tr onclick="verFichaLagostao(${i},'${(r.cnpj||'').replace(/'/g,"\\'")}')" style="border-bottom:1px solid #EEF2F1;cursor:pointer;transition:.1s" onmouseover="this.style.background='#F5F7F6'" onmouseout="this.style.background=''">
            <td style="padding:9px 14px;font-weight:600;color:#0A3332">${r.cliente || '—'}</td>
            <td style="padding:9px 14px;color:#5F7573;font-family:monospace;font-size:11.5px">${r.cnpj || '—'}</td>
            <td style="padding:9px 14px;color:#0A3332">${r.vendedor || '—'}</td>
            <td style="padding:9px 14px;color:#5F7573">${r.fundado || '—'}</td>
            <td style="padding:9px 14px"><span style="background:${cor}22;color:${cor};padding:2px 8px;border-radius:10px;font-weight:700;font-size:11.5px">${r.score || '—'}</span></td>
            <td style="padding:9px 14px;color:${r.dividas>100?'#DC2626':'#5F7573'};font-weight:${r.dividas>100?'700':'500'}">${R$fmt(r.dividas)}</td>
            <td style="padding:9px 14px;color:#0A3332">${r.prazo || '—'}</td>
            <td style="padding:9px 14px;font-weight:600;color:#0A3332">${R$fmt(r.limite)}</td>
            <td style="padding:9px 14px;color:#5F7573;font-size:11.5px">${(r.saidas||[]).join(' + ') || '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    ${filt.length > 300 ? `<div style="padding:12px;text-align:center;color:#5F7573;font-size:12px">Mostrando primeiros 300 de ${filt.length}. Refine os filtros.</div>` : ''}
  </div>
</div>
`;
  };

  // Renderizar todos graficos apos DOM montado
  window.renderBIGraficos = function(){
    const L = (window.LAGOSTAO_DATA || []);
    if (!L.length) return;
    const filt = aplicarFiltros(L);
    if (!window.Chart) return;

    // Limpar charts anteriores
    ['ch-saidas','ch-risco','ch-vendedores','ch-score-vend','ch-ticket-vend','ch-scatter','ch-risco-saida','ch-fundacao'].forEach(id => {
      const inst = Chart.getChart(id);
      if (inst) inst.destroy();
    });

    // 1. Saidas (donut)
    const saidas = {Lagostao:0, Global:0, JP:0};
    filt.forEach(r => (r.saidas||[]).forEach(s => { if(saidas[s]!==undefined) saidas[s]++; }));
    const elSaidas = document.getElementById('ch-saidas');
    if (elSaidas) new Chart(elSaidas, {
      type:'doughnut',
      data:{ labels:Object.keys(saidas), datasets:[{ data:Object.values(saidas), backgroundColor:[CORES.verde, CORES.verdeDark, CORES.roxo], borderColor:'#fff', borderWidth:2 }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{size:11}, padding:10 }} }}
    });

    // 2. Risco (donut)
    const scoresF = filt.map(r=>r.score).filter(s=>s>0);
    const rBaixo = scoresF.filter(s=>s>700).length;
    const rMod = scoresF.filter(s=>s>=601 && s<=700).length;
    const rElev = scoresF.filter(s=>s>=501 && s<=600).length;
    const rAlto = scoresF.filter(s=>s<501 && s>0).length;
    const rSem = filt.length - scoresF.length;
    const elRisco = document.getElementById('ch-risco');
    if (elRisco) new Chart(elRisco, {
      type:'doughnut',
      data:{ labels:['Baixo (>700)','Moderado (601-700)','Elevado (501-600)','Alto (<500)','Sem score'], datasets:[{ data:[rBaixo,rMod,rElev,rAlto,rSem], backgroundColor:[CORES.verdeOk, CORES.amarelo, CORES.laranja, CORES.vermelho, CORES.cinza], borderColor:'#fff', borderWidth:2 }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{size:10}, padding:6, boxWidth:10 }} }}
    });

    // 3. Vendedores (barras horizontais)
    const vends = {};
    filt.forEach(r => { vends[r.vendedor] = (vends[r.vendedor]||0)+1; });
    const topVends = Object.entries(vends).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const elVend = document.getElementById('ch-vendedores');
    if (elVend) new Chart(elVend, {
      type:'bar',
      data:{ labels:topVends.map(v=>v[0]), datasets:[{ label:'Fichas', data:topVends.map(v=>v[1]), backgroundColor:CORES.verde, borderRadius:4 }]},
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}}, scales:{ x:{ grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}}}, y:{ grid:{display:false}, ticks:{font:{size:11}}} }}
    });

    // 4. Score medio por vendedor
    const scorePorVend = {};
    filt.forEach(r => {
      if (r.score>0){
        if (!scorePorVend[r.vendedor]) scorePorVend[r.vendedor] = [];
        scorePorVend[r.vendedor].push(r.score);
      }
    });
    const scoreMediosVend = Object.entries(scorePorVend)
      .map(([v,arr]) => ({v, med: Math.round(arr.reduce((a,b)=>a+b,0)/arr.length), n: arr.length}))
      .filter(o => o.n >= 2)
      .sort((a,b)=>b.med-a.med)
      .slice(0,10);
    const elScoreVend = document.getElementById('ch-score-vend');
    if (elScoreVend) new Chart(elScoreVend, {
      type:'bar',
      data:{
        labels: scoreMediosVend.map(o=>o.v),
        datasets:[{ label:'Score médio', data:scoreMediosVend.map(o=>o.med), backgroundColor: scoreMediosVend.map(o=>o.med>700?CORES.verdeOk:o.med>=601?CORES.amarelo:o.med>=501?CORES.laranja:CORES.vermelho), borderRadius:4 }]
      },
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>'Score médio: '+c.parsed.x+' (n='+scoreMediosVend[c.dataIndex].n+')'}}}, scales:{ x:{ min:0, max:1000, grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}}}, y:{ grid:{display:false}, ticks:{font:{size:11}}} }}
    });

    // 5. Ticket medio por vendedor
    const ticketPorVend = {};
    filt.forEach(r => {
      if (r.limite>0){
        if (!ticketPorVend[r.vendedor]) ticketPorVend[r.vendedor] = [];
        ticketPorVend[r.vendedor].push(r.limite);
      }
    });
    const ticketMediosVend = Object.entries(ticketPorVend)
      .map(([v,arr]) => ({v, med: Math.round(arr.reduce((a,b)=>a+b,0)/arr.length), n:arr.length}))
      .filter(o => o.n >= 2)
      .sort((a,b)=>b.med-a.med)
      .slice(0,10);
    const elTicketVend = document.getElementById('ch-ticket-vend');
    if (elTicketVend) new Chart(elTicketVend, {
      type:'bar',
      data:{ labels:ticketMediosVend.map(o=>o.v), datasets:[{ label:'Ticket médio', data:ticketMediosVend.map(o=>o.med), backgroundColor:CORES.verdeDark, borderRadius:4 }]},
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>'Ticket: R$ '+c.parsed.x.toLocaleString('pt-BR')+' (n='+ticketMediosVend[c.dataIndex].n+')'}}}, scales:{ x:{ grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}, callback:v=>'R$ '+(v/1000).toFixed(0)+'k'}}, y:{ grid:{display:false}, ticks:{font:{size:11}}} }}
    });

    // 6. Scatter score x limite
    const pontos = filt.filter(r=>r.score>0 && r.limite>0).map(r => ({
      x:r.score, y:r.limite, cliente:r.cliente, backgroundColor:r.score>700?CORES.verdeOk:r.score>=601?CORES.amarelo:r.score>=501?CORES.laranja:CORES.vermelho
    }));
    const elScatter = document.getElementById('ch-scatter');
    if (elScatter) new Chart(elScatter, {
      type:'scatter',
      data:{ datasets:[{ label:'Cliente', data:pontos, backgroundColor: pontos.map(p=>p.backgroundColor), borderColor: pontos.map(p=>p.backgroundColor), pointRadius:5, pointHoverRadius:8 }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>pontos[c.dataIndex].cliente+' | Score: '+c.parsed.x+' | Limite: R$ '+c.parsed.y.toLocaleString('pt-BR')}}}, scales:{ x:{ title:{display:true,text:'Score',font:{size:10}}, min:0, max:1000, grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}}}, y:{ title:{display:true,text:'Limite (R$)',font:{size:10}}, grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}, callback:v=>'R$ '+(v/1000).toFixed(0)+'k'}}}}
    });

    // 7. Risco por saida (stacked bar)
    const saidasList = ['Lagostao','Global','JP'];
    const riscoLbls = ['Baixo','Moderado','Elevado','Alto','Sem'];
    const dsRisco = riscoLbls.map((lbl, li) => {
      const dataArr = saidasList.map(s => {
        return filt.filter(r => (r.saidas||[]).includes(s)).filter(r => {
          if (lbl==='Baixo') return r.score>700;
          if (lbl==='Moderado') return r.score>=601 && r.score<=700;
          if (lbl==='Elevado') return r.score>=501 && r.score<=600;
          if (lbl==='Alto') return r.score<501 && r.score>0;
          return r.score===0 || !r.score;
        }).length;
      });
      const cores = [CORES.verdeOk, CORES.amarelo, CORES.laranja, CORES.vermelho, CORES.cinza];
      return { label:lbl, data:dataArr, backgroundColor:cores[li] };
    });
    const elRiscoSaida = document.getElementById('ch-risco-saida');
    if (elRiscoSaida) new Chart(elRiscoSaida, {
      type:'bar',
      data:{ labels:saidasList, datasets:dsRisco },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom', labels:{font:{size:10}, padding:6, boxWidth:10}}}, scales:{ x:{ stacked:true, grid:{display:false}, ticks:{font:{size:11}}}, y:{ stacked:true, grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}}}}}
    });

    // 8. Tempo de atividade
    const anoAtual = new Date().getFullYear();
    const bucketsAnos = {'< 5':0, '5-10':0, '10-20':0, '20-30':0, '> 30':0, 'Sem data':0};
    filt.forEach(r => {
      if (!r.fundado){ bucketsAnos['Sem data']++; return; }
      const partes = r.fundado.split('/');
      let ano = null;
      if (partes.length===3) ano = parseInt(partes[2]);
      else if (r.fundado.includes('-')) ano = parseInt(r.fundado.split('-')[0]);
      if (!ano){ bucketsAnos['Sem data']++; return; }
      const idade = anoAtual - ano;
      if (idade < 5) bucketsAnos['< 5']++;
      else if (idade <= 10) bucketsAnos['5-10']++;
      else if (idade <= 20) bucketsAnos['10-20']++;
      else if (idade <= 30) bucketsAnos['20-30']++;
      else bucketsAnos['> 30']++;
    });
    const elFund = document.getElementById('ch-fundacao');
    if (elFund) new Chart(elFund, {
      type:'bar',
      data:{ labels:Object.keys(bucketsAnos), datasets:[{ label:'Clientes', data:Object.values(bucketsAnos), backgroundColor:[CORES.vermelho, CORES.laranja, CORES.amarelo, CORES.verdeOk, CORES.verdeDark, CORES.cinza], borderRadius:6 }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{title:c=>c[0].label+' anos de atividade'}}}, scales:{ x:{ grid:{display:false}, ticks:{font:{size:11}}}, y:{ grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}}}}}
    });
  };

  window.exportarCSVLagostao = function(){
    const filt = aplicarFiltros(window.LAGOSTAO_DATA || []);
    const cabecalho = ['Data','CNPJ','Cliente','Vendedor','Fundado','Capital','Prospeccao','Score','Dividas','Prazo','Limite','Saidas','Observacoes'];
    const linhas = filt.map(r => [r.data,r.cnpj,r.cliente,r.vendedor,r.fundado,r.capital,r.prospeccao,r.score,r.dividas,r.prazo,r.limite,(r.saidas||[]).join('|'),(r.obs||'').replace(/[\r\n]/g,' ')]);
    const csv = [cabecalho.join(';')].concat(linhas.map(l => l.map(c => String(c==null?'':c).replace(/;/g,',')).join(';'))).join('\n');
    const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lagostao-bi-'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  };
})();
