// bi-lagostao.js - v4.35 BI Lagostao + KPIs clicaveis
(function(){
  const R$fmt = v => 'R$ '+(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});
  const R$dr = R$fmt;
  const CORES = { verde:'#15746E', verdeDark:'#0A3332', amarelo:'#D97706', laranja:'#EA580C', vermelho:'#DC2626', verdeOk:'#059669', roxo:'#8B5CF6', cinza:'#9CA3AF' };
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

  function kpi(lbl, val, sub, cor, drillKey){
    const st = drillKey
      ? `onclick="verComposicaoKPI('${drillKey}')" style="background:#fff;border:1px solid #E4EAF4;border-left:3px solid ${cor};border-radius:10px;padding:14px 16px;cursor:pointer;transition:.15s" onmouseover="this.style.borderColor='#0A3332';this.style.boxShadow='0 4px 12px rgba(10,51,50,.08)'" onmouseout="this.style.borderColor='#E4EAF4';this.style.boxShadow=''"`
      : `style="background:#fff;border:1px solid #E4EAF4;border-left:3px solid ${cor};border-radius:10px;padding:14px 16px"`;
    return `<div ${st}><div style="font-size:10px;font-weight:600;color:#9896A8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">${lbl} ${drillKey?'<span style="color:#15746E;font-weight:700">↗</span>':''}</div><div style="font-family:'Poppins',sans-serif;font-size:22px;font-weight:800;color:#0A3332;line-height:1">${val}</div>${sub?`<div style="font-size:10.5px;color:#5F7573;margin-top:4px">${sub}</div>`:''}</div>`;
  }

  function cardChart(t, id, h){
    return `<div style="background:#fff;border:1px solid #E4EAF4;border-radius:12px;padding:16px 18px"><div style="font-size:11px;font-weight:700;color:#0A3332;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">${t}</div><div style="position:relative;height:${h||220}px"><canvas id="${id}"></canvas></div></div>`;
  }

  function chipStyle(a){ return `padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid ${a?'#15746E':'#D6DDDA'};background:${a?'#15746E':'#fff'};color:${a?'#fff':'#0A3332'}`; }

  window.abrirModalDrill = function(t, s, h){
    const old = document.getElementById('kpi-drill-modal'); if (old) old.remove();
    const ov = document.createElement('div');
    ov.id = 'kpi-drill-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,51,50,.85);z-index:99998;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;padding:20px';
    ov.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:820px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column"><div style="background:linear-gradient(135deg,#0A3332,#15746E);padding:22px 26px;color:#fff;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.08em;font-weight:600">Composição do indicador</div><div style="font-family:Poppins,sans-serif;font-size:20px;font-weight:700;margin-top:4px">${t}</div>${s?`<div style="font-size:12px;color:#B8DDD9;margin-top:4px">${s}</div>`:''}</div><button onclick="document.getElementById('kpi-drill-modal').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:20px;cursor:pointer;width:32px;height:32px;border-radius:8px">×</button></div><div style="padding:22px 26px;overflow-y:auto;flex:1">${h}</div></div>`;
    document.body.appendChild(ov);
  };

  window.verComposicaoKPI = function(tipo){
    const L = (window.LAGOSTAO_DATA || []); const filt = aplicarFiltros(L);
    let t = '', s = '', h = '';
    if (tipo === 'total'){
      t = 'Total analisado: ' + filt.length + ' clientes'; s = 'Base filtrada';
      const pv = {}; filt.forEach(r => pv[r.vendedor] = (pv[r.vendedor]||0)+1);
      const sorted = Object.entries(pv).sort((a,b)=>b[1]-a[1]);
      h = '<div style="font-size:13px;color:#5F7573;margin-bottom:14px">Distribuicao dos <b style="color:#0A3332">'+filt.length+'</b> clientes por vendedor:</div>';
      h += '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#F5F7F6"><th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#5F7573">Vendedor</th><th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#5F7573">Clientes</th><th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#5F7573">%</th></tr></thead><tbody>';
      sorted.forEach(([v,c])=>{ const pct = (c/filt.length*100).toFixed(1); h += '<tr style="border-bottom:1px solid #EEF2F1"><td style="padding:8px 12px;color:#0A3332;font-weight:600">'+v+'</td><td style="padding:8px 12px;text-align:right;font-weight:600">'+c+'</td><td style="padding:8px 12px;text-align:right;color:#5F7573">'+pct+'%</td></tr>'; });
      h += '</tbody></table>';
    }
    else if (tipo === 'vendedores'){
      const v = {}; filt.forEach(r => { if (!v[r.vendedor]) v[r.vendedor] = {fichas:0, comLimite:0, totalLimite:0, scoreMed:[]}; v[r.vendedor].fichas++; if(r.limite>0){ v[r.vendedor].comLimite++; v[r.vendedor].totalLimite+=r.limite; } if(r.score>0) v[r.vendedor].scoreMed.push(r.score); });
      const so = Object.entries(v).sort((a,b)=>b[1].fichas-a[1].fichas);
      t = 'Vendedores ativos: ' + so.length; s = 'Desempenho de cada vendedor';
      h = '<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="background:#F5F7F6"><th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#5F7573">Vendedor</th><th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#5F7573">Fichas</th><th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#5F7573">Aprovadas</th><th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#5F7573">Total limite</th><th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#5F7573">Score med</th></tr></thead><tbody>';
      so.forEach(([nome,d])=>{ const sm = d.scoreMed.length?Math.round(d.scoreMed.reduce((a,b)=>a+b,0)/d.scoreMed.length):'-'; h += '<tr style="border-bottom:1px solid #EEF2F1"><td style="padding:8px 12px;color:#0A3332;font-weight:600">'+nome+'</td><td style="padding:8px 12px;text-align:right;font-weight:600">'+d.fichas+'</td><td style="padding:8px 12px;text-align:right">'+d.comLimite+'</td><td style="padding:8px 12px;text-align:right;font-weight:600">'+R$dr(d.totalLimite)+'</td><td style="padding:8px 12px;text-align:right">'+sm+'</td></tr>'; });
      h += '</tbody></table>';
    }
    else if (tipo === 'score'){
      const sc = filt.map(r=>r.score).filter(x=>x>0).sort((a,b)=>a-b);
      const med = sc.length?Math.round(sc.reduce((a,b)=>a+b,0)/sc.length):0;
      const mediana = sc[Math.floor(sc.length/2)]||0;
      const mn = sc[0]||0, mx = sc[sc.length-1]||0;
      const sScore = filt.length - sc.length;
      t = 'Score medio: ' + med; s = sc.length + ' clientes com pontuacao (' + sScore + ' sem)';
      h = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">';
      h += '<div style="background:#F5F7F6;padding:12px;border-radius:8px"><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Minimo</div><div style="font-family:Poppins,sans-serif;font-size:22px;font-weight:800;color:#DC2626;margin-top:4px">'+mn+'</div></div>';
      h += '<div style="background:#F5F7F6;padding:12px;border-radius:8px"><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Mediana</div><div style="font-family:Poppins,sans-serif;font-size:22px;font-weight:800;color:#0A3332;margin-top:4px">'+mediana+'</div></div>';
      h += '<div style="background:#F5F7F6;padding:12px;border-radius:8px"><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Media</div><div style="font-family:Poppins,sans-serif;font-size:22px;font-weight:800;color:#15746E;margin-top:4px">'+med+'</div></div>';
      h += '<div style="background:#F5F7F6;padding:12px;border-radius:8px"><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Maximo</div><div style="font-family:Poppins,sans-serif;font-size:22px;font-weight:800;color:#059669;margin-top:4px">'+mx+'</div></div></div>';
      const t5 = filt.filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
      const b5 = filt.filter(r=>r.score>0).sort((a,b)=>a.score-b.score).slice(0,5);
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
      h += '<div><div style="font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:8px">Top 5 maiores</div>'+t5.map(r=>'<div style="padding:6px 10px;background:#D1FAE5;border-radius:6px;margin-bottom:4px;font-size:12px"><b>'+r.cliente+'</b> <span style="color:#059669;font-weight:700;float:right">'+r.score+'</span></div>').join('')+'</div>';
      h += '<div><div style="font-size:11px;font-weight:700;color:#DC2626;text-transform:uppercase;margin-bottom:8px">Top 5 menores</div>'+b5.map(r=>'<div style="padding:6px 10px;background:#FEE2E2;border-radius:6px;margin-bottom:4px;font-size:12px"><b>'+r.cliente+'</b> <span style="color:#DC2626;font-weight:700;float:right">'+r.score+'</span></div>').join('')+'</div></div>';
    }

    else if (tipo === 'com_limite'){
      const comL = filt.filter(r=>r.limite>0); const semL = filt.filter(r=>!r.limite || r.limite===0);
      t = 'Clientes com limite: ' + comL.length + ' de ' + filt.length; s = 'Aprovados vs sem limite';
      h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">';
      h += '<div style="background:#D1FAE5;padding:14px;border-radius:10px"><div style="font-size:11px;color:#059669;text-transform:uppercase;font-weight:700">Com limite</div><div style="font-family:Poppins,sans-serif;font-size:28px;font-weight:800;color:#059669;margin-top:6px">'+comL.length+'</div><div style="font-size:12px;color:#065F46;margin-top:2px">'+((comL.length/filt.length*100)||0).toFixed(1)+'% da base</div></div>';
      h += '<div style="background:#FEE2E2;padding:14px;border-radius:10px"><div style="font-size:11px;color:#DC2626;text-transform:uppercase;font-weight:700">Sem limite / A vista</div><div style="font-family:Poppins,sans-serif;font-size:28px;font-weight:800;color:#DC2626;margin-top:6px">'+semL.length+'</div><div style="font-size:12px;color:#7F1D1D;margin-top:2px">'+((semL.length/filt.length*100)||0).toFixed(1)+'% da base</div></div></div>';
      h += '<div style="font-size:11px;font-weight:700;color:#5F7573;text-transform:uppercase;margin-bottom:8px">Clientes sem limite</div>';
      h += '<div style="max-height:280px;overflow-y:auto">'+semL.slice(0,50).map(r=>'<div style="padding:8px 12px;border-bottom:1px solid #EEF2F1;font-size:12.5px"><b>'+r.cliente+'</b> <span style="color:#5F7573;font-size:11px;margin-left:8px">'+r.vendedor+'</span> <span style="float:right;color:#DC2626;font-weight:600">Score: '+(r.score||'-')+'</span></div>').join('')+'</div>';
    }
    else if (tipo === 'ticket'){
      const lim = filt.map(r=>r.limite).filter(x=>x>0).sort((a,b)=>a-b);
      const soma = lim.reduce((a,b)=>a+b,0); const med = lim.length?soma/lim.length:0;
      const mediana = lim[Math.floor(lim.length/2)]||0; const mn = lim[0]||0, mx = lim[lim.length-1]||0;
      t = 'Ticket medio: ' + R$dr(med); s = lim.length + ' clientes com aprovacao';
      const b = {'< 5k':0, '5k-10k':0, '10k-20k':0, '20k-50k':0, '> 50k':0};
      lim.forEach(l=>{ if(l<5000) b['< 5k']++; else if(l<=10000) b['5k-10k']++; else if(l<=20000) b['10k-20k']++; else if(l<=50000) b['20k-50k']++; else b['> 50k']++; });
      h = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">';
      h += '<div style="background:#F5F7F6;padding:12px;border-radius:8px"><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Minimo</div><div style="font-family:Poppins,sans-serif;font-size:18px;font-weight:800;color:#0A3332;margin-top:4px">'+R$dr(mn)+'</div></div>';
      h += '<div style="background:#F5F7F6;padding:12px;border-radius:8px"><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Mediana</div><div style="font-family:Poppins,sans-serif;font-size:18px;font-weight:800;color:#0A3332;margin-top:4px">'+R$dr(mediana)+'</div></div>';
      h += '<div style="background:#F5F7F6;padding:12px;border-radius:8px"><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Media</div><div style="font-family:Poppins,sans-serif;font-size:18px;font-weight:800;color:#15746E;margin-top:4px">'+R$dr(med)+'</div></div>';
      h += '<div style="background:#F5F7F6;padding:12px;border-radius:8px"><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Maximo</div><div style="font-family:Poppins,sans-serif;font-size:18px;font-weight:800;color:#059669;margin-top:4px">'+R$dr(mx)+'</div></div></div>';
      h += '<div style="font-size:11px;font-weight:700;color:#5F7573;text-transform:uppercase;margin-bottom:8px">Distribuicao por faixa</div>';
      Object.entries(b).forEach(([l,c])=>{ const p = lim.length?(c/lim.length*100):0; h += '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="color:#0A3332;font-weight:600">'+l+'</span><span style="color:#5F7573">'+c+' clientes ('+p.toFixed(1)+'%)</span></div><div style="height:8px;background:#EEF2F1;border-radius:4px;overflow:hidden"><div style="height:100%;background:#15746E;width:'+p+'%"></div></div></div>'; });
    }
    else if (tipo === 'total_limite'){
      const cL = filt.filter(r=>r.limite>0).sort((a,b)=>b.limite-a.limite);
      const so = cL.reduce((a,b)=>a+b.limite,0); let ac = 0;
      t = 'Total limite: ' + R$dr(so); s = 'Top 20 que compoem o total';
      h = '<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="background:#F5F7F6"><th style="padding:8px 12px;text-align:left">#</th><th style="padding:8px 12px;text-align:left">Cliente</th><th style="padding:8px 12px;text-align:left">Vendedor</th><th style="padding:8px 12px;text-align:right">Limite</th><th style="padding:8px 12px;text-align:right">% acum</th></tr></thead><tbody>';
      cL.slice(0,20).forEach((r,i)=>{ ac += r.limite; const pA = so?(ac/so*100).toFixed(1):0; h += '<tr style="border-bottom:1px solid #EEF2F1"><td style="padding:8px 12px;color:#5F7573;font-weight:700">'+(i+1)+'</td><td style="padding:8px 12px;color:#0A3332;font-weight:600">'+r.cliente+'</td><td style="padding:8px 12px;color:#5F7573;font-size:12px">'+r.vendedor+'</td><td style="padding:8px 12px;text-align:right;font-weight:700;color:#0A3332">'+R$dr(r.limite)+'</td><td style="padding:8px 12px;text-align:right;color:#15746E;font-size:11px">'+pA+'%</td></tr>'; });
      h += '</tbody></table>';
    }
    else if (tipo === 'maior_limite'){
      const cL = filt.filter(r=>r.limite>0).sort((a,b)=>b.limite-a.limite);
      const top = cL[0]; t = 'Maior limite: ' + R$dr(top?.limite||0); s = 'Destaque + top 10'; h = '';
      if (top){ h += '<div style="background:linear-gradient(135deg,#059669,#0A3332);color:#fff;padding:20px;border-radius:12px;margin-bottom:18px"><div style="font-size:11px;color:#B8DDD9;text-transform:uppercase;font-weight:700">Cliente destaque</div><div style="font-family:Poppins,sans-serif;font-size:22px;font-weight:800;margin-top:6px">'+top.cliente+'</div><div style="font-size:13px;color:#B8DDD9;margin-top:4px">CNPJ '+top.cnpj+' | '+top.vendedor+' | Score '+(top.score||'-')+'</div><div style="font-family:Poppins,sans-serif;font-size:32px;font-weight:800;margin-top:12px">'+R$dr(top.limite)+'</div></div>'; }
      h += '<div style="font-size:11px;font-weight:700;color:#5F7573;text-transform:uppercase;margin-bottom:8px">Top 10 maiores limites</div><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="background:#F5F7F6"><th style="padding:8px 12px;text-align:left">Cliente</th><th style="padding:8px 12px;text-align:right">Score</th><th style="padding:8px 12px;text-align:right">Limite</th></tr></thead><tbody>';
      cL.slice(0,10).forEach(r=>{ h += '<tr style="border-bottom:1px solid #EEF2F1"><td style="padding:8px 12px;color:#0A3332;font-weight:600">'+r.cliente+'</td><td style="padding:8px 12px;text-align:right">'+(r.score||'-')+'</td><td style="padding:8px 12px;text-align:right;font-weight:700">'+R$dr(r.limite)+'</td></tr>'; });
      h += '</tbody></table>';
    }
    else if (tipo === 'dividas'){
      const inad = filt.filter(r=>r.dividas>100).sort((a,b)=>b.dividas-a.dividas);
      const so = inad.reduce((a,b)=>a+b.dividas,0); let ac = 0;
      t = 'Dividas totais: ' + R$dr(so); s = inad.length + ' clientes inadimplentes';
      h = '<div style="background:#FEE2E2;color:#7F1D1D;padding:12px 14px;border-radius:8px;font-size:12.5px;margin-bottom:14px">Ordenacao por divida decrescente. Concentracao mostra Pareto.</div>';
      h += '<table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="background:#F5F7F6"><th style="padding:8px 12px;text-align:left">#</th><th style="padding:8px 12px;text-align:left">Cliente</th><th style="padding:8px 12px;text-align:left">Vendedor</th><th style="padding:8px 12px;text-align:right">Divida</th><th style="padding:8px 12px;text-align:right">Score</th><th style="padding:8px 12px;text-align:right">% acum</th></tr></thead><tbody>';
      inad.slice(0,25).forEach((r,i)=>{ ac += r.dividas; const pA = so?(ac/so*100).toFixed(1):0; h += '<tr style="border-bottom:1px solid #EEF2F1"><td style="padding:8px 12px;color:#5F7573">'+(i+1)+'</td><td style="padding:8px 12px;color:#0A3332;font-weight:600">'+r.cliente+'</td><td style="padding:8px 12px;color:#5F7573">'+r.vendedor+'</td><td style="padding:8px 12px;text-align:right;font-weight:700;color:#DC2626">'+R$dr(r.dividas)+'</td><td style="padding:8px 12px;text-align:right">'+(r.score||'-')+'</td><td style="padding:8px 12px;text-align:right;color:#DC2626;font-size:11px">'+pA+'%</td></tr>'; });
      h += '</tbody></table>';
    }
    window.abrirModalDrill(t, s, h);
  };

  window.pgBILagostao = function(){
    const L = (window.LAGOSTAO_DATA || []);
    if (!L.length) return '<div style="padding:40px;text-align:center;color:#5F7573">Carregando...</div>';
    const F = window._BI_LAG_FILTERS; const filt = aplicarFiltros(L);
    const sc = filt.map(r=>r.score).filter(x=>x>0);
    const scMed = sc.length ? Math.round(sc.reduce((a,b)=>a+b,0)/sc.length) : 0;
    const lim = filt.map(r=>r.limite).filter(x=>x>0);
    const totL = lim.reduce((a,b)=>a+b,0);
    const tk = lim.length ? totL/lim.length : 0;
    const totD = filt.reduce((a,b)=>a+(b.dividas||0),0);
    const nDiv = filt.filter(r=>r.dividas>100).length;
    const cL = lim.length; const mxL = lim.length ? Math.max(...lim) : 0;
    const vU = new Set(filt.map(r=>r.vendedor)).size;
    const vO = Array.from(new Set(L.map(r=>r.vendedor))).sort();

    return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div><div style="font-size:11px;color:#9896A8;text-transform:uppercase;letter-spacing:.09em;font-weight:700">Análise Comercial · Lagostão Pescados</div><div style="font-family:'Poppins',sans-serif;font-size:22px;font-weight:700;color:#0A3332">Business Intelligence · ${filt.length} de ${L.length} clientes</div></div><div style="display:flex;gap:8px"><button onclick="exportarCSVLagostao()" style="background:#0A3332;color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:600;cursor:pointer">Exportar CSV</button><button onclick="window._BI_LAG_FILTERS={vendedor:'',saida:'',risco:'',prazo:'',busca:''};render()" style="background:#fff;border:1px solid #D6DDDA;color:#5F7573;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:600;cursor:pointer">Limpar filtros</button></div></div>

<div style="background:#fff;border:1px solid #E4EAF4;border-radius:12px;padding:14px 16px;margin-bottom:16px"><div style="display:grid;grid-template-columns:1fr 200px 200px 150px;gap:10px;align-items:end"><div><label style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700;display:block;margin-bottom:4px">Buscar cliente ou CNPJ</label><input value="${F.busca}" oninput="window._BI_LAG_FILTERS.busca=this.value;clearTimeout(window._bit);window._bit=setTimeout(render,250)" placeholder="Nome ou CNPJ" style="width:100%;padding:8px 10px;border:1px solid #D6DDDA;border-radius:8px;font-size:13px;background:#F5F7F6"></div><div><label style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700;display:block;margin-bottom:4px">Vendedor</label><select onchange="window._BI_LAG_FILTERS.vendedor=this.value;render()" style="width:100%;padding:8px 10px;border:1px solid #D6DDDA;border-radius:8px;font-size:13px;background:#F5F7F6"><option value="">Todos</option>${vO.map(v=>`<option value="${v}" ${F.vendedor===v?'selected':''}>${v}</option>`).join('')}</select></div><div><label style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700;display:block;margin-bottom:4px">Rota de saída</label><select onchange="window._BI_LAG_FILTERS.saida=this.value;render()" style="width:100%;padding:8px 10px;border:1px solid #D6DDDA;border-radius:8px;font-size:13px;background:#F5F7F6"><option value="">Todas</option><option value="Lagostao" ${F.saida==='Lagostao'?'selected':''}>Lagostão</option><option value="Global" ${F.saida==='Global'?'selected':''}>Global</option><option value="JP" ${F.saida==='JP'?'selected':''}>JP</option></select></div><div><label style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700;display:block;margin-bottom:4px">Prazo</label><input value="${F.prazo}" oninput="window._BI_LAG_FILTERS.prazo=this.value;clearTimeout(window._bit2);window._bit2=setTimeout(render,250)" placeholder="Ex: 14" style="width:100%;padding:8px 10px;border:1px solid #D6DDDA;border-radius:8px;font-size:13px;background:#F5F7F6"></div></div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><span style="font-size:11px;color:#9896A8;text-transform:uppercase;font-weight:700;align-self:center">Faixa de risco:</span><span onclick="window._BI_LAG_FILTERS.risco='';render()" style="${chipStyle(!F.risco)}">Todos</span><span onclick="window._BI_LAG_FILTERS.risco='baixo';render()" style="${chipStyle(F.risco==='baixo')}">Baixo > 700</span><span onclick="window._BI_LAG_FILTERS.risco='moderado';render()" style="${chipStyle(F.risco==='moderado')}">Moderado 601-700</span><span onclick="window._BI_LAG_FILTERS.risco='elevado';render()" style="${chipStyle(F.risco==='elevado')}">Elevado 501-600</span><span onclick="window._BI_LAG_FILTERS.risco='alto';render()" style="${chipStyle(F.risco==='alto')}">Alto < 500</span><span onclick="window._BI_LAG_FILTERS.risco='sem_score';render()" style="${chipStyle(F.risco==='sem_score')}">Sem score</span></div></div>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">${kpi('Total analisado', filt.length, 'clientes na base', '#15746E', 'total')}${kpi('Vendedores ativos', vU, 'com fichas na selecao', '#0A3332', 'vendedores')}${kpi('Score médio', scMed, scMed>700?'Baixo risco':scMed>=601?'Moderado':scMed>=501?'Elevado':scMed>0?'Alto risco':'-', scMed>700?'#059669':scMed>=501?'#D97706':'#DC2626', 'score')}${kpi('Clientes com limite', cL, ((cL/filt.length*100)||0).toFixed(0)+'% da base filtrada', '#15746E', 'com_limite')}</div>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">${kpi('Ticket médio', R$fmt(tk), 'limite concedido', '#15746E', 'ticket')}${kpi('Total limite', R$fmt(totL), 'carteira ativa', '#0A3332', 'total_limite')}${kpi('Maior limite', R$fmt(mxL), 'concessão individual', '#059669', 'maior_limite')}${kpi('Dívidas totais', R$fmt(totD), nDiv+' clientes inadimplentes', '#DC2626', 'dividas')}</div>

<div style="display:grid;grid-template-columns:1fr 1fr 1.5fr;gap:12px;margin-bottom:14px">${cardChart('Rota de saída', 'ch-saidas', 220)}${cardChart('Distribuição de risco', 'ch-risco', 220)}${cardChart('Top vendedores por volume', 'ch-vendedores', 220)}</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">${cardChart('Score médio por vendedor', 'ch-score-vend', 240)}${cardChart('Ticket médio por vendedor (R$)', 'ch-ticket-vend', 240)}</div>
<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin-bottom:14px">${cardChart('Score x Limite (cada ponto é um cliente)', 'ch-scatter', 280)}${cardChart('Risco por rota de saída', 'ch-risco-saida', 280)}</div>
<div style="display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:14px">${cardChart('Distribuição por tempo de atividade (anos)', 'ch-fundacao', 200)}</div>

<div style="background:#fff;border:1px solid #E4EAF4;border-radius:12px;padding:0;overflow:hidden"><div style="padding:14px 18px;border-bottom:1px solid #E4EAF4;display:flex;justify-content:space-between;align-items:center"><div style="font-size:12px;font-weight:700;color:#0A3332;text-transform:uppercase;letter-spacing:.05em">Clientes filtrados (${filt.length}) — clique pra ver ficha</div><div style="font-size:11px;color:#5F7573">Ordenacao: score decrescente</div></div><div style="max-height:520px;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead style="background:#F5F7F6;position:sticky;top:0"><tr style="text-align:left"><th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase">Cliente</th><th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase">CNPJ</th><th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase">Vendedor</th><th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase">Fundado</th><th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase">Score</th><th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase">Dívidas</th><th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase">Prazo</th><th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase">Limite</th><th style="padding:10px 14px;font-weight:700;color:#5F7573;font-size:11px;text-transform:uppercase">Saída</th></tr></thead><tbody>${filt.slice().sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,300).map((r,i)=>{const cor = r.score>700?'#059669':r.score>=601?'#D97706':r.score>=501?'#EA580C':r.score>0?'#DC2626':'#9CA3AF';return `<tr onclick="verFichaLagostao(${i},'${(r.cnpj||'').replace(/'/g,"\\'")}')" style="border-bottom:1px solid #EEF2F1;cursor:pointer" onmouseover="this.style.background='#F5F7F6'" onmouseout="this.style.background=''"><td style="padding:9px 14px;font-weight:600;color:#0A3332">${r.cliente || '—'}</td><td style="padding:9px 14px;color:#5F7573;font-family:monospace;font-size:11.5px">${r.cnpj || '—'}</td><td style="padding:9px 14px;color:#0A3332">${r.vendedor || '—'}</td><td style="padding:9px 14px;color:#5F7573">${r.fundado || '—'}</td><td style="padding:9px 14px"><span style="background:${cor}22;color:${cor};padding:2px 8px;border-radius:10px;font-weight:700;font-size:11.5px">${r.score || '—'}</span></td><td style="padding:9px 14px;color:${r.dividas>100?'#DC2626':'#5F7573'};font-weight:${r.dividas>100?'700':'500'}">${R$dr(r.dividas)}</td><td style="padding:9px 14px;color:#0A3332">${r.prazo || '—'}</td><td style="padding:9px 14px;font-weight:600;color:#0A3332">${R$dr(r.limite)}</td><td style="padding:9px 14px;color:#5F7573;font-size:11.5px">${(r.saidas||[]).join(' + ') || '—'}</td></tr>`;}).join('')}</tbody></table>${filt.length > 300 ? `<div style="padding:12px;text-align:center;color:#5F7573;font-size:12px">Mostrando primeiros 300 de ${filt.length}.</div>` : ''}</div></div>`;
  };

  window.renderBIGraficos = function(){
    const L = (window.LAGOSTAO_DATA || []); if (!L.length || !window.Chart) return;
    const filt = aplicarFiltros(L);
    ['ch-saidas','ch-risco','ch-vendedores','ch-score-vend','ch-ticket-vend','ch-scatter','ch-risco-saida','ch-fundacao'].forEach(id => { const inst = Chart.getChart(id); if (inst) inst.destroy(); });

    const sd = {Lagostao:0, Global:0, JP:0};
    filt.forEach(r => (r.saidas||[]).forEach(s => { if(sd[s]!==undefined) sd[s]++; }));
    const e1 = document.getElementById('ch-saidas');
    if (e1) new Chart(e1, { type:'doughnut', data:{ labels:Object.keys(sd), datasets:[{ data:Object.values(sd), backgroundColor:[CORES.verde, CORES.verdeDark, CORES.roxo], borderColor:'#fff', borderWidth:2 }]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{size:11}, padding:10 }} }}});

    const scF = filt.map(r=>r.score).filter(s=>s>0);
    const rB = scF.filter(s=>s>700).length, rM = scF.filter(s=>s>=601 && s<=700).length, rE = scF.filter(s=>s>=501 && s<=600).length, rA = scF.filter(s=>s<501 && s>0).length, rS = filt.length - scF.length;
    const e2 = document.getElementById('ch-risco');
    if (e2) new Chart(e2, { type:'doughnut', data:{ labels:['Baixo (>700)','Moderado (601-700)','Elevado (501-600)','Alto (<500)','Sem score'], datasets:[{ data:[rB,rM,rE,rA,rS], backgroundColor:[CORES.verdeOk, CORES.amarelo, CORES.laranja, CORES.vermelho, CORES.cinza], borderColor:'#fff', borderWidth:2 }]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{size:10}, padding:6, boxWidth:10 }} }}});

    const vd = {}; filt.forEach(r => { vd[r.vendedor] = (vd[r.vendedor]||0)+1; });
    const tV = Object.entries(vd).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const e3 = document.getElementById('ch-vendedores');
    if (e3) new Chart(e3, { type:'bar', data:{ labels:tV.map(v=>v[0]), datasets:[{ label:'Fichas', data:tV.map(v=>v[1]), backgroundColor:CORES.verde, borderRadius:4 }]}, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}}, scales:{ x:{ grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}}}, y:{ grid:{display:false}, ticks:{font:{size:11}}} }}});

    const spv = {}; filt.forEach(r => { if (r.score>0){ if (!spv[r.vendedor]) spv[r.vendedor] = []; spv[r.vendedor].push(r.score); }});
    const smv = Object.entries(spv).map(([v,a]) => ({v, med: Math.round(a.reduce((x,y)=>x+y,0)/a.length), n: a.length})).filter(o => o.n >= 2).sort((a,b)=>b.med-a.med).slice(0,10);
    const e4 = document.getElementById('ch-score-vend');
    if (e4) new Chart(e4, { type:'bar', data:{ labels: smv.map(o=>o.v), datasets:[{ label:'Score', data:smv.map(o=>o.med), backgroundColor: smv.map(o=>o.med>700?CORES.verdeOk:o.med>=601?CORES.amarelo:o.med>=501?CORES.laranja:CORES.vermelho), borderRadius:4 }]}, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}}, scales:{ x:{ min:0, max:1000, grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}}}, y:{ grid:{display:false}, ticks:{font:{size:11}}} }}});

    const tpv = {}; filt.forEach(r => { if (r.limite>0){ if (!tpv[r.vendedor]) tpv[r.vendedor] = []; tpv[r.vendedor].push(r.limite); }});
    const tmv = Object.entries(tpv).map(([v,a]) => ({v, med: Math.round(a.reduce((x,y)=>x+y,0)/a.length), n:a.length})).filter(o => o.n >= 2).sort((a,b)=>b.med-a.med).slice(0,10);
    const e5 = document.getElementById('ch-ticket-vend');
    if (e5) new Chart(e5, { type:'bar', data:{ labels:tmv.map(o=>o.v), datasets:[{ label:'Ticket', data:tmv.map(o=>o.med), backgroundColor:CORES.verdeDark, borderRadius:4 }]}, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}}, scales:{ x:{ grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}, callback:v=>'R$ '+(v/1000).toFixed(0)+'k'}}, y:{ grid:{display:false}, ticks:{font:{size:11}}} }}});

    const pts = filt.filter(r=>r.score>0 && r.limite>0).map(r => ({ x:r.score, y:r.limite, cliente:r.cliente, backgroundColor:r.score>700?CORES.verdeOk:r.score>=601?CORES.amarelo:r.score>=501?CORES.laranja:CORES.vermelho }));
    const e6 = document.getElementById('ch-scatter');
    if (e6) new Chart(e6, { type:'scatter', data:{ datasets:[{ label:'Cliente', data:pts, backgroundColor: pts.map(p=>p.backgroundColor), borderColor: pts.map(p=>p.backgroundColor), pointRadius:5, pointHoverRadius:8 }]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>pts[c.dataIndex].cliente+' | Score '+c.parsed.x+' | R$ '+c.parsed.y.toLocaleString('pt-BR')}}}, scales:{ x:{ title:{display:true,text:'Score',font:{size:10}}, min:0, max:1000, grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}}}, y:{ title:{display:true,text:'Limite (R$)',font:{size:10}}, grid:{color:'rgba(0,0,0,.04)'}, ticks:{font:{size:10}, callback:v=>'R$ '+(v/1000).toFixed(0)+'k'}}}}});

    const sL = ['Lagostao','Global','JP']; const rL = ['Baixo','Moderado','Elevado','Alto','Sem'];
    const dR = rL.map((lbl, li) => {
      const dA = sL.map(s => filt.filter(r => (r.saidas||[]).includes(s)).filter(r => { if (lbl==='Baixo') return r.score>700; if (lbl==='Moderado') return r.score>=601 && r.score<=700; if (lbl==='Elevado') return r.score>=501 && r.score<=600; if (lbl==='Alto') return r.score<501 && r.score>0; return !r.score; }).length);
      const co = [CORES.verdeOk, CORES.amarelo, CORES.laranja, CORES.vermelho, CORES.cinza];
      return { label:lbl, data:dA, backgroundColor:co[li] };
    });
    const e7 = document.getElementById('ch-risco-saida');
    if (e7) new Chart(e7, { type:'bar', data:{ labels:sL, datasets:dR }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom', labels:{font:{size:10}, padding:6, boxWidth:10}}}, scales:{ x:{ stacked:true, grid:{display:false}}, y:{ stacked:true, grid:{color:'rgba(0,0,0,.04)'}}}}});

    const aA = new Date().getFullYear();
    const bA = {'< 5':0, '5-10':0, '10-20':0, '20-30':0, '> 30':0, 'Sem data':0};
    filt.forEach(r => {
      if (!r.fundado){ bA['Sem data']++; return; }
      const p = r.fundado.split('/'); let a = null;
      if (p.length===3) a = parseInt(p[2]);
      else if (r.fundado.includes('-')) a = parseInt(r.fundado.split('-')[0]);
      if (!a){ bA['Sem data']++; return; }
      const id = aA - a;
      if (id < 5) bA['< 5']++; else if (id <= 10) bA['5-10']++; else if (id <= 20) bA['10-20']++; else if (id <= 30) bA['20-30']++; else bA['> 30']++;
    });
    const e8 = document.getElementById('ch-fundacao');
    if (e8) new Chart(e8, { type:'bar', data:{ labels:Object.keys(bA), datasets:[{ label:'Clientes', data:Object.values(bA), backgroundColor:[CORES.vermelho, CORES.laranja, CORES.amarelo, CORES.verdeOk, CORES.verdeDark, CORES.cinza], borderRadius:6 }]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}}, scales:{ x:{ grid:{display:false}, ticks:{font:{size:11}}}, y:{ grid:{color:'rgba(0,0,0,.04)'}}}}});
  };

  window.verFichaLagostao = function(idx, cnpj){
    const r = (window.LAGOSTAO_DATA||[]).find(x => x.cnpj===cnpj); if (!r) return;
    const cor = r.score>700?'#059669':r.score>=601?'#D97706':r.score>=501?'#EA580C':r.score>0?'#DC2626':'#9CA3AF';
    const rL = r.score>700?'Baixo risco':r.score>=601?'Moderado':r.score>=501?'Elevado':r.score>0?'Alto risco':'Sem score';
    const old = document.getElementById('ficha-lg-modal'); if (old) old.remove();
    const ov = document.createElement('div'); ov.id = 'ficha-lg-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,51,50,.85);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px';
    ov.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:640px;width:100%;max-height:90vh;overflow:auto;font-family:Inter,sans-serif"><div style="background:linear-gradient(135deg,#0A3332,#15746E);padding:22px 26px;color:#fff;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;font-weight:600">Ficha histórica</div><div style="font-family:Poppins,sans-serif;font-size:20px;font-weight:700;margin-top:4px">${r.cliente || '—'}</div></div><button onclick="document.getElementById('ficha-lg-modal').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:20px;cursor:pointer;width:32px;height:32px;border-radius:8px">×</button></div><div style="padding:24px 26px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px"><div><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">CNPJ</div><div style="font-family:monospace;font-size:14px;color:#0A3332;font-weight:600;margin-top:2px">${r.cnpj || '—'}</div></div><div><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Fundação</div><div style="font-size:14px;color:#0A3332;font-weight:600;margin-top:2px">${r.fundado || '—'}</div></div><div><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Vendedor</div><div style="font-size:14px;color:#0A3332;font-weight:600;margin-top:2px">${r.vendedor || '—'}</div></div><div><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Data análise</div><div style="font-size:14px;color:#0A3332;font-weight:600;margin-top:2px">${r.data || '—'}</div></div></div><div style="background:#F5F7F6;border-radius:10px;padding:16px 18px;margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:10.5px;color:#9896A8;text-transform:uppercase;font-weight:700">Score</div><div style="font-family:Poppins,sans-serif;font-size:32px;font-weight:800;color:${cor};line-height:1;margin-top:4px">${r.score || '—'}</div><div style="font-size:11px;color:${cor};font-weight:600;margin-top:2px">${rL}</div></div><div style="text-align:right"><div style="font-size:10.5px;color:#9896A8;text-transform:uppercase;font-weight:700">Limite concedido</div><div style="font-family:Poppins,sans-serif;font-size:22px;font-weight:800;color:#0A3332;margin-top:4px">${R$dr(r.limite)}</div><div style="font-size:11px;color:#5F7573;margin-top:2px">Prazo: ${r.prazo || '—'}</div></div></div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px"><div><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Capital social</div><div style="font-size:14px;color:#0A3332;font-weight:700;margin-top:2px">${R$dr(r.capital)}</div></div><div><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Prospecção</div><div style="font-size:14px;color:#0A3332;font-weight:700;margin-top:2px">${R$dr(r.prospeccao)}</div></div><div><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700">Dívidas</div><div style="font-size:14px;color:${r.dividas>100?'#DC2626':'#0A3332'};font-weight:700;margin-top:2px">${R$dr(r.dividas)}</div></div></div><div><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700;margin-bottom:6px">Rota de saída</div><div style="display:flex;gap:6px;flex-wrap:wrap">${(r.saidas||[]).map(s=>`<span style="background:#0A3332;color:#fff;padding:4px 10px;border-radius:12px;font-size:11.5px;font-weight:600">${s}</span>`).join('') || '<span style="color:#9CA3AF">—</span>'}</div></div>${r.obs ? `<div style="margin-top:12px"><div style="font-size:10px;color:#9896A8;text-transform:uppercase;font-weight:700;margin-bottom:4px">Observações</div><div style="font-size:13px;color:#0A3332;background:#FEF3C7;padding:10px 12px;border-radius:8px">${r.obs}</div></div>` : ''}</div></div>`;
    document.body.appendChild(ov);
  };

  window.exportarCSVLagostao = function(){
    const filt = aplicarFiltros(window.LAGOSTAO_DATA || []);
    const cab = ['Data','CNPJ','Cliente','Vendedor','Fundado','Capital','Prospeccao','Score','Dividas','Prazo','Limite','Saidas','Observacoes'];
    const linhas = filt.map(r => [r.data,r.cnpj,r.cliente,r.vendedor,r.fundado,r.capital,r.prospeccao,r.score,r.dividas,r.prazo,r.limite,(r.saidas||[]).join('|'),(r.obs||'').replace(/[\r\n]/g,' ')]);
    const csv = [cab.join(';')].concat(linhas.map(l => l.map(c => String(c==null?'':c).replace(/;/g,',')).join(';'))).join('\n');
    const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lagostao-bi-'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  };
})();
