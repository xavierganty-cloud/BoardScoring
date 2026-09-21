const STORAGE_KEY = 'boardscoring-state-v1';

const setupPanel = document.getElementById('setupPanel');
const gamePanel = document.getElementById('gamePanel');
const playersSetup = document.getElementById('playersSetup');
const playerCount = document.getElementById('playerCount');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const startGameBtn = document.getElementById('startGameBtn');
const gameNameInput = document.getElementById('gameName');
const gameTitle = document.getElementById('gameTitle');
const gameSubtitle = document.getElementById('gameSubtitle');
const scoreTable = document.getElementById('scoreTable');
const addRoundBtn = document.getElementById('addRoundBtn');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const newGameBtn = document.getElementById('newGameBtn');

const scoreDialog = document.getElementById('scoreDialog');
const scoreForm = document.getElementById('scoreForm');
const closeDialogBtn = document.getElementById('closeDialogBtn');
const dialogTitle = document.getElementById('dialogTitle');
const scoreValueButton = document.getElementById('scoreValueButton');
const manualEntry = document.getElementById('manualEntry');
const manualEntryBtn = document.getElementById('manualEntryBtn');
const manualScoreInput = document.getElementById('manualScoreInput');
const applyManualBtn = document.getElementById('applyManualBtn');

let setupPlayers = ['Joueur 1','Joueur 2'];
let state = {
  started: false,
  gameName: '',
  winnerMode: 'high',
  players: [],
  rounds: [],
  history: []
};
let activeCell = null;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.started && Array.isArray(saved.players)) {
      state = { ...state, ...saved, history: Array.isArray(saved.history) ? saved.history : [] };
      renderGame();
      showGame();
      return;
    }
  } catch (_) {}
  renderSetupPlayers();
}

function renderSetupPlayers() {
  playersSetup.innerHTML = '';
  setupPlayers.forEach((name, index) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <span class="player-index">${index + 1}</span>
      <input class="player-input" data-index="${index}" maxlength="24" value="${escapeHtml(name)}" aria-label="Nom du joueur ${index + 1}" />
      <button class="remove-player" data-remove="${index}" aria-label="Supprimer le joueur ${index + 1}">×</button>`;
    playersSetup.appendChild(row);
  });
  playerCount.textContent = `${setupPlayers.length} / 8`;
  addPlayerBtn.disabled = setupPlayers.length >= 8;
  [...playersSetup.querySelectorAll('[data-remove]')].forEach(btn => {
    btn.disabled = setupPlayers.length <= 2;
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

playersSetup.addEventListener('input', e => {
  if (e.target.matches('.player-input')) {
    setupPlayers[Number(e.target.dataset.index)] = e.target.value;
  }
});

playersSetup.addEventListener('click', e => {
  const btn = e.target.closest('[data-remove]');
  if (!btn || setupPlayers.length <= 2) return;
  setupPlayers.splice(Number(btn.dataset.remove), 1);
  renderSetupPlayers();
});

addPlayerBtn.addEventListener('click', () => {
  if (setupPlayers.length >= 8) return;
  setupPlayers.push(`Joueur ${setupPlayers.length + 1}`);
  renderSetupPlayers();
  setTimeout(() => playersSetup.querySelector('.player-input:last-of-type')?.focus(), 0);
});

startGameBtn.addEventListener('click', () => {
  const names = [...playersSetup.querySelectorAll('.player-input')].map((i, idx) => i.value.trim() || `Joueur ${idx + 1}`);
  const winnerMode = document.querySelector('input[name="winnerMode"]:checked').value;
  state = {
    started: true,
    gameName: gameNameInput.value.trim() || 'Partie',
    winnerMode,
    players: names,
    rounds: [],
    history: []
  };
  saveState();
  renderGame();
  showGame();
});

function showGame() {
  setupPanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  gameSubtitle.textContent = state.gameName;
}

function snapshot() {
  state.history.push(JSON.stringify({ rounds: state.rounds }));
  if (state.history.length > 40) state.history.shift();
  undoBtn.disabled = state.history.length === 0;
}

function totals() {
  return state.players.map((_, p) => state.rounds.reduce((sum, round) => sum + (Number(round[p]) || 0), 0));
}

function ranksFromTotals(ts) {
  const indexed = ts.map((value, index) => ({ value, index }));
  indexed.sort((a,b) => state.winnerMode === 'high' ? b.value - a.value : a.value - b.value);
  const ranks = Array(ts.length).fill(0);
  let lastValue = null;
  let lastRank = 0;
  indexed.forEach((item, order) => {
    if (item.value !== lastValue) lastRank = order + 1;
    ranks[item.index] = lastRank;
    lastValue = item.value;
  });
  return ranks;
}

function renderGame() {
  gameTitle.textContent = state.gameName || 'Partie';
  gameSubtitle.textContent = state.gameName || 'Partie';
  undoBtn.disabled = !state.history.length;
  const ts = totals();
  const ranks = ranksFromTotals(ts);

  let html = '<thead><tr><th></th>';
  state.players.forEach((name, i) => {
    html += `<th><div class="player-head"><span class="player-name">${escapeHtml(name)}</span><span class="player-total">${ts[i]} pts</span><span class="rank-badge">${rankLabel(ranks[i])}</span></div></th>`;
  });
  html += '</tr></thead><tbody>';

  if (!state.rounds.length) {
    html += `<tr><td class="round-label">M1</td>${state.players.map((_,p) => `<td class="score-cell empty-score" data-r="0" data-p="${p}">—</td>`).join('')}</tr>`;
  } else {
    state.rounds.forEach((round, r) => {
      html += `<tr><td class="round-label">M${r + 1}</td>`;
      state.players.forEach((_, p) => {
        const val = round[p];
        html += `<td class="score-cell ${val === null ? 'empty-score' : ''}" data-r="${r}" data-p="${p}">${val === null ? '—' : val}</td>`;
      });
      html += '</tr>';
    });
  }
  html += '</tbody>';
  scoreTable.innerHTML = html;
}

function rankLabel(rank) {
  return rank === 1 ? '1er' : `${rank}e`;
}

addRoundBtn.addEventListener('click', () => {
  snapshot();
  state.rounds.push(Array(state.players.length).fill(null));
  saveState();
  renderGame();
  requestAnimationFrame(() => {
    const scroll = document.getElementById('scoreScroll');
    scroll.scrollTop = scroll.scrollHeight;
  });
});

scoreTable.addEventListener('click', e => {
  const cell = e.target.closest('.score-cell');
  if (!cell) return;
  let r = Number(cell.dataset.r);
  const p = Number(cell.dataset.p);
  if (!state.rounds.length) {
    snapshot();
    state.rounds.push(Array(state.players.length).fill(null));
    r = 0;
    saveState();
  }
  activeCell = { r, p };
  openScoreDialog();
});

function openScoreDialog() {
  const { r, p } = activeCell;
  dialogTitle.textContent = `${state.players[p]} · Manche ${r + 1}`;
  const val = state.rounds[r][p];
  scoreValueButton.textContent = val ?? 0;
  manualEntry.classList.add('hidden');
  manualScoreInput.value = val ?? 0;
  scoreDialog.showModal();
}

function setActiveScore(value) {
  if (!activeCell) return;
  snapshot();
  state.rounds[activeCell.r][activeCell.p] = Math.trunc(Number(value) || 0);
  scoreValueButton.textContent = state.rounds[activeCell.r][activeCell.p];
  saveState();
  renderGame();
}

scoreDialog.addEventListener('click', e => {
  const deltaBtn = e.target.closest('[data-delta]');
  if (!deltaBtn) return;
  const delta = Number(deltaBtn.dataset.delta);
  const current = Number(scoreValueButton.textContent) || 0;
  setActiveScore(current + delta);
});

manualEntryBtn.addEventListener('click', () => {
  manualEntry.classList.toggle('hidden');
  if (!manualEntry.classList.contains('hidden')) {
    manualScoreInput.value = scoreValueButton.textContent;
    manualScoreInput.focus();
    manualScoreInput.select();
  }
});

scoreValueButton.addEventListener('click', () => manualEntryBtn.click());
applyManualBtn.addEventListener('click', () => {
  setActiveScore(manualScoreInput.value);
  manualEntry.classList.add('hidden');
});
manualScoreInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    applyManualBtn.click();
  }
});
closeDialogBtn.addEventListener('click', () => scoreDialog.close());
scoreForm.addEventListener('submit', () => scoreDialog.close());

undoBtn.addEventListener('click', () => {
  const previous = state.history.pop();
  if (!previous) return;
  const restored = JSON.parse(previous);
  state.rounds = restored.rounds;
  saveState();
  renderGame();
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Réinitialiser tous les scores de cette partie ?')) return;
  snapshot();
  state.rounds = [];
  saveState();
  renderGame();
});

newGameBtn.addEventListener('click', () => {
  if (state.started && !confirm('Créer une nouvelle partie ? La partie actuelle sera remplacée.')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = { started:false, gameName:'', winnerMode:'high', players:[], rounds:[], history:[] };
  setupPlayers = ['Joueur 1','Joueur 2'];
  gameNameInput.value = '';
  document.querySelector('input[name="winnerMode"][value="high"]').checked = true;
  renderSetupPlayers();
  gamePanel.classList.add('hidden');
  setupPanel.classList.remove('hidden');
  gameSubtitle.textContent = 'Nouvelle partie';
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

loadState();
