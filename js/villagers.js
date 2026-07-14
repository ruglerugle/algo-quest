// 村人データ生成と名前比較

const NAME_POOL = [
  'アリス', 'ボブ', 'キャロル', 'ダイスケ', 'エミリー', 'フランク', 'グレース', 'ヒロシ',
  'イブ', 'ジャック', 'カレン', 'レオ', 'マリコ', 'ナオキ', 'オリビア', 'ポール',
  'クミコ', 'リョウ', 'サキ', 'タロウ', 'ユミ', 'ワタル', 'ミサキ', 'ケンジ',
];

const collator = new Intl.Collator('ja');

export function compareNames(a, b) {
  return collator.compare(a, b);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * N人分の村人データを生成する。
 * target: 必ずリストに含める名前（既定で名前プールの先頭に存在する）
 * sorted: trueなら五十音順、falseならシャッフル
 */
export function generateVillagers(n, { target, sorted = false } = {}) {
  const width = String(n).length;
  const villagers = [];
  for (let i = 0; i < n; i += 1) {
    const name = i < NAME_POOL.length ? NAME_POOL[i] : `村人${String(i + 1).padStart(width, '0')}号`;
    villagers.push({ id: i, name });
  }
  if (target && !villagers.some((v) => v.name === target)) {
    villagers[Math.floor(Math.random() * villagers.length)].name = target;
  }
  if (sorted) {
    villagers.sort((a, b) => compareNames(a.name, b.name));
  } else {
    shuffle(villagers);
  }
  return villagers;
}
