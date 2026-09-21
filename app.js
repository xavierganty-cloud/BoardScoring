const STORAGE_KEY = 'boardscoring-state-v4';
const DEFAULT_PLAYER_COLORS = [
  '#d74a42', '#3f7cff', '#35a167', '#f2a72f', '#9a5cff', '#ec6da6',
  '#14a3a6', '#a96934', '#5ab0f5', '#95b82c', '#ff7d54', '#7d8b99'
];

const welcomeScreen = document.getElementById('welcomeScreen');
const setupScreen = document.getElementById('setupScreen');
const gamePanel = document.getElementById('gamePanel');
const launchSetupBtn = document.getElementById('launchSetupBtn');
const backHomeBtn = document.getElementById('backHomeBtn');
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
const finishWinner = document.getElementById('finishWinner');
const finishWinnerScore = document.getElementById('finishWinnerScore');
const finishScores = document.getElementById('finishScores');
const finishRounds = document.getElementById('finishRounds');
const toggleDetailsBtn = document.getElementById('toggleDetailsBtn');
const detailsPanel = document.getElementById('detailsPanel');

let setupPlayers = ['Joueur 1', 'Joueur 2'];
let setupColors = DEFAULT_PLAYER_COLORS.slice(0, 2);
let state = defaultState();
let activeCell = null;
let timerHandle = null;

function defaultState() {
  return {
    started: false,
    gameName: '',
    winnerMode: 'high',
    players: [],
    playerColors: [],
    rounds: [],
    history: [],
    startedAt: null,
    finishedAt: null,
    paused: false,
    pausedAt: null,
    pausedTotalMs: 0
  };
}

function createRound(playerCount) {
  return {
    scores: Array(playerCount).fill(null),
    completedAt: null,
    completedElapsedSec: null,
    durationSec: null
  };
}

function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function showWelcome() {
  welcomeScreen.classList.remove('hidden');
  setupScreen.classList.add('hidden');
  gamePanel.classList.add('hidden');
}
function showSetup() {
  welcomeScreen.classList.add('hidden');
  setupScreen.classList.remove('hidden');
  gamePanel.classList.add('hidden');
}
function showGame() {
  welcomeScreen.classList.add('hidden');
  setupScreen.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  gameSubtitle.textContent = state.gameName;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function hexToRgba(hex, alpha = 1) {
  const safe = (hex || '#888888').replace('#', '');
  const expanded = safe.length === 3 ? safe.split('').map(x => x + x).join('') : safe.padEnd(6, '0').slice(0, 6);
  const int = parseInt(expanded, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function readableAccent(hex) {
  const safe = (hex || '#888888').replace('#', '');
  const expanded = safe.length === 3 ? safe.split('').map(x => x + x).join('') : safe.padEnd(6, '0').slice(0, 6);
  const int = parseInt(expanded, 16);
  let r = (int >> 16) & 255;
  let g = (int >> 8) & 255;
  let b = int & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance >= 0.42) return `rgb(${r}, ${g}, ${b})`;
  const mix = luminance < 0.12 ? 0.72 : 0.52;
  r = Math.round(r + (255 - r) * mix);
  g = Math.round(g + (255 - g) * mix);
  b = Math.round(b + (255 - b) * mix);
  return `rgb(${r}, ${g}, ${b})`;
}

function normalizeState() {
  if (!Array.isArray(state.rounds)) state.rounds = [];
  state.rounds = state.rounds.map(round => {
    if (Array.isArray(round)) return { scores: round, completedAt: null, completedElapsedSec: null, durationSec: null };
    return {
      scores: Array.isArray(round.scores) ? round.scores : Array(state.players.length).fill(null),
      completedAt: round.completedAt || null,
      completedElapsedSec: Number.isFinite(round.completedElapsedSec) ? round.completedElapsedSec : null,
      durationSec: Number.isFinite(round.durationSec) ? round.durationSec : null
    };
  });
  if (!state.rounds.length && state.players.length) state.rounds = [createRound(state.players.length)];
  if (!Array.isArray(state.playerColors) || state.playerColors.length !== state.players.length) {
    state.playerColors = state.players.map((_, i) => DEFAULT_PLAYER_COLORS[i % DEFAULT_PLAYER_COLORS.length]);
  }
  if (typeof state.paused !== 'boolean') state.paused = false;
  if (!Number.isFinite(state.pausedTotalMs)) state.pausedTotalMs = 0;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.started && Array.isArray(saved.players)) {
      state = { ...defaultState(), ...saved, history: Array.isArray(saved.history) ? saved.history : [] };
      normalizeState();
      showGame();
      renderGame();
      syncTimer();
      return;
    }
  } catch (_) {}
  renderSetupPlayers();
  showWelcome();
}

function renderSetupPlayers() {
  playersSetup.innerHTML = '';
  setupPlayers.forEach((name, index) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <span class="player-index">${index + 1}</span>
      <input class="player-input" data-index="${index}" maxlength="24" value="${escapeHtml(name)}" aria-label="Nom du joueur ${index + 1}" />
      <div class="player-color-wrap"><input class="player-color-input" type="color" value="${setupColors[index]}" data-color-index="${index}" aria-label="Couleur du joueur ${index + 1}" /></div>
      <button class="remove-player" data-remove="${index}" aria-label="Supprimer le joueur ${index + 1}">×</button>`;
    playersSetup.appendChild(row);
  });
  playerCount.textContent = `${setupPlayers.length} / 12`;
  addPlayerBtn.disabled = setupPlayers.length >= 12;
  [...playersSetup.querySelectorAll('[data-remove]')].forEach(btn => btn.disabled = setupPlayers.length <= 2);
}

playersSetup.addEventListener('input', e => {
  if (e.target.matches('.player-input')) {
    setupPlayers[Number(e.target.dataset.index)] = e.target.value;
  }
  if (e.target.matches('.player-color-input')) {
    setupColors[Number(e.target.dataset.colorIndex)] = e.target.value;
  }
});

playersSetup.addEventListener('click', e => {
  const btn = e.target.closest('[data-remove]');
  if (!btn || setupPlayers.length <= 2) return;
  const idx = Number(btn.dataset.remove);
  setupPlayers.splice(idx, 1);
  setupColors.splice(idx, 1);
  renderSetupPlayers();
});

addPlayerBtn.addEventListener('click', () => {
  if (setupPlayers.length >= 12) return;
  setupPlayers.push(`Joueur ${setupPlayers.length + 1}`);
  setupColors.push(DEFAULT_PLAYER_COLORS[setupColors.length % DEFAULT_PLAYER_COLORS.length]);
  renderSetupPlayers();
  setTimeout(() => playersSetup.querySelector('.player-input:last-of-type')?.focus(), 0);
});

launchSetupBtn.addEventListener('click', showSetup);
backHomeBtn.addEventListener('click', showWelcome);

startGameBtn.addEventListener('click', () => {
  const names = [...playersSetup.querySelectorAll('.player-input')].map((input, idx) => input.value.trim() || `Joueur ${idx + 1}`);
  const colors = [...playersSetup.querySelectorAll('.player-color-input')].map((input, idx) => input.value || DEFAULT_PLAYER_COLORS[idx % DEFAULT_PLAYER_COLORS.length]);
  const winnerMode = document.querySelector('input[name="winnerMode"]:checked').value;
  state = {
    started: true,
    gameName: gameNameInput.value.trim() || 'Partie',
    winnerMode,
    players: names,
    playerColors: colors,
    rounds: [createRound(names.length)],
    history: [],
    startedAt: Date.now(),
    finishedAt: null,
    paused: false,
    pausedAt: null,
    pausedTotalMs: 0
  };
  saveState();
  showGame();
  renderGame();
  syncTimer();
});

function pushHistory() {
  state.history.push(deepClone({
    rounds: state.rounds,
    finishedAt: state.finishedAt,
    paused: state.paused,
    pausedAt: state.pausedAt,
    pausedTotalMs: state.pausedTotalMs,
    playerColors: state.playerColors
  }));
  if (state.history.length > 60) state.history.shift();
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
function rankLabel(rank) { return rank === 1 ? '1er' : `${rank}e`; }
function formatDuration(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}
function getElapsedMs() {
  if (!state.startedAt) return 0;
  const end = state.finishedAt || (state.paused ? state.pausedAt : Date.now());
  return Math.max(0, end - state.startedAt - (state.pausedTotalMs || 0));
}
function getElapsedSeconds() { return Math.floor(getElapsedMs() / 1000); }
function updateTimerText() { liveTimer.textContent = formatDuration(getElapsedSeconds()); }
function getPreviousCompletedSec(roundIndex) {
  for (let i = roundIndex - 1; i >= 0; i--) {
    if (Number.isFinite(state.rounds[i].completedElapsedSec)) return state.rounds[i].completedElapsedSec;
  }
  return 0;
}
function getRoundDurationDisplay(roundIndex) {
  const round = state.rounds[roundIndex];
  if (Number.isFinite(round.durationSec)) return formatDuration(round.durationSec);
  const elapsed = getElapsedSeconds();
  const prev = getPreviousCompletedSec(roundIndex);
  return formatDuration(Math.max(0, elapsed - prev));
}
function updateLiveRoundTimes() {
  document.querySelectorAll('[data-round-time]').forEach(el => {
    const index = Number(el.dataset.roundTime);
    el.textContent = getRoundDurationDisplay(index);
  });
}
function syncTimer() {
  if (timerHandle) clearInterval(timerHandle);
  updateTimerText();
  updateLiveRoundTimes();
  if (state.started && !state.finishedAt && !state.paused) {
    timerHandle = setInterval(() => {
      updateTimerText();
      updateLiveRoundTimes();
    }, 1000);
  }
}
function pauseTimer() {
  if (!state.started || state.finishedAt || state.paused) return;
  state.paused = true;
  state.pausedAt = Date.now();
  saveState();
  syncTimer();
}
function resumeTimer() {
  if (!state.started || state.finishedAt || !state.paused) return;
  state.pausedTotalMs += Date.now() - state.pausedAt;
  state.paused = false;
  state.pausedAt = null;
  saveState();
  syncTimer();
}

function updateRoundCompletion(roundIndex) {
  const round = state.rounds[roundIndex];
  const isComplete = round.scores.every(score => score !== null && score !== undefined && score !== '');
  if (!isComplete) {
    round.completedAt = null;
    round.completedElapsedSec = null;
    round.durationSec = null;
    return;
  }
  const elapsedSec = getElapsedSeconds();
  round.completedAt = Date.now();
  round.completedElapsedSec = elapsedSec;
  round.durationSec = Math.max(0, elapsedSec - getPreviousCompletedSec(roundIndex));
}

function renderGame() {
  if (!state.started) return;
  gameTitle.textContent = state.gameName || 'Partie';
  gameSubtitle.textContent = state.gameName || 'Partie';
  undoBtn.disabled = !state.history.length;
  updateTimerText();
  roundCount.textContent = `${state.rounds.length} ${state.rounds.length > 1 ? 'manches' : 'manche'}`;

  const ts = totals();
  const ranks = ranksFromTotals(ts);
  let html = '<thead><tr><th>Manche</th>';
  state.players.forEach((name, i) => {
    const color = state.playerColors[i] || DEFAULT_PLAYER_COLORS[i % DEFAULT_PLAYER_COLORS.length];
    const readable = readableAccent(color);
    const soft = hexToRgba(color, .16);
    html += `<th style="background:linear-gradient(180deg, ${soft}, rgba(28,33,39,.98)); box-shadow: inset 0 4px 0 ${color};"><div class="player-head"><span class="player-dot" style="background:${color}"></span><span class="player-name">${escapeHtml(name)}</span><span class="player-total" style="color:${readable}">${ts[i]} pts</span><span class="rank-badge">${rankLabel(ranks[i])}</span></div></th>`;
  });
  html += '</tr></thead><tbody>';

  state.rounds.forEach((round, r) => {
    html += `<tr><td class="round-label">${r + 1}<span class="round-time" data-round-time="${r}">${getRoundDurationDisplay(r)}</span></td>`;
    state.players.forEach((_, p) => {
      const val = round.scores[p];
      const color = state.playerColors[p] || DEFAULT_PLAYER_COLORS[p % DEFAULT_PLAYER_COLORS.length];
      const soft = hexToRgba(color, .13);
      html += `<td class="score-cell ${val === null ? 'empty-score' : ''}" data-r="${r}" data-p="${p}" style="--cell-soft:${soft};"><span>${val === null ? '—' : val}</span></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  scoreTable.innerHTML = html;
}

addRoundBtn.addEventListener('click', () => {
  const lastRound = state.rounds[state.rounds.length - 1];
  if (lastRound && lastRound.scores.some(score => score === null)) {
    alert('Termine d’abord la manche en cours avant de passer à la suivante.');
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
  pauseTimer();
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
scoreDialog.addEventListener('close', () => { if (!state.finishedAt) resumeTimer(); });

undoBtn.addEventListener('click', () => {
  const previous = state.history.pop();
  if (!previous) return;
  state.rounds = previous.rounds;
  state.finishedAt = previous.finishedAt || null;
  state.paused = previous.paused || false;
  state.pausedAt = previous.pausedAt || null;
  state.pausedTotalMs = previous.pausedTotalMs || 0;
  state.playerColors = previous.playerColors || state.playerColors;
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
  state.paused = false;
  state.pausedAt = null;
  state.pausedTotalMs = 0;
  saveState();
  renderGame();
  syncTimer();
});

function openFinishDialog() {
  const totalScores = totals();
  const ranks = ranksFromTotals(totalScores);
  const players = state.players.map((name, index) => ({
    name,
    score: totalScores[index],
    rank: ranks[index],
    color: state.playerColors[index] || DEFAULT_PLAYER_COLORS[index % DEFAULT_PLAYER_COLORS.length]
  }));
  players.sort((a, b) => a.rank - b.rank || (state.winnerMode === 'high' ? b.score - a.score : a.score - b.score));

  finishTotalTime.textContent = formatDuration(getElapsedSeconds());
  finishWinner.textContent = players[0] ? players[0].name : '—';
  finishWinnerScore.textContent = players[0] ? `${players[0].score} pts` : '— pts';
  if (players[0]) finishWinner.style.color = readableAccent(players[0].color);

  finishScores.innerHTML = '';
  players.forEach(item => {
    const row = document.createElement('div');
    row.className = 'finish-item';
    row.style.setProperty('--rank-color', item.color);
    const readable = readableAccent(item.color);
    row.innerHTML = `<div class="rank-left"><span class="rank-number">${item.rank}</span><div class="rank-name"><strong style="color:${readable}">${escapeHtml(item.name)}</strong><small>${rankLabel(item.rank)}</small></div></div><span class="rank-score">${item.score} pts</span>`;
    finishScores.appendChild(row);
  });

  finishRounds.innerHTML = '';
  state.rounds.forEach((round, index) => {
    const scoresText = round.scores.map((score, playerIdx) => `${state.players[playerIdx]}: ${score ?? '—'}`).join(' · ');
    const row = document.createElement('div');
    row.className = 'finish-item';
    row.innerHTML = `<div><strong>Manche ${index + 1}</strong><small>${escapeHtml(scoresText)}</small></div><strong>${getRoundDurationDisplay(index)}</strong>`;
    finishRounds.appendChild(row);
  });

  detailsPanel.classList.add('hidden');
  toggleDetailsBtn.textContent = 'Voir les détails de la partie';
  finishDialog.showModal();
}

finishGameBtn.addEventListener('click', () => {
  if (!state.finishedAt) {
    const answer = confirm('Clôturer la partie et afficher le résumé final ?');
    if (!answer) return;
    pushHistory();
    if (state.paused) {
      state.pausedTotalMs += Date.now() - state.pausedAt;
      state.paused = false;
      state.pausedAt = null;
    }
    state.finishedAt = Date.now();
    saveState();
    renderGame();
    syncTimer();
  }
  openFinishDialog();
});

closeFinishDialogBtn.addEventListener('click', () => finishDialog.close());
toggleDetailsBtn.addEventListener('click', () => {
  detailsPanel.classList.toggle('hidden');
  toggleDetailsBtn.textContent = detailsPanel.classList.contains('hidden') ? 'Voir les détails de la partie' : 'Masquer les détails';
});
finishDialog.addEventListener('click', e => {
  const rect = finishDialog.getBoundingClientRect();
  const clickedInDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
  if (!clickedInDialog) finishDialog.close();
});

function resetToSetup() {
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  setupPlayers = ['Joueur 1', 'Joueur 2'];
  setupColors = DEFAULT_PLAYER_COLORS.slice(0, 2);
  gameNameInput.value = '';
  document.querySelector('input[name="winnerMode"][value="high"]').checked = true;
  renderSetupPlayers();
  if (timerHandle) clearInterval(timerHandle);
  showSetup();
}
newGameBtn.addEventListener('click', () => {
  if (state.started && !confirm('Créer une nouvelle partie ? La partie actuelle sera remplacée.')) return;
  resetToSetup();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

loadState();
