/* ============================================================
   価格表・検索ページ（prices.html / s2/prices.html）
   prices.json の全価格を一覧表示し、キーワード検索＋職業フィルタ。
   - body data-depth でサブフォルダの相対パスを補正
   - body data-prices でデータファイルを差し替え（シーズン2は prices-s2.json）
   ============================================================ */
(function () {
  'use strict';

  var body = document.body;
  var P = '../'.repeat(parseInt(body.getAttribute('data-depth') || '0', 10));
  var DATA_FILE = body.getAttribute('data-prices') || 'data/prices.json';
  /* 職業詳細ページ(job.html)があるのはシーズン1のみ */
  var SHOW_JOB_LINK = (body.getAttribute('data-season') || '1') === '1';

  var qEl = document.getElementById('pq');
  var jobSel = document.getElementById('pjob');
  var countEl = document.getElementById('pcount');
  var resultsEl = document.getElementById('priceResults');
  if (!resultsEl) return;

  var DATA = null;
  var CURRENCY = 'エメラルド';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function mc(name) {
    if (!name) return '';
    return '<i class="mc" style="background-image:url(' + P + 'assets/icons/' + esc(name) + '.png)"></i>';
  }
  function formatPrice(item) {
    var p = item.price, unit = item.unit || '', note = item.note || '', main;
    if (p === 0 && note) { main = esc(note); note = ''; }
    else if (p === 0) { main = '無料'; }
    else { main = esc(String(p)) + esc(CURRENCY) + (unit ? esc(unit) : ''); }
    if (note) main += ' <span class="price-sub">（' + esc(note) + '）</span>';
    return main;
  }

  fetch(P + DATA_FILE + '?_=' + Date.now())
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      DATA = data;
      CURRENCY = (data.meta && data.meta.currency) || 'エメラルド';
      buildJobFilter();
      render();
    })
    .catch(function (err) {
      resultsEl.innerHTML = '<p class="price-error">価格データの読み込みに失敗しました（' + esc(err.message) +
        '）。ローカルでは簡易サーバー経由で開いてください。</p>';
    });

  // 職業フィルタの選択肢
  function buildJobFilter() {
    var opts = ['<option value="">すべての職業</option>'];
    DATA.jobs.forEach(function (j) {
      if (j.id === 'common') return;
      opts.push('<option value="' + esc(j.id) + '">' + esc(j.emoji || '') + ' ' + esc(j.label) + '</option>');
    });
    jobSel.innerHTML = opts.join('');
  }

  // 1項目を検索対象テキストに
  function itemText(job, cat, it) {
    return [it.name, it.qty, it.tier, it.detail, it.note, cat.title, job.label]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function render() {
    var q = (qEl.value || '').trim().toLowerCase();
    var jobFilter = jobSel.value;
    var total = 0;
    var blocks = [];

    DATA.jobs.forEach(function (job) {
      if (job.id === 'common') return;
      if (jobFilter && job.id !== jobFilter) return;

      var catBlocks = [];
      (job.categories || []).forEach(function (cat) {
        var items = (cat.items || []).filter(function (it) {
          return !q || itemText(job, cat, it).indexOf(q) >= 0;
        });
        if (!items.length) return;
        total += items.length;
        catBlocks.push(categoryTable(job, cat, items));
      });
      if (!catBlocks.length) return;

      blocks.push(
        '<section class="price-job">' +
          '<div class="price-job__head">' +
            mc((job.icons && job.icons[0]) || 'emerald') +
            '<span class="price-job__name">' + esc(job.label) + '</span>' +
            (SHOW_JOB_LINK ? '<a class="price-job__link" href="' + jobLink(job) + '">詳細ページ →</a>' : '') +
          '</div>' +
          catBlocks.join('') +
        '</section>');
    });

    countEl.textContent = total + ' 件';
    resultsEl.innerHTML = blocks.length ? blocks.join('') :
      '<p class="price-note">該当する価格が見つかりませんでした。検索語や職業フィルタを変えてみてください。</p>';
  }

  function jobLink(job) {
    return P + 'job.html?id=' + encodeURIComponent(job.id);
  }

  function categoryTable(job, cat, items) {
    var cols = cat.columns || ['品目', '価格'];
    var midHead = cols.length >= 3 ? cols[1] : null;
    var midKey = midHead === '数量' ? 'qty' : midHead === '区分' ? 'tier'
      : midHead === '計算' ? 'calc' : midHead === '内容' ? 'detail' : 'qty';

    var rows = items.map(function (it) {
      var cells = cols.map(function (col, i) {
        if (i === 0) return '<td>' + mc(it.icon) + esc(it.name || '') + '</td>';
        if (i === cols.length - 1) return '<td class="price">' + formatPrice(it) + '</td>';
        return '<td' + (midKey === 'qty' ? ' class="num"' : '') + '>' + esc(it[midKey] || '') + '</td>';
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('');

    var thead = '<thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead>';
    return '<div class="price-cat">' +
      '<h3 class="price-cat__title">' + esc(cat.title) + '</h3>' +
      '<div class="table-wrap"><table>' + thead + '<tbody>' + rows + '</tbody></table></div>' +
      '</div>';
  }

  // イベント
  if (qEl) qEl.addEventListener('input', debounce(render, 120));
  if (jobSel) jobSel.addEventListener('change', render);

  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }
})();
