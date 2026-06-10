/* ============================================================
   Minecraft Economy World - ページ挙動
   （nav.js が共通レイアウトを注入した後に実行される）
   - モバイルのサイドナビ開閉
   - ページ内目次のスクロール連動ハイライト
   - トップへ戻るボタン
   ============================================================ */
(function () {
  'use strict';

  var sidenav = document.getElementById('sidenav');
  var backdrop = document.getElementById('navBackdrop');
  var menuToggle = document.getElementById('menuToggle');
  var toTop = document.getElementById('toTop');

  /* ---- モバイル：サイドナビ開閉 ---- */
  function openNav() { sidenav.classList.add('open'); backdrop.classList.add('show'); }
  function closeNav() { sidenav.classList.remove('open'); backdrop.classList.remove('show'); }

  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      if (sidenav.classList.contains('open')) closeNav(); else openNav();
    });
  }
  if (backdrop) backdrop.addEventListener('click', closeNav);

  if (sidenav) {
    sidenav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        if (window.innerWidth <= 880) closeNav();
      });
    });
  }

  /* ---- ページ内目次のスクロール連動 ---- */
  var sections = Array.prototype.slice.call(document.querySelectorAll('.content > .section'));
  var tocLinks = {};
  if (sidenav) {
    sidenav.querySelectorAll('.sidenav__toc a[href^="#"]').forEach(function (a) {
      tocLinks[a.getAttribute('href').slice(1)] = a;
    });
  }

  if (sections.length && Object.keys(tocLinks).length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          Object.keys(tocLinks).forEach(function (k) {
            tocLinks[k].classList.toggle('active', k === id);
          });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    sections.forEach(function (s) { observer.observe(s); });
  }

  /* ---- トップへ戻る ---- */
  if (toTop) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 600) toTop.classList.add('show');
      else toTop.classList.remove('show');
    }, { passive: true });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
