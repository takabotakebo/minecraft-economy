/* ============================================================
   価格データ管理ページ（ローカル専用 / schema 2）
   - 職業 → カテゴリ → 項目 の編集・追加・削除
   - 項目のドラッグ＆ドロップ並び替え
   - アイコンの検索付きピッカー
   - 各カテゴリに「表示プレビュー」（公開ページと同じ見え方）
   保存: ローカル保存API → File System Access → ダウンロード
   ============================================================ */
(function () {
  'use strict';

  /* シーズン切替: admin.html?season=2 でシーズン2の価格(prices-s2.json)を編集 */
  var IS_S2 = /[?&]season=2(&|$)/.test(location.search);
  var DATA_FILE = IS_S2 ? 'prices-s2.json' : 'prices.json';
  var DATA_PATH = 'data/' + DATA_FILE;
  var ICONS_PATH = 'data/icons.json';
  var SAVE_API = 'api/save-prices' + (IS_S2 ? '?file=prices-s2.json' : '');

  var els = {
    root: document.getElementById('jobsRoot'),
    save: document.getElementById('saveBtn'),
    download: document.getElementById('downloadBtn'),
    addJob: document.getElementById('addJobBtn'),
    collapseAll: document.getElementById('collapseAllBtn'),
    expandAll: document.getElementById('expandAllBtn'),
    filter: document.getElementById('filter'),
    status: document.getElementById('status'),
    hint: document.getElementById('fsHint'),
    prodWarning: document.getElementById('prodWarning'),
    modal: document.getElementById('iconModal'),
    iconSearch: document.getElementById('iconSearch'),
    iconGrid: document.getElementById('iconGrid'),
    iconClose: document.getElementById('iconClose'),
    iconClear: document.getElementById('iconClear')
  };

  var host = location.hostname;
  var IS_LOCAL = (host === 'localhost' || host === '127.0.0.1' || host === '' || location.protocol === 'file:');
  var HAS_FS = (typeof window.showSaveFilePicker === 'function' && location.protocol !== 'file:');
  var serverSaveAvailable = IS_LOCAL && location.protocol.indexOf('http') === 0;

  var data = null;
  var iconList = [];
  var fileHandle = null;
  var dirty = false;
  var pickTarget = null; // アイコンピッカーの対象 {ji,ci,ii}
  var catCollapsed = {}; // カテゴリID -> 折りたたみ状態（再描画後も保持）

  if (!IS_LOCAL) els.prodWarning.style.display = '';
  updateHint();
  markSeason();

  /* どのシーズンのデータを編集中かをヘッダーに明示する */
  function markSeason() {
    var label = IS_S2 ? 'シーズン2' : 'シーズン1';
    document.title = '価格データ管理【' + label + '】｜マイクラ経済ワールド';
    var h1 = document.querySelector('.hero--page h1');
    if (h1) h1.insertAdjacentHTML('beforeend',
      ' <span style="font-size:0.7em;color:var(--mc-gold);">【' + label + '｜' + DATA_FILE + '】</span>');
    var lead = document.querySelector('.hero--page p code');
    if (lead) lead.textContent = 'data/' + DATA_FILE;
    var other = IS_S2 ? 'admin.html' : 'admin.html?season=2';
    var otherLabel = IS_S2 ? 'シーズン1の価格を編集 →' : 'シーズン2の価格を編集 →';
    var hero = document.querySelector('.hero--page');
    if (hero) hero.insertAdjacentHTML('beforeend',
      '<p style="margin-top:8px;"><a class="changelog-link" href="' + other + '">' + otherLabel + '</a></p>');
  }

  function updateHint() {
    if (serverSaveAvailable) els.hint.innerHTML = '✅ ローカル編集サーバー経由です。「保存」で <code>data/' + DATA_FILE + '</code> に直接上書きされます。';
    else if (HAS_FS) els.hint.innerHTML = '「保存」でファイル保存ダイアログから <code>data/' + DATA_FILE + '</code> を選んで上書きしてください。';
    else els.hint.innerHTML = '「ダウンロード保存」で <code>' + DATA_FILE + '</code> を保存し <code>site/data/</code> に上書きしてください。';
  }
  function setStatus(m, k) { els.status.textContent = m; els.status.className = 'admin-status' + (k ? ' ' + k : ''); }
  function markDirty() { dirty = true; setStatus('未保存の変更があります', 'dirty'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function currency() { return (data.meta && data.meta.currency) || 'エメラルド'; }

  /* ---- 読み込み（価格 & アイコン一覧） ---- */
  Promise.all([
    fetch(DATA_PATH + '?_=' + Date.now()).then(function (r) { if (!r.ok) throw new Error('prices ' + r.status); return r.json(); }),
    fetch(ICONS_PATH + '?_=' + Date.now()).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
  ]).then(function (res) {
    data = res[0]; iconList = res[1] || [];
    if (!data.jobs) throw new Error('スキーマ未対応（jobs なし）');
    render();
    setStatus('読み込み完了（' + countItems() + ' 項目 / アイコン ' + iconList.length + ' 種）', 'ok');
  }).catch(function (err) { setStatus('読み込み失敗: ' + err.message, 'err'); });

  function countItems() {
    var n = 0; data.jobs.forEach(function (j) { j.categories.forEach(function (c) { n += c.items.length; }); }); return n;
  }

  /* ---- プレビュー（公開ページと同じ価格表記） ---- */
  function formatPrice(it) {
    var p = it.price, unit = it.unit || '', note = it.note || '', main;
    if (p === 0 && note) { main = esc(note); note = ''; }
    else if (p === 0) { main = '無料'; }
    else { main = esc(String(p)) + esc(currency()) + (unit ? esc(unit) : ''); }
    if (note) main += ' <span class="price-sub">（' + esc(note) + '）</span>';
    return main;
  }
  function previewHtml(cat) {
    var cols = cat.columns || ['品目', '価格'];
    var midHead = cols.length >= 3 ? cols[1] : null;
    var midKey = midHead === '数量' ? 'qty' : midHead === '区分' ? 'tier' : midHead === '計算' ? 'calc' : midHead === '内容' ? 'detail' : 'qty';
    var thead = '<thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead>';
    var rows = cat.items.map(function (it) {
      var cells = cols.map(function (col, i) {
        if (i === 0) {
          var icon = it.icon ? '<i class="mc" style="background-image:url(assets/icons/' + esc(it.icon) + '.png)"></i>' : '';
          return '<td>' + icon + esc(it.name || '') + '</td>';
        }
        if (i === cols.length - 1) return '<td class="price">' + formatPrice(it) + '</td>';
        return '<td' + (midKey === 'qty' ? ' class="num"' : '') + '>' + esc(it[midKey] || '') + '</td>';
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('');
    return '<div class="adm-preview"><div class="adm-preview__label">▼ 公開ページでの表示プレビュー</div>' +
      '<div class="table-wrap"><table>' + thead + '<tbody>' + rows + '</tbody></table></div></div>';
  }

  /* ---- 描画 ---- */
  function render() {
    els.root.innerHTML = data.jobs.map(jobHtml).join('');
    bindEvents();
    applyFilter();
  }

  function jobHtml(job, ji) {
    var cats = job.categories.map(function (cat, ci) { return categoryHtml(job, ji, cat, ci); }).join('');
    return '<section class="adm-job" data-ji="' + ji + '">' +
      '<div class="adm-job__head" draggable="true" data-jobdrag="' + ji + '">' +
        '<span class="job-drag-handle" title="ドラッグで職業を並び替え">⠿</span>' +
        '<span class="adm-job__emoji">' + esc(job.emoji || '📦') + '</span>' +
        '<input class="adm-job__label" data-ji="' + ji + '" value="' + esc(job.label) + '" title="職業名">' +
        '<span class="adm-job__id">#' + esc(job.id) + '</span>' +
        '<button class="admin-mini addCat" data-ji="' + ji + '">＋カテゴリ追加</button>' +
        '<button class="admin-mini delJob" data-ji="' + ji + '" title="職業を削除">🗑職業</button>' +
      '</div>' + roleHtml(job, ji) + cats + '</section>';
  }

  /* ---- 職業の役割（説明文＋箇条書きセクション）編集UI ---- */
  function roleHtml(job, ji) {
    var role = job.role || (job.role = {});
    var secs = role.sections || (role.sections = []);
    var secHtml = secs.map(function (s, si) { return roleSectionHtml(ji, s, si); }).join('');
    return '<details class="adm-role" data-ji="' + ji + '">' +
      '<summary>📝 各職業の役割（説明文・箇条書き）</summary>' +
      '<div class="adm-role__body">' +
        '<label class="adm-role__field"><span>説明文</span>' +
          '<textarea class="adm-role-desc" data-ji="' + ji + '" rows="2" placeholder="この職業の説明">' + esc(job.desc || '') + '</textarea>' +
        '</label>' +
        '<div class="adm-role__secs">' + secHtml + '</div>' +
        '<button class="admin-mini addRoleSec" data-ji="' + ji + '">＋見出しを追加</button>' +
      '</div>' +
    '</details>';
  }

  function roleSectionHtml(ji, sec, si) {
    var items = (sec.items || []).map(function (it, ii) {
      return '<div class="adm-roleitem" data-ji="' + ji + '" data-si="' + si + '" data-ii="' + ii + '">' +
        '<span class="roleitem-icon" title="アイコン選択（任意）">' +
          (it.icon ? '<i class="mc" style="background-image:url(assets/icons/' + esc(it.icon) + '.png)"></i>' : '<span class="icon-empty">＋</span>') +
        '</span>' +
        '<input class="admin-text rolei-text" data-ji="' + ji + '" data-si="' + si + '" data-ii="' + ii + '" value="' + esc(it.text || '') + '" placeholder="項目テキスト">' +
        '<button class="admin-mini delRoleItem" data-ji="' + ji + '" data-si="' + si + '" data-ii="' + ii + '" title="削除">🗑</button>' +
      '</div>';
    }).join('');
    return '<div class="adm-rolesec" data-ji="' + ji + '" data-si="' + si + '">' +
      '<div class="adm-rolesec__head">' +
        '<input class="admin-text rolesec-head" data-ji="' + ji + '" data-si="' + si + '" value="' + esc(sec.heading || '') + '" placeholder="見出し（例: 主な商品）">' +
        '<select class="rolesec-type" data-ji="' + ji + '" data-si="' + si + '" title="表示形式">' +
          '<option value="tags"' + (sec.type !== 'list' ? ' selected' : '') + '>タグ（アイコン付き）</option>' +
          '<option value="list"' + (sec.type === 'list' ? ' selected' : '') + '>箇条書きリスト</option>' +
        '</select>' +
        '<button class="admin-mini addRoleItem" data-ji="' + ji + '" data-si="' + si + '">＋項目</button>' +
        '<button class="admin-mini delRoleSec" data-ji="' + ji + '" data-si="' + si + '" title="見出し削除">🗑見出し</button>' +
      '</div>' +
      '<div class="adm-rolesec__items">' + items + '</div>' +
    '</div>';
  }

  function categoryHtml(job, ji, cat, ci) {
    var cols = cat.columns || ['品目', '価格'];
    var midHead = cols.length >= 3 ? cols[1] : '';
    var rows = cat.items.map(function (it, ii) { return itemRow(ji, ci, cat, midHead, it, ii); }).join('');
    var collapsed = catCollapsed[cat.id] ? ' collapsed' : '';
    return '<div class="adm-cat' + collapsed + '" data-ji="' + ji + '" data-ci="' + ci + '" data-cid="' + esc(cat.id) + '">' +
      '<div class="adm-cat__head">' +
        '<button class="cat-toggle" data-cid="' + esc(cat.id) + '" title="折りたたみ">' + (catCollapsed[cat.id] ? '▶' : '▼') + '</button>' +
        '<input class="adm-cat__title" data-ji="' + ji + '" data-ci="' + ci + '" value="' + esc(cat.title) + '" title="カテゴリ名">' +
        '<span class="adm-cat__id">#' + esc(cat.id) + '</span>' +
        '<span class="adm-cat__count">' + cat.items.length + '項目</span>' +
        '<select class="adm-cat__move" data-ji="' + ji + '" data-ci="' + ci + '" title="所属する職業">' +
          data.jobs.map(function (j, k) { return '<option value="' + k + '"' + (k === ji ? ' selected' : '') + '>' + esc(j.label) + 'へ</option>'; }).join('') +
        '</select>' +
        '<button class="admin-mini addItem" data-ji="' + ji + '" data-ci="' + ci + '">＋項目</button>' +
        '<button class="admin-mini delCat" data-ji="' + ji + '" data-ci="' + ci + '" title="カテゴリ削除">🗑カテゴリ</button>' +
      '</div>' +
      '<div class="adm-cat__body">' +
        previewHtml(cat) +
        '<div class="table-wrap"><table class="admin-table"><thead><tr>' +
          '<th style="width:28px;"></th>' +
          '<th style="width:44px;">アイコン</th><th>名前</th>' +
          (cols.length >= 3 ? '<th>' + esc(midHead) + '</th>' : '') +
          '<th style="width:110px;">価格(数値)</th><th style="width:90px;">単位</th><th>補足</th><th style="width:36px;"></th>' +
        '</tr></thead><tbody data-ji="' + ji + '" data-ci="' + ci + '">' + rows + '</tbody></table></div>' +
      '</div>' +
    '</div>';
  }

  function itemRow(ji, ci, cat, midHead, it, ii) {
    var midKey = midHead === '数量' ? 'qty' : midHead === '区分' ? 'tier' : midHead === '計算' ? 'calc' : midHead === '内容' ? 'detail' : 'qty';
    var hasMid = cat.columns.length >= 3;
    var iconCell = it.icon
      ? '<i class="mc" style="background-image:url(assets/icons/' + esc(it.icon) + '.png)"></i>'
      : '<span class="icon-empty">＋</span>';
    var search = (it.name || '') + ' ' + (cat.title || '') + ' ' + data.jobs[ji].label;
    return '<tr class="data-row" draggable="true" data-ji="' + ji + '" data-ci="' + ci + '" data-ii="' + ii + '" data-search="' + esc(search) + '">' +
      '<td class="drag-handle" title="ドラッグで並び替え">⠿</td>' +
      '<td class="icon-cell" title="クリックでアイコン選択">' + iconCell + '</td>' +
      '<td><input class="admin-text fld" data-f="name" value="' + esc(it.name) + '" placeholder="名前"></td>' +
      (hasMid ? '<td><input class="admin-text fld admin-sub-input" data-f="' + midKey + '" value="' + esc(it[midKey] || '') + '" placeholder="' + esc(midHead) + '"></td>' : '') +
      '<td><input type="number" step="0.1" class="admin-price-input fld" data-f="price" value="' + esc(it.price != null ? it.price : 0) + '"></td>' +
      '<td><input class="admin-text fld" data-f="unit" value="' + esc(it.unit || '') + '" placeholder="例:/10分"></td>' +
      '<td><input class="admin-text fld admin-sub-input" data-f="note" value="' + esc(it.note || '') + '" placeholder="補足・範囲など"></td>' +
      '<td><button class="admin-mini delItem" title="削除">🗑</button></td>' +
    '</tr>';
  }

  /* ---- イベント結線 ---- */
  function bindEvents() {
    qa('.adm-job__label').forEach(function (inp) {
      inp.addEventListener('input', function () { data.jobs[+inp.dataset.ji].label = inp.value; markDirty(); });
    });
    qa('.adm-cat__title').forEach(function (inp) {
      inp.addEventListener('input', function () { data.jobs[+inp.dataset.ji].categories[+inp.dataset.ci].title = inp.value; markDirty(); });
    });
    qa('.adm-cat__move').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var ji = +sel.dataset.ji, ci = +sel.dataset.ci, to = +sel.value;
        if (to === ji) return;
        var cat = data.jobs[ji].categories.splice(ci, 1)[0];
        data.jobs[to].categories.push(cat);
        markDirty(); render();
      });
    });
    qa('.fld').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var tr = inp.closest('tr');
        var it = item(tr);
        var f = inp.dataset.f;
        if (f === 'price') it.price = inp.value === '' ? 0 : Number(inp.value);
        else if (inp.value === '') delete it[f];
        else it[f] = inp.value;
        inp.classList.add('changed');
        // プレビュー即時更新
        refreshPreview(tr);
        markDirty();
      });
    });
    // カテゴリの折りたたみトグル（再描画せずclassで切替）
    qa('.cat-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = btn.closest('.adm-cat');
        var cid = btn.dataset.cid;
        var nowCollapsed = box.classList.toggle('collapsed');
        catCollapsed[cid] = nowCollapsed;
        btn.textContent = nowCollapsed ? '▶' : '▼';
      });
    });
    qa('.addItem').forEach(function (btn) {
      btn.addEventListener('click', function () {
        data.jobs[+btn.dataset.ji].categories[+btn.dataset.ci].items.push({ name: '新しい項目', price: 0 });
        markDirty(); render(); focusLast(btn.dataset.ji, btn.dataset.ci);
      });
    });
    qa('.delItem').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr'); var cat = category(tr); var it = cat.items[+tr.dataset.ii];
        if (confirm('「' + (it.name || '(無名)') + '」を削除しますか？')) { cat.items.splice(+tr.dataset.ii, 1); markDirty(); render(); }
      });
    });
    qa('.addCat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ji = +btn.dataset.ji;
        var id = askId('新しいカテゴリのID（英数字_）例: special_goods'); if (!id) return;
        var title = prompt('カテゴリの表示名', '新カテゴリ') || '新カテゴリ';
        data.jobs[ji].categories.push({ id: id, title: title, columns: ['品目', '数量', '価格'], items: [{ name: '新しい項目', qty: '', price: 0 }] });
        markDirty(); render();
      });
    });
    qa('.delJob').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ji = +btn.dataset.ji, job = data.jobs[ji];
        var nCat = job.categories.length;
        var nItem = job.categories.reduce(function (s, c) { return s + c.items.length; }, 0);
        var msg = '職業「' + job.label + '」を削除しますか？\n' +
          'カテゴリ ' + nCat + ' 個・項目 ' + nItem + ' 件もまとめて削除されます。';
        if (confirm(msg)) { data.jobs.splice(ji, 1); markDirty(); render(); }
      });
    });
    qa('.delCat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ji = +btn.dataset.ji, ci = +btn.dataset.ci, cat = data.jobs[ji].categories[ci];
        if (confirm('カテゴリ「' + cat.title + '」を項目ごと削除しますか？')) { data.jobs[ji].categories.splice(ci, 1); markDirty(); render(); }
      });
    });
    // アイコンセル → ピッカー
    qa('.icon-cell').forEach(function (td) {
      td.addEventListener('click', function () {
        var tr = td.closest('tr');
        openPicker(+tr.dataset.ji, +tr.dataset.ci, +tr.dataset.ii);
      });
    });
    bindRoleEvents();
    bindDnD();
    bindJobDnD();
  }

  /* ---- 役割（desc / sections）編集イベント ---- */
  function bindRoleEvents() {
    qa('.adm-role-desc').forEach(function (ta) {
      ta.addEventListener('input', function () { data.jobs[+ta.dataset.ji].desc = ta.value; markDirty(); });
    });
    qa('.rolesec-head').forEach(function (inp) {
      inp.addEventListener('input', function () {
        roleSec(inp).heading = inp.value; markDirty();
      });
    });
    qa('.rolesec-type').forEach(function (sel) {
      sel.addEventListener('change', function () { roleSec(sel).type = sel.value; markDirty(); });
    });
    qa('.rolei-text').forEach(function (inp) {
      inp.addEventListener('input', function () {
        roleItem(inp).text = inp.value; markDirty();
      });
    });
    qa('.addRoleSec').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var job = data.jobs[+btn.dataset.ji];
        (job.role.sections = job.role.sections || []).push({ heading: '新しい見出し', type: 'tags', items: [] });
        markDirty(); render(); reopenRole(btn.dataset.ji);
      });
    });
    qa('.delRoleSec').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('この見出しを削除しますか？')) return;
        data.jobs[+btn.dataset.ji].role.sections.splice(+btn.dataset.si, 1);
        markDirty(); render(); reopenRole(btn.dataset.ji);
      });
    });
    qa('.addRoleItem').forEach(function (btn) {
      btn.addEventListener('click', function () {
        data.jobs[+btn.dataset.ji].role.sections[+btn.dataset.si].items.push({ text: '' });
        markDirty(); render(); reopenRole(btn.dataset.ji);
      });
    });
    qa('.delRoleItem').forEach(function (btn) {
      btn.addEventListener('click', function () {
        data.jobs[+btn.dataset.ji].role.sections[+btn.dataset.si].items.splice(+btn.dataset.ii, 1);
        markDirty(); render(); reopenRole(btn.dataset.ji);
      });
    });
    // 役割項目のアイコン選択
    qa('.roleitem-icon').forEach(function (span) {
      span.addEventListener('click', function () {
        var box = span.closest('.adm-roleitem');
        openRolePicker(+box.dataset.ji, +box.dataset.si, +box.dataset.ii);
      });
    });
  }
  function roleSec(el) { return data.jobs[+el.dataset.ji].role.sections[+el.dataset.si]; }
  function roleItem(el) { return data.jobs[+el.dataset.ji].role.sections[+el.dataset.si].items[+el.dataset.ii]; }
  // 再描画後に該当職業の details を開いたままにする
  function reopenRole(ji) {
    var d = els.root.querySelector('.adm-role[data-ji="' + ji + '"]');
    if (d) d.open = true;
  }

  /* ---- 職業ブロックのドラッグ＆ドロップ並び替え ---- */
  var jobDragSrc = null;
  function bindJobDnD() {
    qa('.adm-job__head[data-jobdrag]').forEach(function (head) {
      head.addEventListener('dragstart', function (e) {
        jobDragSrc = head; head.closest('.adm-job').classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', head.dataset.jobdrag); } catch (x) {}
      });
      head.addEventListener('dragend', function () {
        var s = head.closest('.adm-job'); if (s) s.classList.remove('dragging');
        qa('.adm-job.drop-before,.adm-job.drop-after').forEach(function (r) { r.classList.remove('drop-before', 'drop-after'); });
      });
      head.addEventListener('dragover', function (e) {
        if (!jobDragSrc || jobDragSrc === head) return;
        e.preventDefault();
        var sec = head.closest('.adm-job');
        var rect = sec.getBoundingClientRect();
        var after = (e.clientY - rect.top) > rect.height / 2;
        sec.classList.toggle('drop-after', after);
        sec.classList.toggle('drop-before', !after);
      });
      head.addEventListener('dragleave', function () {
        var s = head.closest('.adm-job'); if (s) s.classList.remove('drop-before', 'drop-after');
      });
      head.addEventListener('drop', function (e) {
        if (!jobDragSrc || jobDragSrc === head) return;
        e.preventDefault();
        var from = +jobDragSrc.dataset.jobdrag, to = +head.dataset.jobdrag;
        var sec = head.closest('.adm-job');
        var after = sec.classList.contains('drop-after');
        var moved = data.jobs.splice(from, 1)[0];
        var insert = to + (after ? 1 : 0);
        if (from < insert) insert--;
        data.jobs.splice(insert, 0, moved);
        markDirty(); render();
      });
    });
  }

  function item(tr) { return data.jobs[+tr.dataset.ji].categories[+tr.dataset.ci].items[+tr.dataset.ii]; }
  function category(tr) { return data.jobs[+tr.dataset.ji].categories[+tr.dataset.ci]; }
  function refreshPreview(tr) {
    var catBox = tr.closest('.adm-cat');
    var cat = data.jobs[+catBox.dataset.ji].categories[+catBox.dataset.ci];
    var pv = catBox.querySelector('.adm-preview');
    if (pv) pv.outerHTML = previewHtml(cat);
  }

  /* ---- ドラッグ＆ドロップ並び替え（同一カテゴリ内） ---- */
  var dragSrc = null;
  function bindDnD() {
    qa('tr.data-row').forEach(function (tr) {
      tr.addEventListener('dragstart', function (e) {
        dragSrc = tr; tr.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', tr.dataset.ii); } catch (x) {}
      });
      tr.addEventListener('dragend', function () {
        tr.classList.remove('dragging');
        qa('tr.drop-before,tr.drop-after').forEach(function (r) { r.classList.remove('drop-before', 'drop-after'); });
      });
      tr.addEventListener('dragover', function (e) {
        if (!dragSrc || dragSrc === tr) return;
        // 同一カテゴリのみ
        if (tr.dataset.ji !== dragSrc.dataset.ji || tr.dataset.ci !== dragSrc.dataset.ci) return;
        e.preventDefault();
        var rect = tr.getBoundingClientRect();
        var after = (e.clientY - rect.top) > rect.height / 2;
        tr.classList.toggle('drop-after', after);
        tr.classList.toggle('drop-before', !after);
      });
      tr.addEventListener('dragleave', function () { tr.classList.remove('drop-before', 'drop-after'); });
      tr.addEventListener('drop', function (e) {
        if (!dragSrc || dragSrc === tr) return;
        if (tr.dataset.ji !== dragSrc.dataset.ji || tr.dataset.ci !== dragSrc.dataset.ci) return;
        e.preventDefault();
        var cat = category(tr);
        var from = +dragSrc.dataset.ii, to = +tr.dataset.ii;
        var after = tr.classList.contains('drop-after');
        var moved = cat.items.splice(from, 1)[0];
        var insert = to + (after ? 1 : 0);
        if (from < insert) insert--;
        cat.items.splice(insert, 0, moved);
        markDirty(); render();
      });
    });
  }

  function focusLast(ji, ci) {
    var rows = qa('tr.data-row[data-ji="' + ji + '"][data-ci="' + ci + '"]');
    var last = rows[rows.length - 1];
    if (last) { last.scrollIntoView({ block: 'center' }); var i = last.querySelector('input.fld'); if (i) i.focus(); }
  }
  function askId(msg) {
    var id = prompt(msg); if (!id) return null; id = id.trim();
    if (!/^[a-z0-9_]+$/i.test(id)) { alert('IDは英数字とアンダースコアのみ。'); return null; }
    var dup = false; data.jobs.forEach(function (j) { j.categories.forEach(function (c) { if (c.id === id) dup = true; }); });
    if (dup) { alert('そのIDは既に使われています。'); return null; }
    return id;
  }
  function qa(sel) { return Array.prototype.slice.call(els.root.querySelectorAll(sel)); }

  /* ---- アイコンピッカー ---- */
  function openPicker(ji, ci, ii) {
    pickTarget = { kind: 'price', ji: ji, ci: ci, ii: ii };
    showPicker();
  }
  function openRolePicker(ji, si, ii) {
    pickTarget = { kind: 'role', ji: ji, si: si, ii: ii };
    showPicker();
  }
  function showPicker() {
    els.iconSearch.value = '';
    renderIconGrid('');
    els.modal.classList.add('open');
    els.iconSearch.focus();
  }
  function closePicker() { els.modal.classList.remove('open'); pickTarget = null; }
  function renderIconGrid(q) {
    q = (q || '').toLowerCase();
    var list = q ? iconList.filter(function (n) { return n.indexOf(q) >= 0; }) : iconList;
    var limited = list.slice(0, 400);
    if (!limited.length) { els.iconGrid.innerHTML = '<div class="icon-modal__none">該当なし</div>'; return; }
    els.iconGrid.innerHTML = limited.map(function (n) {
      return '<div class="icon-pick" data-name="' + esc(n) + '" title="' + esc(n) + '">' +
        '<i class="mc" style="background-image:url(assets/icons/' + esc(n) + '.png)"></i>' +
        '<small>' + esc(n) + '</small></div>';
    }).join('') + (list.length > 400 ? '<div class="icon-modal__none">他 ' + (list.length - 400) + ' 件。検索で絞り込み</div>' : '');
    els.iconGrid.querySelectorAll('.icon-pick').forEach(function (el) {
      el.addEventListener('click', function () { applyIcon(el.getAttribute('data-name')); });
    });
  }
  function applyIcon(name) {
    if (!pickTarget) return;
    var t = pickTarget, it;
    if (t.kind === 'role') {
      it = data.jobs[t.ji].role.sections[t.si].items[t.ii];
    } else {
      it = data.jobs[t.ji].categories[t.ci].items[t.ii];
    }
    if (name) it.icon = name; else delete it.icon;
    var reopenJi = t.kind === 'role' ? t.ji : null;
    markDirty(); closePicker(); render();
    if (reopenJi != null) reopenRole(reopenJi);
  }
  els.iconSearch.addEventListener('input', function () { renderIconGrid(els.iconSearch.value); });
  els.iconClose.addEventListener('click', closePicker);
  els.iconClear.addEventListener('click', function () { applyIcon(null); });
  els.modal.addEventListener('click', function (e) { if (e.target === els.modal) closePicker(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && els.modal.classList.contains('open')) closePicker(); });

  /* ---- 職業追加 ---- */
  if (els.addJob) {
    els.addJob.addEventListener('click', function () {
      var id = prompt('新しい職業のID（英数字_）例: fisher'); if (!id) return; id = id.trim();
      if (!/^[a-z0-9_]+$/i.test(id)) { alert('IDは英数字とアンダースコアのみ。'); return; }
      if (data.jobs.some(function (j) { return j.id === id; })) { alert('そのIDは既に存在します。'); return; }
      var label = prompt('職業の表示名', '新しい職業') || '新しい職業';
      var emoji = prompt('絵文字（任意）', '📦') || '📦';
      data.jobs.push({ id: id, label: label, emoji: emoji, desc: '', icons: ['emerald'], categories: [] });
      markDirty(); render();
    });
  }

  /* ---- 全カテゴリ一括開閉 ---- */
  function setAllCollapsed(collapsed) {
    if (!data) return;
    data.jobs.forEach(function (j) { j.categories.forEach(function (c) { catCollapsed[c.id] = collapsed; }); });
    render();
  }
  if (els.collapseAll) els.collapseAll.addEventListener('click', function () { setAllCollapsed(true); });
  if (els.expandAll) els.expandAll.addEventListener('click', function () { setAllCollapsed(false); });

  /* ---- 絞り込み ---- */
  els.filter.addEventListener('input', applyFilter);
  function applyFilter() {
    var q = els.filter.value.trim().toLowerCase();
    qa('.data-row').forEach(function (tr) {
      tr.classList.toggle('hidden', !!q && tr.getAttribute('data-search').toLowerCase().indexOf(q) < 0);
    });
  }

  /* ---- 保存 ---- */
  function serialize() { return JSON.stringify(data, null, 2) + '\n'; }
  els.save.addEventListener('click', async function () {
    if (!data) return;
    if (serverSaveAvailable) {
      try {
        var res = await fetch(SAVE_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialize() });
        if (res.ok) { dirty = false; clearChanged(); setStatus('保存しました ✓ data/' + DATA_FILE + ' を更新（' + new Date().toLocaleTimeString() + '）', 'ok'); return; }
      } catch (e) { serverSaveAvailable = false; updateHint(); }
    }
    if (HAS_FS) {
      try {
        if (!fileHandle) fileHandle = await window.showSaveFilePicker({ suggestedName: DATA_FILE, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
        var w = await fileHandle.createWritable(); await w.write(serialize()); await w.close();
        dirty = false; clearChanged(); setStatus('保存しました ✓（' + new Date().toLocaleTimeString() + '）', 'ok'); return;
      } catch (err) { if (err && err.name === 'AbortError') { setStatus('保存をキャンセル'); return; } }
    }
    doDownload();
  });
  function clearChanged() { qa('.changed').forEach(function (i) { i.classList.remove('changed'); }); }
  els.download.addEventListener('click', doDownload);
  function doDownload() {
    if (!data) return;
    var blob = new Blob([serialize()], { type: 'application/json' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = DATA_FILE; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    setStatus(DATA_FILE + ' をダウンロードしました。site/data/ に上書きしてください', 'ok');
  }
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
