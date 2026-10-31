/* 由 scripts/build.js 内联进页面。__EXAM_Y__ / __EXAM_M__ / __EXAM_D__ 会在构建时替换。
   __EXAM_M__ 已经是 Date 用的月份（0 = 一月）。 */
(function () {
  var target = new Date(__EXAM_Y__, __EXAM_M__, __EXAM_D__);
  var now = new Date();
  var days = Math.ceil((target - now) / 86400000);
  var el = document.querySelector('#countdown b');
  if (el) el.textContent = days > 0 ? days : 0;
})();
window.addEventListener('scroll', function () {
  var h = document.documentElement;
  var denom = h.scrollHeight - h.clientHeight;
  var p = denom > 0 ? h.scrollTop / denom : 0;
  document.getElementById('progress').style.width = (p * 100) + '%';
}, { passive: true });
var curFilter = 'all', curQuery = '';
function applyFilter() {
  var visible = 0;
  document.querySelectorAll('.batch').forEach(function (batch) {
    var batchVisible = 0;
    batch.querySelectorAll('section[data-sec]').forEach(function (sec) {
      var secShow = (curFilter === 'all') || (sec.dataset.sec === curFilter);
      var cardsVisible = 0;
      sec.querySelectorAll('.card').forEach(function (c) {
        var hay = (c.dataset.k || '') + c.textContent;
        var show = secShow && (!curQuery || hay.indexOf(curQuery) > -1);
        c.style.display = show ? '' : 'none';
        if (show) { cardsVisible++; visible++; batchVisible++; }
      });
      sec.style.display = (secShow && cardsVisible > 0) ? '' : 'none';
    });
    batch.style.display = batchVisible ? '' : 'none';
  });
  var empty = document.getElementById('empty');
  if (empty) empty.style.display = visible ? 'none' : 'block';
}
document.getElementById('filters').addEventListener('click', function (e) {
  var b = e.target.closest('.fbtn');
  if (!b) return;
  document.querySelectorAll('.fbtn').forEach(function (x) { x.classList.remove('on'); });
  b.classList.add('on');
  curFilter = b.dataset.f;
  applyFilter();
});
document.getElementById('q').addEventListener('input', function (e) {
  curQuery = e.target.value.trim();
  applyFilter();
});
