// DOM描画専任。ステージ固有の見た目は stageDef.renderVisual / renderActions に委譲する。

export function renderStageNav(stages, state, onSelect) {
  const nav = document.getElementById('stage-nav');
  nav.innerHTML = '';
  stages.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.textContent = s.navLabel;
    if (i === state.stageIndex) btn.classList.add('active');
    if (i > state.unlockedCount - 1) btn.disabled = true;
    btn.addEventListener('click', () => onSelect(i));
    nav.appendChild(btn);
  });
}

export function renderDialogue(stageDef) {
  const box = document.getElementById('dialogue-panel');
  const lines = stageDef.dialogue ?? [];
  box.innerHTML = lines.length
    ? lines.map((l) => `<p class="dialogue-line"><span class="speaker">${escapeHtml(l.who)}</span>${escapeHtml(l.text)}</p>`).join('')
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

export function renderBookRecommend(lead) {
  const el = document.getElementById('book-recommend');
  el.innerHTML = `
    <p class="book-recommend-label">参考文献</p>
    <div class="book-recommend-body">
      <a href="${BOOK_RECOMMEND.url}" target="_blank" rel="sponsored noopener">
        <img src="${BOOK_RECOMMEND.cover}" alt="${escapeHtml(BOOK_RECOMMEND.title)}" class="book-recommend-cover">
      </a>
      <div>
        <p class="book-recommend-lead">${escapeHtml(lead)}</p>
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
