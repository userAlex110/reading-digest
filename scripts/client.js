/* 由 scripts/build.js 内联进页面。__EXAM_Y__ / __EXAM_M__ / __EXAM_D__ 会在构建时替换。
   __EXAM_M__ 已经是 Date 用的月份（0 = 一月）。 */
(function () {
  var target = new Date(__EXAM_Y__, __EXAM_M__, __EXAM_D__);
  var now = new Date();
  var days = Math.ceil((target - now) / 86400000);
  var el = document.querySelector('#countdown b');
  if (el) el.textContent = days > 0 ? days : 0;
})();

(function () {
  var progress = document.getElementById('progress');
  var searchIndex = {};
  document.querySelectorAll('.essay').forEach(function (essay) {
    var main = essay.querySelector('.essay-main');
    searchIndex[essay.dataset.id] = main ? main.textContent : '';
  });

  function currentEssay() {
    return document.querySelector('.essay:target, .essay:has(:target)');
  }

  function updateProgress() {
    var h = document.documentElement;
    var denom = h.scrollHeight - h.clientHeight;
    var p = denom > 0 ? h.scrollTop / denom : 0;
    if (progress) {
      progress.style.width = (p * 100) + '%';
      progress.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    }
  }

  function updateToc() {
    var essay = currentEssay();
    if (!essay) return;
    var links = essay.querySelectorAll('.toc a');
    var spy = essay.querySelectorAll('[data-spy]');
    if (!spy.length) return;
    var mark = window.scrollY + Math.min(240, window.innerHeight * 0.33);
    var current = spy[0];
    for (var i = 0; i < spy.length; i++) {
      var top = spy[i].getBoundingClientRect().top + window.scrollY;
      if (top <= mark) current = spy[i];
    }
    var doc = document.documentElement;
    if (window.scrollY + window.innerHeight >= doc.scrollHeight - 8) current = spy[spy.length - 1];
    links.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + current.id;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  }

  function onScroll() {
    updateProgress();
    updateToc();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  updateProgress();

  var curFilter = 'all';
  var curQuery = '';
  function norm(value) {
    return (value || '').toLowerCase();
  }
  function applyFilter() {
    var visible = 0;
    document.querySelectorAll('.batch').forEach(function (batch) {
      var count = 0;
      batch.querySelectorAll('.card').forEach(function (card) {
        var hay = norm((card.dataset.k || '') + ' ' + card.textContent + ' ' + (searchIndex[card.dataset.id] || ''));
        var show = (curFilter === 'all' || card.dataset.cat === curFilter) && (!curQuery || hay.indexOf(curQuery) > -1);
        card.hidden = !show;
        if (show) count++;
      });
      var cnt = batch.querySelector('.cnt');
      if (cnt) cnt.textContent = count + ' 条';
      batch.hidden = count === 0;
      visible += count;
    });
    var empty = document.getElementById('empty');
    if (empty) empty.hidden = visible !== 0;
  }

  var filters = document.getElementById('filters');
  if (filters) {
    filters.addEventListener('click', function (e) {
      var button = e.target.closest('.fbtn');
      if (!button) return;
      filters.querySelectorAll('.fbtn').forEach(function (item) {
        item.setAttribute('aria-pressed', 'false');
      });
      button.setAttribute('aria-pressed', 'true');
      curFilter = button.dataset.f || 'all';
      applyFilter();
    });
  }
  var query = document.getElementById('q');
  if (query) {
    query.addEventListener('input', function (e) {
      curQuery = norm(e.target.value.trim());
      applyFilter();
    });
  }

  function onNav() {
    var essay = currentEssay();
    if (essay) {
      var hash = location.hash.slice(1);
      var decoded = hash;
      try { decoded = decodeURIComponent(hash); } catch (error) { decoded = hash; }
      if (decoded === essay.id) {
        window.scrollTo({ top: 0, behavior: 'instant' });
        var title = essay.querySelector('h1');
        if (title) {
          title.setAttribute('tabindex', '-1');
          title.focus({ preventScroll: true });
        }
      } else {
        var section = document.getElementById(decoded);
        if (section && essay.contains(section)) section.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    }
    requestAnimationFrame(function () {
      updateProgress();
      updateToc();
    });
  }
  window.addEventListener('hashchange', onNav);
  window.addEventListener('load', onNav);
})();
