const STORAGE_KEY = 'boardscoring-state-v2';

const setupPanel = document.getElementById('setupPanel');
const gamePanel = document.getElementById('gamePanel');
const playersSetup = document.getElementById('playersSetup');
const playerCount = document.getElementById('playerCount');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const startGameBtn = document.getElementById('startGameBtn');
const gameNameInput = document.getElementById('gameName');
const gameTitle = document.getElementById('gameTitle');
const gameSubtitle = document.getElementById('gameSubtitle');
const liveTimer = document.getElementById('liveTimer');
const roundCount = document.getElementById('roundCount');
const scoreTable = document.getElementById('scoreTable');
const addRoundBtn = document.getElementById('addRoundBtn');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const newGameBtn = document.getElementById('newGameBtn');
const finishGameBtn = document.getElementById('finishGameBtn');

const scoreDialog = document.getElementById('scoreDialog');
const scoreForm = document.getElementById('scoreForm');
const closeDialogBtn = document.getElementById('closeDialogBtn');
const dialogTitle = document.getElementById('dialogTitle');
const scoreValueButton = document.getElementById('scoreValueButton');
const manualEntry = document.getElementById('manualEntry');
const manualScoreInput = document.getElementById('manualScoreInput');

const finishDialog = document.getElementById('finishDialog');
const closeFinishDialogBtn = document.getElementById('closeFinishDialogBtn');
const finishTotalTime = document.getElementById('finishTotalTime');
const finishScores = document.getElementById('finishScores');
const finishRounds = document.getElementById('finishRounds');

let setupPlayers = ['Joueur 1', 'Joueur 2'];
let state = defaultState();
let activeCell = null;
let timerHandle = null;

function defaultState() {
  return {
    started: false,
    gameName: '',
    winnerMode: 'high',
    players: [],
    rounds: [],
    history: [],
    startedAt: null,
    finishedAt: null
  };
}

function createRound(playerCount) {
  return {
    scores: Array(playerCount).fill(null),
    completedAt: null,
    durationSec: null
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.started && Array.isArray(saved.players)) {
      state = {
        ...defaultState(),
        ...saved,
        history: Array.isArray(saved.history) ? saved.history : []
      };
      normalizeState();
      showGame();
      renderGame();
      syncTimer();
      return;
    }
  } catch (_) {}
  renderSetupPlayers();
}

function normalizeState() {
  if (!Array.isArray(state.rounds)) state.rounds = [];
  state.rounds = state.rounds.map(round => {
    if (Array.isArray(round)) {
      return { scores: round, completedAt: null, durationSec: null };
    }
    return {
      scores: Array.isArray(round.scores) ? round.scores : Array(state.players.length).fill(null),
      completedAt: round.completedAt || null,
      durationSec: Number.isFinite(round.durationSec) ? round.durationSec : null
    };
  });
  if (!state.rounds.length && state.players.length) {
    state.rounds = [createRound(state.players.length)];
  }
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
  return String(str).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
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
  const names = [...playersSetup.querySelectorAll('.player-input')].map((input, idx) => input.value.trim() || `Joueur ${idx + 1}`);
  const winnerMode = document.querySelector('input[name="winnerMode"]:checked').value;
  state = {
    started: true,
    gameName: gameNameInput.value.trim() || 'Partie',
    winnerMode,
    players: names,
    rounds: [createRound(names.length)],
    history: [],
    startedAt: Date.now(),
    finishedAt: null
  };
  saveState();
  showGame();
  renderGame();
  syncTimer();
});

function showGame() {
  setupPanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  gameSubtitle.textContent = state.gameName;
}

function pushHistory() {
  state.history.push(deepClone({ rounds: state.rounds, finishedAt: state.finishedAt }));
  if (state.history.length > 50) state.history.shift();
  undoBtn.disabled = state.history.length === 0;
}

function totals() {
  return state.players.map((_, playerIndex) => state.rounds.reduce((sum, round) => sum + (Number(round.scores[playerIndex]) || 0), 0));
}

function ranksFromTotals(ts) {
  const indexed = ts.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => state.winnerMode === 'high' ? b.value - a.value : a.value - b.value);
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

function formatDuration(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

function getElapsedSeconds() {
  if (!state.startedAt) return 0;
  const end = state.finishedAt || Date.now();
  return Math.floor((end - state.startedAt) / 1000);
}

function updateTimerText() {
  liveTimer.textContent = formatDuration(getElapsedSeconds());
}

function syncTimer() {
  if (timerHandle) clearInterval(timerHandle);
  updateTimerText();
  if (state.started && !state.finishedAt) {
    timerHandle = setInterval(updateTimerText, 1000);
  }
}

function getPreviousCompletedAt(roundIndex) {
  for (let i = roundIndex - 1; i >= 0; i--) {
    if (state.rounds[i].completedAt) return state.rounds[i].completedAt;
  }
  return state.startedAt || Date.now();
}

function updateRoundCompletion(roundIndex) {
  const round = state.rounds[roundIndex];
  const isComplete = round.scores.every(score => score !== null && score !== undefined && score !== '');
  if (isComplete && !round.completedAt) {
    const now = Date.now();
    round.completedAt = now;
    round.durationSec = Math.max(0, Math.floor((now - getPreviousCompletedAt(roundIndex)) / 1000));
  }
}

function roundStatusText(round) {
  if (Number.isFinite(round.durationSec)) return formatDuration(round.durationSec);
  return 'en cours';
}

function renderGame() {
  if (!state.started) return;
  gameTitle.textContent = state.gameName || 'Partie';
  gameSubtitle.textContent = state.gameName || 'Partie';
  undoBtn.disabled = !state.history.length;
  updateTimerText();
  roundCount.textContent = `${state.rounds.length} ${state.rounds.length > 1 ? 'manches' : 'manche'}`;
  finishGameBtn.textContent = state.finishedAt ? 'Voir le résumé' : 'Fin de partie';

  const ts = totals();
  const ranks = ranksFromTotals(ts);

  let html = '<thead><tr><th>Manche</th>';
  state.players.forEach((name, i) => {
    html += `<th><div class="player-head"><span class="player-name">${escapeHtml(name)}</span><span class="player-total">${ts[i]} pts</span><span class="rank-badge">${rankLabel(ranks[i])}</span></div></th>`;
  });
  html += '</tr></thead><tbody>';

  state.rounds.forEach((round, r) => {
    html += `<tr><td class="round-label">M${r + 1}<span class="round-time">${roundStatusText(round)}</span></td>`;
    state.players.forEach((_, p) => {
      const val = round.scores[p];
      html += `<td class="score-cell ${val === null ? 'empty-score' : ''}" data-r="${r}" data-p="${p}">${val === null ? '—' : val}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  scoreTable.innerHTML = html;
}

function rankLabel(rank) {
  return rank === 1 ? '1er' : `${rank}e`;
}

addRoundBtn.addEventListener('click', () => {
  const lastRound = state.rounds[state.rounds.length - 1];
  if (lastRound && lastRound.scores.some(score => score === null)) {
    alert('Termine d’abord la manche en cours avant d’en ajouter une nouvelle.');
    return;
  }
  pushHistory();
  state.rounds.push(createRound(state.players.length));
  state.finishedAt = null;
  saveState();
  renderGame();
  syncTimer();
  requestAnimationFrame(() => {
    const scroll = document.getElementById('scoreScroll');
    scroll.scrollTop = scroll.scrollHeight;
  });
});

scoreTable.addEventListener('click', e => {
  const cell = e.target.closest('.score-cell');
  if (!cell) return;
  activeCell = { r: Number(cell.dataset.r), p: Number(cell.dataset.p) };
  openScoreDialog();
});

function openScoreDialog() {
  const { r, p } = activeCell;
  const round = state.rounds[r];
  dialogTitle.textContent = `${state.players[p]} · Manche ${r + 1}`;
  const value = round.scores[p] ?? 0;
  scoreValueButton.textContent = value;
  manualScoreInput.value = value;
  manualEntry.classList.add('hidden');
  scoreDialog.showModal();
}

function setPreviewValue(value) {
  const normalized = Math.trunc(Number(value) || 0);
  scoreValueButton.textContent = normalized;
  manualScoreInput.value = normalized;
}

function commitActiveScore() {
  if (!activeCell) return;
  pushHistory();
  const round = state.rounds[activeCell.r];
  round.scores[activeCell.p] = Math.trunc(Number(manualScoreInput.value !== '' ? manualScoreInput.value : scoreValueButton.textContent) || 0);
  updateRoundCompletion(activeCell.r);
  saveState();
  renderGame();
}

scoreDialog.addEventListener('click', e => {
  const deltaBtn = e.target.closest('[data-delta]');
  if (!deltaBtn) return;
  const delta = Number(deltaBtn.dataset.delta);
  const current = Number(scoreValueButton.textContent) || 0;
  setPreviewValue(current + delta);
});

scoreValueButton.addEventListener('click', () => {
  manualEntry.classList.toggle('hidden');
  if (!manualEntry.classList.contains('hidden')) {
    manualScoreInput.focus();
    manualScoreInput.select();
  }
});

manualScoreInput.addEventListener('input', () => {
  if (manualScoreInput.value === '' || manualScoreInput.value === '-') return;
  setPreviewValue(manualScoreInput.value);
});

manualScoreInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    scoreForm.requestSubmit();
  }
});

closeDialogBtn.addEventListener('click', () => scoreDialog.close());
scoreForm.addEventListener('submit', e => {
  e.preventDefault();
  commitActiveScore();
  scoreDialog.close();
});

undoBtn.addEventListener('click', () => {
  const previous = state.history.pop();
  if (!previous) return;
  state.rounds = previous.rounds;
  state.finishedAt = previous.finishedAt || null;
  saveState();
  renderGame();
  syncTimer();
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Réinitialiser les scores et le temps de cette partie ?')) return;
  pushHistory();
  state.rounds = [createRound(state.players.length)];
  state.startedAt = Date.now();
  state.finishedAt = null;
  saveState();
  renderGame();
  syncTimer();
});

function openFinishDialog() {
  const totalScores = totals();
  const ranks = ranksFromTotals(totalScores);
  finishTotalTime.textContent = formatDuration(getElapsedSeconds());

  finishScores.innerHTML = '';
  state.players
    .map((name, index) => ({ name, score: totalScores[index], rank: ranks[index] }))
    .sort((a, b) => a.rank - b.rank || (state.winnerMode === 'high' ? b.score - a.score : a.score - b.score))
    .forEach(item => {
      const row = document.createElement('div');
      row.className = 'finish-item';
      row.innerHTML = `<div><strong>${escapeHtml(item.name)}</strong><small>${rankLabel(item.rank)}</small></div><strong>${item.score} pts</strong>`;
      finishScores.appendChild(row);
    });

  finishRounds.innerHTML = '';
  state.rounds.forEach((round, index) => {
    const row = document.createElement('div');
    row.className = 'finish-item';
    row.innerHTML = `<div><strong>Manche ${index + 1}</strong><small>${round.scores.map(score => score ?? '—').join(' · ')}</small></div><strong>${roundStatusText(round)}</strong>`;
    finishRounds.appendChild(row);
  });

  finishDialog.showModal();
}

finishGameBtn.addEventListener('click', () => {
  if (!state.finishedAt) {
    const answer = confirm('Clôturer la partie et afficher le résumé final ?');
    if (!answer) return;
    pushHistory();
    state.finishedAt = Date.now();
    saveState();
    renderGame();
    syncTimer();
  }
  openFinishDialog();
});

closeFinishDialogBtn.addEventListener('click', () => finishDialog.close());
finishDialog.addEventListener('click', e => {
  const rect = finishDialog.getBoundingClientRect();
  const clickedInDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
  if (!clickedInDialog) finishDialog.close();
});

newGameBtn.addEventListener('click', () => {
  if (state.started && !confirm('Créer une nouvelle partie ? La partie actuelle sera remplacée.')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  setupPlayers = ['Joueur 1', 'Joueur 2'];
  gameNameInput.value = '';
  document.querySelector('input[name="winnerMode"][value="high"]').checked = true;
  renderSetupPlayers();
  gamePanel.classList.add('hidden');
  setupPanel.classList.remove('hidden');
  gameSubtitle.textContent = 'Nouvelle partie';
  if (timerHandle) clearInterval(timerHandle);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

loadState();
