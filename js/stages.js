// 各ステージの定義とロジック
import { generateVillagers } from './villagers.js';
import {
  createLinearRuntime, linearStep,
  createBinaryRuntime, binaryStep,
  createBubbleRuntime, bubbleStep,
  computeQuickSortEvents,
} from './algorithms.js';
import { escapeHtml } from './ui.js';

/** 一定間隔(秒)ごとにstepFnを1回呼ぶ、再生/一時停止共通の自動進行ヘルパー */
function tickAtInterval(state, dt, speed, api, intervalSeconds, isDone, stepFn) {
  const rt = state.stageRuntime;
  if (isDone(rt)) return;
  rt._accum = (rt._accum ?? 0) + dt * speed;
  while (rt._accum >= intervalSeconds && !isDone(rt)) {
    stepFn(state, api);
    rt._accum -= intervalSeconds;
  }
  if (isDone(rt)) state.playing = false;
}

// ============================================================
// ステージ0: 線形探索
// ============================================================

const LINEAR_PHASES = [
  { n: 100, mode: 'grid' },
  { n: 1000, mode: 'grid' },
  { n: 10000, mode: 'auto' },
  { n: 100000, mode: 'auto' },
];

function buildLinearPhase(phaseIdx) {
  const phaseDef = LINEAR_PHASES[phaseIdx];
  const target = 'アリス';
  const villagers = generateVillagers(phaseDef.n, { target });
  return {
    phaseIdx,
    phaseDef,
    target,
    villagers,
    linear: createLinearRuntime(villagers, target),
    autoBatch: Math.max(1, Math.round(phaseDef.n / 400)),
  };
}

function doLinearCheck(state, api) {
  const rt = state.stageRuntime;
  const result = linearStep(rt.linear);
  if (!result) return;
  if (result.exhausted) {
    api.log('名簿の最後まで確認しましたが見つかりませんでした…おかしいですね。', 'err');
  } else {
    const v = rt.villagers[result.checkedIndex];
    api.log(`${result.checkedIndex + 1}人目「${v.name}」を確認…${result.matched ? '発見！' : '違いました。'}`, result.matched ? 'ok' : '');
    if (result.matched) {
      api.setStatus(`${rt.target}さんを発見！ 比較回数: ${rt.linear.operations}回`, 'ok');
    }
  }
  api.refreshActions();
  api.render();
}

function advanceLinearPhase(state, api) {
  const rt = state.stageRuntime;
  const nextIdx = rt.phaseIdx + 1;
  if (nextIdx >= LINEAR_PHASES.length) {
    api.completeStage();
    api.log('お見事！これだけの人数を毎回手作業で探すのは限界です。次は「並べ替え」と「半分に絞り込む」技を身につけましょう。', 'ok');
    api.render();
    return;
  }
  state.playing = false;
  state.stageRuntime = buildLinearPhase(nextIdx);
  api.log(`依頼：村人${LINEAR_PHASES[nextIdx].n.toLocaleString()}人の中から${state.stageRuntime.target}さんを探してください。`);
  api.refreshActions();
  api.render();
}

function tickLinear(state, dt, speed, api) {
  const rt = state.stageRuntime;
  if (rt.linear.found || rt.linear.exhausted) return;
  const steps = Math.max(1, Math.round(rt.autoBatch * speed));
  advanceLinearAuto(state, api, steps);
}

function advanceLinearAuto(state, api, steps) {
  const rt = state.stageRuntime;
  for (let i = 0; i < steps; i += 1) {
    const result = linearStep(rt.linear);
    if (!result || result.matched || result.exhausted) break;
  }
  if (rt.linear.found) {
    const manualHours = (rt.linear.operations * 3) / 3600;
    api.log(`発見！比較回数: ${rt.linear.operations.toLocaleString()}回。もし1件3秒で手作業チェックしていたら約${manualHours.toFixed(1)}時間かかっていました。`, 'ok');
    api.setStatus(`発見！比較回数 ${rt.linear.operations.toLocaleString()}回`, 'ok');
    state.playing = false;
    api.refreshActions();
  } else if (rt.linear.exhausted) {
    api.log('見つかりませんでした。', 'err');
    state.playing = false;
  }
  api.render();
}

function renderLinearVisual(container, state, api) {
  const rt = state.stageRuntime;
  container.innerHTML = '';

  const info = document.createElement('div');
  info.className = 'stage-info';
  info.textContent = `対象: ${rt.target}さん / 村人数: ${rt.villagers.length.toLocaleString()}人（順不同）`;
  container.appendChild(info);

  if (rt.phaseDef.mode === 'auto') {
    const scan = document.createElement('div');
    scan.className = 'auto-scan-line';
    const idx = rt.linear.pointer;
    const current = idx >= 0 && idx < rt.villagers.length ? rt.villagers[idx] : null;
    scan.innerHTML = current
      ? `<span class="scan-index">#${(idx + 1).toLocaleString()}</span><span class="scan-name">${escapeHtml(current.name)}</span>`
      : '<span class="hint">下の「再生」ボタンで捜索を開始してください</span>';
    container.appendChild(scan);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'villager-grid';
  rt.villagers.forEach((v, i) => {
    const card = document.createElement('button');
    card.className = 'villager-card';
    card.textContent = v.name;
    if (i < rt.linear.pointer || (i === rt.linear.pointer && !rt.linear.found)) card.classList.add('checked');
    if (i === rt.linear.pointer && rt.linear.found) card.classList.add('found');
    if (i === rt.linear.pointer + 1 && !rt.linear.found && !rt.linear.exhausted) {
      card.classList.add('next');
      card.addEventListener('click', () => doLinearCheck(state, api));
    } else {
      card.disabled = true;
    }
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

function renderLinearActions(container, state, api) {
  const rt = state.stageRuntime;
  if (rt.phaseDef.mode !== 'auto') {
    const btn = document.createElement('button');
    btn.textContent = '次の村人を確認する';
    btn.disabled = rt.linear.found || rt.linear.exhausted;
    btn.addEventListener('click', () => doLinearCheck(state, api));
    container.appendChild(btn);
  }
  if (rt.linear.found || rt.linear.exhausted) {
    const next = document.createElement('button');
    const isLast = rt.phaseIdx >= LINEAR_PHASES.length - 1;
    next.className = 'primary';
    next.textContent = isLast ? 'ステージクリア！' : `次の依頼へ（村人${LINEAR_PHASES[rt.phaseIdx + 1].n.toLocaleString()}人）`;
    next.addEventListener('click', () => advanceLinearPhase(state, api));
    container.appendChild(next);
  }
}

const STAGE_LINEAR = {
  navLabel: '①線形探索',
  title: '第1章 名簿の村 ― 線形探索 ―',
  missionText: 'アリスさんを名簿の先頭から1人ずつ確認して見つけ出そう。',
  dialogue: [
    { who: '村長', text: '物流エンジニアさん、村人のアリスさんに荷物を届けてほしいのです。名簿から探してもらえますか？' },
    { who: 'あなた', text: 'わかりました。1人ずつ確認していきますね。' },
  ],
  build() {
    return { runtime: buildLinearPhase(0) };
  },
  renderVisual: renderLinearVisual,
  renderActions: renderLinearActions,
  tick: tickLinear,
  stepOnce: (state, api) => advanceLinearAuto(state, api, 1),
  statusInfo: (state) => ({
    name: '線形探索 (Linear Search)',
    complexity: '最悪 O(N)',
    operations: state.stageRuntime.linear.operations.toLocaleString(),
  }),
};

// ============================================================
// ステージ1: 二分探索
// ============================================================

function buildBinaryRuntime() {
  const target = 'サキ';
  const villagers = generateVillagers(1000, { target, sorted: true });
  return {
    target,
    villagers,
    binary: createBinaryRuntime(villagers, target),
    linearEquivalent: Math.ceil(villagers.length / 2),
  };
}

function doBinaryCheck(state, api) {
  const rt = state.stageRuntime;
  const result = binaryStep(rt.binary);
  if (!result) return;
  if (result.exhausted) {
    api.log('範囲が無くなりました…名簿に見当たらないようです。', 'err');
  } else if (result.found) {
    const v = rt.villagers[result.mid];
    api.log(`中央「${v.name}」…一致！発見しました！（比較${rt.binary.operations}回）`, 'ok');
    api.setStatus(`発見！比較回数 ${rt.binary.operations}回`, 'ok');
  } else {
    const v = rt.villagers[result.mid];
    if (result.cmp < 0) {
      api.log(`中央「${v.name}」…探している${rt.target}さんは五十音順で手前です。左半分に絞ります。`);
    } else {
      api.log(`中央「${v.name}」…探している${rt.target}さんは五十音順で後ろです。右半分に絞ります。`);
    }
  }
  api.refreshActions();
  api.render();
}

function renderBinaryVisual(container, state) {
  const rt = state.stageRuntime;
  const b = rt.binary;
  container.innerHTML = '';

  const info = document.createElement('div');
  info.className = 'stage-info';
  const rangeSize = b.found || b.exhausted ? 0 : b.hi - b.lo + 1;
  info.textContent = `対象: ${rt.target}さん / 名簿は${rt.villagers.length.toLocaleString()}人（五十音順）/ 現在の有効範囲: ${rangeSize.toLocaleString()}人`;
  container.appendChild(info);

  const track = document.createElement('div');
  track.className = 'binary-track';
  const showIdx = (idx, label, cls) => {
    if (idx < 0 || idx >= rt.villagers.length) return;
    const card = document.createElement('div');
    card.className = `binary-card ${cls}`;
    card.innerHTML = `<span class="tag">${label}</span><span class="name">${escapeHtml(rt.villagers[idx].name)}</span>`;
    track.appendChild(card);
  };

  if (!b.found && !b.exhausted) {
    const mid = (b.lo + b.hi) >> 1;
    showIdx(b.lo, '左端', 'lo');
    showIdx(mid, '中央', 'mid');
    showIdx(b.hi, '右端', 'hi');
  } else if (b.found) {
    showIdx(b.mid, '発見', 'found');
  }
  container.appendChild(track);
}

function renderBinaryActions(container, state, api) {
  const rt = state.stageRuntime;
  const b = rt.binary;
  if (!b.found && !b.exhausted) {
    const btn = document.createElement('button');
    btn.textContent = '中央を確認する';
    btn.addEventListener('click', () => doBinaryCheck(state, api));
    container.appendChild(btn);
  } else if (b.found) {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'primary';
    clearBtn.textContent = 'ステージクリア！';
    clearBtn.addEventListener('click', () => {
      api.completeStage();
      api.log(`二分探索なら${b.operations}回で発見できました。同じ${rt.villagers.length.toLocaleString()}人を線形探索すると平均${rt.linearEquivalent.toLocaleString()}回かかります。半分ずつ捨てる力、体感できましたね。`, 'ok');
      api.render();
    });
    container.appendChild(clearBtn);
  }
}

const STAGE_BINARY = {
  navLabel: '②二分探索',
  title: '第2章 五十音の名簿 ― 二分探索 ―',
  missionText: '名簿は五十音順に並んでいます。中央から確認し、範囲を半分ずつ絞り込んでサキさんを見つけよう。',
  dialogue: [
    { who: '村長', text: '今度はサキさんへ荷物です。実は名簿を五十音順に並べ直しておきました。' },
    { who: 'あなた', text: '並んでいるなら…端から探さなくても、真ん中から確認すればよさそうですね。' },
  ],
  build() {
    return { runtime: buildBinaryRuntime() };
  },
  renderVisual: renderBinaryVisual,
  renderActions: renderBinaryActions,
  tick: (state, dt, speed, api) => tickAtInterval(
    state, dt, speed, api, 0.5,
    (rt) => rt.binary.found || rt.binary.exhausted,
    doBinaryCheck,
  ),
  stepOnce: doBinaryCheck,
  statusInfo: (state) => ({
    name: '二分探索 (Binary Search)',
    complexity: 'O(log N)',
    operations: state.stageRuntime.binary.operations,
  }),
};

// ============================================================
// ステージ2: バブルソート
// ============================================================

const BUBBLE_PHASES = [
  { n: 10 },
  { n: 24 },
];

function randomValues(n) {
  const arr = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildBubblePhase(phaseIdx) {
  const phaseDef = BUBBLE_PHASES[phaseIdx];
  const values = randomValues(phaseDef.n);
  return { phaseIdx, phaseDef, bubble: createBubbleRuntime(values), lastCompare: null };
}

function renderBars(container, arr, opts = {}) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'bars';
  const maxVal = Math.max(...arr, 1);
  arr.forEach((val, idx) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${(val / maxVal) * 100}%`;
    bar.title = String(val);
    if (opts.compare?.includes(idx)) bar.classList.add('compare');
    if (opts.swap?.includes(idx)) bar.classList.add('swap');
    if (opts.pivot === idx) bar.classList.add('pivot');
    if (opts.sortedFrom !== undefined && idx >= opts.sortedFrom) bar.classList.add('sorted');
    if (opts.allSorted) bar.classList.add('sorted');
    wrap.appendChild(bar);
  });
  container.appendChild(wrap);
}

function doBubbleStep(state, api) {
  const rt = state.stageRuntime;
  const result = bubbleStep(rt.bubble);
  if (!result) return;
  rt.lastCompare = { i: result.i, j: result.j };
  api.log(`${result.i + 1}番目と${result.j + 1}番目を比較…${result.swapped ? '順番を交換しました' : 'そのまま'}`, result.swapped ? 'ok' : '');
  if (rt.bubble.sorted) {
    api.log(`並べ替え完了！比較${rt.bubble.comparisons}回、交換${rt.bubble.swaps}回。`, 'ok');
    api.setStatus(`完了：比較${rt.bubble.comparisons}回`, 'ok');
  }
  api.refreshActions();
  api.render();
}

function advanceBubblePhase(state, api) {
  const rt = state.stageRuntime;
  const nextIdx = rt.phaseIdx + 1;
  if (nextIdx >= BUBBLE_PHASES.length) {
    api.completeStage();
    api.log('お疲れさまでした。荷物がもっと増えると腕がもちません…次はもっと速い「クイックソート」を身につけましょう。', 'ok');
    api.render();
    return;
  }
  state.stageRuntime = buildBubblePhase(nextIdx);
  api.log(`依頼：荷物${BUBBLE_PHASES[nextIdx].n}個をバブルソートで並べ替えてください。`);
  api.refreshActions();
  api.render();
}

function renderBubbleVisual(container, state) {
  const rt = state.stageRuntime;
  const b = rt.bubble;
  container.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'stage-info';
  info.textContent = `荷物${b.arr.length}個 / 比較${b.comparisons}回・交換${b.swaps}回`;
  container.appendChild(info);
  const barsBox = document.createElement('div');
  renderBars(barsBox, b.arr, {
    compare: rt.lastCompare && !b.sorted ? [rt.lastCompare.i, rt.lastCompare.j] : [],
    sortedFrom: b.arr.length - b.sortedTail,
    allSorted: b.sorted,
  });
  container.appendChild(barsBox);
}

function renderBubbleActions(container, state, api) {
  const rt = state.stageRuntime;
  const b = rt.bubble;
  const btn = document.createElement('button');
  btn.textContent = '1手進める（隣同士を比較）';
  btn.disabled = b.sorted;
  btn.addEventListener('click', () => doBubbleStep(state, api));
  container.appendChild(btn);
  if (b.sorted) {
    const next = document.createElement('button');
    next.className = 'primary';
    const isLast = rt.phaseIdx >= BUBBLE_PHASES.length - 1;
    next.textContent = isLast ? 'ステージクリア！' : `次の依頼へ（荷物${BUBBLE_PHASES[rt.phaseIdx + 1].n}個）`;
    next.addEventListener('click', () => advanceBubblePhase(state, api));
    container.appendChild(next);
  }
}

const STAGE_BUBBLE = {
  navLabel: '③バブルソート',
  title: '第3章 荷物の山 ― バブルソート ―',
  missionText: 'バラバラに積まれた荷物を、隣同士の交換だけで並べ替えよう。',
  dialogue: [
    { who: '村長', text: '荷物が届いたのですが、大きさがバラバラで倉庫に収まりません。並べ替えてもらえますか？' },
    { who: 'あなた', text: 'まずは隣同士を比べながら、地道に並べ替えてみます。' },
  ],
  build() {
    return { runtime: buildBubblePhase(0) };
  },
  renderVisual: renderBubbleVisual,
  renderActions: renderBubbleActions,
  tick: (state, dt, speed, api) => tickAtInterval(
    state, dt, speed, api, 0.12,
    (rt) => rt.bubble.sorted,
    doBubbleStep,
  ),
  stepOnce: doBubbleStep,
  statusInfo: (state) => ({
    name: 'バブルソート (Bubble Sort)',
    complexity: 'O(N²)',
    operations: state.stageRuntime.bubble.comparisons,
  }),
};

// ============================================================
// ステージ3: クイックソート
// ============================================================

function buildQuickRuntime() {
  const values = randomValues(30);
  const { events, comparisons, swaps } = computeQuickSortEvents(values);
  return {
    quick: {
      arr: [...values], events, eventIdx: -1, comparisons, swaps,
      done: false, highlight: null, opsSoFar: 0,
    },
  };
}

function advanceQuickEvents(state, api, count) {
  const rt = state.stageRuntime;
  const q = rt.quick;
  for (let s = 0; s < count && !q.done; s += 1) {
    q.eventIdx += 1;
    if (q.eventIdx >= q.events.length) { q.done = true; break; }
    const ev = q.events[q.eventIdx];
    if (ev.type === 'swap') {
      [q.arr[ev.i], q.arr[ev.j]] = [q.arr[ev.j], q.arr[ev.i]];
      q.highlight = { compare: [], swap: [ev.i, ev.j], pivot: q.highlight?.pivot ?? null };
    } else if (ev.type === 'compare') {
      q.opsSoFar += 1;
      q.highlight = { compare: [ev.i, ev.j], swap: [], pivot: q.highlight?.pivot ?? null };
    } else if (ev.type === 'pivot') {
      q.highlight = { compare: [], swap: [], pivot: ev.index };
    } else if (ev.type === 'partitionDone') {
      q.highlight = { compare: [], swap: [], pivot: null };
    } else if (ev.type === 'done') {
      q.done = true;
    }
  }
  if (q.done) {
    api.log(`クイックソート完了！比較${q.comparisons}回、交換${q.swaps}回。バブルソートよりずっと少ない操作数で終わりました。`, 'ok');
    api.setStatus(`完了：比較${q.comparisons}回`, 'ok');
    state.playing = false;
    api.refreshActions();
  }
  api.render();
}

function tickQuick(state, dt, speed, api) {
  if (state.stageRuntime.quick.done) return;
  const stepsPerTick = Math.max(1, Math.round(2 * speed));
  advanceQuickEvents(state, api, stepsPerTick);
}

function renderQuickVisual(container, state) {
  const q = state.stageRuntime.quick;
  container.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'stage-info';
  info.textContent = `荷物${q.arr.length}個 / 比較${q.comparisons}回・交換${q.swaps}回 / 進捗 ${q.eventIdx + 1}/${q.events.length}`;
  container.appendChild(info);
  const barsBox = document.createElement('div');
  renderBars(barsBox, q.arr, {
    compare: q.highlight?.compare ?? [],
    swap: q.highlight?.swap ?? [],
    pivot: q.highlight?.pivot ?? null,
    allSorted: q.done,
  });
  container.appendChild(barsBox);
}

function renderQuickActions(container, state, api) {
  const q = state.stageRuntime.quick;
  if (q.done) {
    const next = document.createElement('button');
    next.className = 'primary';
    next.textContent = 'ステージクリア！';
    next.addEventListener('click', () => {
      api.completeStage();
      api.log('見事、王国の物流に必要なアルゴリズムを一通り身につけました！', 'ok');
      api.render();
    });
    container.appendChild(next);
  } else {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = '下部の「再生」ボタンでクイックソートを自動実行できます。';
    container.appendChild(hint);
  }
}

const STAGE_QUICK = {
  navLabel: '④クイックソート',
  title: '第4章 荷物の山、再び ― クイックソート ―',
  missionText: '今度はもっと多くの荷物を「クイックソート」で一気に並べ替えよう。',
  dialogue: [
    { who: '村長', text: '今度はさらに大量の荷物です。バブルソートでは日が暮れてしまいますね…。' },
    { who: 'あなた', text: 'では「クイックソート」を使いましょう。基準を決めて、一気に仕分けます。' },
  ],
  build() {
    return { runtime: buildQuickRuntime() };
  },
  renderVisual: renderQuickVisual,
  renderActions: renderQuickActions,
  tick: tickQuick,
  stepOnce: (state, api) => advanceQuickEvents(state, api, 1),
  statusInfo: (state) => ({
    name: 'クイックソート (Quick Sort)',
    complexity: '平均 O(N log N)',
    operations: state.stageRuntime.quick.comparisons,
  }),
};

export const STAGES = [STAGE_LINEAR, STAGE_BINARY, STAGE_BUBBLE, STAGE_QUICK];
