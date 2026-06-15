/* ============================================================
   jobs.html 用：職業カード（#jobCards）と各職業の役割（#jobRoles）を
   prices.json から生成する。職業の並び順は JSON の jobs 配列順。
   ============================================================ */
(function () {
  'use strict';

  var cardsEl = document.getElementById('jobCards');       // jobs.html: ページ内アンカーへ
  var homeCardsEl = document.getElementById('homeJobCards'); // index.html: 相場ページへ直行
  var rolesEl = document.getElementById('jobRoles');
  if (!cardsEl && !homeCardsEl && !rolesEl) return;

  // jobs.html は深さ0想定
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function mc(name, cls) {
    if (!name) return '';
    return '<i class="mc ' + (cls || '') + '" style="background-image:url(assets/icons/' + esc(name) + '.png)"></i>';
  }
  // 職業のヒーローアイコン配列の先頭などからカード用アイコンを決める
  function cardIcon(job) {
    if (job.icons && job.icons.length) return job.icons[0];
    return 'emerald';
  }

  fetch('data/prices.json?_=' + Date.now())
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      var jobs = (data.jobs || []).filter(function (j) { return j.id !== 'common'; });

      if (cardsEl) {
        cardsEl.innerHTML = jobs.map(function (j) {
          return '<a href="#role-' + esc(j.id) + '" class="job-card">' +
            mc(cardIcon(j), 'job-ico') +
            '<span class="job-name">' + esc(j.label) + '</span></a>';
        }).join('');
      }

      if (homeCardsEl) {
        // トップは各職業の詳細ページへ直行（政府も詳細ページへ）
        homeCardsEl.innerHTML = jobs.map(function (j) {
          return '<a href="job.html?id=' + esc(j.id) + '" class="job-card">' +
            mc(cardIcon(j), 'job-ico') +
            '<span class="job-name">' + esc(j.label) + '</span></a>';
        }).join('');
      }

      if (rolesEl) {
        rolesEl.innerHTML = jobs.map(roleBlock).join('');
      }
    })
    .catch(function (err) {
      if (rolesEl) rolesEl.innerHTML = '<p class="price-error">役割データの読み込みに失敗しました（' + esc(err.message) + '）。</p>';
    });

  function roleBlock(job) {
    var role = job.role || {};
    var secs = role.sections || [];

    // カードヘッダー（アイコン＋大きな職業名の帯）
    var head = '<div class="role-card__head">' +
      mc(cardIcon(job), 'role-card__icon') +
      '<span class="role-card__name">' + esc(job.label) + '</span>' +
      '</div>';

    var desc = job.desc ? '<p class="role-card__desc">' + esc(job.desc) + '</p>' : '';

    // 職業の詳細ページへの誘導リンク（政府も詳細ページへ）
    var link = '<a class="job-detail-link" href="job.html?id=' + esc(job.id) + '">' +
      mc(cardIcon(job)) + esc(job.label) + 'の詳細・価格へ →</a>';

    var body = secs.map(function (s) {
      var h = '<h4>' + (s.icon ? mc(s.icon) + ' ' : '') + esc(s.heading) + '</h4>';
      if (s.type === 'list') {
        return h + '<ul>' + s.items.map(function (it) {
          return '<li>' + esc(it.text) + '</li>';
        }).join('') + '</ul>';
      }
      return h + '<div class="tags">' + s.items.map(function (it) {
        return '<span class="tag">' + mc(it.icon) + esc(it.text) + '</span>';
      }).join('') + '</div>';
    }).join('');

    return '<article class="role-card" id="role-' + esc(job.id) + '">' +
      head +
      '<div class="role-card__body">' + desc + link + body + '</div>' +
      '</article>';
  }
})();
