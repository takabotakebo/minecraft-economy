/* ============================================================
   価格計算ツール（calc.html）
   入り口: 政府 / 職業
   政府モード: 通常（物資・装備・サービス） / エンチャント装備（専用）
   - エンチャント装備: 元装備（ダイヤ＋鉄）に複数エンチャントを付与
     修繕は「元装備の本体価格 + 10」を上乗せ
   - すべて同じカートに合算
   ============================================================ */
(function () {
  'use strict';

  var el = {
    source: document.getElementById('calcSource'),
    govMode: document.getElementById('calcGovMode'),
    jobField: document.getElementById('jobField'),
    job: document.getElementById('calcJob'),
    normalPicker: document.getElementById('normalPicker'),
    enchantPicker: document.getElementById('enchantPicker'),
    catField: document.getElementById('catField'),
    cat: document.getElementById('calcCat'),
    item: document.getElementById('calcItem'),
    qty: document.getElementById('calcQty'),
    preview: document.getElementById('calcPreview'),
    add: document.getElementById('calcAdd'),
    enchBase: document.getElementById('enchBase'),
    enchList: document.getElementById('enchList'),
    enchPreview: document.getElementById('enchPreview'),
    enchAdd: document.getElementById('enchAdd'),
    cartItems: document.getElementById('cartItems'),
    cartTotal: document.getElementById('cartTotal'),
    cartClear: document.getElementById('cartClear'),
    rangeNote: document.getElementById('calcRangeNote')
  };
  if (!el.source) return;

  var DATA = null, CURRENCY = 'エメラルド';
  var cart = [];
  var enchantList = [];      // エンチャント定義
  var baseEquip = [];        // エンチャント対象の元装備 [{name,icon,price,from}]
  var state = { src: 'gov', govMode: 'buy' };

  // 政府カテゴリのうち「売る（政府が買い取る）」側のカテゴリID
  var SELL_CATS = { supply_quest: 1, device_fee: 1 };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function mc(name) { return name ? '<i class="mc" style="background-image:url(assets/icons/' + esc(name) + '.png)"></i>' : ''; }
  function priceText(n) { return n + CURRENCY; }

  function jobs() { return (DATA.jobs || []).filter(function (j) { return j.id !== 'common'; }); }
  function findJob(id) { return DATA.jobs.find(function (j) { return j.id === id; }); }
  function gov() { return findJob('government'); }

  fetch('data/prices.json?_=' + Date.now())
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      DATA = data;
      CURRENCY = (data.meta && data.meta.currency) || 'エメラルド';
      collectEnchantData();
      initUI();
    })
    .catch(function (err) {
      el.preview.innerHTML = '<p class="price-error">価格データの読み込みに失敗しました（' + esc(err.message) +
        '）。ローカルでは簡易サーバー経由で開いてください。</p>';
    });

  /* ---- エンチャント・元装備データを収集 ---- */
  function collectEnchantData() {
    var g = gov();
    (g.categories || []).forEach(function (c) {
      if (c.id === 'enchant_fee') enchantList = c.items || [];
    });
    baseEquip = [];
    (g.categories || []).forEach(function (c) {
      if (c.id === 'diamond_base') {
        c.items.forEach(function (it) {
          baseEquip.push({ name: it.name, icon: it.icon, price: Number(it.price) || 0, from: 'ダイヤ装備' });
        });
      }
    });
    // 鉄装備（basic_equipment のうち「鉄」を含むもの）
    (g.categories || []).forEach(function (c) {
      if (c.id === 'basic_equipment') {
        c.items.forEach(function (it) {
          if (it.name.indexOf('鉄') >= 0) {
            baseEquip.push({ name: it.name, icon: it.icon, price: Number(it.price) || 0, from: '鉄装備' });
          }
        });
      }
    });
  }

  /* ---- UI初期化 ---- */
  function initUI() {
    // 入り口
    el.source.querySelectorAll('.src-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        setActive(el.source, b);
        state.src = b.getAttribute('data-src');
        applyState();
      });
    });
    // 政府モード
    el.govMode.querySelectorAll('.mode-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        setActive(el.govMode, b);
        state.govMode = b.getAttribute('data-mode');
        applyState();
      });
    });
    // 職業セレクト
    el.job.innerHTML = jobs().filter(function (j) { return j.id !== 'government'; }).map(function (j) {
      return '<option value="' + esc(j.id) + '">' + esc(j.emoji || '') + ' ' + esc(j.label) + '</option>';
    }).join('');
    el.job.addEventListener('change', function () { onCatSourceChange(); });

    // 通常ピッカー
    el.cat.addEventListener('change', onCatChange);
    el.item.addEventListener('change', updatePreview);
    el.qty.addEventListener('input', updatePreview);
    el.add.addEventListener('click', addNormalToCart);

    // エンチャントピッカー
    el.enchBase.innerHTML = baseEquip.map(function (b, i) {
      return '<option value="' + i + '">' + esc(b.name) + '（' + esc(b.from) + ' / 本体' + b.price + '）</option>';
    }).join('');
    buildEnchantChecks();
    el.enchBase.addEventListener('change', updateEnchPreview);
    el.enchAdd.addEventListener('click', addEnchantToCart);

    el.cartClear.addEventListener('click', function () { cart = []; renderCart(); });

    applyState();
    renderCart();
  }

  function setActive(group, btn) {
    group.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
  }

  /* ---- 状態に応じて表示切替 ---- */
  function applyState() {
    var isGov = state.src === 'gov';
    el.govMode.style.display = isGov ? '' : 'none';
    el.jobField.style.display = isGov ? 'none' : '';

    var enchMode = isGov && state.govMode === 'enchant';
    el.normalPicker.style.display = enchMode ? 'none' : '';
    el.enchantPicker.style.display = enchMode ? '' : 'none';

    // 職業モードはカテゴリ選択を隠す（品目に全カテゴリをまとめる）
    el.catField.style.display = (!isGov) ? 'none' : '';

    if (enchMode) { updateEnchPreview(); }
    else { onCatSourceChange(); }
  }

  // 通常モードのカテゴリ元（政府 or 選択職業）
  function curJobForNormal() {
    return state.src === 'gov' ? gov() : findJob(el.job.value);
  }

  function onCatSourceChange() {
    var job = curJobForNormal();
    if (state.src === 'gov') {
      // 政府：買う/売るでカテゴリを振り分け（value に実indexを保持）
      var sell = (state.govMode === 'sell');
      var opts = (job.categories || []).map(function (c, i) {
        if (c.id === 'enchant_fee') return '';   // エンチャントは専用モードへ
        var isSellCat = !!SELL_CATS[c.id];
        if (sell !== isSellCat) return '';
        return '<option value="' + i + '">' + esc(c.title) + '</option>';
      }).filter(Boolean);
      el.cat.innerHTML = opts.join('');
      onCatChange();
    } else {
      // 職業：全カテゴリの品目をまとめて品目セレクトへ（value="ci:ii"）
      var opts = [];
      (job.categories || []).forEach(function (c, ci) {
        (c.items || []).forEach(function (it, ii) {
          // 複数カテゴリある職業はカテゴリ名を前置
          var multi = (job.categories.length > 1);
          var label = (multi ? esc(c.title) + '｜' : '') + esc(it.name);
          opts.push('<option value="' + ci + ':' + ii + '">' + label + '</option>');
        });
      });
      el.item.innerHTML = opts.join('');
      updatePreview();
    }
  }

  function curCat() {
    var job = curJobForNormal();
    if (state.src === 'gov') return (job.categories || [])[el.cat.value | 0];
    // 職業：item の value "ci:ii" から
    var ci = parseInt((el.item.value || '0:0').split(':')[0], 10) || 0;
    return (job.categories || [])[ci];
  }
  function curItem() {
    var job = curJobForNormal();
    if (state.src === 'gov') return (curCat().items || [])[el.item.value | 0];
    var p = (el.item.value || '0:0').split(':');
    var cat = (job.categories || [])[parseInt(p[0], 10) || 0];
    return (cat.items || [])[parseInt(p[1], 10) || 0];
  }

  function onCatChange() {
    var cat = curCat();
    el.item.innerHTML = (cat.items || []).map(function (it, i) {
      return '<option value="' + i + '">' + esc(it.name) + '</option>';
    }).join('');
    updatePreview();
  }

  /* ---- 価格ヘルパ ---- */
  function unitInfo(item) {
    var range = null;
    var m = /範囲\s*([0-9.]+)\s*[〜~]\s*([0-9.]+)/.exec(item.note || '');
    if (m) range = { lo: Number(m[1]), hi: Number(m[2]) };
    return { value: Number(item.price) || 0, range: range, unit: item.unit || '' };
  }

  /* ---- 通常モード ---- */
  function buildNormalEntry() {
    var job = curJobForNormal(), it = curItem();
    if (!it) return null;
    var qty = Math.max(1, parseInt(el.qty.value, 10) || 1);
    var u = unitInfo(it);
    var subtotal = u.value * qty;
    return {
      type: 'normal',
      jobLabel: job.label, jobIcon: (job.icons && job.icons[0]) || 'emerald',
      name: it.name, icon: it.icon, qty: qty, unit: u.unit,
      subtotal: subtotal, isFree: (u.value === 0 && !it.note),
      range: u.range ? { lo: u.range.lo * qty, hi: u.range.hi * qty } : null,
      isRange: !!u.range
    };
  }
  function updatePreview() {
    var e = buildNormalEntry();
    if (!e) { el.preview.innerHTML = ''; return; }
    if (e.isFree) { el.preview.innerHTML = '<strong>無料</strong>' + (e.qty > 1 ? ' × ' + e.qty : ''); return; }
    var s = '単価 ' + priceText(unitInfo(curItem()).value) + (e.unit ? esc(e.unit) : '') +
      ' × ' + e.qty + ' = <strong class="calc-amount">' + priceText(e.subtotal) + (e.unit ? esc(e.unit) : '') + '</strong>';
    if (e.range) s += '<br><span class="price-sub">（相場の範囲なら ' + e.range.lo + '〜' + e.range.hi + CURRENCY + '）</span>';
    el.preview.innerHTML = s;
  }
  function addNormalToCart() {
    var e = buildNormalEntry();
    if (!e) return;
    cart.push(e); renderCart();
  }

  /* ---- エンチャントモード ---- */
  function buildEnchantChecks() {
    el.enchList.innerHTML = enchantList.map(function (e, i) {
      var label = (e.calcType === 'base_plus') ? '装備代+' + (e.add || 0) : '+' + e.price;
      return '<label class="ench-chk"><input type="checkbox" value="' + i + '">' +
        '<span>' + esc(e.name) + ' <small>' + label + '</small></span></label>';
    }).join('');
    el.enchList.querySelectorAll('input').forEach(function (c) {
      c.addEventListener('change', updateEnchPreview);
    });
  }
  function curBase() { return baseEquip[el.enchBase.value | 0]; }
  function selectedEnchants(basePrice) {
    var total = 0, names = [];
    el.enchList.querySelectorAll('input:checked').forEach(function (chk) {
      var e = enchantList[chk.value | 0];
      var add = (e.calcType === 'base_plus') ? (basePrice + (e.add || 0)) : (Number(e.price) || 0);
      total += add; names.push(e.name);
    });
    return { total: total, names: names };
  }
  function buildEnchantEntry() {
    var b = curBase();
    if (!b) return null;
    var se = selectedEnchants(b.price);
    return {
      type: 'enchant',
      jobLabel: '政府', jobIcon: 'emerald_block',
      baseName: b.name, icon: b.icon, basePrice: b.price,
      enchNames: se.names, enchTotal: se.total,
      subtotal: b.price + se.total
    };
  }
  function updateEnchPreview() {
    var e = buildEnchantEntry();
    if (!e) { el.enchPreview.innerHTML = ''; return; }
    var lines = ['本体 ' + priceText(e.basePrice)];
    if (e.enchNames.length) lines.push('＋ ' + esc(e.enchNames.join('・')) + ' = +' + e.enchTotal + CURRENCY);
    lines.push('<strong class="calc-amount">合計 ' + priceText(e.subtotal) + '</strong>');
    el.enchPreview.innerHTML = lines.join('<br>');
  }
  function addEnchantToCart() {
    var e = buildEnchantEntry();
    if (!e) return;
    cart.push(e);
    // チェックをリセットして次の装備を作りやすく
    el.enchList.querySelectorAll('input:checked').forEach(function (c) { c.checked = false; });
    updateEnchPreview();
    renderCart();
  }

  /* ---- カート ---- */
  function renderCart() {
    if (!cart.length) {
      el.cartItems.innerHTML = '<p class="cart-empty">まだ何も入っていません。左で選んで追加してください。</p>';
      el.cartTotal.innerHTML = '';
      el.rangeNote.textContent = '';
      return;
    }
    var rows = cart.map(function (e, i) {
      if (e.type === 'enchant') {
        var ench = e.enchNames.length ? '<small class="cart-ench">＋' + esc(e.enchNames.join('・')) + '</small>' : '<small class="cart-ench">エンチャントなし</small>';
        return '<div class="cart-row">' +
          '<span class="cart-row__icon">' + mc(e.icon) + '</span>' +
          '<span class="cart-row__name">' + esc(e.baseName) + ench +
            '<small class="cart-from">' + mc(e.jobIcon) + esc(e.jobLabel) + '</small></span>' +
          '<span class="cart-row__qty"></span>' +
          '<span class="cart-row__amount">' + priceText(e.subtotal) + '</span>' +
          '<button class="cart-row__del" data-i="' + i + '" title="削除">🗑</button></div>';
      }
      var amount = e.isFree ? '無料' : priceText(e.subtotal) + (e.unit ? esc(e.unit) : '');
      return '<div class="cart-row">' +
        '<span class="cart-row__icon">' + mc(e.icon) + '</span>' +
        '<span class="cart-row__name">' + esc(e.name) +
          '<small class="cart-from">' + mc(e.jobIcon) + esc(e.jobLabel) + '</small></span>' +
        '<span class="cart-row__qty">×' + e.qty + '</span>' +
        '<span class="cart-row__amount">' + amount + '</span>' +
        '<button class="cart-row__del" data-i="' + i + '" title="削除">🗑</button></div>';
    }).join('');
    el.cartItems.innerHTML = rows;
    el.cartItems.querySelectorAll('.cart-row__del').forEach(function (b) {
      b.addEventListener('click', function () { cart.splice(b.getAttribute('data-i') | 0, 1); renderCart(); });
    });

    var sum = 0, hasUnit = false, hasRange = false;
    cart.forEach(function (e) {
      if (e.unit) hasUnit = true;
      if (e.isRange) hasRange = true;
      sum += e.subtotal;
    });
    el.cartTotal.innerHTML = '合計（目安）<span class="cart-total__amount">' + priceText(sum) + '</span>';
    var notes = [];
    if (hasUnit) notes.push('※「/10分」「/1装備」などの単位付き価格は1回分として合算しています。');
    if (hasRange) notes.push('※ 相場（範囲）の品目は下限値で計算した目安です。');
    el.rangeNote.innerHTML = notes.join('<br>');
  }
})();
