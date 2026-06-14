/* ============================================================
   Minecraft Economy World - 価格テーブル描画（schema 2）
   data/prices.json を読み込み、
   <div data-price-table="カテゴリID"></div> に表を生成する。
   データ構造: jobs[] -> categories[] -> items[]（price は数値）
   ============================================================ */
(function () {
  'use strict';

  var depth = parseInt(document.body.getAttribute('data-depth') || '0', 10);
  var P = depth > 0 ? '../'.repeat(depth) : '';
  var DATA_URL = P + 'data/prices.json';
  var ICON_BASE = P + 'assets/icons/';

  var holders = Array.prototype.slice.call(
    document.querySelectorAll('[data-price-table]')
  );
  if (!holders.length) return;

  var PRICE_COLS = { '価格': 1, '報酬': 1, '相場': 1, '追加料金': 1, '参加費': 1, '金額': 1, '利用料': 1, '本体価格': 1, '1時間あたりの収入目安': 1 };
  var HEAD_KEY = { '数量': 'qty', '区分': 'tier', '内容': 'detail', '計算': 'calc' };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // 数値price + unit + note を表示用文字列へ
  function formatPrice(item, currency) {
    var p = item.price;
    var unit = item.unit || '';
    var note = item.note || '';
    var main;
    if (p === 0 && note) {
      // 0 かつ補足がある（無料・特殊式など）→ note を主表示
      main = esc(note);
      note = '';
    } else if (p === 0) {
      main = '無料';
    } else {
      main = esc(String(p)) + esc(currency) + (unit ? esc(unit) : '');
    }
    if (note) {
      main += ' <span class="price-sub">（' + esc(note) + '）</span>';
    }
    return main;
  }

  // 全カテゴリを id -> {category, currency} で索引化
  function indexCategories(data) {
    var idx = {};
    var currency = (data.meta && data.meta.currency) || 'エメラルド';
    (data.jobs || []).forEach(function (job) {
      (job.categories || []).forEach(function (cat) {
        idx[cat.id] = cat;
      });
    });
    return { idx: idx, currency: currency };
  }

  function buildTable(cat, currency) {
    var cols = cat.columns;
    var midHead = cols.length >= 3 ? cols[1] : null;
    var midKey = midHead && HEAD_KEY[midHead] ? HEAD_KEY[midHead] : 'qty';

    var thead = '<thead><tr>' + cols.map(function (c) {
      return '<th>' + esc(c) + '</th>';
    }).join('') + '</tr></thead>';

    var rowsHtml = cat.items.map(function (item) {
      var cells = cols.map(function (col, i) {
        if (i === 0) {
          var icon = item.icon
            ? '<i class="mc" style="background-image:url(' + ICON_BASE + esc(item.icon) + '.png)"></i>'
            : '';
          return '<td>' + icon + esc(item.name || '') + '</td>';
        }
        if (i === cols.length - 1) {
          // 最終列＝価格
          return '<td class="price">' + formatPrice(item, currency) + '</td>';
        }
        // 中間列
        var val = item[midKey] != null ? item[midKey] : '';
        var cls = (midKey === 'qty') ? ' class="num"' : '';
        return '<td' + cls + '>' + esc(val) + '</td>';
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('');

    return '<div class="table-wrap"><table>' + thead +
           '<tbody>' + rowsHtml + '</tbody></table></div>';
  }

  function render(data) {
    var info = indexCategories(data);
    holders.forEach(function (el) {
      var id = el.getAttribute('data-price-table');
      var cat = info.idx[id];
      if (!cat) {
        el.innerHTML = '<p class="price-error">⚠ 価格データ「' + esc(id) + '」が見つかりません。</p>';
        return;
      }
      var html = '';
      if (cat.note) html += '<p class="price-note">' + esc(cat.note) + '</p>';
      html += buildTable(cat, info.currency);
      el.innerHTML = html;
    });
  }

  fetch(DATA_URL + '?_=' + Date.now())
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(render)
    .catch(function (err) {
      holders.forEach(function (el) {
        el.innerHTML = '<p class="price-error">⚠ 価格データの読み込みに失敗しました（' +
          esc(err.message) + '）。ローカルでは簡易サーバー経由で表示してください。</p>';
      });
    });
})();
