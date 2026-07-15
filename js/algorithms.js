// 探索・ソートの純粋ロジック（DOM操作は一切行わない）
import { compareNames } from './villagers.js';

// ---------- 線形探索 ----------

export function createLinearRuntime(villagers, target) {
  return { villagers, target, pointer: -1, operations: 0, found: false, exhausted: false };
}

/** 次の1人を確認する。戻り値: { checkedIndex, matched, exhausted } */
export function linearStep(runtime) {
  if (runtime.found || runtime.exhausted) return null;
  runtime.pointer += 1;
  if (runtime.pointer >= runtime.villagers.length) {
    runtime.exhausted = true;
    return { checkedIndex: -1, matched: false, exhausted: true };
  }
  runtime.operations += 1;
  const matched = runtime.villagers[runtime.pointer].name === runtime.target;
  if (matched) runtime.found = true;
  return { checkedIndex: runtime.pointer, matched, exhausted: false };
}

// ---------- 二分探索 ----------

export function createBinaryRuntime(sortedVillagers, target) {
  return {
    villagers: sortedVillagers,
    target,
    lo: 0,
    hi: sortedVillagers.length - 1,
    mid: -1,
    operations: 0,
    found: false,
    exhausted: false,
  };
}

/** 中央を確認し、範囲を半分に絞る。戻り値: { mid, cmp, found, exhausted } */
export function binaryStep(runtime) {
  if (runtime.found || runtime.exhausted) return null;
  if (runtime.lo > runtime.hi) {
    runtime.exhausted = true;
    return { mid: -1, cmp: 0, found: false, exhausted: true };
  }
  const mid = (runtime.lo + runtime.hi) >> 1;
  runtime.mid = mid;
  runtime.operations += 1;
  const cmp = compareNames(runtime.target, runtime.villagers[mid].name);
  if (cmp === 0) {
    runtime.found = true;
    return { mid, cmp, found: true, exhausted: false };
  }
  if (cmp < 0) runtime.hi = mid - 1;
  else runtime.lo = mid + 1;
  return { mid, cmp, found: false, exhausted: false };
}

// ---------- バブルソート（手動ステップ） ----------

export function createBubbleRuntime(values) {
  return {
    arr: [...values],
    j: 0,
    passEnd: values.length - 1,
    comparisons: 0,
    swaps: 0,
    sortedTail: values.length <= 1 ? values.length : 0,
    sorted: values.length <= 1,
  };
}

/** 隣同士を1回だけ比較（必要なら交換）する。戻り値: { i, j, swapped, passDone, sorted } */
export function bubbleStep(runtime) {
  if (runtime.sorted) return null;
  const i = runtime.j;
  const j = runtime.j + 1;
  runtime.comparisons += 1;
  let swapped = false;
  if (runtime.arr[i] > runtime.arr[j]) {
    [runtime.arr[i], runtime.arr[j]] = [runtime.arr[j], runtime.arr[i]];
    runtime.swaps += 1;
    swapped = true;
  }
  runtime.j += 1;
  let passDone = false;
  if (runtime.j >= runtime.passEnd) {
    passDone = true;
    runtime.j = 0;
    runtime.passEnd -= 1;
    runtime.sortedTail += 1;
    if (runtime.passEnd <= 0) runtime.sorted = true;
  }
  return { i, j, swapped, passDone, sorted: runtime.sorted };
}

// ---------- クイックソート（イベント事前計算→自動再生） ----------

/**
 * クイックソートを実行しながら操作イベントを記録する。
 * イベント種別: range(lo,hi)＝今処理中の部分配列 / pivot(pivotIndex) /
 * compare(i,j) / swap(i,j) / partitionDone(pivotFinalIndex) /
 * confirmed(index) ＝そのindexが最終位置に確定
 */
export function computeQuickSortEvents(values) {
  const arr = [...values];
  const events = [];
  let comparisons = 0;
  let swaps = 0;

  function swap(i, j) {
    [arr[i], arr[j]] = [arr[j], arr[i]];
    swaps += 1;
    events.push({ type: 'swap', i, j });
  }

  function partition(lo, hi) {
    events.push({ type: 'range', lo, hi });
    const pivotIndex = hi;
    const pivot = arr[pivotIndex];
    events.push({ type: 'pivot', index: pivotIndex });
    let i = lo;
    for (let j = lo; j < hi; j += 1) {
      comparisons += 1;
      events.push({ type: 'compare', i: j, j: pivotIndex });
      if (arr[j] < pivot) {
        if (i !== j) swap(i, j);
        i += 1;
      }
    }
    if (i !== pivotIndex) swap(i, pivotIndex);
    events.push({ type: 'partitionDone', index: i });
    events.push({ type: 'confirmed', index: i });
    return i;
  }

  function quickSort(lo, hi) {
    if (lo > hi) return;
    if (lo === hi) {
      events.push({ type: 'range', lo, hi });
      events.push({ type: 'confirmed', index: lo });
      return;
    }
    const p = partition(lo, hi);
    quickSort(lo, p - 1);
    quickSort(p + 1, hi);
  }

  quickSort(0, arr.length - 1);
  events.push({ type: 'done' });
  return { events, sortedArray: arr, comparisons, swaps };
}
