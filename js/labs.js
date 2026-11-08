/* ============================================================
   実験ウィジェット（アルゴリズムクエスト）
   <div class="lab" data-lab="種類" data-id="課題ID"> を見つけて組み立てる。
   ============================================================ */
(function (global) {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function head(title) { return '<div class="lab-head"><span class="lab-badge">実験</span><span class="lab-title">' + title + "</span></div>"; }
  function prep(root) {
    var id = root.getAttribute("data-id");
    if (id) root.setAttribute("data-task", id);
    return !!(id && global.QUEST && global.QUEST.isTaskDone(id));
  }
  function done(root, msg) {
    if (!root.classList.contains("solved")) {
      root.classList.add("solved");
      var b = root.querySelector(".lab-badge");
      if (b) b.textContent = "✓ 達成";
      var id = root.getAttribute("data-id");
      if (id && global.QUEST) global.QUEST.taskDone(root, id);
    }
    if (msg) say(root, msg, true);
  }
  function say(root, msg, ok) {
    var s = root.querySelector(".lab-status");
    if (s) { s.innerHTML = msg; s.className = "lab-status" + (ok ? " ok" : ""); }
  }
  function fmt(n) { return Math.round(n).toLocaleString("ja-JP"); }
  function dur(sec) {
    if (sec < 60) return Math.round(sec) + "秒";
    if (sec < 3600) return Math.round(sec / 60) + "分";
    if (sec < 86400) return (sec / 3600).toFixed(1) + "時間";
    return (sec / 86400).toFixed(1) + "日";
  }

  /* ---------- 1. 線形探索 ---------- */
  function linear(root) {
    var already = prep(root);
    var ran = {};
    var SIZES = [100, 10000, 1000000];
    root.innerHTML = head("名簿を前から順に調べる（線形探索）") +
      '<div class="row sizes"></div><div class="bar-out"></div><p class="lab-status" aria-live="polite"></p>';
    SIZES.forEach(function (n) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn btn-primary"; b.textContent = fmt(n) + "人から探す";
      b.addEventListener("click", function () { run(n); });
      root.querySelector(".sizes").appendChild(b);
    });
    var rows = [];
    function run(n) {
      // 探す人がいる位置を、決まった並びの中から選ぶ（毎回同じ結果になるように）
      var pos = Math.floor(n * 0.73) + 1;
      ran[n] = { pos: pos, worst: n };
      rows = SIZES.filter(function (s) { return ran[s]; }).map(function (s) { return ran[s]; });
      var max = Math.max.apply(null, rows.map(function (r) { return r.worst; }));
      root.querySelector(".bar-out").innerHTML = '<table class="cmp"><tr><th>人数 N</th><th>今回の比較回数</th><th>最悪（いない場合）</th><th>1回3秒なら（最悪）</th></tr>' +
        SIZES.filter(function (s) { return ran[s]; }).map(function (s) {
          return "<tr><td>" + fmt(s) + "</td><td>" + fmt(ran[s].pos) + "</td><td>" + fmt(s) + '<span class="bar" style="width:' + Math.max(2, s / max * 100) + '%"></span></td><td>' + dur(s * 3) + "</td></tr>";
        }).join("") + "</table>";
      var all = SIZES.every(function (s) { return ran[s]; });
      if (all || already) done(root, "人数が100倍になると、最悪の比較回数も100倍。かかる時間は人数に比例する。");
      else say(root, fmt(n) + "人のうち " + fmt(pos) + "人目で見つかった。ほかの人数でも試そう。");
    }
    if (already) done(root, "この課題は達成済み");
    else say(root, "3つの人数で探してみよう");
  }

  /* ---------- 2. 二分探索（自分で半分に切る） ---------- */
  function binary(root) {
    var already = prep(root);
    var N = 1000, target, lo, hi, steps, found;
    root.innerHTML = head("五十音順の名簿で、真ん中から調べる（二分探索）") +
      '<p class="readout q"></p><div class="range"><div class="range-in"></div></div>' +
      '<div class="row"><button type="button" class="btn lab-lo">← 前半にいる</button><button type="button" class="btn btn-primary lab-hit">ここだ！</button><button type="button" class="btn lab-hi">後半にいる →</button></div>' +
      '<div class="row"><button type="button" class="btn lab-reset">別の人を探す</button></div><p class="lab-status" aria-live="polite"></p>';
    function mid() { return Math.floor((lo + hi) / 2); }
    function reset() {
      target = 1 + Math.floor(Math.random() * N); lo = 1; hi = N; steps = 0; found = false; draw();
      say(root, "探すのは名簿番号 <b>" + target + "</b> の人。真ん中の人の番号と比べて、前半か後半かを選ぼう。");
    }
    function draw() {
      var m = mid();
      root.querySelector(".q").innerHTML = "探す番号：<b class=\"tgt\">" + target + "</b>　調べる範囲：<b>" + lo + "〜" + hi + "</b> 番（" + (hi - lo + 1) + "人）　真ん中の人：<b>" + m + "</b> 番　比べた回数：<b>" + steps + "</b>";
      var r = root.querySelector(".range-in");
      r.style.marginLeft = ((lo - 1) / N * 100) + "%";
      r.style.width = Math.max(0.6, (hi - lo + 1) / N * 100) + "%";
    }
    function choose(dir) {
      if (found || lo > hi) return;
      var m = mid();
      steps++;
      var right = m === target ? 0 : (target < m ? -1 : 1);
      if (dir !== right) { steps--; say(root, "真ん中は " + m + " 番。探しているのは " + target + " 番だから、もう一度考えよう。"); return; }
      if (dir === 0) {
        found = true; draw();
        if (steps <= 10) done(root, steps + "回で見つかった！ 1000人でも、半分に切ることを10回くり返せば必ず1人に絞れる。");
        else say(root, steps + "回で見つかった。");
        return;
      }
      if (dir < 0) hi = m - 1; else lo = m + 1;
      draw();
      say(root, "範囲が半分になった。残り " + (hi - lo + 1) + " 人。");
    }
    root.querySelector(".lab-lo").addEventListener("click", function () { choose(-1); });
    root.querySelector(".lab-hi").addEventListener("click", function () { choose(1); });
    root.querySelector(".lab-hit").addEventListener("click", function () { choose(0); });
    root.querySelector(".lab-reset").addEventListener("click", reset);
    reset();
    if (already) done(root);
  }

  /* ---------- 3. ハッシュ表 ---------- */
  function hash(root) {
    var already = prep(root);
    var B = 10;
    var table, added = 0, searched = false;
    var NAMES = ["たろう", "はなこ", "けんた", "みさき", "ゆうと", "あおい", "そうた", "りこ"];
    function h(s) { var t = 0; for (var i = 0; i < s.length; i++) t += s.charCodeAt(i); return t % B; }
    root.innerHTML = head("名前から棚の番号を計算する（ハッシュ表）") +
      '<div class="row names"></div><div class="buckets"></div>' +
      '<div class="row"><label>探す名前 <select class="find"></select></label><button type="button" class="btn btn-primary lab-find">探す</button><button type="button" class="btn lab-reset">空にする</button></div>' +
      '<p class="lab-status" aria-live="polite"></p>';
    NAMES.forEach(function (nm) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = "＋ " + nm;
      b.addEventListener("click", function () { add(nm, b); });
      root.querySelector(".names").appendChild(b);
      root.querySelector(".find").insertAdjacentHTML("beforeend", "<option>" + nm + "</option>");
    });
    function reset() {
      table = []; for (var i = 0; i < B; i++) table.push([]);
      added = 0; searched = false;
      root.querySelectorAll(".names button").forEach(function (b) { b.disabled = false; });
      draw(-1); say(root, "名前を5人以上入れてから、だれかを探してみよう。");
    }
    function add(nm, btn) {
      var k = h(nm);
      table[k].push(nm); added++; btn.disabled = true;
      var codes = [];
      for (var i = 0; i < nm.length; i++) codes.push(nm.charCodeAt(i));
      draw(k);
      say(root, "「" + nm + "」の文字の番号の合計 " + codes.join("＋") + " ＝ " + codes.reduce(function (a, b) { return a + b; }, 0) + "、10で割った余り " + k + " → 棚 " + k + (table[k].length > 1 ? "（先客がいるので、同じ棚に並べる＝衝突）" : ""));
      check();
    }
    function draw(hl) {
      root.querySelector(".buckets").innerHTML = table.map(function (b, i) {
        return '<div class="bk' + (i === hl ? " hl" : "") + '"><b>' + i + "</b>" + b.map(function (n) { return "<span>" + n + "</span>"; }).join("") + "</div>";
      }).join("");
    }
    function check() { if ((added >= 5 && searched) || already) done(root, "名前から棚の番号を計算するので、人数が増えても調べるのは1つの棚の中だけ。"); }
    root.querySelector(".lab-find").addEventListener("click", function () {
      var nm = root.querySelector(".find").value, k = h(nm);
      draw(k);
      var i = table[k].indexOf(nm);
      if (i < 0) say(root, "棚 " + k + " を見たが「" + nm + "」はいない（まだ入れていない）。調べたのは棚1つ、比べたのは " + table[k].length + " 人だけ。");
      else { searched = added >= 5 || searched; say(root, "棚 " + k + " を開けて、" + (i + 1) + " 人目で「" + nm + "」が見つかった。名簿全体の人数には関係なく、比べたのは " + (i + 1) + " 回。"); check(); }
    });
    root.querySelector(".lab-reset").addEventListener("click", reset);
    reset();
    if (already) done(root, "この課題は達成済み");
  }

  /* ---------- 4・5. 並べ替え（バブル・クイック） ---------- */
  function bars(root, arr, marks) {
    var max = Math.max.apply(null, arr);
    root.querySelector(".bars").innerHTML = arr.map(function (v, i) {
      return '<div class="bcol ' + (marks[i] || "") + '"><div class="bbar" style="height:' + (v / max * 100) + '%"></div><small>' + v + "</small></div>";
    }).join("");
  }
  function bubble(root) {
    var already = prep(root);
    var INIT = [5, 2, 8, 1, 9, 3, 7, 4];
    var a, i, j, cmp, swp, fin;
    root.innerHTML = head("隣どうしを比べて入れ替える（バブルソート）") +
      '<div class="bars"></div><p class="readout"></p>' +
      '<div class="row"><button type="button" class="btn btn-primary lab-step">1回比べる</button><button type="button" class="btn lab-pass">1周すすめる</button><button type="button" class="btn lab-reset">最初から</button></div><p class="lab-status" aria-live="polite"></p>';
    function reset() { a = INIT.slice(); i = 0; j = 0; cmp = 0; swp = 0; fin = false; show({}); say(root, "左から順に隣どうしを比べ、大きいほうを右へ送る。"); }
    function show(m) {
      var marks = {};
      for (var k = a.length - i; k < a.length; k++) marks[k] = "done";
      Object.keys(m).forEach(function (k) { marks[k] = m[k]; });
      bars(root, a, marks);
      root.querySelector(".readout").innerHTML = "比べた回数 <b>" + cmp + "</b>　入れ替えた回数 <b>" + swp + "</b>　（8個なら比べるのは全部で 7＋6＋…＋1 ＝ 28回）";
    }
    function step() {
      if (fin) return;
      var n = a.length, m = {};
      m[j] = "cmp"; m[j + 1] = "cmp";
      cmp++;
      var msg = a[j] + " と " + a[j + 1] + " を比べた";
      if (a[j] > a[j + 1]) { var t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; swp++; m[j] = "swap"; m[j + 1] = "swap"; msg += " → 入れ替え"; }
      j++;
      if (j >= n - 1 - i) { j = 0; i++; msg += "。1周終わり、いちばん右の " + a[n - i] + " が確定"; }
      if (i >= n - 1) { fin = true; show({}); done(root, "並べ終わった。比べた回数は " + cmp + " 回 ＝ 8×7÷2。個数 N に対して N(N−1)/2 回比べる。"); return; }
      show(m); say(root, msg + "。");
    }
    root.querySelector(".lab-step").addEventListener("click", step);
    root.querySelector(".lab-pass").addEventListener("click", function () { var k = i; while (!fin && i === k) step(); });
    root.querySelector(".lab-reset").addEventListener("click", reset);
    reset();
    if (already) done(root);
  }

  function quick(root) {
    var already = prep(root);
    var SETS = { mix: [7, 2, 9, 4, 12, 1, 8, 5, 11, 3, 10, 6], sorted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
    var ran = {};
    var a, ops, k, cmp, timer = null, cur = "mix";
    root.innerHTML = head("基準より小さいか大きいかで2つに分ける（クイックソート）") +
      '<div class="row sets"><button type="button" class="btn btn-primary" data-s="mix">ばらばらの12個</button><button type="button" class="btn" data-s="sorted">もう並んでいる12個</button></div>' +
      '<div class="bars"></div><p class="readout"></p>' +
      '<div class="row"><button type="button" class="btn btn-primary lab-run">▶ 再生</button><button type="button" class="btn lab-step">1手すすめる</button></div>' +
      '<p class="legend"><span class="lg pivot"></span>基準　<span class="lg cmp"></span>比べている　<span class="lg swap"></span>入れ替え　<span class="lg done"></span>位置が確定</p>' +
      '<p class="lab-status" aria-live="polite"></p>';
    function record(arr) {
      // 最後の要素を基準にする分け方（ロムート方式）の手順を記録する
      var b = arr.slice(), list = [], fixed = {};
      function snap(m, msg, c) { list.push({ a: b.slice(), m: Object.assign({}, fixed, m), msg: msg, c: c }); }
      var c = 0;
      function qs(lo, hi) {
        if (lo > hi) return;
        if (lo === hi) { fixed[lo] = "done"; snap({}, b[lo] + " は1個だけなので確定", c); return; }
        var p = b[hi], i = lo;
        var m0 = {}; m0[hi] = "pivot"; snap(m0, "基準は右端の " + p + "（範囲 " + (lo + 1) + "〜" + (hi + 1) + " 番目）", c);
        for (var j = lo; j < hi; j++) {
          c++;
          var m = {}; m[hi] = "pivot"; m[j] = "cmp";
          if (b[j] < p) {
            var t = b[i]; b[i] = b[j]; b[j] = t;
            m[i] = "swap"; m[j] = "swap"; m[hi] = "pivot";
            snap(m, b[i] + " は基準より小さいので左側へ", c);
            i++;
          } else snap(m, b[j] + " は基準以上なので右側に残す", c);
        }
        var t2 = b[i]; b[i] = b[hi]; b[hi] = t2;
        fixed[i] = "done";
        snap({}, "基準 " + p + " を左右の境目に置いた。この位置で確定", c);
        qs(lo, i - 1); qs(i + 1, hi);
      }
      qs(0, b.length - 1);
      return list;
    }
    function load(s) {
      if (timer) { clearInterval(timer); timer = null; }
      cur = s; a = SETS[s]; ops = record(a); k = -1;
      root.querySelectorAll(".sets button").forEach(function (b) { b.classList.toggle("btn-primary", b.getAttribute("data-s") === s); });
      bars(root, a, {}); root.querySelector(".readout").innerHTML = "比べた回数 <b>0</b>";
      say(root, "再生すると、基準で2つに分けることをくり返す。");
    }
    function step() {
      if (k >= ops.length - 1) return false;
      k++;
      var o = ops[k];
      bars(root, o.a, o.m);
      root.querySelector(".readout").innerHTML = "比べた回数 <b>" + o.c + "</b>";
      say(root, o.msg);
      if (k === ops.length - 1) {
        ran[cur] = o.c;
        var msg = (cur === "mix" ? "ばらばら" : "並んでいる") + "の12個で、比べた回数は " + o.c + " 回。";
        if ((ran.mix && ran.sorted) || already) done(root, "ばらばら " + (ran.mix || "?") + " 回、並んでいる " + (ran.sorted || "?") + " 回。右端を基準にすると、並んでいる入力では毎回1つずつしか減らず、12×11÷2 ＝ 66 回の最悪になる。");
        else say(root, msg + "もう一方の並びでも試そう。");
        return false;
      }
      return true;
    }
    root.querySelectorAll(".sets button").forEach(function (b) { b.addEventListener("click", function () { load(b.getAttribute("data-s")); }); });
    root.querySelector(".lab-step").addEventListener("click", step);
    root.querySelector(".lab-run").addEventListener("click", function () {
      if (timer) return;
      timer = setInterval(function () { if (!step()) { clearInterval(timer); timer = null; } }, reduce ? 20 : 260);
    });
    load("mix");
    if (already) done(root);
  }

  /* ---------- 6. 幅優先探索（キュー） ---------- */
  function graphSvg(nodes, edges, state, weighted) {
    var h = '<svg viewBox="0 0 460 260" width="460" role="img" aria-label="町と道の図">';
    edges.forEach(function (e) {
      var a = nodes[e[0]], b = nodes[e[1]];
      var on = state.edge && state.edge(e);
      h += '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="' + (on ? "#2f9e5c" : "#b9a687") + '" stroke-width="' + (on ? 5 : 3) + '"/>';
      if (weighted) h += '<rect x="' + ((a[0] + b[0]) / 2 - 11) + '" y="' + ((a[1] + b[1]) / 2 - 10) + '" width="22" height="18" rx="4" fill="#fff" stroke="#b9a687"/><text x="' + (a[0] + b[0]) / 2 + '" y="' + ((a[1] + b[1]) / 2 + 4) + '" text-anchor="middle" font-size="11" font-weight="900">' + e[2] + "</text>";
    });
    Object.keys(nodes).forEach(function (n) {
      var p = nodes[n], st = state.node(n);
      h += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="20" fill="' + st.fill + '" stroke="' + st.stroke + '" stroke-width="2.5"/>';
      h += '<text x="' + p[0] + '" y="' + (p[1] + 5) + '" text-anchor="middle" font-size="14" font-weight="900">' + n + "</text>";
      if (st.label !== undefined) h += '<text x="' + p[0] + '" y="' + (p[1] - 26) + '" text-anchor="middle" font-size="12" font-weight="900" fill="#8a3a2a">' + st.label + "</text>";
    });
    return h + "</svg>";
  }
  function bfs(root) {
    var already = prep(root);
    var NODES = { S: [50, 130], A: [150, 60], B: [150, 200], C: [260, 60], D: [260, 200], E: [360, 130], G: [430, 60] };
    var EDGES = [["S", "A"], ["S", "B"], ["A", "C"], ["B", "D"], ["C", "E"], ["D", "E"], ["E", "G"], ["A", "B"]];
    var st;
    root.innerHTML = head("近い順に広げる（幅優先探索）") +
      '<div class="gwrap"></div><p class="readout"></p>' +
      '<div class="row"><button type="button" class="btn btn-primary lab-step">1歩すすめる</button><button type="button" class="btn lab-reset">最初から</button></div><p class="lab-status" aria-live="polite"></p>';
    function nb(n) { var r = []; EDGES.forEach(function (e) { if (e[0] === n) r.push(e[1]); else if (e[1] === n) r.push(e[0]); }); return r.sort(); }
    function reset() { st = { q: ["S"], dist: { S: 0 }, from: {}, cur: null, fin: false }; draw(); say(root, "スタート S をキュー（待ち行列）に入れた。キューの先頭から取り出して、まだ行っていない隣を後ろに並べる。"); }
    function draw() {
      root.querySelector(".gwrap").innerHTML = graphSvg(NODES, EDGES, {
        node: function (n) {
          var seen = st.dist[n] !== undefined;
          return { fill: n === st.cur ? "#ffd66b" : seen ? "#e2f2e6" : "#fff", stroke: n === "G" ? "#8a3a2a" : seen ? "#2f9e5c" : "#9c8a6a", label: seen ? st.dist[n] + "歩" : undefined };
        },
        edge: function (e) { return st.from[e[1]] === e[0] || st.from[e[0]] === e[1]; }
      });
      root.querySelector(".readout").innerHTML = "キュー（先頭 → 後ろ）：<b>" + (st.q.length ? st.q.join(" → ") : "（空）") + "</b>";
    }
    function step() {
      if (st.fin || !st.q.length) return;
      var n = st.q.shift(); st.cur = n;
      var add = [];
      nb(n).forEach(function (m) { if (st.dist[m] === undefined) { st.dist[m] = st.dist[n] + 1; st.from[m] = n; st.q.push(m); add.push(m); } });
      draw();
      if (n === "G" || st.dist.G !== undefined && !st.q.length) { }
      if (!st.q.length) { st.fin = true; done(root, "全部の町に、S から何歩で行けるかが決まった。G までは " + st.dist.G + " 歩。キューのおかげで、近い町から順に調べられた。"); return; }
      say(root, n + " を取り出した。まだ行っていない隣 " + (add.length ? add.join("・") + " に「" + (st.dist[n] + 1) + "歩」と書いてキューの後ろへ" : "は無い") + "。");
    }
    root.querySelector(".lab-step").addEventListener("click", step);
    root.querySelector(".lab-reset").addEventListener("click", reset);
    reset();
    if (already) done(root);
  }

  /* ---------- 7. ダイクストラ法 ---------- */
  function dijkstra(root) {
    var already = prep(root);
    var NODES = { S: [50, 130], A: [160, 50], B: [160, 210], C: [290, 50], D: [290, 210], G: [410, 130] };
    var EDGES = [["S", "A", 4], ["S", "B", 1], ["B", "A", 2], ["A", "C", 5], ["B", "D", 8], ["C", "G", 3], ["D", "G", 1], ["C", "D", 2]];
    var st;
    root.innerHTML = head("いちばん近い町から確定していく（ダイクストラ法）") +
      '<div class="gwrap"></div><p class="readout"></p>' +
      '<div class="row"><button type="button" class="btn btn-primary lab-step">1つ確定する</button><button type="button" class="btn lab-reset">最初から</button></div><p class="lab-status" aria-live="polite"></p>';
    function reset() { st = { d: { S: 0 }, from: {}, fixed: {}, cur: null, fin: false }; draw(); say(root, "S までの距離は 0。ほかはまだ分からない（∞）。"); }
    function cand() { return Object.keys(NODES).filter(function (n) { return !st.fixed[n] && st.d[n] !== undefined; }).sort(function (a, b) { return st.d[a] - st.d[b]; }); }
    function draw() {
      root.querySelector(".gwrap").innerHTML = graphSvg(NODES, EDGES, {
        node: function (n) { return { fill: n === st.cur ? "#ffd66b" : st.fixed[n] ? "#e2f2e6" : "#fff", stroke: st.fixed[n] ? "#2f9e5c" : "#9c8a6a", label: st.d[n] === undefined ? "∞" : st.d[n] }; },
        edge: function (e) { return st.from[e[1]] === e[0] || st.from[e[0]] === e[1]; }
      }, true);
      var c = cand();
      root.querySelector(".readout").innerHTML = "まだ確定していない町を近い順に：<b>" + (c.length ? c.map(function (n) { return n + "(" + st.d[n] + ")"; }).join(" ") : "（なし）") + "</b>";
    }
    function step() {
      if (st.fin) return;
      var c = cand();
      if (!c.length) return;
      var n = c[0]; st.fixed[n] = true; st.cur = n;
      var upd = [];
      EDGES.forEach(function (e) {
        var m = e[0] === n ? e[1] : e[1] === n ? e[0] : null;
        if (!m || st.fixed[m]) return;
        var nd = st.d[n] + e[2];
        if (st.d[m] === undefined || nd < st.d[m]) { st.d[m] = nd; st.from[m] = n; upd.push(m + " を " + nd + " に"); }
      });
      draw();
      if (Object.keys(NODES).every(function (x) { return st.fixed[x]; })) {
        st.fin = true;
        var path = ["G"]; while (path[0] !== "S") path.unshift(st.from[path[0]]);
        done(root, "全部確定した。S から G の最短は " + st.d.G + "（" + path.join(" → ") + "）。");
        return;
      }
      say(root, n + "（" + st.d[n] + "）を確定。" + (upd.length ? "そこから行ける町を書き直した：" + upd.join("、") : "書き直せる町は無かった") + "。");
    }
    root.querySelector(".lab-step").addEventListener("click", step);
    root.querySelector(".lab-reset").addEventListener("click", reset);
    reset();
    if (already) done(root);
  }

  /* ---------- 8. 動的計画法（素朴な再帰 vs 表） ---------- */
  function dp(root) {
    var already = prep(root);
    var filled, N = 10;
    root.innerHTML = head("階段の上り方を数える（再帰と表）") +
      '<div class="row"><label>段数 n ＝ <input type="range" min="1" max="40" value="10" class="dp-n" aria-label="段数"> <b class="dp-nv">10</b></label></div>' +
      '<table class="cmp dp-cmp"></table>' +
      '<p style="text-align:center;margin-top:10px">表を1マスずつ埋める（n ＝ 10 まで）</p><div class="dp-table"></div>' +
      '<div class="row"><button type="button" class="btn btn-primary lab-fill">次のマスを埋める</button><button type="button" class="btn lab-reset">表を空にする</button></div>' +
      '<p class="lab-status" aria-live="polite"></p>';
    function ways(n) { var a = 1, b = 1; for (var i = 2; i <= n; i++) { var t = a + b; a = b; b = t; } return n === 0 ? 1 : b; }
    function calls(n) { return 2 * ways(n) - 1; } // 素朴な再帰 f(n)=f(n-1)+f(n-2)、f(0)=f(1)=1 の呼び出し回数
    function cmpTable() {
      var n = +root.querySelector(".dp-n").value;
      root.querySelector(".dp-nv").textContent = n;
      root.querySelector(".dp-cmp").innerHTML = "<tr><th>やり方</th><th>計算の回数（n ＝ " + n + "）</th></tr>" +
        "<tr><td>素朴な再帰（同じ計算を何度もする）</td><td><b>" + fmt(calls(n)) + "</b> 回</td></tr>" +
        "<tr><td>表に書き込みながら（1段ずつ1回）</td><td><b>" + n + "</b> 回</td></tr>" +
        "<tr><td>上り方の数</td><td>" + fmt(ways(n)) + " 通り</td></tr>";
    }
    function reset() { filled = 1; drawT(); say(root, "0段と1段の上り方はどちらも1通り。そこから表を埋めていこう。"); }
    function drawT() {
      var h = "";
      for (var i = 0; i <= N; i++) h += '<div class="dpc' + (i <= filled ? " on" : "") + (i === filled && i > 1 ? " now" : "") + '"><small>' + i + "段</small><b>" + (i <= filled ? ways(i) : "") + "</b></div>";
      root.querySelector(".dp-table").innerHTML = h;
    }
    root.querySelector(".dp-n").addEventListener("input", cmpTable);
    root.querySelector(".lab-fill").addEventListener("click", function () {
      if (filled >= N) return;
      filled++;
      drawT();
      if (filled >= N || already) done(root, "10段の上り方は " + ways(10) + " 通り。表なら1マスに1回の足し算で済む。");
      else say(root, filled + "段 ＝ " + (filled - 1) + "段の " + ways(filled - 1) + " ＋ " + (filled - 2) + "段の " + ways(filled - 2) + " ＝ " + ways(filled));
    });
    root.querySelector(".lab-reset").addEventListener("click", reset);
    cmpTable(); reset();
    if (already) done(root);
  }

  /* ---------- 9. 計算量の比較 ---------- */
  function growth(root) {
    root.innerHTML = head("N が増えると、手間はどう増える？") +
      '<div class="row"><label>N ＝ <input type="range" min="1" max="6" value="2" class="g-n" aria-label="データの数"> <b class="g-nv"></b></label></div><table class="cmp g-t"></table>' +
      '<p class="lab-note">※ 1回の操作を1ナノ秒（10億分の1秒）として、かかる時間の目安。</p>';
    function t(ops) {
      var s = ops / 1e9;
      if (!isFinite(s) || s > 1e15) return "宇宙の年齢よりずっと長い";
      if (s < 1e-6) return "一瞬";
      if (s < 1) return (s * 1000).toPrecision(2) + " ミリ秒";
      return dur(s) + (s >= 86400 * 365 ? "（" + (s / 86400 / 365).toPrecision(2) + " 年）" : "");
    }
    function draw() {
      var e = +root.querySelector(".g-n").value, N = Math.pow(10, e);
      root.querySelector(".g-nv").textContent = fmt(N);
      // [計算量, 例, 操作の回数の log10]
      var rows = [
        ["O(1)", "ハッシュ表で探す", 0],
        ["O(log N)", "二分探索", Math.log10(Math.max(1, Math.log2(N)))],
        ["O(N)", "線形探索", e],
        ["O(N log N)", "クイックソート（平均）", e + Math.log10(Math.log2(N))],
        ["O(N²)", "バブルソート", 2 * e],
        ["O(2ᴺ)", "素朴な再帰で増え方が最悪の型", N * Math.log10(2)]
      ];
      root.querySelector(".g-t").innerHTML = "<tr><th>計算量</th><th>例</th><th>操作の回数</th><th>時間の目安</th></tr>" + rows.map(function (r) {
        var big = r[2] > 15;
        return "<tr><td><b>" + r[0] + "</b></td><td>" + r[1] + "</td><td>" + (big ? "約 10 の " + fmt(Math.floor(r[2])) + " 乗" : fmt(Math.pow(10, r[2]))) + "</td><td>" + (big ? "宇宙の年齢（約 10 の 26 乗ナノ秒）よりずっと長い" : t(Math.pow(10, r[2]))) + "</td></tr>";
      }).join("");
    }
    root.querySelector(".g-n").addEventListener("input", draw);
    draw();
  }

  var KINDS = { linear: linear, binary: binary, hash: hash, bubble: bubble, quick: quick, bfs: bfs, dijkstra: dijkstra, dp: dp, growth: growth };
  function boot() {
    document.querySelectorAll(".lab[data-lab]").forEach(function (root) {
      var f = KINDS[root.getAttribute("data-lab")];
      if (f) f(root);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
