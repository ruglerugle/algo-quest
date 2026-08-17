// DOM描画専任。ステージ固有の見た目は stageDef.renderVisual / renderActions に委譲する。

export function renderStageNav(stages, state, onSelect) {
  const nav = document.getElementById('stage-nav');
  nav.innerHTML = '';

  const clearedCount = Math.max(0, state.unlockedCount - 1);
  const progressLabel = document.getElementById('progress-label');
  const progressFill = document.getElementById('progress-fill');
  if (progressLabel) progressLabel.textContent = `クリア ${clearedCount} / ${stages.length}`;
  if (progressFill) progressFill.style.width = `${(clearedCount / stages.length) * 100}%`;

  stages.forEach((s, i) => {
    const done = i < state.unlockedCount - 1;
    const locked = i > state.unlockedCount - 1;
    const active = i === state.stageIndex;

    const btn = document.createElement('button');
    btn.className = `side-step${active ? ' active' : ''}${done ? ' done' : ''}${locked ? ' locked' : ''}`;
    btn.disabled = locked;

    const paw = document.createElement('span');
    paw.className = 'paw';
    paw.textContent = '📦';
    btn.appendChild(paw);

    const label = document.createElement('span');
    label.className = 'side-step-label';
    label.textContent = s.navLabel;
    btn.appendChild(label);

    const status = document.createElement('span');
    status.className = 'status-icon';
    status.textContent = done ? '✅' : locked ? '🔒' : '';
    btn.appendChild(status);

    btn.addEventListener('click', () => onSelect(i));
    nav.appendChild(btn);
  });
}

const SPEAKER_ICONS = {
  村長: '/images/soncho.png',
  王: '/images/king.png',
  あなた: '/images/you.png',
};

function dialogueRow(who, text) {
  const icon = SPEAKER_ICONS[who];
  const isYou = who === 'あなた';
  const side = isYou ? ' right' : '';
  const frameHtml = icon
    ? `<div class="dialog-character"><img src="${icon}" alt="${escapeHtml(who)}"><div class="dialog-name ${isYou ? 'you' : 'npc'}">${escapeHtml(who)}</div></div>`
    : '';
  return `<div class="dialog-row${side}">${frameHtml}<div class="dialog-bubble">${escapeHtml(text)}</div></div>`;
}

export function renderDialogue(stageDef) {
  const box = document.getElementById('dialogue-panel');
  const lines = stageDef.dialogue ?? [];
  box.innerHTML = lines.length
    ? `<div class="dialog-scene">${lines.map((l) => dialogueRow(l.who, l.text)).join('')}</div>`
    : '';
}

export function renderMissionBanner(stageDef) {
  document.getElementById('mission-title').textContent = stageDef.title;
  document.getElementById('mission-text').textContent = stageDef.missionText;
  setMissionStatus('', '');
}

export function setMissionStatus(text, cls) {
  const el = document.getElementById('mission-status');
  el.textContent = text;
  el.className = cls ?? '';
}

export function renderStageActions(container, stageDef, state, api) {
  container.innerHTML = '';
  stageDef.renderActions(container, state, api);
}

export function renderStageVisual(container, stageDef, state, api) {
  stageDef.renderVisual(container, state, api);
}

export function renderStatusBox(stageDef, state) {
  const el = document.getElementById('status-content');
  if (!stageDef.statusInfo) {
    el.innerHTML = '<p class="hint">ステージを開始すると表示されます</p>';
    return;
  }
  const info = stageDef.statusInfo(state);
  el.innerHTML = `
    <p class="algo-name">${escapeHtml(info.name)}</p>
    <p class="algo-meta">計算量の目安: <span>${escapeHtml(info.complexity)}</span></p>
    <p class="algo-ops">操作回数: <span>${info.operations}</span></p>
  `;
}

const BOOK_RECOMMEND = {
  title: '石畑清『アルゴリズムとデータ構造』(岩波講座 ソフトウェア科学)',
  url: 'https://www.amazon.co.jp/dp/4000103431?tag=senjin-22',
  cover: 'https://m.media-amazon.com/images/I/41lM1rzG12L._SY385_.jpg',
};

export function renderBookRecommend() {
  const el = document.getElementById('book-recommend');
  el.innerHTML = `
    <p class="book-recommend-label">参考文献</p>
    <div class="book-recommend-body">
      <a href="${BOOK_RECOMMEND.url}" target="_blank" rel="sponsored noopener">
        <img src="${BOOK_RECOMMEND.cover}" alt="${escapeHtml(BOOK_RECOMMEND.title)}" class="book-recommend-cover">
      </a>
      <div>
        <p class="book-recommend-lead">もっと深く学びたい方へ</p>
        <a href="${BOOK_RECOMMEND.url}" target="_blank" rel="sponsored noopener">${escapeHtml(BOOK_RECOMMEND.title)}</a>
      </div>
    </div>
  `;
}

export function renderCompareBox(html) {
  document.getElementById('compare-box').innerHTML = html ?? '';
}

export function clearLog() {
  document.getElementById('log-list').innerHTML = '';
}

export function appendLog(message, cls) {
  const list = document.getElementById('log-list');
  const li = document.createElement('li');
  li.textContent = message;
  if (cls) li.className = cls;
  list.appendChild(li);
  const panel = document.getElementById('log-panel');
  panel.scrollTop = panel.scrollHeight;
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ===== 全クリアまとめ画面 =====
export function renderEnding(onReplay) {
  const main = document.getElementById('main-area');
  const el = document.getElementById('ending-screen');
  el.hidden = false;
  el.innerHTML = `
    <div class="ending-card">
      <div class="ending-emoji">🎉</div>
      <h2>全章クリア！おめでとうございます</h2>
      <p class="ending-lead">王国の物流エンジニアとして、6つのアルゴリズムをやり遂げました。</p>
      <div class="ending-list">
        ✅ 第1章 線形探索 ― 端から1件ずつ確認する <span class="o">O(N)</span><br>
        ✅ 第2章 二分探索 ― 並んだデータを半分ずつ絞り込む <span class="o">O(log N)</span><br>
        ✅ 第3章 バブルソート ― 隣同士を比べて交換する <span class="o">O(N&sup2;)</span><br>
        ✅ 第4章 クイックソート ― 基準で仕分けて分割統治 <span class="o">O(N log N)</span><br>
        ✅ 第5章 ダイクストラ法 ― 距離が確定した町から最短経路を広げる<br>
        ✅ 第6章 動的計画法 ― 一度計算した答えをメモして再利用する
      </div>
      <p class="ending-note">同じ問題でも、アルゴリズムの選び方で手数は桁違いに変わる。計算量（O記法）は、その差を見積もる物差しです。下の参考書は、今日体験したことを理屈から支えてくれます。</p>
      <div class="ending-actions">
        <button type="button" id="ending-replay">↺ はじめから遊びなおす</button>
        <a class="share" href="https://x.com/intent/post?text=${encodeURIComponent('アルゴリズムクエスト 全章クリア！🎉 探索・ソート・最短経路・動的計画法をゲームで学べる無料アルゴリズム学習ゲーム')}&url=${encodeURIComponent('https://informatics.habatakijuku.com/algo-quest/')}" target="_blank" rel="noopener">𝕏 クリアを報告する</a>
        <a href="/">🧭 他のクエストも遊ぶ</a>
      </div>
    </div>
  `;
  el.querySelector('#ending-replay').addEventListener('click', onReplay);
  main.classList.add('ending-mode');
  window.scrollTo(0, 0);
}

export function hideEnding() {
  const main = document.getElementById('main-area');
  if (!main.classList.contains('ending-mode')) return;
  main.classList.remove('ending-mode');
  const el = document.getElementById('ending-screen');
  el.hidden = true;
  el.innerHTML = '';
}

// ===== 章末クイズ =====
export function renderQuiz(quiz, onPass) {
  const panel = document.getElementById('quiz-panel');
  panel.hidden = false;
  let idx = 0;

  function renderQuestion() {
    const item = quiz[idx];
    panel.innerHTML = `
      <div class="quiz-box">
        <div class="quiz-head">📜 理解度チェック（${idx + 1} / ${quiz.length}）― 全問正解でつぎへ進めます</div>
        <div class="quiz-q">Q${idx + 1}. ${escapeHtml(item.q)}</div>
        <div class="quiz-choices"></div>
        <div class="quiz-feedback"></div>
      </div>
    `;
    const choicesEl = panel.querySelector('.quiz-choices');
    const feedback = panel.querySelector('.quiz-feedback');
    item.choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.textContent = `${'ABC'[i]}. ${choice}`;
      btn.addEventListener('click', () => {
        if (i !== item.correct) {
          feedback.className = 'quiz-feedback ng';
          feedback.textContent = '❌ 不正解。ステージで体験したことを思い出して、もう一度考えてみよう。';
          return;
        }
        feedback.className = 'quiz-feedback ok';
        feedback.textContent = `⭕ 正解！ ${item.explain}`;
        choicesEl.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        const next = document.createElement('button');
        next.className = 'quiz-pass';
        if (idx + 1 < quiz.length) {
          next.textContent = 'つぎの問題へ ▶';
          next.addEventListener('click', () => { idx += 1; renderQuestion(); });
        } else {
          next.textContent = '✅ 合格！つぎへ進む';
          next.addEventListener('click', onPass);
        }
        panel.querySelector('.quiz-box').appendChild(next);
      });
      choicesEl.appendChild(btn);
    });
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  renderQuestion();
}

export function hideQuiz() {
  const panel = document.getElementById('quiz-panel');
  panel.hidden = true;
  panel.innerHTML = '';
}
