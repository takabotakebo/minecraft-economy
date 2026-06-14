/* ============================================================
   価格データ管理ページ（ローカル専用 / schema 2）
   data/prices.json（jobs -> categories -> items, price は数値）を
   一覧編集・項目追加・カテゴリ編集して書き戻す。

   保存優先: ローカル保存API(POST api/save-prices) → File System Access → ダウンロード
   ============================================================ */
(function () {
  'use strict';

  var DATA_PATH = 'data/prices.json';
  var SAVE_API = 'api/save-prices';

  var els = {
    root: document.getElementById('jobsRoot'),
    save: document.getElementById('saveBtn'),
    download: document.getElementById('downloadBtn'),
    addJob: document.getElementById('addJobBtn'),
    filter: document.getElementById('filter'),
    status: document.getElementById('status'),
    hint: document.getElementById('fsHint'),
    prodWarning: document.getElementById('prodWarning')
  };

  var host = location.hostname;
  var IS_LOCAL = (host === 'localhost' || host === '127.0.0.1' ||
                  host === '' || location.protocol === 'file:');
  var HAS_FS = (typeof window.showSaveFilePicker === 'function' &&
                location.protocol !== 'file:');
  var serverSaveAvailable = IS_LOCAL && location.protocol.indexOf('http') === 0;

  var data = null;
  var fileHandle = null;
  var dirty = false;

  if (!IS_LOCAL) els.prodWarning.style.display = '';
  updateHint();

  function updateHint() {
    if (serverSaveAvailable) {
      els.hint.innerHTML = '✅ ローカル編集サーバー経由です。「保存」で <code>data/prices.json</code> に直接上書きされます。';
    } else if (HAS_FS) {
      els.hint.innerHTML = '「保存」でファイル保存ダイアログから <code>data/prices.json</code> を選んで上書きしてください。';
    } else {
      els.hint.innerHTML = '「ダウンロード保存」で <code>prices.json</code> を保存し <code>site/data/</code> に上書きしてください。';
    }
  }
  function setStatus(msg, kind) {
    els.status.textContent = msg;
    els.status.className = 'admin-status' + (kind ? ' ' + kind : '');
  }
  function markDirty() { dirty = true; setStatus('未保存の変更があります', 'dirty'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---- 読み込み ---- */
  fetch(DATA_PATH + '?_=' + Date.now())
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (json) {
      data = json;
      if (!data.jobs) throw new Error('スキーマが未対応（jobs がありません）');
      render();
      setStatus('読み込み完了（' + countItems() + ' 項目）', 'ok');
    })
    .catch(function (err) {
      setStatus('読み込み失敗: ' + err.message, 'err');
    });

  function countItems() {
    var n = 0;
    data.jobs.forEach(function (j) { j.categories.forEach(function (c) { n += c.items.length; }); });
    return n;
  }

  /* ---- 描画 ---- */
  function render() {
    var html = data.jobs.map(jobHtml).join('');
    els.root.innerHTML = html;
    bindEvents();
    applyFilter();
  }

  function jobHtml(job, ji) {
    var cats = job.categories.map(function (cat, ci) {
      return categoryHtml(job, ji, cat, ci);
    }).join('');
    return '' +
      '<section class="adm-job" data-ji="' + ji + '">' +
        '<div class="adm-job__head">' +
          '<span class="adm-job__emoji">' + esc(job.emoji || '📦') + '</span>' +
          '<input class="adm-job__label" data-ji="' + ji + '" value="' + esc(job.label) + '" title="職業名">' +
          '<span class="adm-job__id">#' + esc(job.id) + '</span>' +
          '<button class="admin-mini addCat" data-ji="' + ji + '">＋カテゴリ追加</button>' +
        '</div>' +
        cats +
      '</section>';
  }

  function categoryHtml(job, ji, cat, ci) {
    var cols = cat.columns || ['品目', '価格'];
    var midHead = cols.length >= 3 ? cols[1] : '';
    var rows = cat.items.map(function (it, ii) {
      return itemRow(ji, ci, cat, midHead, it, ii);
    }).join('');
    return '' +
      '<div class="adm-cat" data-ji="' + ji + '" data-ci="' + ci + '">' +
        '<div class="adm-cat__head">' +
          '<input class="adm-cat__title" data-ji="' + ji + '" data-ci="' + ci + '" value="' + esc(cat.title) + '" title="カテゴリ名">' +
          '<span class="adm-cat__id">#' + esc(cat.id) + '</span>' +
          '<select class="adm-cat__move" data-ji="' + ji + '" data-ci="' + ci + '" title="所属する職業">' +
            data.jobs.map(function (j, k) {
              return '<option value="' + k + '"' + (k === ji ? ' selected' : '') + '>' + esc(j.label) + 'へ</option>';
            }).join('') +
          '</select>' +
          '<button class="admin-mini addItem" data-ji="' + ji + '" data-ci="' + ci + '">＋項目</button>' +
          '<button class="admin-mini delCat" data-ji="' + ji + '" data-ci="' + ci + '" title="カテゴリ削除">🗑カテゴリ</button>' +
        '</div>' +
        '<div class="table-wrap"><table class="admin-table"><thead><tr>' +
          '<th style="width:36px;"></th><th>名前</th>' +
          (cols.length >= 3 ? '<th>' + esc(midHead) + '</th>' : '') +
          '<th style="width:120px;">価格(数値)</th>' +
          '<th style="width:90px;">単位</th>' +
          '<th>補足</th>' +
          '<th style="width:40px;"></th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '</div>';
  }

  function itemRow(ji, ci, cat, midHead, it, ii) {
    var midKey = midHead === '数量' ? 'qty' : midHead === '区分' ? 'tier'
      : midHead === '計算' ? 'calc' : midHead === '内容' ? 'detail' : 'qty';
    var hasMid = cat.columns.length >= 3;
    var icon = it.icon
      ? '<i class="mc" style="background-image:url(assets/icons/' + esc(it.icon) + '.png)"></i>' : '';
    var search = (it.name || '') + ' ' + (cat.title || '') + ' ' + data.jobs[ji].label;
    return '' +
      '<tr class="data-row" data-ji="' + ji + '" data-ci="' + ci + '" data-ii="' + ii + '" data-search="' + esc(search) + '">' +
        '<td>' + icon + '</td>' +
        '<td><input class="admin-text fld" data-f="name" value="' + esc(it.name) + '" placeholder="名前"></td>' +
        (hasMid ? '<td><input class="admin-text fld admin-sub-input" data-f="' + midKey + '" value="' + esc(it[midKey] || '') + '" placeholder="' + esc(midHead) + '"></td>' : '') +
        '<td><input type="number" step="0.1" class="admin-price-input fld" data-f="price" value="' + esc(it.price != null ? it.price : 0) + '"></td>' +
        '<td><input class="admin-text fld" data-f="unit" value="' + esc(it.unit || '') + '" placeholder="例:/10分"></td>' +
        '<td><input class="admin-text fld admin-sub-input" data-f="note" value="' + esc(it.note || '') + '" placeholder="補足・範囲など"></td>' +
        '<td><button class="admin-mini delItem" title="この項目を削除">🗑</button></td>' +
      '</tr>';
  }

  /* ---- イベント ---- */
  function bindEvents() {
    // 職業名
    qa('.adm-job__label').forEach(function (inp) {
      inp.addEventListener('input', function () {
        data.jobs[+inp.dataset.ji].label = inp.value; markDirty();
      });
    });
    // カテゴリ名
    qa('.adm-cat__title').forEach(function (inp) {
      inp.addEventListener('input', function () {
        data.jobs[+inp.dataset.ji].categories[+inp.dataset.ci].title = inp.value; markDirty();
      });
    });
    // カテゴリの所属職業を移動
    qa('.adm-cat__move').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var ji = +sel.dataset.ji, ci = +sel.dataset.ci, to = +sel.value;
        if (to === ji) return;
        var cat = data.jobs[ji].categories.splice(ci, 1)[0];
        data.jobs[to].categories.push(cat);
        markDirty(); render();
      });
    });
    // 項目フィールド編集
    qa('.fld').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var tr = inp.closest('tr');
        var it = data.jobs[+tr.dataset.ji].categories[+tr.dataset.ci].items[+tr.dataset.ii];
        var f = inp.dataset.f;
        if (f === 'price') {
          it.price = inp.value === '' ? 0 : Number(inp.value);
        } else if (inp.value === '') {
          delete it[f];
        } else {
          it[f] = inp.value;
        }
        inp.classList.add('changed');
        markDirty();
      });
    });
    // 項目追加
    qa('.addItem').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = data.jobs[+btn.dataset.ji].categories[+btn.dataset.ci];
        cat.items.push({ name: '新しい項目', price: 0 });
        markDirty(); render();
        focusLast(btn.dataset.ji, btn.dataset.ci);
      });
    });
    // 項目削除
    qa('.delItem').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr');
        var cat = data.jobs[+tr.dataset.ji].categories[+tr.dataset.ci];
        var it = cat.items[+tr.dataset.ii];
        if (confirm('「' + (it.name || '(無名)') + '」を削除しますか？')) {
          cat.items.splice(+tr.dataset.ii, 1); markDirty(); render();
        }
      });
    });
    // カテゴリ追加
    qa('.addCat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ji = +btn.dataset.ji;
        var id = askId('新しいカテゴリのID（英数字_）例: special_goods');
        if (!id) return;
        var title = prompt('カテゴリの表示名', '新カテゴリ') || '新カテゴリ';
        data.jobs[ji].categories.push({
          id: id, title: title, columns: ['品目', '数量', '価格'],
          items: [{ name: '新しい項目', qty: '', price: 0 }]
        });
        markDirty(); render();
      });
    });
    // カテゴリ削除
    qa('.delCat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ji = +btn.dataset.ji, ci = +btn.dataset.ci;
        var cat = data.jobs[ji].categories[ci];
        if (confirm('カテゴリ「' + cat.title + '」を項目ごと削除しますか？')) {
          data.jobs[ji].categories.splice(ci, 1); markDirty(); render();
        }
      });
    });
  }

  function focusLast(ji, ci) {
    var rows = qa('tr.data-row[data-ji="' + ji + '"][data-ci="' + ci + '"]');
    var last = rows[rows.length - 1];
    if (last) { last.scrollIntoView({ block: 'center' }); last.querySelector('input').focus(); }
  }
  function askId(msg) {
    var id = prompt(msg);
    if (!id) return null;
    id = id.trim();
    if (!/^[a-z0-9_]+$/i.test(id)) { alert('IDは英数字とアンダースコアのみ。'); return null; }
    var dup = false;
    data.jobs.forEach(function (j) { j.categories.forEach(function (c) { if (c.id === id) dup = true; }); });
    if (dup) { alert('そのIDは既に使われています。'); return null; }
    return id;
  }
  function qa(sel) { return Array.prototype.slice.call(els.root.querySelectorAll(sel)); }

  /* ---- 職業追加 ---- */
  if (els.addJob) {
    els.addJob.addEventListener('click', function () {
      var id = prompt('新しい職業のID（英数字_）例: fisher');
      if (!id) return;
      id = id.trim();
      if (!/^[a-z0-9_]+$/i.test(id)) { alert('IDは英数字とアンダースコアのみ。'); return; }
      if (data.jobs.some(function (j) { return j.id === id; })) { alert('そのIDは既に存在します。'); return; }
      var label = prompt('職業の表示名', '新しい職業') || '新しい職業';
      var emoji = prompt('絵文字（任意）', '📦') || '📦';
      data.jobs.push({ id: id, label: label, emoji: emoji, categories: [] });
      markDirty(); render();
    });
  }

  /* ---- 絞り込み ---- */
  els.filter.addEventListener('input', applyFilter);
  function applyFilter() {
    var q = els.filter.value.trim().toLowerCase();
    qa('.data-row').forEach(function (tr) {
      var hit = !q || tr.getAttribute('data-search').toLowerCase().indexOf(q) >= 0;
      tr.classList.toggle('hidden', !hit);
    });
  }

  /* ---- 保存 ---- */
  function serialize() { return JSON.stringify(data, null, 2) + '\n'; }

  els.save.addEventListener('click', async function () {
    if (!data) return;
    if (serverSaveAvailable) {
      try {
        var res = await fetch(SAVE_API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialize()
        });
        if (res.ok) {
          dirty = false; clearChanged();
          setStatus('保存しました ✓ data/prices.json を更新（' + new Date().toLocaleTimeString() + '）', 'ok');
          return;
        }
      } catch (e) { serverSaveAvailable = false; updateHint(); }
    }
    if (HAS_FS) {
      try {
        if (!fileHandle) {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: 'prices.json',
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
          });
        }
        var w = await fileHandle.createWritable();
        await w.write(serialize()); await w.close();
        dirty = false; clearChanged();
        setStatus('保存しました ✓（' + new Date().toLocaleTimeString() + '）', 'ok');
        return;
      } catch (err) { if (err && err.name === 'AbortError') { setStatus('保存をキャンセル'); return; } }
    }
    doDownload();
  });
  function clearChanged() { qa('.changed').forEach(function (i) { i.classList.remove('changed'); }); }

  els.download.addEventListener('click', doDownload);
  function doDownload() {
    if (!data) return;
    var blob = new Blob([serialize()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'prices.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setStatus('prices.json をダウンロードしました。site/data/ に上書きしてください', 'ok');
  }

  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });
})();
