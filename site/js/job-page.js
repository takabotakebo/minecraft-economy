/* ============================================================
   汎用職業ページ job.html?id=xxx
   prices.json から該当職業のカテゴリを読み、ヒーロー＋価格表を生成。
   職業を prices.json に追加すれば、このページが自動で対応する。
   ============================================================ */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var jobId = params.get('id') || 'material';

  var heroEl = document.getElementById('jobHero');
  var bodyEl = document.getElementById('jobBody');

  var PRICE_COLS = { '価格': 1, '報酬': 1, '相場': 1, '追加料金': 1, '参加費': 1, '金額': 1, '利用料': 1, '本体価格': 1, '1時間あたりの収入目安': 1 };
  var HEAD_KEY = { '数量': 'qty', '区分': 'tier', '内容': 'detail', '計算': 'calc' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function formatPrice(item, currency) {
    var p = item.price, unit = item.unit || '', note = item.note || '', main;
    if (p === 0 && note) { main = esc(note); note = ''; }
    else if (p === 0) { main = '無料'; }
    else { main = esc(String(p)) + esc(currency) + (unit ? esc(unit) : ''); }
    if (note) main += ' <span class="price-sub">（' + esc(note) + '）</span>';
    return main;
  }

  function buildTable(cat, currency) {
    var cols = cat.columns || ['品目', '価格'];
    var midHead = cols.length >= 3 ? cols[1] : null;
    var midKey = midHead && HEAD_KEY[midHead] ? HEAD_KEY[midHead] : 'qty';
    var thead = '<thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead>';
    var rows = (cat.items || []).map(function (item) {
      var cells = cols.map(function (col, i) {
        if (i === 0) {
          var icon = item.icon ? '<i class="mc" style="background-image:url(assets/icons/' + esc(item.icon) + '.png)"></i>' : '';
          return '<td>' + icon + esc(item.name || '') + '</td>';
        }
        if (i === cols.length - 1) return '<td class="price">' + formatPrice(item, currency) + '</td>';
        var val = item[midKey] != null ? item[midKey] : '';
        return '<td' + (midKey === 'qty' ? ' class="num"' : '') + '>' + esc(val) + '</td>';
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('');
    return '<div class="table-wrap"><table>' + thead + '<tbody>' + rows + '</tbody></table></div>';
  }

  function mc(name) {
    if (!name) return '';
    return '<i class="mc" style="background-image:url(assets/icons/' + esc(name) + '.png)"></i>';
  }

  // 役割（主な取り扱い・主な仕事・サービス）のHTMLを組み立て
  function roleSectionsHtml(job) {
    var role = job.role || {};
    var secs = role.sections || [];
    if (!secs.length) return '';
    return secs.map(function (s) {
      var h = '<h4>' + (s.icon ? mc(s.icon) + ' ' : '') + esc(s.heading) + '</h4>';
      if (s.type === 'list') {
        return h + '<ul>' + (s.items || []).map(function (it) {
          return '<li>' + esc(it.text) + '</li>';
        }).join('') + '</ul>';
      }
      return h + '<div class="tags">' + (s.items || []).map(function (it) {
        return '<span class="tag">' + mc(it.icon) + esc(it.text) + '</span>';
      }).join('') + '</div>';
    }).join('');
  }

  fetch('data/prices.json?_=' + Date.now())
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      var currency = (data.meta && data.meta.currency) || 'エメラルド';
      var job = (data.jobs || []).find(function (j) { return j.id === jobId; });
      if (!job) {
        heroEl.innerHTML = '<h1>職業が見つかりません</h1><p>id=' + esc(jobId) + '</p>';
        return;
      }
      document.title = job.label + '｜マイクラ経済ワールド';

      // ヒーロー
      var icons = (job.icons || []).map(function (n) {
        return '<i class="mc mc-xl" style="background-image:url(assets/icons/' + esc(n) + '.png)"></i>';
      }).join('');
      heroEl.innerHTML =
        '<div class="hero-icons">' + icons + '</div>' +
        '<div class="hero-kicker">職業</div>' +
        '<h1><span class="hero-emoji">' + esc(job.emoji || '📦') + '</span>' + esc(job.label) + '</h1>' +
        (job.desc ? '<p>' + esc(job.desc) + '</p>' : '');

      // 各職業一覧へ戻る導線
      var backLink = '<p class="job-back"><a href="jobs.html">← 各職業の一覧へ戻る</a></p>';

      var secNo = 0;
      var parts = [];

      // 1) 役割セクション（主な取り扱い・主な仕事・サービス）
      var roleInner = roleSectionsHtml(job);
      if (roleInner) {
        secNo++;
        parts.push(
          '<section class="section" id="role">' +
          '<div class="section__head"><span class="num">' + secNo + '</span>' +
          '<h2><span class="ico">📋</span>役割・取り扱い</h2></div>' +
          '<div class="section__body">' + roleInner + '</div>' +
          '</section>');
      }

      // 2) 相場カテゴリ（価格テーブル）
      // 一部カテゴリは別ページ(国のシステム)に残すため、職業詳細では表示しない
      var SKIP = { tax: 1 };
      (job.categories || []).filter(function (cat) { return !SKIP[cat.id]; }).forEach(function (cat) {
        secNo++;
        var note = cat.note ? '<p class="price-note">' + esc(cat.note) + '</p>' : '';
        parts.push(
          '<section class="section" id="' + esc(cat.id) + '">' +
          '<div class="section__head"><span class="num">' + secNo + '</span>' +
          '<h2><span class="ico">' + esc(job.emoji || '📦') + '</span>' + esc(cat.title) + '</h2></div>' +
          '<div class="section__body">' + note + buildTable(cat, currency) + '</div>' +
          '</section>');
      });

      bodyEl.innerHTML = backLink +
        (parts.length ? parts.join('') : '<p class="price-note">この職業にはまだ情報がありません。</p>');

      // サイドナビの目次を作り直す（nav.js は非同期注入なので ready を待つ）
      if (document.getElementById('sidenav')) rebuildToc(job);
      else document.addEventListener('nav:ready', function () { rebuildToc(job); }, { once: true });
    })
    .catch(function (err) {
      heroEl.innerHTML = '<h1>読み込み失敗</h1><p class="price-error">' + esc(err.message) +
        '（ローカルでは簡易サーバー経由で開いてください）</p>';
    });

  // nav.js が作る .sidenav__toc を、生成後のセクションで埋め直す
  function rebuildToc(job) {
    var nav = document.getElementById('sidenav');
    if (!nav) return;
    var secs = document.querySelectorAll('#jobBody > .section');
    if (!secs.length) return;
    var items = Array.prototype.map.call(secs, function (s) {
      var h = s.querySelector('.section__head h2');
      var ico = h && h.querySelector('.ico') ? h.querySelector('.ico').textContent : '';
      var label = h ? h.textContent.replace(ico, '').trim() : s.id;
      return '<li><a href="#' + s.id + '"><span class="ico">' + ico + '</span>' + label + '</a></li>';
    }).join('');
    // 既存のTOC（あれば置換、なければ追加）
    var old = nav.querySelector('.sidenav__toc');
    var oldTitle = nav.querySelector('.sidenav__toc-title');
    if (old) old.remove();
    if (oldTitle) oldTitle.remove();
    nav.insertAdjacentHTML('beforeend',
      '<h2 class="sidenav__toc-title">このページの目次</h2><ul class="sidenav__toc">' + items + '</ul>');
  }
})();
