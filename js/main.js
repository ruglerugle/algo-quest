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

// 検証用: URLに ?all を付けると全ステージのロックを解除する（例: index.html?all）
if (new URLSearchParams(location.search).has('all')) {
  gameState.unlockedCount = STAGES.length;
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
    ui.renderStageNav(STAGES, gameState, loadStage);
  },
};

function loadStage(index) {
  if (index > gameState.unlockedCount - 1) return;
  const def = STAGES[index];
  const built = def.build();

  gameState.stageIndex = index;
  gameState.stageDef = def;
  gameState.stageRuntime = built.runtime;
  gameState.playing = false;
  gameState.completed = false;

  ui.clearLog();
  ui.renderCompareBox('');
  ui.renderDialogue(def);
  ui.renderMissionBanner(def);
  ui.renderStageNav(STAGES, gameState, loadStage);
  ui.renderStageActions(actionsEl, def, gameState, API);
  render();
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

let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min((now - lastTick) / 1000, 0.25);
  lastTick = now;
  if (gameState.playing && gameState.stageDef?.tick) {
    gameState.stageDef.tick(gameState, dt, gameState.speed, API);
  }
}, 16);

loadStage(0);
