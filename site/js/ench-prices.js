/* ============================================================
   エンチャント図鑑（s2/enchants.html）価格列の注入
   data/prices-s2.json の政府カテゴリ
     - new_enchant_fee（新エンチャント価格）
     - unique_skill（ユニークスキル・非売品）
   から価格を引き、各カテゴリ表の右端に「価格」列を追加する。
   図鑑側の行とはエンチャント名（<td> 内の <strong>）で対応付ける。
   価格改定は prices-s2.json（⚙管理ページのシーズン2）だけ直せばよい。
   ============================================================ */
(function () {
  'use strict';

  var body = document.body;
  var P = '../'.repeat(parseInt(body.getAttribute('data-depth') || '0', 10));
  var DATA_FILE = body.getAttribute('data-prices') || 'data/prices-s2.json';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  fetch(P + DATA_FILE + '?_=' + Date.now())
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) { decorate(buildMap(data)); })
    .catch(function () { /* 価格が引けない時は列を出さない（図鑑は読める） */ });

  /* 価格アイテム名 → 図鑑のエンチャント名 に正規化してマップを作る */
  function buildMap(data) {
    var gov = (data.jobs || []).filter(function (j) { return j.id === 'government'; })[0];
    if (!gov) return {};
    var map = {};
    (gov.categories || []).forEach(function (cat) {
      if (cat.id !== 'new_enchant_fee' && cat.id !== 'unique_skill') return;
      var unique = (cat.id === 'unique_skill');
      (cat.items || []).forEach(function (it) {
        var name = String(it.name || '');
        var lvM = name.match(/\sLV(\d+)$/);
        var base = name.replace(/\sLV\d+$/, '').split('（')[0].trim();
        var entry = map[base] || (map[base] = { levels: [], unique: unique, set: null });
        entry.levels.push({ lv: lvM ? parseInt(lvM[1], 10) : 0, price: it.price, note: it.note || '' });
        /* 「ジャベリン＋リターン」はセット価格 → 図鑑の両方の行に出す */
        if (base.indexOf('＋') >= 0) {
          base.split('＋').forEach(function (part) {
            map[part.trim()] = { levels: entry.levels, unique: unique, set: base };
          });
        }
      });
    });
    return map;
  }

  function cellHTML(e) {
    if (!e) return '<td class="lv" style="color:var(--mc-text-dim);">未定</td>';
    var ls = e.levels.slice().sort(function (a, b) { return a.lv - b.lv; });
    /* 禁止（price 0 + note 禁止） */
    if (ls.every(function (l) { return l.price === 0 && /禁止/.test(l.note); })) {
      return '<td class="ng" style="font-weight:bold;">禁止</td>';
    }
    /* ユニークスキル（非売品） */
    if (e.unique) {
      var un = ls[0].note && ls[0].note !== '非売品' ? '<span class="en">' + esc(ls[0].note) + '</span>' : '';
      return '<td class="price" style="color:var(--mc-gold);">非売品' + un + '</td>';
    }
    /* レベル別価格（バイタリティ・ダブルジャンプなど） */
    if (ls.length > 1) {
      var rows = ls.map(function (l) { return 'LV' + l.lv + '： ' + l.price; }).join('<br>');
      return '<td class="price" style="white-space:nowrap;">' + rows + '</td>';
    }
    var l = ls[0];
    var note = e.set ? '<span class="en">' + esc(e.set) + ' セット価格</span>'
             : (l.note ? '<span class="en">' + esc(l.note) + '</span>' : '');
    return '<td class="price">' + l.price + note + '</td>';
  }

  function decorate(map) {
    document.querySelectorAll('section[id^="cat-"] table').forEach(function (tbl) {
      var hrow = tbl.querySelector('thead tr');
      if (hrow) hrow.insertAdjacentHTML('beforeend', '<th>価格<span style="font-weight:normal;font-size:0.75rem;">(エメラルド)</span></th>');
      tbl.querySelectorAll('tbody tr').forEach(function (tr) {
        var st = tr.querySelector('td strong');
        var name = st ? st.textContent.trim() : '';
        tr.insertAdjacentHTML('beforeend', cellHTML(map[name]));
      });
    });
  }
})();
