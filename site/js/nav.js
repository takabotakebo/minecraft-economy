/* ============================================================
   Minecraft Economy World - 共通ナビ注入スクリプト
   各ページの <body data-page="..." data-depth="..."> を読み、
   ヘッダー（ドロップダウン付き）/ サイドナビ / フッターを生成する。
   ============================================================ */
(function () {
  'use strict';

  var body = document.body;
  var depth = parseInt(body.getAttribute('data-depth') || '0', 10);
  var current = body.getAttribute('data-page') || '';
  var P = depth > 0 ? '../'.repeat(depth) : '';   // ルートへの相対プレフィックス

  /* 職業ページ(job.html?id=xxx)では、現在の職業IDを見る */
  var currentJobId = new URLSearchParams(location.search).get('id') || '';

  /* ---- ローカル判定（localhost / 127.0.0.1 / file: のときだけ管理機能を出す） ---- */
  var host = location.hostname;
  var IS_LOCAL = (host === 'localhost' || host === '127.0.0.1' ||
                  host === '' || location.protocol === 'file:');

  /* ---- サイト構造定義 ---- */
  var VERSION = 'v0.4.1';
  /* シーズン（body data-season で指定。既定はシーズン1） */
  var SEASON = body.getAttribute('data-season') || '1';
  var SEASONS = [
    { id: '1', label: 'シーズン1', emoji: '🌱', href: 'index.html' },
    { id: '2', label: 'シーズン2', emoji: '✨', href: 's2/index.html' }
  ];
  // 職業ナビに出さない内部グループ
  var HIDDEN_JOBS = { common: 1 };
  // job.html へ出す職業リスト（prices.json から動的生成）
  var JOBS = [];   // { key:'job-<id>', id, href:'job.html?id=<id>', emoji, label }
  var NAV = [];

  function buildNavModel() {
    if (SEASON === '2') {
      NAV = [
        { key: 's2-home',     href: 's2/index.html',    emoji: '🏠', label: 'トップ' },
        { key: 's2-guild',    href: 's2/guild.html',    emoji: '🛡️', label: 'ギルド' },
        { key: 's2-prices',   href: 's2/prices.html',   emoji: '🔎', label: '価格表' },
        { key: 's2-calc',     href: 's2/calc.html',     emoji: '🧮', label: '計算ツール' },
        { key: 's2-enchants', href: 's2/enchants.html', emoji: '✨', label: 'エンチャント図鑑' }
      ];
      return;
    }
    NAV = [
      { key: 'home',    href: 'index.html',   emoji: '🏠', label: 'ホーム' },
      { key: 'system',  href: 'system.html',  emoji: '🏛️', label: '国のシステム' },
      { key: 'jobs',    href: 'jobs.html',    emoji: '🧑‍🌾', label: '各職業', children: JOBS },
      { key: 'prices',  href: 'prices.html',  emoji: '🔎', label: '価格表' },
      { key: 'calc',    href: 'calc.html',    emoji: '🧮', label: '計算ツール' },
      { key: 'summary', href: 'summary.html', emoji: '🌟', label: 'まとめ' },
      { key: 'changelog', href: 'changelog.html', emoji: '📝', label: '変更履歴' }
    ];
  }

  function abs(href) { return P + href; }
  function isCurrent(key) { return key === current; }
  // 職業の子リンクが現在ページか（job.html?id=xxx）
  function isCurrentJob(jobId) { return current === 'jobs' && currentJobId === jobId; }
  /* 子ページにいる時は親(jobs)もアクティブ扱い */
  function isActiveTop(item) {
    if (isCurrent(item.key)) return true;
    if (item.children) return item.children.some(function (c) { return isCurrentJob(c.id); });
    return false;
  }

  /* ---- シーズン切替（ロゴ右のドロップダウン） ---- */
  function buildSeasonSwitch() {
    var cur = SEASONS[0];
    SEASONS.forEach(function (s) { if (s.id === SEASON) cur = s; });
    var items = SEASONS.map(function (s) {
      var active = s.id === SEASON ? ' active' : '';
      return '<a class="dropdown__item' + active + '" href="' + abs(s.href) + '">' +
             '<span class="ico">' + s.emoji + '</span>' + s.label + '</a>';
    }).join('');
    return '' +
      '<div class="navitem navitem--has-dropdown season-switch">' +
        '<a class="navlink season-switch__btn" href="' + abs(cur.href) + '">' +
          '<span class="ico">' + cur.emoji + '</span>' +
          '<span class="season-switch__label">' + cur.label + '</span>' +
          '<span class="caret">▾</span></a>' +
        '<div class="dropdown">' + items + '</div>' +
      '</div>';
  }

  /* ---- ヘッダー（グローバルナビ＋ドロップダウン） ---- */
  function buildHeader() {
    var links = NAV.map(function (item) {
      var active = isActiveTop(item) ? ' active' : '';
      if (item.children) {
        var sub = item.children.map(function (c) {
          var ca = isCurrentJob(c.id) ? ' active' : '';
          return '<a class="dropdown__item' + ca + '" href="' + abs(c.href) + '">' +
                 '<span class="ico">' + c.emoji + '</span>' + c.label + '</a>';
        }).join('');
        return '' +
          '<div class="navitem navitem--has-dropdown">' +
            '<a class="navlink' + active + '" href="' + abs(item.href) + '">' +
              '<span class="ico">' + item.emoji + '</span>' + item.label +
              '<span class="caret">▾</span></a>' +
            '<div class="dropdown">' +
              '<a class="dropdown__item dropdown__item--head' + (isCurrent(item.key) ? ' active' : '') + '" href="' + abs(item.href) + '">' +
                '<span class="ico">' + item.emoji + '</span>各職業トップ</a>' +
              sub +
            '</div>' +
          '</div>';
      }
      return '<div class="navitem"><a class="navlink' + active + '" href="' + abs(item.href) + '">' +
             '<span class="ico">' + item.emoji + '</span>' + item.label + '</a></div>';
    }).join('');

    return '' +
      '<header class="site-header">' +
        '<div class="site-header__inner">' +
          '<div class="header-left">' +
            '<button class="menu-toggle" id="menuToggle" aria-label="メニュー">☰</button>' +
            '<a href="' + abs('index.html') + '" class="site-title">' +
              '<i class="mc mc-lg" style="background-image:url(' + abs('assets/icons/dirt.png') + ')"></i>' +
              '<span class="site-title__text">マイクラ経済ワールド</span></a>' +
            buildSeasonSwitch() +
          '</div>' +
          '<nav class="globalnav" id="globalnav">' + links + '</nav>' +
          '<div class="header-right">' +
            (IS_LOCAL
              ? '<a class="gear-link" href="' + abs('admin.html') + (SEASON === '2' ? '?season=2' : '') +
                '" title="価格データ管理（ローカル専用・シーズン' + SEASON + '）" aria-label="価格データ管理">⚙</a>'
              : '') +
            '<span class="version-badge">' +
              '<i class="mc" style="background-image:url(' + abs('assets/icons/emerald.png') + ')"></i> ' + VERSION +
            '</span>' +
          '</div>' +
        '</div>' +
      '</header>';
  }

  /* ---- サイドナビ：グローバル構造 + 現在ページ内の目次 ---- */
  function buildSidenav() {
    // グローバル部
    var globalItems = NAV.map(function (item) {
      var active = isActiveTop(item) ? ' active' : '';
      var html = '<li><a class="sidenav__top' + active + '" href="' + abs(item.href) + '">' +
                 '<span class="ico">' + item.emoji + '</span>' + item.label + '</a></li>';
      if (item.children && isActiveTop(item)) {
        // 子（職業）を展開
        var subs = item.children.map(function (c) {
          var ca = isCurrentJob(c.id) ? ' active' : '';
          return '<li><a class="sidenav__sub' + ca + '" href="' + abs(c.href) + '">' +
                 '<span class="ico">' + c.emoji + '</span>' + c.label + '</a></li>';
        }).join('');
        html += '<ul class="sidenav__children">' + subs + '</ul>';
      }
      return html;
    }).join('');

    // ページ内目次（このページの .section を拾う）
    var toc = buildPageToc();

    return '' +
      '<nav class="sidenav" id="sidenav">' +
        '<h2>メニュー</h2>' +
        '<ul class="sidenav__global">' + globalItems + '</ul>' +
        toc +
      '</nav>';
  }

  function buildPageToc() {
    var secs = document.querySelectorAll('#app > .section');
    // セクションが1つ以下なら目次は出さない（トップなど）
    if (secs.length < 2) return '';
    var items = Array.prototype.map.call(secs, function (s) {
      var head = s.querySelector('.section__head h2');
      var ico = head ? (head.querySelector('.ico') ? head.querySelector('.ico').textContent : '') : '';
      var label = head ? head.textContent.replace(ico, '').trim() : s.id;
      return '<li><a href="#' + s.id + '"><span class="ico">' + ico + '</span>' + label + '</a></li>';
    }).join('');
    return '<h2 class="sidenav__toc-title">このページの目次</h2>' +
           '<ul class="sidenav__toc">' + items + '</ul>';
  }

  /* ---- フッター ---- */
  function buildFooter() {
    return '' +
      '<footer class="site-footer">' +
        '<p><i class="mc" style="background-image:url(' + abs('assets/icons/emerald.png') + ')"></i> ' +
          'マイクラ経済ワールド 運用ルール <strong>' + VERSION + '</strong></p>' +
        '<p>ルール改定履歴は <a href="' + abs('changelog.html') + '" class="changelog-link">変更履歴ページ</a> を参照してください。</p>' +
        '<p style="margin-top:12px;font-size:0.78rem;color:#888;">' +
          'アイテムアイコン © Mojang Studios / Microsoft。テクスチャは ' +
          '<a href="https://github.com/destruc7i0n/minecraft-textures" class="changelog-link">destruc7i0n/minecraft-textures</a> ' +
          'より取得。本サイトは非公式のファン制作・非商用です。Minecraft is a trademark of Mojang Studios.</p>' +
      '</footer>';
  }

  /* ---- 職業リストを prices.json から取得して NAV を組み立て、その後DOM構築 ---- */
  // 取得失敗時のフォールバック（既定6職業）
  var FALLBACK_JOBS = [
    { id: 'material', emoji: '🧱', label: '材料屋' },
    { id: 'farmer', emoji: '🍞', label: '農家' },
    { id: 'adventurer', emoji: '🔥', label: '冒険家' },
    { id: 'builder', emoji: '🏠', label: '建築家' },
    { id: 'engineer', emoji: '⚙️', label: '装置技師' },
    { id: 'tamer', emoji: '🐺', label: '調教師' }
  ];

  function setJobs(list) {
    JOBS.length = 0;
    list.forEach(function (j) {
      if (HIDDEN_JOBS[j.id]) return;
      JOBS.push({
        key: 'job-' + j.id, id: j.id,
        href: 'job.html?id=' + encodeURIComponent(j.id),
        emoji: j.emoji || '📦', label: j.label || j.id
      });
    });
    buildNavModel();
  }

  fetch(P + 'data/prices.json?_=' + Date.now())
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      setJobs(data && data.jobs ? data.jobs : FALLBACK_JOBS);
    })
    .catch(function () { setJobs(FALLBACK_JOBS); })
    .then(mount);

  /* ---- DOM 構築 ---- */
  function mount() {
  var app = document.getElementById('app');

  // ヘッダーを body 先頭へ
  body.insertAdjacentHTML('afterbegin', buildHeader());

  // モバイル用バックドロップ（layoutの外＝グリッドに含めない）
  body.insertAdjacentHTML('afterbegin', '<div class="nav-backdrop" id="navBackdrop"></div>');

  // app を layout でラップ：sidenav + content
  var layout = document.createElement('div');
  layout.className = 'layout';
  layout.innerHTML = buildSidenav();
  var content = document.createElement('main');
  content.className = 'content';
  // app の中身を content へ移動
  while (app.firstChild) content.appendChild(app.firstChild);
  layout.appendChild(content);
  app.replaceWith(layout);

  // フッターを末尾へ
  layout.insertAdjacentHTML('afterend', buildFooter());

  // トップへ戻るボタン
  var toTop = document.createElement('button');
  toTop.className = 'to-top';
  toTop.id = 'toTop';
  toTop.setAttribute('aria-label', 'トップへ戻る');
  toTop.textContent = '▲';
  document.body.appendChild(toTop);

  /* ---- モバイル：ドロップダウンはタップで開閉 ---- */
  document.querySelectorAll('.navitem--has-dropdown > .navlink').forEach(function (a) {
    a.addEventListener('click', function (e) {
      // 画面が狭い時のみ、1タップ目は展開・2タップ目で遷移
      if (window.innerWidth <= 980) {
        var parent = a.parentElement;
        if (!parent.classList.contains('open')) {
          e.preventDefault();
          document.querySelectorAll('.navitem--has-dropdown.open').forEach(function (o) {
            if (o !== parent) o.classList.remove('open');
          });
          parent.classList.add('open');
        }
      }
    });
  });

  // nav構築完了を他スクリプト(main.js/job-page.js)へ通知
  document.dispatchEvent(new CustomEvent('nav:ready'));
  } /* end mount */
})();
