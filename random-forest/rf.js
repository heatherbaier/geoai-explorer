// ─────────────────────────────────────────────────────────────
//  GeoAI Explorer — Random Forest Logic
// ─────────────────────────────────────────────────────────────

/* ══════════════════════════ STATE ══════════════════════════ */
let gameIdx       = 0;
let votes         = {};       // { parcelId: { treeId: 'HIGH RISK'|'LOW RISK' } }
let parcelResults = [];       // { parcel, treeVotes, ensemble, correct }
let mainMap       = null;
let gameMap       = null;
let gameMarker    = null;
let phasesUnlocked = [1];

/* ══════════════════════════ PHASE NAV ══════════════════════ */
function showPhase(n) {
  if(!phasesUnlocked.includes(n)) return;
  document.querySelectorAll('.phase-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.phase-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`phase-${n}`).classList.add('active');
  document.getElementById(`pbtn-${n}`).classList.add('active');
  if(n === 2) setTimeout(() => gameMap && gameMap.invalidateSize(), 100);
}

function unlockPhase(n) {
  if(!phasesUnlocked.includes(n)) {
    phasesUnlocked.push(n);
    const btn = document.getElementById(`pbtn-${n}`);
    btn.classList.remove('locked');
  }
  showPhase(n);
}

/* ══════════════════════════ MAIN MAP ═══════════════════════ */
function initMainMap() {
  mainMap = L.map('rf-map', { zoomControl: true, scrollWheelZoom: false })
    .setView([29.730, -95.480], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 16
  }).addTo(mainMap);

  RF_PARCELS.forEach(p => {
    const color = p.flood === 'YES' ? '#E24B4A' : '#1D9E75';
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 8, color: '#fff', weight: 1.5,
      fillColor: color, fillOpacity: 0.85
    }).addTo(mainMap);
    marker.bindTooltip(`
      <strong>#${p.id} — ${p.neighborhood}</strong><br>
      dist: ${p.dist}m · imp: ${p.imp}% · slope: ${p.slope}° · drain: ${p.drain}<br>
      <span style="font-weight:600;color:${color};">${p.flood === 'YES' ? 'HIGH RISK' : 'LOW RISK'}</span>
    `, { direction: 'top', offset: [0, -6] });
  });
}

/* ══════════════════════════ GAME MAP ═══════════════════════ */
function initGameMap() {
  if(gameMap) return;
  gameMap = L.map('game-map', { zoomControl: false, scrollWheelZoom: false })
    .setView([29.730, -95.480], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 16
  }).addTo(gameMap);
}

function updateGameMap(parcel) {
  if(!gameMap) initGameMap();
  if(gameMarker) gameMap.removeLayer(gameMarker);
  gameMarker = L.circleMarker([parcel.lat, parcel.lng], {
    radius: 12, color: '#534AB7', weight: 3,
    fillColor: '#534AB7', fillOpacity: 0.5
  }).addTo(gameMap);
  gameMap.setView([parcel.lat, parcel.lng], 13);
  setTimeout(() => gameMap.invalidateSize(), 120);
}

/* ══════════════════════════ TREE SVG ═══════════════════════ */
function nodeClass(node) {
  if(node.label === 'HIGH RISK') return 'leaf-yes';
  if(node.label === 'LOW RISK')  return 'leaf-no';
  return 'decision';
}

function drawTreeSVG(treeObj, highlightPath) {
  // Layout: fixed positions for a 3-level tree
  const W = 320, H = 220;
  const nodes = [
    { id:'root', x:160, y:22,  w:150, h:40, node: treeObj.tree, parentId: null, edgeLabel:'' },
    { id:'L',    x:75,  y:110, w:130, h:38, node: treeObj.tree.left,  parentId:'root', edgeLabel:'YES' },
    { id:'R',    x:250, y:110, w:130, h:38, node: treeObj.tree.right, parentId:'root', edgeLabel:'NO'  },
    { id:'LL',   x:32,  y:190, w:110, h:34, node: treeObj.tree.left.left,   parentId:'L', edgeLabel:'YES' },
    { id:'LR',   x:118, y:190, w:110, h:34, node: treeObj.tree.left.right,  parentId:'L', edgeLabel:'NO'  },
    { id:'RL',   x:205, y:190, w:110, h:34, node: treeObj.tree.right.left,  parentId:'R', edgeLabel:'YES' },
    { id:'RR',   x:298, y:190, w:110, h:34, node: treeObj.tree.right.right, parentId:'R', edgeLabel:'NO'  },
  ];

  let html = `<svg viewBox="0 0 ${W} ${H+20}" width="${W}" height="${H+20}" style="display:block;min-width:${W}px;">`;

  // Edges
  nodes.forEach(n => {
    const parent = nodes.find(p => p.id === n.parentId);
    if(!parent) return;
    const inPath = highlightPath && highlightPath.includes(n.id);
    const stroke = inPath ? treeObj.color : '#aaa';
    const w = inPath ? 2.5 : 1;
    html += `<path d="M${parent.x},${parent.y+parent.h} C${parent.x},${parent.y+parent.h+22} ${n.x},${n.y-22} ${n.x},${n.y}"
      fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
    const mx = (parent.x+n.x)/2+4, my = (parent.y+parent.h+n.y)/2;
    html += `<text x="${mx}" y="${my}" text-anchor="middle" font-size="9" fill="#999" font-family="sans-serif">${n.edgeLabel}</text>`;
  });

  // Nodes
  nodes.forEach(n => {
    const nc = nodeClass(n.node);
    const inPath = highlightPath && highlightPath.includes(n.id);
    let fill, stroke, textCol;
    if(nc === 'leaf-yes') {
      fill='#FCEBEB'; stroke='#F09595'; textCol='#A32D2D';
    } else if(nc === 'leaf-no') {
      fill='#E1F5EE'; stroke='#5DCAA5'; textCol='#085041';
    } else {
      fill = inPath ? '#E6F1FB' : '#F2F1ED';
      stroke = inPath ? treeObj.color : '#ccc';
      textCol = inPath ? '#0C447C' : '#3a3a40';
    }
    const sw = inPath ? 2 : 1;
    html += `<rect x="${n.x-n.w/2}" y="${n.y}" width="${n.w}" height="${n.h}" rx="7"
      fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

    if(n.node.label) {
      html += `<text x="${n.x}" y="${n.y+n.h/2+1}" text-anchor="middle" dominant-baseline="central"
        font-size="11" font-weight="700" fill="${textCol}" font-family="sans-serif">${n.node.label}</text>`;
    } else {
      // Decision node — split label across two lines
      const feat = n.node.feat;
      const fl = FEAT_LABELS[feat];
      const thresh = n.node.cat ? `= ${n.node.thresh}` : `≤ ${n.node.thresh}${fl.unit}`;
      html += `<text x="${n.x}" y="${n.y+12}" text-anchor="middle"
        font-size="10" font-weight="600" fill="${textCol}" font-family="sans-serif">${fl.label}</text>`;
      html += `<text x="${n.x}" y="${n.y+24}" text-anchor="middle"
        font-size="10" fill="${textCol}" font-family="sans-serif">${thresh}?</text>`;
    }
  });

  html += '</svg>';
  return html;
}

/* ══════════════════════════ PHASE 1 ════════════════════════ */
function renderTrees(highlightPaths) {
  const grid = document.getElementById('trees-display');
  grid.innerHTML = RF_TREES.map(t => {
    const hp = highlightPaths ? highlightPaths[t.id] : null;
    const svg = drawTreeSVG(t, hp);
    return `
      <div class="tree-card">
        <div class="tree-card-header">
          <span class="tree-dot" style="background:${t.color};"></span>
          <div>
            <div class="tree-card-name">${t.name}</div>
            <div class="tree-card-sub">First split: ${t.firstSplit}</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;">
          Trained on parcels: ${t.trainedOn.join(', ')}
        </div>
        <div class="tree-svg-wrap" id="tree-wrap-${t.id}">${svg}</div>
      </div>`;
  }).join('');

  // Drag-to-scroll for each tree
  RF_TREES.forEach(t => {
    const el = document.getElementById(`tree-wrap-${t.id}`);
    let dragging=false, sx, sy, sl, st;
    el.addEventListener('mousedown', e => { dragging=true; sx=e.pageX-el.offsetLeft; sy=e.pageY-el.offsetTop; sl=el.scrollLeft; st=el.scrollTop; e.preventDefault(); });
    document.addEventListener('mouseup', () => { dragging=false; });
    document.addEventListener('mousemove', e => {
      if(!dragging) return;
      el.scrollLeft = sl-(e.pageX-el.offsetLeft-sx);
      el.scrollTop  = st-(e.pageY-el.offsetTop-sy);
    });
  });
}

/* ══════════════════════════ PHASE 2 ════════════════════════ */
function getTreePath(treeObj, parcel) {
  // Returns array of node ids the parcel traverses
  const path = ['root'];
  let node = treeObj.tree;
  const sides = [];
  while(!node.label) {
    const val = {dist:parcel.dist, imp:parcel.imp, slope:parcel.slope, drain:parcel.drain}[node.feat];
    const goLeft = node.cat ? val === node.thresh : val <= node.thresh;
    sides.push(goLeft ? 'L' : 'R');
    node = goLeft ? node.left : node.right;
    // Build node id from path
    path.push(sides.join(''));
  }
  return path;
}

function initGame() {
  gameIdx = 0;
  votes = {};
  parcelResults = [];
  RF_TEST_PARCELS.forEach(p => { votes[p.id] = {}; });
  renderProgress();
  renderGameStep();
}

function renderProgress() {
  const dots = document.getElementById('progress-dots');
  const label = document.getElementById('progress-label');
  dots.innerHTML = RF_TEST_PARCELS.map((p,i) => {
    let cls = 'p-dot';
    if(i < gameIdx) {
      const r = parcelResults[i];
      cls += r && r.correct ? ' done-correct' : ' done-wrong';
    } else if(i === gameIdx) cls += ' current';
    return `<div class="${cls}"></div>`;
  }).join('');
  label.textContent = `${gameIdx + 1} of ${RF_TEST_PARCELS.length}`;
}

function renderGameStep() {
  const parcel = RF_TEST_PARCELS[gameIdx];
  renderParcelCard(parcel);
  renderVoteRows(parcel);
  renderGameNav(false);
  updateGameMap(parcel);
  // Show tree paths on the phase-1 trees (highlight for current parcel)
  const paths = {};
  RF_TREES.forEach(t => { paths[t.id] = getTreePath(t, parcel); });
  renderTrees(paths);
}

function renderParcelCard(parcel) {
  document.getElementById('game-parcel-card').innerHTML = `
    <div class="parcel-id">Test parcel ${parcel.id}</div>
    <div class="parcel-neighborhood">${parcel.neighborhood}</div>
    <div class="parcel-hint">${parcel.hint}</div>
    <div class="feat-grid">
      <div class="feat-item">
        <div class="feat-name">dist. to stream</div>
        <div class="feat-val">${parcel.dist} m</div>
      </div>
      <div class="feat-item">
        <div class="feat-name">imp. surface %</div>
        <div class="feat-val">${parcel.imp}%</div>
      </div>
      <div class="feat-item">
        <div class="feat-name">slope</div>
        <div class="feat-val">${parcel.slope}°</div>
      </div>
      <div class="feat-item">
        <div class="feat-name">drainage</div>
        <div class="feat-val">${parcel.drain}</div>
      </div>
    </div>`;
}

function renderVoteRows(parcel) {
  const container = document.getElementById('vote-rows');
  container.innerHTML = RF_TREES.map(t => {
    const myVote = votes[parcel.id][t.id];
    const correct = traverse(t.tree, parcel);
    const confirmed = myVote !== undefined;
    const isCorrect = myVote === correct;
    let rowClass = 'vote-row';
    if(confirmed) rowClass += isCorrect ? ' correct' : ' wrong';

    const hiBtn = `vote-btn${myVote==='HIGH RISK'?' selected-yes':''}`;
    const loBtn = `vote-btn${myVote==='LOW RISK'?' selected-no':''}`;
    const disabled = confirmed ? 'disabled' : '';

    let feedback = '';
    if(confirmed) {
      feedback = isCorrect
        ? `<span class="vote-feedback ok">✓ Correct — ${correct}</span>`
        : `<span class="vote-feedback bad">✗ Wrong — should be ${correct}</span>`;
      // Show why
      const path = getTreePath(t, parcel);
      const pathStr = buildPathExplanation(t.tree, parcel);
      feedback += `<div class="vote-hint">${pathStr}</div>`;
    }

    return `
      <div class="${rowClass}" id="vrow-${t.id}">
        <span class="vote-tree-label" style="color:${t.color};">${t.name}</span>
        <div class="vote-btn-group">
          <button class="${hiBtn}" onclick="castVote('${parcel.id}',${t.id},'HIGH RISK')" ${disabled}
            style="border-left:3px solid var(--red-bd);">HIGH RISK</button>
          <button class="${loBtn}" onclick="castVote('${parcel.id}',${t.id},'LOW RISK')" ${disabled}
            style="border-left:3px solid var(--green-bd);">LOW RISK</button>
        </div>
        ${feedback}
      </div>`;
  }).join('');
}

function buildPathExplanation(tree, parcel) {
  let node = tree;
  const steps = [];
  while(!node.label) {
    const fl = FEAT_LABELS[node.feat];
    const val = {dist:parcel.dist,imp:parcel.imp,slope:parcel.slope,drain:parcel.drain}[node.feat];
    const goLeft = node.cat ? val === node.thresh : val <= node.thresh;
    const thresh = node.cat ? `= ${node.thresh}` : `≤ ${node.thresh}${fl.unit}`;
    steps.push(`${fl.label} ${val}${fl.unit} ${goLeft?'✓':'✗'} ${thresh}`);
    node = goLeft ? node.left : node.right;
  }
  return steps.join(' → ') + ` → ${node.label}`;
}

function castVote(parcelId, treeId, label) {
  votes[parcelId][treeId] = label;
  const parcel = RF_TEST_PARCELS.find(p => p.id === parcelId);
  renderVoteRows(parcel);

  // Check if all 3 trees voted
  const allVoted = RF_TREES.every(t => votes[parcelId][t.id] !== undefined);
  if(allVoted) showEnsembleResult(parcel);
}

function showEnsembleResult(parcel) {
  const treeVotes = RF_TREES.map(t => traverse(t.tree, parcel));
  const highCount = treeVotes.filter(v => v === 'HIGH RISK').length;
  const ensemble  = highCount >= 2 ? 'HIGH RISK' : 'LOW RISK';
  const correct   = ensemble === parcel.flood;

  parcelResults[gameIdx] = { parcel, treeVotes, ensemble, correct };

  const el = document.getElementById('ensemble-result');
  el.className = `ensemble-result show ${ensemble === 'HIGH RISK' ? 'high' : 'low'}`;
  el.innerHTML = `
    <div class="ensemble-label ${ensemble === 'HIGH RISK' ? 'high' : 'low'}">
      Forest vote: ${ensemble}
    </div>
    <div class="ensemble-votes">
      ${RF_TREES.map((t,i) => `<span style="color:${t.color};font-weight:500;">${t.name}: ${treeVotes[i]}</span>`).join(' · ')}
    </div>
    <div class="ensemble-accuracy" style="color:${correct?'var(--green-txt)':'var(--red-txt)'};">
      ${correct ? '✓ Correct — matches true label' : `✗ Wrong — true label is ${parcel.flood}`}
    </div>`;

  renderGameNav(true);
  renderProgress();
}

function renderGameNav(showNext) {
  const el = document.getElementById('game-nav-btns');
  const isLast = gameIdx === RF_TEST_PARCELS.length - 1;
  if(!showNext) { el.innerHTML = ''; return; }
  el.innerHTML = isLast
    ? `<button class="btn primary" onclick="finishGame()">See results &rarr;</button>`
    : `<button class="btn primary" onclick="nextParcel()">Next parcel &rarr;</button>`;
}

function nextParcel() {
  gameIdx++;
  document.getElementById('ensemble-result').className = 'ensemble-result';
  renderProgress();
  renderGameStep();
}

function finishGame() {
  unlockPhase(3);
  renderResults();
}

/* ══════════════════════════ PHASE 3 ════════════════════════ */
function renderResults() {
  // Score counts
  const totalParcels = parcelResults.length;
  const ensembleCorrect = parcelResults.filter(r => r.correct).length;

  // Per-tree accuracy
  const treeCorrect = RF_TREES.map(t => {
    return parcelResults.filter(r => traverse(t.tree, r.parcel) === r.parcel.flood).length;
  });
  const bestSingle = Math.max(...treeCorrect);

  // Score grid
  document.getElementById('score-grid').innerHTML = `
    <div class="score-card">
      <div class="score-num" style="color:var(--purple);">${ensembleCorrect}/${totalParcels}</div>
      <div class="score-lbl">Forest correct</div>
    </div>
    ${RF_TREES.map((t,i) => `
    <div class="score-card">
      <div class="score-num" style="color:${t.color};">${treeCorrect[i]}/${totalParcels}</div>
      <div class="score-lbl">${t.name} correct</div>
    </div>`).join('')}`;

  // Commentary
  const commentary = document.getElementById('results-commentary');
  if(ensembleCorrect >= bestSingle) {
    commentary.innerHTML = `The forest scored <strong>${ensembleCorrect}/${totalParcels}</strong> — matching or beating the best individual tree (${bestSingle}/${totalParcels}). This is the core promise of ensembles: aggregating imperfect trees produces a more robust classifier.`;
  } else {
    commentary.innerHTML = `The forest scored <strong>${ensembleCorrect}/${totalParcels}</strong>, which didn't beat the best individual tree (${bestSingle}/${totalParcels}) on this small sample. With only 3 trees and 5 test parcels this can happen — in a real random forest with 100+ trees, the ensemble almost always outperforms any single tree.`;
  }

  // Feature importance (hardcoded weights based on tree structure)
  const fiData = [
    { feat: 'dist. to stream', score: 0.48, color: '#534AB7' },
    { feat: 'imp. surface %',  score: 0.28, color: '#0F6E56' },
    { feat: 'drainage class',  score: 0.16, color: '#993C1D' },
    { feat: 'slope',           score: 0.08, color: '#BA7517' },
  ];
  document.getElementById('feature-importance').innerHTML = fiData.map(f => `
    <div class="fi-bar-wrap">
      <div class="fi-label-row">
        <span style="font-weight:500;color:var(--text);">${f.feat}</span>
        <span style="color:var(--text2);">${Math.round(f.score*100)}%</span>
      </div>
      <div class="fi-bar-track">
        <div class="fi-bar-fill" style="width:${f.score*100}%;background:${f.color};"></div>
      </div>
    </div>`).join('');

  // Per-parcel table
  document.getElementById('results-table').innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:var(--surface2);">
          <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border);color:var(--text2);">Parcel</th>
          <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border);color:var(--text2);">True label</th>
          ${RF_TREES.map(t=>`<th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border);color:${t.color};">${t.name}</th>`).join('')}
          <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border);color:var(--purple);">Forest vote</th>
          <th style="padding:7px 10px;text-align:left;border-bottom:1px solid var(--border);color:var(--text2);">Result</th>
        </tr>
      </thead>
      <tbody>
        ${parcelResults.map(r => {
          const treeVotes = RF_TREES.map(t => traverse(t.tree, r.parcel));
          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:6px 10px;color:var(--text2);">${r.parcel.neighborhood}</td>
            <td style="padding:6px 10px;">
              <span style="font-weight:600;color:${r.parcel.flood==='YES'?'var(--red-txt)':'var(--green-txt)'};">
                ${r.parcel.flood === 'YES' ? 'HIGH' : 'LOW'}
              </span>
            </td>
            ${treeVotes.map(v=>`
            <td style="padding:6px 10px;color:${v==='HIGH RISK'?'var(--red-txt)':'var(--green-txt)'};">
              ${v === 'HIGH RISK' ? 'HIGH' : 'LOW'}
            </td>`).join('')}
            <td style="padding:6px 10px;font-weight:600;color:${r.ensemble==='HIGH RISK'?'var(--red-txt)':'var(--green-txt)'};">
              ${r.ensemble === 'HIGH RISK' ? 'HIGH' : 'LOW'}
            </td>
            <td style="padding:6px 10px;">
              ${r.correct
                ? '<span style="color:var(--green-txt);font-weight:600;">✓</span>'
                : '<span style="color:var(--red-txt);font-weight:600;">✗</span>'}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function resetGame() {
  gameIdx = 0; votes = {}; parcelResults = [];
  RF_TEST_PARCELS.forEach(p => { votes[p.id] = {}; });
  phasesUnlocked = [1,2];
  showPhase(2);
  renderProgress();
  renderGameStep();
}

/* ══════════════════════════ INIT ═══════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initMainMap();
  renderTrees(null);
  initGame();
});
