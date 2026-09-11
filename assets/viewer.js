/* Solutions viewer — one script for every solutions page.
   The page tells it what to show through data-attributes on #viewer:
     data-folder  folder with the solution images (1.png, 2.png … or 1.svg …)
     data-count   number of puzzles
     data-ext     image formats to try, in order, e.g. "svg,png"
   The current puzzle lives in the URL hash (#42) so links can be shared and
   the back button works. */
(function () {
  'use strict';

  var root = document.getElementById('viewer');
  if (!root) { return; }

  var folder = root.getAttribute('data-folder');
  var count = parseInt(root.getAttribute('data-count'), 10) || 0;
  var exts = (root.getAttribute('data-ext') || 'png').split(',');
  var strings = {};
  try { strings = JSON.parse(document.getElementById('viewer-strings').textContent); } catch (e) { strings = {}; }
  var t = function (key, fallback) { return strings[key] || fallback; };

  var img = document.getElementById('solution-image');
  var msg = document.getElementById('solution-message');
  var selects = Array.prototype.slice.call(document.querySelectorAll('select.puzzle-select'));
  var prevButtons = Array.prototype.slice.call(document.querySelectorAll('[data-nav="prev"]'));
  var nextButtons = Array.prototype.slice.call(document.querySelectorAll('[data-nav="next"]'));
  var counter = document.getElementById('puzzle-counter');
  var pageTitle = document.title;

  var current = 0;
  var requestId = 0;

  function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function srcFor(n, ext) {
    if (/^https:\/\//.test(folder)) { return folder + '/' + n + '.' + ext; }
    return encodePath(folder + '/' + n + '.' + ext);
  }

  function readHash() {
    var m = /^#(?:p=|puzzle=)?(\d+)$/.exec(window.location.hash || '');
    if (!m) { return 0; }
    var n = parseInt(m[1], 10);
    return (n >= 1 && n <= count) ? n : 0;
  }

  function writeHash(n) {
    if (readHash() === n) { return; }
    if (history.replaceState) {
      history.replaceState(null, '', '#' + n);
    } else {
      window.location.hash = '#' + n;
    }
  }

  function preload(n) {
    if (n < 1 || n > count) { return; }
    var i = new Image();
    i.src = srcFor(n, exts[0]);
  }

  function show(n, fromHash) {
    if (n < 1) { n = 1; }
    if (n > count) { n = count; }
    current = n;
    var id = ++requestId;
    var attempt = 0;

    selects.forEach(function (s) { s.value = String(n); });
    prevButtons.forEach(function (b) { b.setAttribute('aria-disabled', n <= 1 ? 'true' : 'false'); });
    nextButtons.forEach(function (b) { b.setAttribute('aria-disabled', n >= count ? 'true' : 'false'); });
    if (counter) { counter.textContent = t('puzzle', 'Puzzle') + ' ' + n + ' ' + t('of', 'of') + ' ' + count; }
    document.title = t('puzzle', 'Puzzle') + ' ' + n + ' · ' + pageTitle;
    if (!fromHash) { writeHash(n); }

    msg.hidden = true;
    img.hidden = false;
    img.alt = t('puzzle', 'Puzzle') + ' ' + n;

    function tryNext() {
      if (id !== requestId) { return; }
      if (attempt >= exts.length) {
        img.hidden = true;
        img.removeAttribute('src');
        msg.hidden = false;
        return;
      }
      img.src = srcFor(n, exts[attempt++]);
    }
    img.onload = function () {
      if (id !== requestId) { return; }
      preload(n + 1);
    };
    img.onerror = function () { tryNext(); };
    tryNext();
    syncEditionLinks();
  }

  // Dropdown(s)
  selects.forEach(function (s) {
    var frag = document.createDocumentFragment();
    for (var i = 1; i <= count; i++) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = t('puzzle', 'Puzzle') + ' ' + i;
      frag.appendChild(o);
    }
    s.appendChild(frag);
    s.addEventListener('change', function () { show(parseInt(s.value, 10)); });
  });

  prevButtons.forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); if (current > 1) { show(current - 1); } });
  });
  nextButtons.forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); if (current < count) { show(current + 1); } });
  });

  // Keyboard: arrow keys move between puzzles (not while typing in a field)
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) { return; }
    if (e.key === 'ArrowLeft' && current > 1) { e.preventDefault(); show(current - 1); }
    if (e.key === 'ArrowRight' && current < count) { e.preventDefault(); show(current + 1); }
  });

  // Swipe on the image
  var touchX = null, touchY = null;
  img.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { touchX = null; return; }
    touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
  }, { passive: true });
  img.addEventListener('touchend', function (e) {
    if (touchX === null || !e.changedTouches.length) { return; }
    var dx = e.changedTouches[0].clientX - touchX;
    var dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && current < count) { show(current + 1); }
      if (dx > 0 && current > 1) { show(current - 1); }
    }
  }, { passive: true });

  // Print just the solution (the print stylesheet hides everything else)
  var printBtn = document.getElementById('print-button');
  if (printBtn) {
    printBtn.addEventListener('click', function (e) { e.preventDefault(); window.print(); });
  }

  // Edition links keep the current puzzle number
  function syncEditionLinks() {
    Array.prototype.slice.call(document.querySelectorAll('a[data-edition-link]')).forEach(function (a) {
      var base = a.getAttribute('href').split('#')[0];
      a.setAttribute('href', base + (current ? '#' + current : ''));
    });
  }

  window.addEventListener('hashchange', function () {
    var n = readHash();
    if (n && n !== current) { show(n, true); }
    syncEditionLinks();
  });

  show(readHash() || 1, true);
})();
