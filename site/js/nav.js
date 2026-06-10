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

  /* ---- サイト構造定義 ---- */
  var VERSION = 'v0.1.1';
  var JOBS = [
    { key: 'job-material',   href: 'jobs/material.html',   emoji: '🧱', label: '材料屋' },
    { key: 'job-farmer',     href: 'jobs/farmer.html',     emoji: '🍞', label: '農家' },
    { key: 'job-adventurer', href: 'jobs/adventurer.html', emoji: '🔥', label: '冒険家' },
    { key: 'job-builder',    href: 'jobs/builder.html',    emoji: '🏠', label: '建築家' },
    { key: 'job-engineer',   href: 'jobs/engineer.html',   emoji: '⚙️', label: '装置技師' },
    { key: 'job-tamer',      href: 'jobs/tamer.html',      emoji: '🐺', label: '調教師' }
  ];
  var NAV = [
    { key: 'home',    href: 'index.html',     emoji: '🏠', label: 'ホーム' },
    { key: 'system',  href: 'system.html',    emoji: '🏛️', label: '国のシステム' },
    { key: 'jobs',    href: 'jobs.html',      emoji: '🧑‍🌾', label: '各職業', children: JOBS },
    { key: 'summary', href: 'summary.html',   emoji: '🌟', label: 'まとめ' },
    { key: 'changelog', href: 'changelog.html', emoji: '📝', label: '変更履歴' }
  ];

  function abs(href) { return P + href; }
  function isCurrent(key) { return key === current; }
  /* 子ページにいる時は親(jobs)もアクティブ扱い */
  function isActiveTop(item) {
    if (isCurrent(item.key)) return true;
    if (item.children) return item.children.some(function (c) { return isCurrent(c.key); });
    return false;
  }

  /* ---- ヘッダー（グローバルナビ＋ドロップダウン） ---- */
  function buildHeader() {
    var links = NAV.map(function (item) {
      var active = isActiveTop(item) ? ' active' : '';
      if (item.children) {
        var sub = item.children.map(function (c) {
          var ca = isCurrent(c.key) ? ' active' : '';
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
          '</div>' +
          '<nav class="globalnav" id="globalnav">' + links + '</nav>' +
          '<span class="version-badge">' +
            '<i class="mc" style="background-image:url(' + abs('assets/icons/emerald.png') + ')"></i> ' + VERSION +
          '</span>' +
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
          var ca = isCurrent(c.key) ? ' active' : '';
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
    if (!secs.length) return '';
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

  /* ---- DOM 構築 ---- */
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
})();
