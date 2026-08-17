// エントリーポイント：ゲームループとステージ管理
import { STAGES } from './stages.js';
import * as ui from './ui.js';

const gameState = {
  stageIndex: 0,
  stageDef: null,
  stageRuntime: {},
  playing: false,
  speed: 1,
  unlockedCount: 1,
  completed: false,
};

// 進捗の保存（localStorageが使えない環境では保存せずに動作する）
const STORAGE_KEY = 'algo-quest-progress';

function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!data || typeof data.unlockedCount !== 'number' || typeof data.stageIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function saveProgress() {
  if (devUnlockAll) return; // 検証用アンロックは保存しない
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      unlockedCount: gameState.unlockedCount,
      stageIndex: gameState.stageIndex,
    }));
  } catch {
    // プライベートモード等で保存できない場合は今回のセッション内のみ有効
  }
}

// 検証用: URLに ?all を付けると全ステージのロックを解除する（例: index.html?all）
const devUnlockAll = new URLSearchParams(location.search).has('all');
const savedProgress = devUnlockAll ? null : loadProgress();
if (devUnlockAll) {
  gameState.unlockedCount = STAGES.length;
} else if (savedProgress) {
  // 全ステージクリア時は unlockedCount が STAGES.length + 1 になる
  gameState.unlockedCount = Math.min(Math.max(savedProgress.unlockedCount, 1), STAGES.length + 1);
}

const visualEl = document.getElementById('visual-stage');
const actionsEl = document.getElementById('stage-actions');

function render() {
  ui.renderStageVisual(visualEl, gameState.stageDef, gameState, API);
  ui.renderStatusBox(gameState.stageDef, gameState);
}

const API = {
  log(message, cls) { ui.appendLog(message, cls); },
  render,
  refreshActions() {
    ui.renderStageActions(actionsEl, gameState.stageDef, gameState, API);
  },
  setStatus(text, cls) { ui.setMissionStatus(text, cls); },
  completeStage() {
    if (gameState.completed) return;
    gameState.completed = true;
    gameState.unlockedCount = Math.max(gameState.unlockedCount, gameState.stageIndex + 2);
    saveProgress();
    ui.renderStageNav(STAGES, gameState, loadStage);
  },
  goToNextStage() {
    const nextIndex = gameState.stageIndex + 1;
    if (nextIndex < STAGES.length && nextIndex <= gameState.unlockedCount - 1) {
      loadStage(nextIndex);
    } else if (nextIndex >= STAGES.length && gameState.completed) {
      ui.renderEnding(() => {
        gameState.unlockedCount = 1;
        saveProgress();
        loadStage(0);
      });
    }
  },
};

function loadStage(index) {
  if (index > gameState.unlockedCount - 1) return;
  ui.hideEnding();
  const def = STAGES[index];
  const built = def.build();

  gameState.stageIndex = index;
  gameState.stageDef = def;
  gameState.stageRuntime = built.runtime;
  gameState.playing = false;
  gameState.completed = false;
  saveProgress();

  ui.clearLog();
  ui.renderCompareBox('');
  ui.renderDialogue(def);
  ui.renderMissionBanner(def);
  ui.renderStageNav(STAGES, gameState, loadStage);
  ui.renderStageActions(actionsEl, def, gameState, API);
  ui.renderBookRecommend();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' }); // 新しいステージの会話が目に入るように
}

document.getElementById('btn-play').addEventListener('click', () => { gameState.playing = true; });
document.getElementById('btn-pause').addEventListener('click', () => { gameState.playing = false; });
document.getElementById('btn-step-anim').addEventListener('click', () => {
  if (gameState.stageDef.stepOnce) gameState.stageDef.stepOnce(gameState, API);
});
document.getElementById('speed-slider').addEventListener('input', (ev) => {
  gameState.speed = parseFloat(ev.target.value);
});
document.getElementById('btn-reset').addEventListener('click', () => {
  loadStage(gameState.stageIndex);
});

function toggleSidebar() {
  document.getElementById('app-shell').classList.toggle('side-collapsed');
}
document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
document.getElementById('head-nav-toggle').addEventListener('click', toggleSidebar);
document.getElementById('side-backdrop').addEventListener('click', () => {
  document.getElementById('app-shell').classList.add('side-collapsed');
});

let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min((now - lastTick) / 1000, 0.25);
  lastTick = now;
  if (gameState.playing && gameState.stageDef?.tick) {
    gameState.stageDef.tick(gameState, dt, gameState.speed, API);
  }
}, 16);

// 前回の続きから再開（保存が無ければ第1章から）
const initialStage = savedProgress
  ? Math.max(0, Math.min(savedProgress.stageIndex, gameState.unlockedCount - 1, STAGES.length - 1))
  : 0;
loadStage(initialStage);
