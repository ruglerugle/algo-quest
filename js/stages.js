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
    if (ev.type === 'swap') {
      [q.arr[ev.i], q.arr[ev.j]] = [q.arr[ev.j], q.arr[ev.i]];
      q.highlight = { compare: [], swap: [ev.i, ev.j], pivot: q.highlight?.pivot ?? null };
      q.liveDesc = '2つの荷物の位置を交換しました。';
    } else if (ev.type === 'compare') {
      q.opsSoFar += 1;
      const lighter = q.arr[ev.i] < q.arr[ev.j];
      q.highlight = { compare: [ev.i], swap: [], pivot: q.highlight?.pivot ?? null };
      q.liveDesc = `比較中の荷物は基準より${lighter ? '軽いので左側へ' : '重い(または同じ)のでそのまま'}`;
    } else if (ev.type === 'pivot') {
      q.highlight = { compare: [], swap: [], pivot: ev.index };
      q.liveDesc = '基準(ピボット)となる荷物を選びました。';
      api.log('基準(ピボット)となる荷物を選びました。');
    } else if (ev.type === 'partitionDone') {
      q.highlight = { compare: [], swap: [], pivot: null };
      q.liveDesc = '基準の位置が確定！ 左側は基準より軽く、右側は基準より重い荷物に分かれました。';
      api.log('基準の位置が確定。左は基準より軽い・右は基準より重い荷物に分かれました。', 'ok');
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
  const info = document.createElement('div');
  info.className = 'stage-info';
  info.textContent = `荷物${q.arr.length}個 / 比較${q.comparisons}回・交換${q.swaps}回 / 進捗 ${q.eventIdx + 1}/${q.events.length}`;
  container.appendChild(info);

  const live = document.createElement('div');
  live.className = 'live-desc';
  live.textContent = q.liveDesc;
  container.appendChild(live);

  const barsBox = document.createElement('div');
  renderBars(barsBox, q.arr, {
    compare: q.highlight?.compare ?? [],
    swap: q.highlight?.swap ?? [],
    pivot: q.highlight?.pivot ?? null,
    allSorted: q.done,
  });
  container.appendChild(barsBox);

  renderBarLegend(container, [
    { cls: 'pivot', label: '基準（ピボット）' },
    { cls: 'compare', label: '比較中' },
    { cls: 'swap', label: '交換' },
    { cls: 'sorted', label: '確定' },
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
      api.log('並べ替えの技はここまで。次は洞窟の奥に眠るお宝を目指しましょう。', 'ok');
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
    { who: '村長', text: '今度はさらに大量の荷物です。バブルソートでは日が暮れてしまいますね…。' },
    { who: 'あなた', text: 'では「クイックソート」を使いましょう。まず適当な荷物を1つ「基準」に選びます。' },
    { who: 'あなた', text: '基準より軽い荷物は左へ、重い荷物は右へ仕分けたら、基準の位置が確定します。' },
    { who: 'あなた', text: 'あとは左側・右側それぞれの中で、同じことをもう一度繰り返すだけです。' },
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
// ステージ4: スタック
// ============================================================

const CAVE_TREE = {
  id: 'entrance', label: '入口', children: [
    {
      id: 'hallA', label: '広間A', children: [
        { id: 'deadend1', label: '行き止まり…宝はありません', mapLabel: '行き止まり', children: [] },
        {
          id: 'roomB', label: '小部屋B', children: [
            { id: 'deadend2', label: '行き止まり…宝はありません', mapLabel: '行き止まり', children: [] },
          ],
        },
      ],
    },
    {
      id: 'hallC', label: '広間C', children: [
        { id: 'deadend3', label: '行き止まり…宝はありません', mapLabel: '行き止まり', children: [] },
        { id: 'treasure', label: '宝物庫', children: [], isTreasure: true },
      ],
    },
  ],
};

const ROOM_POS = {
  entrance: { x: 360, y: 50 },
  hallA: { x: 200, y: 170 },
  hallC: { x: 520, y: 170 },
  deadend1: { x: 90, y: 290 },
  roomB: { x: 310, y: 290 },
  deadend2: { x: 310, y: 410 },
  deadend3: { x: 430, y: 290 },
  treasure: { x: 630, y: 290 },
};

const ROOM_EDGES = [
  ['entrance', 'hallA'], ['entrance', 'hallC'],
  ['hallA', 'deadend1'], ['hallA', 'roomB'], ['roomB', 'deadend2'],
  ['hallC', 'deadend3'], ['hallC', 'treasure'],
];

function flattenTree(node, map = {}) {
  map[node.id] = node;
  node.children.forEach((c) => flattenTree(c, map));
  return map;
}
const ROOM_MAP = flattenTree(CAVE_TREE);

function buildStackRuntime() {
  return {
    stack: [CAVE_TREE], explored: {}, visited: new Set(['entrance']),
    operations: 0, cleared: false,
  };
}

function doPush(state, api) {
  const rt = state.stageRuntime;
  const current = rt.stack[rt.stack.length - 1];
  const idx = rt.explored[current.id] || 0;
  const child = current.children[idx];
  rt.stack.push(child);
  rt.visited.add(child.id);
  rt.operations += 1;
  api.log(`「${child.label}」へ進みました。(Push)`);
  if (child.isTreasure) {
    rt.cleared = true;
    api.log('宝物庫を発見しました！', 'ok');
    api.setStatus(`発見！操作回数: ${rt.operations}`, 'ok');
    state.playing = false;
  } else if (child.children.length === 0) {
    api.log(`「${child.label}」…先へは進めません。`, 'err');
  }
  api.refreshActions();
  api.render();
}

function doPop(state, api) {
  const rt = state.stageRuntime;
  if (rt.stack.length <= 1) return;
  const popped = rt.stack.pop();
  const parent = rt.stack[rt.stack.length - 1];
  rt.explored[parent.id] = (rt.explored[parent.id] || 0) + 1;
  rt.operations += 1;
  api.log(`「${popped.label}」から「${parent.label}」へ戻りました。(Pop)`);
  api.refreshActions();
  api.render();
}

function doCaveStep(state, api) {
  const rt = state.stageRuntime;
  if (rt.cleared) return;
  const current = rt.stack[rt.stack.length - 1];
  const idx = rt.explored[current.id] || 0;
  if (current.children.length > idx) {
    doPush(state, api);
  } else if (rt.stack.length > 1) {
    doPop(state, api);
  }
}

function renderStackVisual(container, state) {
  const rt = state.stageRuntime;
  container.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'stage-info';
  info.textContent = `スタックの深さ: ${rt.stack.length} / 操作回数: ${rt.operations}`;
  container.appendChild(info);

  const current = rt.stack[rt.stack.length - 1];
  const idx = rt.explored[current.id] || 0;
  const live = document.createElement('div');
  live.className = 'live-desc';
  live.textContent = rt.cleared
    ? '宝物庫を発見しました！'
    : (current.children.length > idx
      ? `現在地:「${current.label}」。奥へ進めます。`
      : `現在地:「${current.label}」。これ以上は進めません…戻りましょう。`);
  container.appendChild(live);

  const mapBox = document.createElement('div');
  renderStackMap(mapBox, rt);
  container.appendChild(mapBox);

  renderBarLegend(container, [
    { cls: 'cave-current', label: '現在地' },
    { cls: 'cave-onpath', label: '通ってきた道' },
    { cls: 'cave-treasure', label: '宝物庫' },
    { cls: 'cave-deadend', label: '行き止まり' },
    { cls: 'cave-unvisited', label: '未探索' },
  ]);

  const towerLabel = document.createElement('div');
  towerLabel.className = 'stage-info';
  towerLabel.textContent = '現在のスタック（下が入口・上が現在地）';
  container.appendChild(towerLabel);

  const tower = document.createElement('div');
  tower.className = 'stack-tower';
  [...rt.stack].reverse().forEach((node, i) => {
    const box = document.createElement('div');
    box.className = 'stack-room';
    if (i === 0) box.classList.add('top');
    if (node.isTreasure) box.classList.add('treasure');
    if (node.children.length === 0 && !node.isTreasure) box.classList.add('deadend');
    box.textContent = node.label;
    tower.appendChild(box);
  });
  container.appendChild(tower);
}

function renderStackMap(container, rt) {
  const currentId = rt.stack[rt.stack.length - 1].id;
  const stackIds = new Set(rt.stack.map((n) => n.id));

  const edgesSvg = ROOM_EDGES.map(([a, b]) => {
    const pa = ROOM_POS[a];
    const pb = ROOM_POS[b];
    const onPath = stackIds.has(a) && stackIds.has(b);
    return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" class="cave-edge${onPath ? ' on-path' : ''}" />`;
  }).join('');

  const roomsSvg = Object.entries(ROOM_POS).map(([id, pos]) => {
    const node = ROOM_MAP[id];
    const visited = rt.visited.has(id);
    const isCurrent = id === currentId;
    const isDeadend = node.children.length === 0 && !node.isTreasure;
    const cls = [
      'cave-room',
      !visited ? 'unvisited' : '',
      visited && isCurrent ? 'current' : '',
      visited && !isCurrent && stackIds.has(id) ? 'onpath' : '',
      visited && node.isTreasure ? 'treasure' : '',
      visited && isDeadend ? 'deadend' : '',
    ].filter(Boolean).join(' ');
    const label = node.mapLabel ?? node.label;
    return `<g class="${cls}">
      <rect x="${pos.x - 55}" y="${pos.y - 22}" width="110" height="44" rx="10"></rect>
      <text x="${pos.x}" y="${pos.y + 5}" text-anchor="middle">${escapeHtml(label)}</text>
    </g>`;
  }).join('');

  container.innerHTML = `<svg viewBox="0 0 720 450" class="cave-map">${edgesSvg}${roomsSvg}</svg>`;
}

function renderStackActions(container, state, api) {
  const rt = state.stageRuntime;
  if (rt.cleared) {
    const next = document.createElement('button');
    next.className = 'primary';
    next.textContent = 'ステージクリア！';
    next.addEventListener('click', () => {
      api.completeStage();
      api.log('スタックの「後入れ先出し(LIFO)」のおかげで、迷わず正しい順番で引き返せました。', 'ok');
      api.render();
    });
    container.appendChild(next);
    return;
  }
  const current = rt.stack[rt.stack.length - 1];
  const idx = rt.explored[current.id] || 0;
  if (current.children.length > idx) {
    const child = current.children[idx];
    const btn = document.createElement('button');
    btn.textContent = `「${child.label}」へ進む (Push)`;
    btn.addEventListener('click', () => doPush(state, api));
    container.appendChild(btn);
  } else if (rt.stack.length > 1) {
    const btn = document.createElement('button');
    btn.textContent = '戻る (Pop)';
    btn.addEventListener('click', () => doPop(state, api));
    container.appendChild(btn);
  }
}

const STAGE_STACK = {
  navLabel: '⑤スタック',
  title: '第5章 洞窟の奥 ― スタック ―',
  missionText: '一本道の洞窟を奥へ進み(Push)、行き止まりなら戻り(Pop)ながら、宝物庫を目指そう。',
  dialogue: [
    { who: '村長', text: '洞窟の奥に眠るお宝を取ってきてほしいのです。ただし道は入り組んでいて、行き止まりも多いとか…。' },
    { who: 'あなた', text: '進んだ道は覚えておいて、行き止まりならさっき来た道をそのまま戻ればいいですね。' },
  ],
  build() {
    return { runtime: buildStackRuntime() };
  },
  renderVisual: renderStackVisual,
  renderActions: renderStackActions,
  tick: (state, dt, speed, api) => tickAtInterval(
    state, dt, speed, api, 0.4,
    (rt) => rt.cleared,
    doCaveStep,
  ),
  stepOnce: doCaveStep,
  statusInfo: (state) => ({
    name: 'スタック (Stack)',
    complexity: 'Push/Pop: O(1)',
    operations: state.stageRuntime.operations,
  }),
};

// ============================================================
// ステージ5: キュー
// ============================================================

const QUEUE_NAMES = ['アリス', 'ボブ', 'キャロル', 'ダイスケ', 'エミリー', 'フランク', 'グレース', 'ヒロシ', 'イブ', 'ジャック', 'カレン', 'レオ'];

function buildQueueRuntime() {
  const queue = QUEUE_NAMES.slice(0, 4).map((name, i) => ({ id: i, name }));
  return { queue, nextArrivalIdx: 4, served: 0, operations: 0, done: false };
}

function doServe(state, api) {
  const rt = state.stageRuntime;
  if (rt.queue.length === 0) return;
  const customer = rt.queue.shift();
  rt.served += 1;
  rt.operations += 1;
  api.log(`先頭の「${customer.name}」さんをご案内しました。(Dequeue)`, 'ok');
  if (rt.nextArrivalIdx < QUEUE_NAMES.length) {
    const name = QUEUE_NAMES[rt.nextArrivalIdx];
    rt.nextArrivalIdx += 1;
    rt.queue.push({ id: rt.nextArrivalIdx, name });
    rt.operations += 1;
    api.log(`新しく「${name}」さんが列の最後尾に並びました。(Enqueue)`);
  }
  if (rt.queue.length === 0 && rt.nextArrivalIdx >= QUEUE_NAMES.length) {
    rt.done = true;
    api.log('列に並んでいたお客様、全員のご案内が完了しました！', 'ok');
    api.setStatus(`完了：ご案内${rt.served}人`, 'ok');
    state.playing = false;
  }
  api.refreshActions();
  api.render();
}

function renderQueueTrack(container, items, renderCard) {
  const track = document.createElement('div');
  track.className = 'queue-track';
  items.forEach((item, i) => track.appendChild(renderCard(item, i)));
  container.appendChild(track);
}

function renderQueueVisual(container, state) {
  const rt = state.stageRuntime;
  container.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'stage-info';
  info.textContent = `列に並んでいる人数: ${rt.queue.length}人 / ご案内済み: ${rt.served}人 / 操作回数: ${rt.operations}`;
  container.appendChild(info);

  const live = document.createElement('div');
  live.className = 'live-desc';
  live.textContent = rt.done
    ? '全員のご案内が完了しました！'
    : (rt.queue.length ? `先頭:「${rt.queue[0].name}」さんをご案内できます。` : '次のお客様の到着を待っています…');
  container.appendChild(live);

  renderQueueTrack(container, rt.queue, (c, i) => {
    const card = document.createElement('div');
    card.className = 'queue-card';
    if (i === 0) card.classList.add('front');
    card.innerHTML = `<span class="tag">${i === 0 ? '先頭' : `${i + 1}番目`}</span><span class="name">${escapeHtml(c.name)}</span>`;
    return card;
  });
}

function renderQueueActions(container, state, api) {
  const rt = state.stageRuntime;
  if (rt.done) {
    const next = document.createElement('button');
    next.className = 'primary';
    next.textContent = 'ステージクリア！';
    next.addEventListener('click', () => {
      api.completeStage();
      api.log('キューの「先入れ先出し(FIFO)」のおかげで、来た順番どおり公平にご案内できました。', 'ok');
      api.render();
    });
    container.appendChild(next);
    return;
  }
  const btn = document.createElement('button');
  btn.textContent = '先頭のお客様をご案内する (Dequeue)';
  btn.disabled = rt.queue.length === 0;
  btn.addEventListener('click', () => doServe(state, api));
  container.appendChild(btn);
}

const STAGE_QUEUE = {
  navLabel: '⑥キュー',
  title: '第6章 パン屋の行列 ― キュー ―',
  missionText: '並んでいるお客様を、先頭から順番にご案内しよう。割り込みはできません。',
  dialogue: [
    { who: 'パン屋の店主', text: 'お客さんが並び始めました。手伝ってもらえますか？' },
    { who: 'あなた', text: 'もちろんです。並んだ順番どおり、先頭の方からご案内しますね。' },
  ],
  build() {
    return { runtime: buildQueueRuntime() };
  },
  renderVisual: renderQueueVisual,
  renderActions: renderQueueActions,
  tick: (state, dt, speed, api) => tickAtInterval(
    state, dt, speed, api, 0.35,
    (rt) => rt.done,
    doServe,
  ),
  stepOnce: doServe,
  statusInfo: (state) => ({
    name: 'キュー (Queue)',
    complexity: 'Enqueue/Dequeue: O(1)',
    operations: state.stageRuntime.operations,
  }),
};

// ============================================================
// ステージ6: 優先度付きキュー
// ============================================================

const SEVERITY_LABEL = { 1: '軽症', 2: '中等症', 3: '重症' };

const PATIENT_POOL = [
  { name: 'ナオキ', severity: 1 },
  { name: 'ユミ', severity: 2 },
  { name: 'ワタル', severity: 1 },
  { name: 'ミサキ', severity: 3 },
  { name: 'ケンジ', severity: 2 },
  { name: 'クミコ', severity: 1 },
  { name: 'グレース', severity: 3 },
  { name: 'カレン', severity: 2 },
];

function buildPQRuntime() {
  const waiting = PATIENT_POOL.slice(0, 3).map((p, i) => ({ ...p, id: i }));
  return { waiting, nextArrivalIdx: 3, diagnosed: 0, operations: 0, done: false };
}

function doDiagnose(state, api) {
  const rt = state.stageRuntime;
  if (rt.waiting.length === 0) return;
  let bestIdx = 0;
  for (let i = 1; i < rt.waiting.length; i += 1) {
    if (rt.waiting[i].severity > rt.waiting[bestIdx].severity) bestIdx = i;
  }
  const patient = rt.waiting.splice(bestIdx, 1)[0];
  rt.diagnosed += 1;
  rt.operations += 1;
  const cls = patient.severity === 3 ? 'err' : patient.severity === 1 ? 'ok' : '';
  api.log(`${SEVERITY_LABEL[patient.severity]}の「${patient.name}」さんを診察しました。`, cls);
  if (rt.nextArrivalIdx < PATIENT_POOL.length) {
    const arriving = PATIENT_POOL[rt.nextArrivalIdx];
    rt.nextArrivalIdx += 1;
    rt.waiting.push({ ...arriving, id: rt.nextArrivalIdx });
    rt.operations += 1;
    api.log(`新しく${SEVERITY_LABEL[arriving.severity]}の「${arriving.name}」さんが来院しました。`);
  }
  if (rt.waiting.length === 0 && rt.nextArrivalIdx >= PATIENT_POOL.length) {
    rt.done = true;
    api.log('待合室の患者様、全員の診察が完了しました！', 'ok');
    api.setStatus(`完了：診察${rt.diagnosed}人`, 'ok');
    state.playing = false;
  }
  api.refreshActions();
  api.render();
}

function renderPQVisual(container, state) {
  const rt = state.stageRuntime;
  container.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'stage-info';
  info.textContent = `待合室の人数: ${rt.waiting.length}人 / 診察済み: ${rt.diagnosed}人 / 操作回数: ${rt.operations}`;
  container.appendChild(info);

  const sorted = [...rt.waiting].sort((a, b) => b.severity - a.severity);
  const live = document.createElement('div');
  live.className = 'live-desc';
  live.textContent = rt.done
    ? '全員の診察が完了しました！'
    : (sorted.length ? `次に診察: ${SEVERITY_LABEL[sorted[0].severity]}の「${sorted[0].name}」さん` : '次の患者の来院を待っています…');
  container.appendChild(live);

  renderQueueTrack(container, sorted, (p, i) => {
    const card = document.createElement('div');
    card.className = `queue-card severity-${p.severity}`;
    if (i === 0) card.classList.add('front');
    card.innerHTML = `<span class="tag">${SEVERITY_LABEL[p.severity]}</span><span class="name">${escapeHtml(p.name)}</span>`;
    return card;
  });
}

function renderPQActions(container, state, api) {
  const rt = state.stageRuntime;
  if (rt.done) {
    const next = document.createElement('button');
    next.className = 'primary';
    next.textContent = 'ステージクリア！';
    next.addEventListener('click', () => {
      api.completeStage();
      api.log('優先度付きキューのおかげで、来院順ではなく症状の重さで公平に診察できました。', 'ok');
      api.render();
    });
    container.appendChild(next);
    return;
  }
  const btn = document.createElement('button');
  btn.textContent = '次に診察する（最優先の患者）';
  btn.disabled = rt.waiting.length === 0;
  btn.addEventListener('click', () => doDiagnose(state, api));
  container.appendChild(btn);
}

const STAGE_PQUEUE = {
  navLabel: '⑦優先度付きキュー',
  title: '第7章 救急病院 ― 優先度付きキュー ―',
  missionText: '待合室では、来た順番ではなく症状が重い患者様から診察しよう。',
  dialogue: [
    { who: '看護師', text: '先生、待合室に患者様が増えてきました。順番にご案内しますか？' },
    { who: 'あなた', text: 'いいえ、症状が重い方を優先します。来た順番は関係ありません。' },
  ],
  build() {
    return { runtime: buildPQRuntime() };
  },
  renderVisual: renderPQVisual,
  renderActions: renderPQActions,
  tick: (state, dt, speed, api) => tickAtInterval(
    state, dt, speed, api, 0.4,
    (rt) => rt.done,
    doDiagnose,
  ),
  stepOnce: doDiagnose,
  statusInfo: (state) => ({
    name: '優先度付きキュー (Priority Queue)',
    complexity: '取り出し: O(log N)',
    operations: state.stageRuntime.operations,
  }),
};

// ============================================================
// 共通: グラフ/マップ描画ヘルパー（DFS・BFS・ダイクストラで共用）
// ============================================================

function renderGraphSvg(container, { positions, edges, nodeClass, nodeLabel, nodeSubLabel, edgeClass, edgeLabel, edgeLabelT, viewBox }) {
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
    return `<g class="cave-room ${cls}">
      <rect x="${pos.x - 58}" y="${pos.y - boxH / 2}" width="116" height="${boxH}" rx="10"></rect>
      <text x="${pos.x}" y="${pos.y + (sub ? -3 : 5)}" text-anchor="middle">${escapeHtml(label)}</text>
      ${sub ? `<text x="${pos.x}" y="${pos.y + 16}" text-anchor="middle" class="graph-node-sub">${escapeHtml(sub)}</text>` : ''}
    </g>`;
  }).join('');

  container.innerHTML = `<svg viewBox="${viewBox}" class="cave-map">${edgesSvg}${nodesSvg}</svg>`;
}

function flattenGraphTree(node, map = {}) {
  map[node.id] = node;
  node.children.forEach((c) => flattenGraphTree(c, map));
  return map;
}

function edgesFromTree(node, acc = []) {
  node.children.forEach((c) => {
    acc.push({ from: node.id, to: c.id });
    edgesFromTree(c, acc);
  });
  return acc;
}

// ============================================================
// ステージ7: DFS（深さ優先探索）
// ============================================================

const MAZE_TREE = {
  id: 'start', label: 'スタート', x: 0, y: 0, children: [
    {
      id: 'a', label: '一本道', x: 1, y: 0, children: [
        {
          id: 'b', label: '一本道', x: 2, y: 0, children: [
            {
              id: 'c', label: '分かれ道', x: 2, y: 1, children: [
                { id: 'd', label: '行き止まり', x: 1, y: 1, children: [] },
                {
                  id: 'e', label: '分かれ道', x: 2, y: 2, children: [
                    { id: 'f', label: '行き止まり', x: 3, y: 2, children: [] },
                    {
                      id: 'g', label: '分かれ道', x: 2, y: 3, children: [
                        { id: 'h', label: '行き止まり', x: 1, y: 3, children: [] },
                        { id: 'goal', label: 'ゴール', x: 3, y: 3, children: [], isTreasure: true },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const MAZE_MAP = flattenGraphTree(MAZE_TREE);
const MAZE_EDGES = edgesFromTree(MAZE_TREE);
const MAZE_POS = Object.fromEntries(
  Object.values(MAZE_MAP).map((n) => [n.id, { x: 80 + n.x * 140, y: 60 + n.y * 110 }]),
);

function buildDfsRuntime() {
  return {
    stack: ['start'], explored: {}, visited: new Set(['start']),
    operations: 0, cleared: false,
  };
}

function doDfsPush(state, api) {
  const rt = state.stageRuntime;
  const current = MAZE_MAP[rt.stack[rt.stack.length - 1]];
  const idx = rt.explored[current.id] || 0;
  const child = current.children[idx];
  rt.stack.push(child.id);
  rt.visited.add(child.id);
  rt.operations += 1;
  api.log(`「${child.label}」へ進みました。(Push)`);
  if (child.isTreasure) {
    rt.cleared = true;
    api.log('ゴールに到達しました！', 'ok');
    api.setStatus(`到達！操作回数: ${rt.operations}`, 'ok');
    state.playing = false;
  } else if (child.children.length === 0) {
    api.log(`「${child.label}」…先へは進めません。`, 'err');
  }
  api.refreshActions();
  api.render();
}

function doDfsPop(state, api) {
  const rt = state.stageRuntime;
  if (rt.stack.length <= 1) return;
  const popped = MAZE_MAP[rt.stack.pop()];
  const parent = MAZE_MAP[rt.stack[rt.stack.length - 1]];
  rt.explored[parent.id] = (rt.explored[parent.id] || 0) + 1;
  rt.operations += 1;
  api.log(`「${popped.label}」から「${parent.label}」へ戻りました。(Pop)`);
  api.refreshActions();
  api.render();
}

function doDfsStep(state, api) {
  const rt = state.stageRuntime;
  if (rt.cleared) return;
  const current = MAZE_MAP[rt.stack[rt.stack.length - 1]];
  const idx = rt.explored[current.id] || 0;
  if (current.children.length > idx) {
    doDfsPush(state, api);
  } else if (rt.stack.length > 1) {
    doDfsPop(state, api);
  }
}

function renderDfsVisual(container, state) {
  const rt = state.stageRuntime;
  container.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'stage-info';
  info.textContent = `スタックの深さ: ${rt.stack.length} / 操作回数: ${rt.operations}`;
  container.appendChild(info);

  const current = MAZE_MAP[rt.stack[rt.stack.length - 1]];
  const idx = rt.explored[current.id] || 0;
  const live = document.createElement('div');
  live.className = 'live-desc';
  live.textContent = rt.cleared
    ? 'ゴールに到達しました！'
    : (current.children.length > idx
      ? `現在地:「${current.label}」。奥へ進めます。`
      : `現在地:「${current.label}」。これ以上は進めません…戻りましょう。`);
  container.appendChild(live);

  const mapBox = document.createElement('div');
  const stackIds = new Set(rt.stack);
  renderGraphSvg(mapBox, {
    positions: MAZE_POS,
    edges: MAZE_EDGES,
    edgeClass: (from, to) => (stackIds.has(from) && stackIds.has(to) ? 'on-path' : ''),
    nodeLabel: (id) => MAZE_MAP[id].label,
    nodeClass: (id) => {
      const node = MAZE_MAP[id];
      const visited = rt.visited.has(id);
      const isCurrent = id === current.id;
      const isDeadend = node.children.length === 0 && !node.isTreasure;
      return [
        !visited ? 'unvisited' : '',
        visited && isCurrent ? 'current' : '',
        visited && !isCurrent && stackIds.has(id) ? 'onpath' : '',
        visited && node.isTreasure ? 'treasure' : '',
        visited && isDeadend ? 'deadend' : '',
      ].filter(Boolean).join(' ');
    },
    viewBox: '0 0 580 440',
  });
  container.appendChild(mapBox);

  renderBarLegend(container, [
    { cls: 'cave-current', label: '現在地' },
    { cls: 'cave-onpath', label: '通ってきた道' },
    { cls: 'cave-treasure', label: 'ゴール' },
    { cls: 'cave-deadend', label: '行き止まり' },
    { cls: 'cave-unvisited', label: '未探索' },
  ]);
}

function renderDfsActions(container, state, api) {
  const rt = state.stageRuntime;
  if (rt.cleared) {
    const next = document.createElement('button');
    next.className = 'primary';
    next.textContent = 'ステージクリア！';
    next.addEventListener('click', () => {
      api.completeStage();
      api.log('迷路をとにかく奥へ進み、行き止まりで戻る…これがDFS(深さ優先探索)です。', 'ok');
      api.render();
    });
    container.appendChild(next);
    return;
  }
  const current = MAZE_MAP[rt.stack[rt.stack.length - 1]];
  const idx = rt.explored[current.id] || 0;
  if (current.children.length > idx) {
    const child = current.children[idx];
    const btn = document.createElement('button');
    btn.textContent = `「${child.label}」へ進む (Push)`;
    btn.addEventListener('click', () => doDfsPush(state, api));
    container.appendChild(btn);
  } else if (rt.stack.length > 1) {
    const btn = document.createElement('button');
    btn.textContent = '戻る (Pop)';
    btn.addEventListener('click', () => doDfsPop(state, api));
    container.appendChild(btn);
  }
}

const STAGE_DFS = {
  navLabel: '⑧DFS',
  title: '第8章 迷路の館 ― DFS(深さ優先探索) ―',
  missionText: 'とにかく奥へ進み、行き止まりなら戻りながら、迷路の奥にあるゴールを目指そう。',
  dialogue: [
    { who: '館の主', text: 'この迷路を抜けられたら褒美をあげよう。ただし行き止まりも多いぞ。' },
    { who: 'あなた', text: 'これはスタックの時とやり方は同じですね。とにかく奥へ、行き止まりなら戻る。' },
    { who: 'あなた', text: 'この「行けるところまで進んで、ダメなら戻る」探し方が「DFS(深さ優先探索)」なんですね。' },
  ],
  build() {
    return { runtime: buildDfsRuntime() };
  },
  renderVisual: renderDfsVisual,
  renderActions: renderDfsActions,
  tick: (state, dt, speed, api) => tickAtInterval(state, dt, speed, api, 0.4, (rt) => rt.cleared, doDfsStep),
  stepOnce: doDfsStep,
  statusInfo: (state) => ({
    name: 'DFS (深さ優先探索)',
    complexity: 'O(V+E)',
    operations: state.stageRuntime.operations,
  }),
};

// ============================================================
// ステージ8: BFS（幅優先探索）
// ============================================================

const FIRE_TREE = {
  id: 'start', label: '出火元', x: 0, y: 2, children: [
    {
      id: 'L1', label: '分かれ道', x: 1, y: 2, children: [
        {
          id: 'L2', label: '分かれ道', x: 1, y: 1, children: [
            {
              id: 'L3', label: '分かれ道', x: 2, y: 1, children: [
                { id: 'hydrantFar', label: '消火栓(遠い)', x: 2, y: 0, children: [], isHydrant: true },
              ],
            },
          ],
        },
      ],
    },
    { id: 'D1', label: '行き止まり', x: 0, y: 1, children: [] },
    {
      id: 'S1', label: '分かれ道', x: 0, y: 3, children: [
        { id: 'hydrantNear', label: '消火栓(近い)', x: 1, y: 3, children: [], isHydrant: true },
      ],
    },
  ],
};

const FIRE_MAP = flattenGraphTree(FIRE_TREE);
const FIRE_EDGES = edgesFromTree(FIRE_TREE);
const FIRE_POS = Object.fromEntries(
  Object.values(FIRE_MAP).map((n) => [n.id, { x: 90 + n.x * 140, y: 60 + n.y * 100 }]),
);

function buildBfsRuntime() {
  return {
    queueIds: ['start'], visitedIds: new Set(), queuedIds: new Set(['start']),
    distance: { start: 0 }, operations: 0, cleared: false,
  };
}

function doBfsStep(state, api) {
  const rt = state.stageRuntime;
  if (rt.cleared || rt.queueIds.length === 0) return;
  const id = rt.queueIds.shift();
  rt.queuedIds.delete(id);
  rt.visitedIds.add(id);
  rt.operations += 1;
  const node = FIRE_MAP[id];
  api.log(`「${node.label}」を確認しました。(Dequeue)`);
  if (node.isHydrant) {
    rt.cleared = true;
    api.log(`一番近い消火栓「${node.label}」を発見！ 出火元から${rt.distance[id]}マスの距離でした。`, 'ok');
    api.setStatus(`発見！距離${rt.distance[id]} / 操作回数${rt.operations}`, 'ok');
    state.playing = false;
  } else {
    node.children.forEach((child) => {
      if (!rt.visitedIds.has(child.id) && !rt.queuedIds.has(child.id)) {
        rt.queueIds.push(child.id);
        rt.queuedIds.add(child.id);
        rt.distance[child.id] = rt.distance[id] + 1;
        rt.operations += 1;
        api.log(`「${child.label}」を確認待ちの列に追加しました。(Enqueue)`);
      }
    });
    if (rt.queueIds.length === 0) {
      rt.cleared = true;
      api.log('これ以上調べられる場所がありません。', 'err');
      state.playing = false;
    }
  }
  api.refreshActions();
  api.render();
}

function renderBfsVisual(container, state) {
  const rt = state.stageRuntime;
  container.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'stage-info';
  info.textContent = `確認待ちの人数: ${rt.queueIds.length} / 操作回数: ${rt.operations}`;
  container.appendChild(info);

  const live = document.createElement('div');
  live.className = 'live-desc';
  live.textContent = rt.cleared
    ? '一番近い消火栓を発見しました！'
    : (rt.queueIds.length ? `次に確認: 「${FIRE_MAP[rt.queueIds[0]].label}」` : '確認できる場所がありません…');
  container.appendChild(live);

  const mapBox = document.createElement('div');
  renderGraphSvg(mapBox, {
    positions: FIRE_POS,
    edges: FIRE_EDGES,
    edgeClass: (from, to) => (rt.visitedIds.has(from) && (rt.visitedIds.has(to) || rt.queuedIds.has(to)) ? 'on-path' : ''),
    nodeLabel: (id) => FIRE_MAP[id].label,
    nodeClass: (id) => {
      const node = FIRE_MAP[id];
      const visited = rt.visitedIds.has(id);
      const queued = rt.queuedIds.has(id);
      return [
        !visited && !queued ? 'unvisited' : '',
        queued ? 'candidate' : '',
        visited && node.isHydrant ? 'treasure' : '',
        visited && !node.isHydrant && node.children.length === 0 ? 'deadend' : '',
        visited && !node.isHydrant && node.children.length > 0 ? 'onpath' : '',
      ].filter(Boolean).join(' ');
    },
    viewBox: '0 0 450 420',
  });
  container.appendChild(mapBox);

  renderBarLegend(container, [
    { cls: 'cave-candidate', label: '確認待ち(キュー内)' },
    { cls: 'cave-onpath', label: '確認済み' },
    { cls: 'cave-treasure', label: '消火栓発見' },
    { cls: 'cave-deadend', label: '行き止まり' },
    { cls: 'cave-unvisited', label: '未確認' },
  ]);
}

function renderBfsActions(container, state, api) {
  const rt = state.stageRuntime;
  if (rt.cleared) {
    const next = document.createElement('button');
    next.className = 'primary';
    next.textContent = 'ステージクリア！';
    next.addEventListener('click', () => {
      api.completeStage();
      api.log('近い場所から順番に確認するBFS(幅優先探索)なら、必ず一番近い消火栓を見つけられます。奥から探すDFSだと、遠い消火栓に先に辿り着いてしまうこともあります。', 'ok');
      api.render();
    });
    container.appendChild(next);
    return;
  }
  const btn = document.createElement('button');
  btn.textContent = '確認待ちの先頭を調べる (Dequeue)';
  btn.disabled = rt.queueIds.length === 0;
  btn.addEventListener('click', () => doBfsStep(state, api));
  container.appendChild(btn);
}

const STAGE_BFS = {
  navLabel: '⑨BFS',
  title: '第9章 火事だ！ ― BFS(幅優先探索) ―',
  missionText: '出火元から近い順に確認して、一番近い消火栓を見つけよう。',
  dialogue: [
    { who: '消防隊長', text: '火事だ！一番近い消火栓はどこだ！？' },
    { who: 'あなた', text: '奥から探す(DFS)と、遠い消火栓に先に辿り着いてしまうかもしれません。' },
    { who: 'あなた', text: '近い場所から順番に確認していく「BFS(幅優先探索)」で探しましょう。' },
  ],
  build() {
    return { runtime: buildBfsRuntime() };
  },
  renderVisual: renderBfsVisual,
  renderActions: renderBfsActions,
  tick: (state, dt, speed, api) => tickAtInterval(state, dt, speed, api, 0.4, (rt) => rt.cleared, doBfsStep),
  stepOnce: doBfsStep,
  statusInfo: (state) => ({
    name: 'BFS (幅優先探索)',
    complexity: 'O(V+E)',
    operations: state.stageRuntime.operations,
  }),
};

// ============================================================
// ステージ9: ダイクストラ法
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
  { from: 'capital', to: 'mountain', weight: 25, roadLabel: '山', labelT: 0.2 },
  { from: 'capital', to: 'harbor', weight: 12, roadLabel: '港街道' },
  { from: 'forest', to: 'mountain', weight: 3, roadLabel: '街道' },
  { from: 'forest', to: 'lake', weight: 4, roadLabel: '森', labelT: 0.8 },
  { from: 'mountain', to: 'pass', weight: 6, roadLabel: '街道' },
  { from: 'lake', to: 'pass', weight: 6, roadLabel: '街道' },
  { from: 'lake', to: 'valley', weight: 9, roadLabel: '森', labelT: 0.2 },
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

  const mapBox = document.createElement('div');
  renderGraphSvg(mapBox, {
    positions: KINGDOM_POS,
    edges: KINGDOM_EDGES,
    edgeLabel: (from, to) => {
      const e = KINGDOM_EDGES.find((x) => x.from === from && x.to === to);
      return e ? `${e.roadLabel} ${e.weight}分` : '';
    },
    edgeLabelT: (from, to) => findKingdomEdge(from, to)?.labelT ?? 0.5,
    edgeClass: (from, to) => (rt.settled.has(from) && rt.prev[to] === from ? 'on-path' : ''),
    nodeLabel: (id) => KINGDOM_NODES[id].label,
    nodeSubLabel: (id) => (rt.dist[id] === Infinity ? '∞' : `${rt.dist[id]}分`),
    nodeClass: (id) => {
      const node = KINGDOM_NODES[id];
      const settled = rt.settled.has(id);
      return [
        !settled && rt.dist[id] === Infinity ? 'unvisited' : '',
        !settled && rt.dist[id] !== Infinity ? 'candidate' : '',
        settled && node.isGoal ? 'treasure' : '',
        settled && !node.isGoal ? 'onpath' : '',
      ].filter(Boolean).join(' ');
    },
    viewBox: '0 0 800 450',
  });
  container.appendChild(mapBox);

  renderBarLegend(container, [
    { cls: 'cave-onpath', label: '最短時間が確定' },
    { cls: 'cave-candidate', label: '候補（時間わかっている）' },
    { cls: 'cave-treasure', label: 'ゴール確定' },
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
  navLabel: '⑩ダイクストラ法',
  title: '第10章 王国マップ ― ダイクストラ法 ―',
  missionText: '道の数が増えて複雑になった。一直線の近道に見える道ほど、実は遠回りかもしれない。王都から隣国までの最短時間の道を見つけよう。',
  dialogue: [
    { who: '王', text: '隣国まで一番早く着ける道を調べてくれ。港からの海路は一直線で近そうだが…本当に一番速いか？' },
    { who: 'あなた', text: '道の数が多くて、見た目だけでは判断できませんね。一直線に近い道が、必ずしも一番速いとは限りません。' },
    { who: 'あなた', text: '今わかっている中で一番近い場所から、一つずつ確実に確定させていきましょう。' },
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

export const STAGES = [
  STAGE_LINEAR, STAGE_BINARY, STAGE_BUBBLE, STAGE_QUICK,
  STAGE_STACK, STAGE_QUEUE, STAGE_PQUEUE,
  STAGE_DFS, STAGE_BFS, STAGE_DIJKSTRA,
];
