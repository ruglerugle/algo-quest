// 村人データ生成と名前比較

const NAME_POOL = [
  'アリス', 'ボブ', 'キャロル', 'ダイスケ', 'エミリー', 'フランク', 'グレース', 'ヒロシ',
  'イブ', 'ジャック', 'カレン', 'レオ', 'マリコ', 'ナオキ', 'オリビア', 'ポール',
  'クミコ', 'リョウ', 'サキ', 'タロウ', 'ユミ', 'ワタル', 'ミサキ', 'ケンジ',
];

// NAME_POOLを使い切った分の穴埋め用（姓+名の組み合わせで実在感のある名前を生成する）
// 五十音順ソート(compareNames)が正しく機能するよう、姓もカタカナで統一する
const FILLER_SURNAMES = [
  'スミス', 'ジョーンズ', 'ブラウン', 'テイラー', 'ウィルソン', 'ムーア', 'クラーク', 'ホワイト',
  'ハリス', 'マーティン', 'トンプソン', 'ヤング', 'ウォーカー', 'アレン', 'キング', 'ライト',
  'ヒル', 'グリーン', 'アダムス', 'ベイカー', 'ネルソン', 'カーター', 'ミッチェル', 'ロバーツ',
  'ターナー', 'フィリップス', 'パーカー', 'エバンス', 'エドワーズ', 'コリンズ', 'ステュワート', 'サンチェス',
  'モリス', 'ロジャース', 'リード', 'クック', 'モーガン', 'ベル', 'マーフィー', 'バード',
  'クーパー', 'リチャードソン', 'ウッド', 'ワトソン', 'ブルックス', 'ベネット', 'グレイ', 'ジェームズ',
  'ヘイズ', 'マイヤーズ',
];
const FILLER_GIVEN = [
  'アリス', 'ボブ', 'キャロル', 'ダイスケ', 'エミリー', 'フランク', 'グレース', 'ヒロシ',
  'イブ', 'ジャック', 'カレン', 'レオ', 'マリコ', 'ナオキ', 'オリビア', 'ポール',
  'クミコ', 'リョウ', 'サキ', 'タロウ', 'ユミ', 'ワタル', 'ミサキ', 'ケンジ',
  'ハルカ', 'ソウタ', 'アヤカ', 'コウジ', 'マナミ', 'ユウキ', 'チヒロ', 'リク',
  'サユリ', 'ダイキ', 'ホノカ', 'シュン', 'アカリ', 'ケイタ', 'ミユ', 'ハヤト',
  'ナツミ', 'ケント', 'エリカ', 'マサト', 'リナ', 'ショウ', 'ミオ', 'タクミ',
  'カズヤ', 'サトシ',
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
  const usedCount = {};
  for (let i = 0; i < n; i += 1) {
    let name;
    if (i < NAME_POOL.length) {
      name = NAME_POOL[i];
    } else {
      const base = generateFillerName(i - NAME_POOL.length);
      usedCount[base] = (usedCount[base] || 0) + 1;
      name = usedCount[base] > 1 ? `${base}(${usedCount[base]})` : base;
    }
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
