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
  const target = 'アル・ゴリズム';
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
  let activeCard = null;
  rt.villagers.forEach((v, i) => {
    const card = document.createElement('button');
    card.className = 'villager-card';
    card.textContent = v.name;
    if (i < rt.linear.pointer || (i === rt.linear.pointer && !rt.linear.found)) card.classList.add('checked');
    if (i === rt.linear.pointer && rt.linear.found) { card.classList.add('found'); activeCard = card; }
    if (i === rt.linear.pointer + 1 && !rt.linear.found && !rt.linear.exhausted) {
      card.classList.add('next');
      card.addEventListener('click', () => doLinearCheck(state, api));
      activeCard = card;
    } else {
      card.disabled = true;
    }
    grid.appendChild(card);
  });
  container.appendChild(grid);
  if (activeCard) activeCard.scrollIntoView({ block: 'nearest' });
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
  missionText: 'アル・ゴリズムさんを名簿の先頭から1人ずつ確認して見つけ出そう。',
  dialogue: [
    { who: '村長', text: '物流エンジニアさん、村人のアル・ゴリズムさんに荷物を届けてほしいのです。ただ…名簿はバラバラの順番で、どこにいるのか私にもわからなくて。' },
    { who: 'あなた', text: 'バラバラなら、端から1人ずつ確認していくしかなさそうですね。' },
    { who: '村長', text: 'そんなに時間がかかって大丈夫でしょうか…村人は100人もいるのに。' },
    { who: 'あなた', text: '大丈夫です。まずは1人ずつ、名前を確認していきましょう。見つかるまで根気強く続けます。' },
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
  const target = 'アル・ゴリズム';
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
    card.innerHTML = `<span class="tag">${label}</span><span class="name">${escapeHtml(rt.villagers[idx].name)}</span><span class="num">名簿${(idx + 1).toLocaleString()}番</span>`;
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
  missionText: '名簿は五十音順に並んでいます。中央から確認し、範囲を半分ずつ絞り込んでアル・ゴリズムさんを見つけよう。',
  dialogue: [
    { who: '村長', text: '今度もアル・ゴリズムさんへ荷物です。前回大変そうだったので、名簿を五十音順に並べ直しておきました。これで少しは楽になりますか？' },
    { who: 'あなた', text: 'ありがとうございます！並んでいるなら、端から1人ずつ確認する必要はありませんよ。' },
    { who: '村長', text: 'え、そうなんですか？でも結局、全員分見ないといけないのでは…' },
    { who: 'あなた', text: 'いいえ。真ん中の人を見て、探している名前より前か後ろかだけ判断すれば、調べる範囲を半分に絞り込めるんです。' },
    { who: 'あなた', text: 'それを繰り返せば、100人でも1,000人でも、あっという間に見つかります。' },
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
  const addBoundary = () => {
    const divider = document.createElement('div');
    divider.className = 'bar-boundary';
    wrap.appendChild(divider);
  };
  arr.forEach((val, idx) => {
    if (opts.boundary === idx) addBoundary();
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${(val / maxVal) * 100}%`;
    if (opts.compare?.includes(idx)) bar.classList.add('compare');
    if (opts.swap?.includes(idx)) bar.classList.add('swap');
    if (opts.pivot === idx) bar.classList.add('pivot');
    if (opts.sortedFrom !== undefined && idx >= opts.sortedFrom) bar.classList.add('sorted');
    if (opts.sortedIndices?.has(idx)) bar.classList.add('sorted');
    if (opts.allSorted) bar.classList.add('sorted');
    if (opts.inRange && (idx < opts.inRange.lo || idx > opts.inRange.hi)) bar.classList.add('out-of-range');
    wrap.appendChild(bar);
  });
  if (opts.boundary === arr.length) addBoundary();
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
    { who: '村長', text: '…とはいえ、一度に全部を見比べるなんてできませんよね？どうすればいいのやら。' },
    { who: 'あなた', text: '一度に全部は無理でも、隣同士を1組ずつ比べることならできます。' },
    { who: 'あなた', text: '大きい方が右にあれば交換、を端から端まで繰り返せば、一番大きい荷物が一番右まで押し出されていきます。' },
    { who: 'あなた', text: 'それを何度も繰り返せば、少しずつ全体が並んでいきますよ。' },
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
      confirmed: new Set(),
      range: { lo: 0, hi: values.length - 1 },
      boundary: null,
      liveDesc: '「再生」ボタンか「1ステップ」でクイックソートを開始します。',
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
    if (ev.type === 'range') {
      q.range = { lo: ev.lo, hi: ev.hi };
    } else if (ev.type === 'swap') {
      [q.arr[ev.i], q.arr[ev.j]] = [q.arr[ev.j], q.arr[ev.i]];
      q.highlight = { compare: [], swap: [ev.i, ev.j], pivot: q.highlight?.pivot ?? null };
      q.liveDesc = '2つの荷物の位置を交換しました。';
      if (ev.boundary !== undefined) q.boundary = ev.boundary;
    } else if (ev.type === 'compare') {
      q.opsSoFar += 1;
      const lighter = q.arr[ev.i] < q.arr[ev.j];
      q.highlight = { compare: [ev.i], swap: [], pivot: q.highlight?.pivot ?? null };
      q.liveDesc = `比較中の荷物は基準より${lighter ? '軽いので左側へ' : '重い(または同じ)のでそのまま'}`;
      if (ev.boundary !== undefined) q.boundary = ev.boundary;
    } else if (ev.type === 'boundary') {
      q.boundary = ev.index;
    } else if (ev.type === 'pivot') {
      q.highlight = { compare: [], swap: [], pivot: ev.index };
      q.liveDesc = '基準(ピボット)となる荷物を選びました。';
      api.log('基準(ピボット)となる荷物を選びました。');
      q.boundary = ev.boundary;
    } else if (ev.type === 'partitionDone') {
      q.highlight = { compare: [], swap: [], pivot: null };
      q.liveDesc = '基準の位置が確定！ 左側は基準より軽く、右側は基準より重い荷物に分かれました。';
      api.log('基準の位置が確定。左は基準より軽い・右は基準より重い荷物に分かれました。', 'ok');
      q.boundary = null;
    } else if (ev.type === 'confirmed') {
      q.confirmed.add(ev.index);
    } else if (ev.type === 'done') {
      q.done = true;
    }
  }
  if (q.done) {
    q.liveDesc = '並べ替え完了！';
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
  const rangeSize = q.done ? 0 : q.range.hi - q.range.lo + 1;
  const info = document.createElement('div');
  info.className = 'stage-info stage-info--tall';
  const boundaryText = q.boundary != null ? ` / 軽いグループ: ${q.boundary - q.range.lo}個` : '';
  info.textContent = q.done
    ? `荷物${q.arr.length}個 / 比較${q.comparisons}回・交換${q.swaps}回 / 進捗 ${q.eventIdx + 1}/${q.events.length}`
    : `荷物${q.arr.length}個 / 比較${q.comparisons}回・交換${q.swaps}回 / 進捗 ${q.eventIdx + 1}/${q.events.length} / 現在の範囲: ${q.range.lo + 1}〜${q.range.hi + 1}番目（${rangeSize}個）${boundaryText}`;
  container.appendChild(info);

  const live = document.createElement('div');
  live.className = 'live-desc live-desc--tall';
  live.textContent = q.liveDesc;
  container.appendChild(live);

  const barsBox = document.createElement('div');
  renderBars(barsBox, q.arr, {
    compare: q.highlight?.compare ?? [],
    swap: q.highlight?.swap ?? [],
    pivot: q.highlight?.pivot ?? null,
    sortedIndices: q.confirmed,
    inRange: q.done ? null : q.range,
    boundary: q.done ? null : q.boundary,
    allSorted: q.done,
  });
  container.appendChild(barsBox);

  renderBarLegend(container, [
    { cls: 'pivot', label: '基準（ピボット）' },
    { cls: 'compare', label: '比較中' },
    { cls: 'swap', label: '交換' },
    { cls: 'sorted', label: '確定' },
    { cls: 'boundary', label: '｜軽いグループとの境目' },
  ]);
}

function renderBarLegend(container, entries) {
  const legend = document.createElement('div');
  legend.className = 'bar-legend';
  entries.forEach(({ cls, label }) => {
    const item = document.createElement('span');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-swatch ${cls}"></span>${escapeHtml(label)}`;
    legend.appendChild(item);
  });
  container.appendChild(legend);
}

function renderQuickActions(container, state, api) {
  const q = state.stageRuntime.quick;
  if (q.done) {
    const next = document.createElement('button');
    next.className = 'primary';
    next.textContent = 'ステージクリア！';
    next.addEventListener('click', () => {
      api.completeStage();
      api.log('並べ替えの技はここまで。次は王国マップで最短経路を探しましょう。', 'ok');
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
  missionText: '「基準（ピボット）」を1つ選び、それより小さい荷物は左、大きい荷物は右に仕分ける。これを繰り返して並べ替えよう。',
  dialogue: [
    { who: '村長', text: '今度はさらに大量の荷物です。前回のやり方(バブルソート)では日が暮れてしまいますね…。' },
    { who: 'あなた', text: 'では「クイックソート」を使いましょう。まず適当な荷物を1つ「基準」に選びます。' },
    { who: '村長', text: '基準を選んで、それが何の役に立つのですか？' },
    { who: 'あなた', text: '基準より軽い荷物は左へ、重い荷物は右へ仕分けると、基準の位置がその時点で最終的な位置に確定するんです。' },
    { who: 'あなた', text: 'あとは分かれた左側・右側それぞれの中で、同じことをもう一度繰り返すだけ。全体を一度に比べるより、ずっと少ない手間で済みます。' },
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

// ============================================================
// 共通: グラフ/マップ描画ヘルパー（ダイクストラで使用）
// ============================================================

function renderGraphSvg(container, { positions, edges, nodeClass, nodeLabel, nodeSubLabel, edgeClass, edgeLabel, edgeLabelT, viewBox, onNodeClick }) {
  const edgesSvg = edges.map(({ from, to }) => {
    const pa = positions[from];
    const pb = positions[to];
    const cls = edgeClass ? edgeClass(from, to) : '';
    const label = edgeLabel ? edgeLabel(from, to) : '';
    const t = edgeLabelT ? edgeLabelT(from, to) : 0.5;
    const mx = pa.x + (pb.x - pa.x) * t;
    const my = pa.y + (pb.y - pa.y) * t;
    const labelSvg = label
      ? `<text x="${mx}" y="${my - 6}" text-anchor="middle" class="graph-edge-label">${escapeHtml(label)}</text>`
      : '';
    return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" class="cave-edge ${cls}"></line>${labelSvg}`;
  }).join('');

  const nodesSvg = Object.keys(positions).map((id) => {
    const pos = positions[id];
    const cls = nodeClass(id);
    const label = nodeLabel(id);
    const sub = nodeSubLabel ? nodeSubLabel(id) : '';
    const boxH = sub ? 54 : 44;
    return `<g class="cave-room ${cls}" data-id="${id}">
      <rect x="${pos.x - 58}" y="${pos.y - boxH / 2}" width="116" height="${boxH}" rx="10"></rect>
      <text x="${pos.x}" y="${pos.y + (sub ? -3 : 5)}" text-anchor="middle">${escapeHtml(label)}</text>
      ${sub ? `<text x="${pos.x}" y="${pos.y + 16}" text-anchor="middle" class="graph-node-sub">${escapeHtml(sub)}</text>` : ''}
    </g>`;
  }).join('');

  container.innerHTML = `<svg viewBox="${viewBox}" class="cave-map">${edgesSvg}${nodesSvg}</svg>`;

  if (onNodeClick) {
    container.querySelectorAll('.cave-room').forEach((g) => {
      g.addEventListener('click', () => onNodeClick(g.dataset.id));
    });
  }
}

function renderQueueTrack(container, items, renderCard) {
  const track = document.createElement('div');
  track.className = 'queue-track';
  items.forEach((item, i) => track.appendChild(renderCard(item, i)));
  container.appendChild(track);
}

// ============================================================
// ステージ5: ダイクストラ法
// ============================================================

const KINGDOM_NODES = {
  capital: { label: '王都' },
  forest: { label: '森の村' },
  mountain: { label: '山の村' },
  lake: { label: '湖畔の町' },
  pass: { label: '峠' },
  harbor: { label: '港町' },
  valley: { label: '谷間の村' },
  goal: { label: '隣国', isGoal: true },
};

const KINGDOM_EDGES = [
  { from: 'capital', to: 'forest', weight: 5, roadLabel: '森' },
  { from: 'capital', to: 'mountain', weight: 25, roadLabel: '山', labelT: 0.35 },
  { from: 'capital', to: 'harbor', weight: 12, roadLabel: '港街道' },
  { from: 'forest', to: 'mountain', weight: 3, roadLabel: '街道' },
  { from: 'forest', to: 'lake', weight: 4, roadLabel: '森', labelT: 0.8 },
  { from: 'mountain', to: 'pass', weight: 6, roadLabel: '街道' },
  { from: 'lake', to: 'pass', weight: 6, roadLabel: '街道' },
  { from: 'lake', to: 'valley', weight: 9, roadLabel: '森', labelT: 0.35 },
  { from: 'pass', to: 'goal', weight: 8, roadLabel: '街道' },
  { from: 'harbor', to: 'valley', weight: 3, roadLabel: '港街道' },
  { from: 'valley', to: 'goal', weight: 10, roadLabel: '谷道' },
  { from: 'harbor', to: 'goal', weight: 30, roadLabel: '海路（近道に見える一直線）', labelT: 0.15 },
  { from: 'mountain', to: 'goal', weight: 15, roadLabel: '険しい山道' },
];

const KINGDOM_POS = {
  capital: { x: 60, y: 220 },
  forest: { x: 220, y: 100 },
  mountain: { x: 400, y: 60 },
  lake: { x: 220, y: 240 },
  pass: { x: 400, y: 220 },
  harbor: { x: 60, y: 380 },
  valley: { x: 560, y: 340 },
  goal: { x: 720, y: 220 },
};

function kingdomNeighbors(id) {
  return KINGDOM_EDGES.filter((e) => e.from === id);
}

function buildDijkstraRuntime() {
  const dist = {};
  Object.keys(KINGDOM_NODES).forEach((id) => { dist[id] = id === 'capital' ? 0 : Infinity; });
  return {
    dist, prev: {}, settled: new Set(), operations: 0, cleared: false, goalId: null,
  };
}

function doDijkstraStep(state, api) {
  const rt = state.stageRuntime;
  if (rt.cleared) return;
  let bestId = null;
  Object.keys(rt.dist).forEach((id) => {
    if (rt.settled.has(id) || rt.dist[id] === Infinity) return;
    if (bestId === null || rt.dist[id] < rt.dist[bestId]) bestId = id;
  });
  if (bestId === null) {
    rt.cleared = true;
    api.log('これ以上たどり着ける場所がありません。', 'err');
    state.playing = false;
    api.refreshActions();
    api.render();
    return;
  }
  rt.settled.add(bestId);
  rt.operations += 1;
  api.log(`「${KINGDOM_NODES[bestId].label}」までの最短時間が${rt.dist[bestId]}分に確定しました。`, 'ok');
  if (KINGDOM_NODES[bestId].isGoal) {
    rt.cleared = true;
    rt.goalId = bestId;
    api.setStatus(`到着！最短${rt.dist[bestId]}分`, 'ok');
    state.playing = false;
  } else {
    kingdomNeighbors(bestId).forEach((e) => {
      rt.operations += 1;
      const newDist = rt.dist[bestId] + e.weight;
      if (newDist < rt.dist[e.to]) {
        rt.dist[e.to] = newDist;
        rt.prev[e.to] = bestId;
        api.log(`「${KINGDOM_NODES[e.to].label}」への所要時間を${newDist}分に更新しました。(${e.roadLabel}経由)`);
      }
    });
  }
  api.refreshActions();
  api.render();
}

function getKingdomShortestPath(rt) {
  const nodes = new Set();
  const edges = new Set();
  if (!rt.cleared || rt.goalId == null) return { nodes, edges };
  let cur = rt.goalId;
  nodes.add(cur);
  while (rt.prev[cur] !== undefined) {
    const prev = rt.prev[cur];
    edges.add(`${prev}->${cur}`);
    nodes.add(prev);
    cur = prev;
  }
  return { nodes, edges };
}

function renderDijkstraVisual(container, state) {
  const rt = state.stageRuntime;
  container.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'stage-info';
  info.textContent = `確定済み: ${rt.settled.size}/${Object.keys(KINGDOM_NODES).length} / 操作回数: ${rt.operations}`;
  container.appendChild(info);

  const live = document.createElement('div');
  live.className = 'live-desc';
  live.textContent = rt.cleared
    ? `隣国までの最短時間は${rt.dist[rt.goalId]}分でした！`
    : '「1手」で、今わかっている中で一番近い場所を確定させます。';
  container.appendChild(live);

  const path = getKingdomShortestPath(rt);

  const mapBox = document.createElement('div');
  renderGraphSvg(mapBox, {
    positions: KINGDOM_POS,
    edges: KINGDOM_EDGES,
    edgeLabel: (from, to) => {
      const e = KINGDOM_EDGES.find((x) => x.from === from && x.to === to);
      return e ? `${e.roadLabel} ${e.weight}分` : '';
    },
    edgeLabelT: (from, to) => findKingdomEdge(from, to)?.labelT ?? 0.5,
    edgeClass: (from, to) => {
      if (path.edges.has(`${from}->${to}`)) return 'final-path';
      return rt.settled.has(from) && rt.prev[to] === from ? 'on-path' : '';
    },
    nodeLabel: (id) => KINGDOM_NODES[id].label,
    nodeSubLabel: (id) => (rt.dist[id] === Infinity ? '∞' : `${rt.dist[id]}分`),
    nodeClass: (id) => {
      const node = KINGDOM_NODES[id];
      const settled = rt.settled.has(id);
      const onFinalPath = path.nodes.has(id);
      return [
        !settled && rt.dist[id] === Infinity ? 'unvisited' : '',
        !settled && rt.dist[id] !== Infinity ? 'candidate' : '',
        settled && onFinalPath ? 'final-path' : '',
        settled && !onFinalPath ? 'onpath' : '',
      ].filter(Boolean).join(' ');
    },
    viewBox: '0 0 800 450',
  });
  container.appendChild(mapBox);

  renderBarLegend(container, [
    { cls: 'cave-final-path', label: '最短ルート' },
    { cls: 'cave-onpath', label: '最短時間が確定' },
    { cls: 'cave-candidate', label: '候補（時間わかっている）' },
    { cls: 'cave-unvisited', label: 'まだ分からない' },
  ]);
}

function findKingdomEdge(from, to) {
  return KINGDOM_EDGES.find((e) => e.from === from && e.to === to);
}

function renderDijkstraActions(container, state, api) {
  const rt = state.stageRuntime;
  if (rt.cleared) {
    const next = document.createElement('button');
    next.className = 'primary';
    next.textContent = 'ステージクリア！';
    next.addEventListener('click', () => {
      api.completeStage();
      const harborDirect = findKingdomEdge('capital', 'harbor').weight + findKingdomEdge('harbor', 'goal').weight;
      const mountainDirect = findKingdomEdge('capital', 'mountain').weight + findKingdomEdge('mountain', 'goal').weight;
      api.log(`一直線に近い「海路」経由だと${harborDirect}分、「山道」経由だと${mountainDirect}分もかかります。見つけた道は${rt.dist[rt.goalId]}分で、実はどちらより速いのです。`, 'ok');
      api.log('道ごとの時間を考えながら「今一番近い場所」から確定させていく…これがダイクストラ法のすごさです。', 'ok');
      api.render();
    });
    container.appendChild(next);
    return;
  }
  const btn = document.createElement('button');
  btn.textContent = '一番近い場所を確定させる (1手)';
  btn.addEventListener('click', () => doDijkstraStep(state, api));
  container.appendChild(btn);
}

const STAGE_DIJKSTRA = {
  navLabel: '⑤ダイクストラ法',
  title: '第5章 王国マップ ― ダイクストラ法 ―',
  missionText: '道の数が増えて複雑になった。一直線の近道に見える道ほど、実は遠回りかもしれない。王都から隣国までの最短時間の道を見つけよう。',
  dialogue: [
    { who: '王', text: '隣国まで一番早く着ける道を調べてくれ。港からの海路は一直線で近そうだが…本当に一番速いか？' },
    { who: 'あなた', text: '道の数が多くて、見た目だけでは判断できませんね。一直線に近い道が、必ずしも一番速いとは限りません。' },
    { who: '王', text: 'では、全ての道を試すしかないのか？それでは時間がかかりすぎるぞ。' },
    { who: 'あなた', text: '全部を一度に比べる必要はありません。今わかっている中で一番近い場所から、一つずつ確実に確定させていきましょう。' },
    { who: 'あなた', text: '一度確定した場所を起点に、また次に近い場所を探す…これを繰り返せば、遠回りなく最短の道が見えてきます。' },
  ],
  build() {
    return { runtime: buildDijkstraRuntime() };
  },
  renderVisual: renderDijkstraVisual,
  renderActions: renderDijkstraActions,
  tick: (state, dt, speed, api) => tickAtInterval(state, dt, speed, api, 0.5, (rt) => rt.cleared, doDijkstraStep),
  stepOnce: doDijkstraStep,
  statusInfo: (state) => ({
    name: 'ダイクストラ法 (Dijkstra)',
    complexity: 'O((V+E) log V)',
    operations: state.stageRuntime.operations,
  }),
};

// ============================================================
// ステージ10: 動的計画法
// ============================================================

// 依頼として計算する段数の並び（だんだん増え、最後に宝箱がある18段に挑戦する）
const DP_TARGETS = [3, 4, 5, 6, 18];
const CHEST_RIDDLE = '刻まれし問い：「一歩か二歩で十八段を登る道は、幾通りありや」';

function buildDPStagePhase(phaseIdx) {
  return {
    phaseIdx,
    mode: phaseIdx === 0 ? 'naive' : 'memo',
    roundIdx: 0,
    roundActive: false,
    table: {},
    totalClicks: 0,
    cleared: false,
  };
}

function nextUnknownStep(table) {
  let n = 1;
  while (table[n] !== undefined) n += 1;
  return n;
}

function doDPStep(state, api) {
  const rt = state.stageRuntime;
  if (rt.cleared) return;
  if (!rt.roundActive) {
    if (rt.mode === 'naive') rt.table = {};
    rt.roundActive = true;
  }
  const target = DP_TARGETS[rt.roundIdx];
  const n = nextUnknownStep(rt.table);
  if (n > target) {
    api.log(`${target}段の上り方は ${rt.table[target]}通りでした。`, 'ok');
    rt.roundActive = false;
    rt.roundIdx += 1;
    if (rt.roundIdx >= DP_TARGETS.length) {
      rt.cleared = true;
      api.setStatus(`完了：合計クリック数 ${rt.totalClicks}回`, 'ok');
      state.playing = false;
    } else {
      api.log(`次の依頼：${DP_TARGETS[rt.roundIdx]}段の上り方を計算しましょう。`);
    }
    api.refreshActions();
    api.render();
    return;
  }
  let value;
  if (n === 1) value = 1;
  else if (n === 2) value = 2;
  else value = rt.table[n - 1] + rt.table[n - 2];
  rt.table[n] = value;
  rt.totalClicks += 1;
  api.log(n <= 2
    ? `${n}段：${value}通り（これ以上分けられない土台の数字です）`
    : `${n}段 = ${n - 1}段(${rt.table[n - 1]}通り) + ${n - 2}段(${rt.table[n - 2]}通り) = ${value}通り`);
  api.render();
}

function advanceDPPhase(state, api) {
  const rt = state.stageRuntime;
  const nextIdx = rt.phaseIdx + 1;
  if (nextIdx >= 2) {
    api.completeStage();
    api.log(`メモ化ありなら合計${rt.totalClicks}回で済みました。一度計算した段の数字を覚えておくだけで、同じ計算をやり直さずに済みます。`, 'ok');
    api.render();
    return;
  }
  state.playing = false;
  state.stageRuntime = buildDPStagePhase(nextIdx);
  api.log('依頼：今度は同じ依頼を、一度計算した段の数字を覚えながら(メモ化)解いてみましょう。');
  api.refreshActions();
  api.render();
}

function renderDPVisual(container, state) {
  const rt = state.stageRuntime;
  container.innerHTML = '';
  const target = DP_TARGETS[Math.min(rt.roundIdx, DP_TARGETS.length - 1)];
  const isFinalTarget = target === DP_TARGETS[DP_TARGETS.length - 1];

  const riddle = document.createElement('div');
  riddle.className = 'chest-riddle';
  riddle.textContent = CHEST_RIDDLE;
  container.appendChild(riddle);

  const info = document.createElement('div');
  info.className = 'stage-info';
  info.textContent = `モード: ${rt.mode === 'memo' ? 'メモ化あり' : 'メモ化なし'} / 今回の依頼: ${target}段 / 合計クリック数: ${rt.totalClicks}回`;
  container.appendChild(info);

  const live = document.createElement('div');
  live.className = 'live-desc';
  if (rt.cleared) {
    live.textContent = rt.phaseIdx === 1 ? '答えを確かめて、宝箱の鍵を開けよう！' : '全ての依頼が完了しました！';
  } else {
    const n = nextUnknownStep(rt.table);
    if (n > target) {
      live.textContent = `${target}段の上り方は ${rt.table[target]}通り！次の依頼に進みましょう。`;
    } else if (n <= 2) {
      live.textContent = `${n}段だけなら上り方は${n}通りです。まずこの土台を計算しましょう。`;
    } else {
      live.textContent = `${n}段の上り方 = ${n - 1}段の上り方 + ${n - 2}段の上り方 で計算できます。`;
    }
  }
  container.appendChild(live);

  const stairs = document.createElement('div');
  stairs.className = 'stair-visual';
  for (let s = 1; s <= target; s += 1) {
    const step = document.createElement('div');
    step.className = 'stair-step';
    if (rt.table[s] !== undefined) step.classList.add('done');
    step.style.height = `${s * 7}px`;
    stairs.appendChild(step);
  }
  if (isFinalTarget) {
    const chest = document.createElement('div');
    chest.className = 'chest-icon';
    stairs.appendChild(chest);
  }
  container.appendChild(stairs);

  const rows = Object.keys(rt.table).map(Number).sort((a, b) => a - b);
  renderQueueTrack(container, rows, (n) => {
    const card = document.createElement('div');
    card.className = 'queue-card';
    if (n === target) card.classList.add('front');
    card.innerHTML = `<span class="tag">${n}段</span><span class="name">${rt.table[n]}通り</span>`;
    return card;
  });
}

function renderDPActions(container, state, api) {
  const rt = state.stageRuntime;
  if (rt.cleared) {
    if (rt.phaseIdx >= 1) {
      renderChestUnlock(container, state, api);
      return;
    }
    const next = document.createElement('button');
    next.className = 'primary';
    next.textContent = '次の依頼へ（メモ化ありで挑戦）';
    next.addEventListener('click', () => advanceDPPhase(state, api));
    container.appendChild(next);
    return;
  }
  const btn = document.createElement('button');
  btn.textContent = '1段分を計算する';
  btn.addEventListener('click', () => doDPStep(state, api));
  container.appendChild(btn);
}

function renderChestUnlock(container, state, api) {
  const rt = state.stageRuntime;
  const target = DP_TARGETS[DP_TARGETS.length - 1];
  const wrap = document.createElement('div');
  wrap.className = 'chest-unlock';
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.placeholder = '暗証番号を入力';
  input.className = 'chest-unlock-input';
  const btn = document.createElement('button');
  btn.className = 'primary';
  btn.textContent = '開錠する';
  btn.addEventListener('click', () => {
    const answer = String(rt.table[target]);
    if (input.value.trim() === answer) {
      api.log(`暗証番号「${answer}」…カチリと鍵が開いた！`, 'ok');
      advanceDPPhase(state, api);
    } else {
      api.log('暗証番号が違うようだ…計算結果をもう一度確認しよう。', 'err');
      input.value = '';
      input.focus();
    }
  });
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') btn.click(); });
  wrap.appendChild(input);
  wrap.appendChild(btn);
  container.appendChild(wrap);
}

const STAGE_DP = {
  navLabel: '⑥動的計画法',
  title: '第6章 宝箱の暗証番号 ― 動的計画法 ―',
  missionText: '18段の階段の上り方(1歩か2歩)が何通りあるか、1段目から順に数えていこう。宝箱の蓋に刻まれた問いの答えが、鍵を開く暗証番号になる。',
  dialogue: [
    { who: '王', text: '階段のてっぺんで宝箱を見つけたのだが、蓋に古代文字で何か刻まれている。読めるか？' },
    { who: 'あなた', text: '……『一歩か二歩で十八段を登る道は、幾通りありや』と刻まれていますね。これが鍵の暗証番号を解く問いのようです。' },
    { who: '王', text: '十八段の上り方だと…？一体何通りあるのか、見当もつかん。' },
    { who: 'あなた', text: '1段なら1通り、2段なら「1+1」か「2」の2通り。3段目からは、1段前と2段前の答えを足せば求まりますね。' },
    { who: 'あなた', text: 'でも毎回1段目からやり直していたら、大きい段数では大変です。一度計算した数字を覚えておきましょう。' },
  ],
  build() {
    return { runtime: buildDPStagePhase(0) };
  },
  renderVisual: renderDPVisual,
  renderActions: renderDPActions,
  tick: (state, dt, speed, api) => tickAtInterval(state, dt, speed, api, 0.15, (rt) => rt.cleared, doDPStep),
  stepOnce: doDPStep,
  statusInfo: (state) => {
    const rt = state.stageRuntime;
    return rt.mode === 'memo'
      ? { name: '動的計画法 (メモ化あり)', complexity: 'O(N)', operations: rt.totalClicks }
      : { name: '動的計画法 (メモ化なし)', complexity: 'O(N²)（依頼のたびにやり直す）', operations: rt.totalClicks };
  },
};

export const STAGES = [
  STAGE_LINEAR, STAGE_BINARY, STAGE_BUBBLE, STAGE_QUICK,
  STAGE_DIJKSTRA, STAGE_DP,
];
