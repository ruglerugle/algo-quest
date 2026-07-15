// 村人データ生成と名前比較

const NAME_POOL = [
  'アリス', 'ボブ', 'キャロル', 'ダイスケ', 'エミリー', 'フランク', 'グレース', 'ヒロシ',
  'イブ', 'ジャック', 'カレン', 'レオ', 'マリコ', 'ナオキ', 'オリビア', 'ポール',
  'クミコ', 'リョウ', 'サキ', 'タロウ', 'ユミ', 'ワタル', 'ミサキ', 'ケンジ',
];

// NAME_POOLを使い切った分の穴埋め用（姓+名の組み合わせで実在感のある名前を生成する）
const FILLER_SURNAMES = [
  '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤',
  '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水',
  '山崎', '森', '池田', '橋本', '阿部', '石川', '前田', '藤田', '後藤', '岡田',
];
const FILLER_GIVEN = [
  'アリス', 'ボブ', 'キャロル', 'ダイスケ', 'エミリー', 'フランク', 'グレース', 'ヒロシ',
  'イブ', 'ジャック', 'カレン', 'レオ', 'マリコ', 'ナオキ', 'オリビア', 'ポール',
  'クミコ', 'リョウ', 'サキ', 'タロウ', 'ユミ', 'ワタル', 'ミサキ', 'ケンジ',
  'ハルカ', 'ソウタ', 'アヤカ', 'コウジ', 'マナミ', 'ユウキ', 'チヒロ', 'リク',
  'サユリ', 'ダイキ', 'ホノカ', 'シュン', 'アカリ', 'ケイタ', 'ミユ', 'ハヤト',
];

function generateFillerName(i) {
  const surname = FILLER_SURNAMES[i % FILLER_SURNAMES.length];
  const given = FILLER_GIVEN[Math.floor(i / FILLER_SURNAMES.length) % FILLER_GIVEN.length];
  return `${surname}${given}`;
}

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
  const villagers = [];
  for (let i = 0; i < n; i += 1) {
    const name = i < NAME_POOL.length ? NAME_POOL[i] : generateFillerName(i - NAME_POOL.length);
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
