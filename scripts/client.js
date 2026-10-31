/* 由 scripts/build.js 内联。__EXAM_* 在构建时替换。月份已经是 Date 的 0 起始。 */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mq = window.matchMedia("(max-width: 800px)");
  var target = new Date(__EXAM_Y__, __EXAM_M__, __EXAM_D__);
  var days = Math.ceil((target - new Date()) / 86400000);
  var countEl = document.querySelector("#countdown b");
  if (countEl) countEl.textContent = days > 0 ? days : 0;

  var CN = "〇一二三四五六七八九";
  var cards = [].slice.call(document.querySelectorAll("#chapters .card"));
  var hay = cards.map(function (card) {
    var scroll = card.querySelector(".scroll");
    return ((card.getAttribute("data-k") || "") + "\n" + (scroll ? scroll.textContent : "")).toLowerCase();
  });
  var catButtons = [].slice.call(document.querySelectorAll("#filters [data-filter]")).filter(function (b) {
    return b.dataset.filter !== "all";
  });
  var catIndex = {};
  var catMeta = {};
  catButtons.forEach(function (b, i) {
    catIndex[b.dataset.filter] = i;
    catMeta[b.dataset.filter] = {
      title: b.dataset.title || b.textContent,
      numeral: b.dataset.numeral || "",
      badge: b.dataset.badge || b.textContent
    };
  });

  var mode = "time";
  var filter = "all";
  var query = "";
  var currentId = cards[0] ? cards[0].dataset.id : "";
  var order = cards.slice();
  var mobile = mq.matches;
  var locking = false;
  var scheduled = 0;
  var catalogOpen = false;
  var lastFocus = null;
  var pages = new Map();

  function monthDay(iso) {
    return Number(iso.slice(5, 7)) + " 月 " + Number(iso.slice(8, 10)) + " 日";
  }
  function yearCn(iso) {
    return iso.slice(0, 4).replace(/\d/g, function (d) { return CN[d]; });
  }
  function motion() {
    return reduce.matches ? "auto" : "smooth";
  }
  function matchAt(i) {
    var card = cards[i];
    if (filter !== "all" && card.dataset.cat !== filter) return false;
    if (!query) return true;
    return hay[i].indexOf(query) !== -1;
  }
  function visibleCount() {
    var n = 0;
    for (var i = 0; i < cards.length; i++) if (!cards[i].classList.contains("is-out")) n++;
    return n;
  }
  function ensurePage(card) {
    var page = pages.get(card);
    if (!page) {
      page = document.createElement("div");
      page.className = "page";
      pages.set(card, page);
    }
    page.appendChild(card);
    return page;
  }
  function section(key) {
    var sec = document.createElement("section");
    sec.className = "group";
    sec.id = "grp-" + key;
    sec.dataset.key = key;
    var head = document.createElement("header");
    head.className = "ghead";
    if (mode === "time") {
      var year = document.createElement("span");
      year.className = "year";
      year.textContent = yearCn(key);
      head.appendChild(year);
      var h2 = document.createElement("h2");
      h2.textContent = monthDay(key);
      head.appendChild(h2);
    } else {
      var meta = catMeta[key] || { title: key, numeral: "" };
      var num = document.createElement("span");
      num.className = "numeral";
      num.textContent = meta.numeral;
      head.appendChild(num);
      var title = document.createElement("h2");
      title.textContent = meta.title;
      head.appendChild(title);
    }
    var count = document.createElement("span");
    count.className = "gcount";
    head.appendChild(count);
    sec.appendChild(head);
    var grid = document.createElement("div");
    grid.className = "grid";
    sec.appendChild(grid);
    return sec;
  }
  function updateGroups() {
    var nav = document.getElementById("side-index");
    nav.textContent = "";
    document.querySelectorAll("#chapters .group").forEach(function (group) {
      var n = group.querySelectorAll(".card:not(.is-out)").length;
      group.classList.toggle("is-out", n === 0);
      var count = group.querySelector(".gcount");
      if (count) count.textContent = n + " 篇";
      if (!n) return;
      var link = document.createElement("a");
      link.href = "#" + group.id;
      var label = document.createElement("span");
      var numeral = group.querySelector(".numeral");
      var heading = group.querySelector("h2");
      label.textContent = numeral ? (numeral.textContent + " " + (catMeta[group.dataset.key] ? catMeta[group.dataset.key].badge : heading.textContent)) : heading.textContent;
      var small = document.createElement("small");
      small.textContent = String(n);
      link.appendChild(label);
      link.appendChild(small);
      nav.appendChild(link);
    });
    var empty = document.getElementById("empty-desk");
    if (empty) empty.hidden = visibleCount() !== 0;
  }
  function layoutDesktop() {
    var host = document.getElementById("chapters");
    var empty = document.getElementById("empty-desk");
    var frag = document.createDocumentFragment();
    var grid = null;
    var key = "";
    order.forEach(function (card) {
      var next = mode === "time" ? card.dataset.added : card.dataset.cat;
      if (next !== key) {
        key = next;
        var sec = section(key);
        grid = sec.querySelector(".grid");
        frag.appendChild(sec);
      }
      grid.appendChild(card);
    });
    host.replaceChildren(frag);
    if (empty) host.appendChild(empty);
    document.getElementById("pager").textContent = "";
    updateGroups();
  }
  function layoutMobile() {
    var pager = document.getElementById("pager");
    var bin = document.getElementById("bin");
    var frag = document.createDocumentFragment();
    order.forEach(function (card) {
      var page = ensurePage(card);
      if (card.classList.contains("is-out")) bin.appendChild(page);
      else frag.appendChild(page);
    });
    pager.replaceChildren(frag);
    var empty = document.getElementById("empty-mob");
    if (empty) empty.hidden = pager.childElementCount !== 0;
    alignTo(currentId, false);
  }
  function applyOut() {
    var q = query;
    for (var i = 0; i < cards.length; i++) {
      var show = (filter === "all" || cards[i].dataset.cat === filter) && (!q || hay[i].indexOf(q) !== -1);
      cards[i].classList.toggle("is-out", !show);
    }
  }
  function refresh() {
    applyOut();
    if (mobile) layoutMobile();
    else updateGroups();
    var line = document.getElementById("countline");
    if (line) {
      var n = visibleCount();
      line.textContent = n + " 篇 · " + (mode === "time" ? "按时间" : "按分类") + (filter === "all" ? "" : " · 已筛选") + (query ? " · 检索中" : "");
    }
    document.querySelectorAll("[data-arrange]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.arrange === mode));
    });
    document.querySelectorAll("[data-filter]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.filter === filter));
    });
    if (catalogOpen) renderCatalog();
    updatePosFromPager();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = requestAnimationFrame(function () {
      scheduled = 0;
      refresh();
    });
  }
  function sortOrder() {
    order = cards.slice().sort(function (a, b) {
      if (mode === "time") {
        if (a.dataset.added !== b.dataset.added) return a.dataset.added < b.dataset.added ? 1 : -1;
        var d = (catIndex[a.dataset.cat] || 0) - (catIndex[b.dataset.cat] || 0);
        if (d) return d;
      } else {
        var c = (catIndex[a.dataset.cat] || 0) - (catIndex[b.dataset.cat] || 0);
        if (c) return c;
      }
      return Number(a.dataset.i) - Number(b.dataset.i);
    });
  }
  function pagerPages() {
    return [].slice.call(document.getElementById("pager").children);
  }
  function updatePos(index, total) {
    var pos = document.getElementById("pos");
    var label = total ? (index + 1) + " / " + total : "0 / 0";
    if (pos) {
      pos.textContent = label;
      pos.setAttribute("aria-label", total ? ("打开目录，第 " + (index + 1) + " 张，共 " + total + " 张") : "打开目录");
    }
    var prev = document.getElementById("prev");
    var next = document.getElementById("next");
    if (prev) prev.disabled = !total || index <= 0;
    if (next) next.disabled = !total || index >= total - 1;
    var fill = document.querySelector("#mob-prog > span");
    var bar = document.getElementById("mob-prog");
    var pct = total ? Math.round((index + 1) / total * 100) : 0;
    if (fill) fill.style.width = pct + "%";
    if (bar) bar.setAttribute("aria-valuenow", String(pct));
    pagerPages().forEach(function (page, i) {
      if (i === index) page.setAttribute("aria-current", "true");
      else page.removeAttribute("aria-current");
    });
    if (catalogOpen) {
      document.querySelectorAll("#cat-list button").forEach(function (b) {
        b.setAttribute("aria-current", b.dataset.id === currentId ? "true" : "false");
      });
    }
  }
  function updatePosFromPager() {
    if (!mobile) return;
    var pagesNow = pagerPages();
    if (!pagesNow.length) { updatePos(0, 0); return; }
    var index = 0;
    for (var i = 0; i < pagesNow.length; i++) {
      if (pagesNow[i].querySelector(".card").dataset.id === currentId) { index = i; break; }
    }
    updatePos(index, pagesNow.length);
  }
  function alignTo(id, smooth) {
    var pagesNow = pagerPages();
    if (!pagesNow.length) { currentId = ""; updatePos(0, 0); return; }
    var index = 0;
    if (id) {
      for (var i = 0; i < pagesNow.length; i++) {
        if (pagesNow[i].querySelector(".card").dataset.id === id) { index = i; break; }
      }
    }
    var page = pagesNow[index];
    currentId = page.querySelector(".card").dataset.id;
    var pager = document.getElementById("pager");
    locking = true;
    pager.scrollTo({ left: page.offsetLeft, behavior: smooth ? motion() : "auto" });
    updatePos(index, pagesNow.length);
    window.setTimeout(function () { locking = false; }, smooth && !reduce.matches ? 480 : 40);
  }
  function go(delta, smooth) {
    var pagesNow = pagerPages();
    if (!pagesNow.length) return;
    var index = 0;
    for (var i = 0; i < pagesNow.length; i++) {
      if (pagesNow[i].querySelector(".card").dataset.id === currentId) { index = i; break; }
    }
    var next = Math.max(0, Math.min(pagesNow.length - 1, index + delta));
    alignTo(pagesNow[next].querySelector(".card").dataset.id, smooth);
  }
  function renderCatalog() {
    var list = document.getElementById("cat-list");
    var frag = document.createDocumentFragment();
    var key = "";
    var sectionEl = null;
    order.forEach(function (card) {
      if (card.classList.contains("is-out")) return;
      var next = mode === "time" ? card.dataset.added : card.dataset.cat;
      if (next !== key) {
        key = next;
        sectionEl = document.createElement("section");
        var h3 = document.createElement("h3");
        if (mode === "time") h3.textContent = monthDay(key);
        else {
          var meta = catMeta[key] || { numeral: "", title: key };
          h3.textContent = (meta.numeral ? meta.numeral + " " : "") + meta.title;
        }
        sectionEl.appendChild(h3);
        frag.appendChild(sectionEl);
      }
      var btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.jump = card.dataset.id;
      btn.dataset.id = card.dataset.id;
      if (card.classList.contains("is-failed")) btn.classList.add("is-failed");
      if (card.dataset.id === currentId) btn.setAttribute("aria-current", "true");
      var em = document.createElement("em");
      em.textContent = card.querySelector(".cat").textContent;
      var span = document.createElement("span");
      span.textContent = card.querySelector(".title").textContent;
      if (card.classList.contains("is-failed")) {
        var mark = document.createElement("i");
        mark.textContent = " 未录入";
        span.appendChild(mark);
      }
      btn.appendChild(em);
      btn.appendChild(span);
      sectionEl.appendChild(btn);
    });
    if (!frag.childNodes.length) {
      var p = document.createElement("p");
      p.className = "empty";
      p.textContent = "这一叠里没有相符的篇目。";
      frag.appendChild(p);
    }
    list.replaceChildren(frag);
  }
  function setCatalog(open) {
    catalogOpen = open;
    var dialog = document.getElementById("catalog");
    if (open) {
      lastFocus = document.activeElement;
      renderCatalog();
      dialog.hidden = false;
      document.getElementById("close-catalog").focus();
    } else {
      dialog.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
  }
  function onPagerScroll() {
    if (locking || !mobile) return;
    var pager = document.getElementById("pager");
    var pagesNow = pagerPages();
    if (!pagesNow.length || !pager.clientWidth) return;
    var index = Math.round(pager.scrollLeft / pager.clientWidth);
    index = Math.max(0, Math.min(pagesNow.length - 1, index));
    var id = pagesNow[index].querySelector(".card").dataset.id;
    if (id === currentId) return;
    currentId = id;
    updatePos(index, pagesNow.length);
  }
  function onWindowScroll() {
    if (mobile) return;
    var bar = document.getElementById("desk-prog");
    var fill = bar.querySelector("span");
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var pct = h > 0 ? Math.round(window.scrollY / h * 100) : 0;
    fill.style.width = pct + "%";
    bar.setAttribute("aria-valuenow", String(pct));
  }
  function setMode(next) {
    if (mode === next) return;
    mode = next;
    sortOrder();
    currentId = "";
    if (mobile) layoutMobile();
    else layoutDesktop();
    refresh();
  }
  function setFilter(next) {
    if (filter === next) return;
    filter = next;
    currentId = "";
    schedule();
  }

  document.documentElement.classList.add("js");
  if (mobile) layoutMobile();
  else updateGroups();
  refresh();

  document.body.addEventListener("click", function (e) {
    var arrange = e.target.closest("[data-arrange]");
    if (arrange) { setMode(arrange.dataset.arrange); return; }
    var chip = e.target.closest("[data-filter]");
    if (chip) { setFilter(chip.dataset.filter); return; }
    var expand = e.target.closest(".expand");
    if (expand) {
      var card = expand.closest(".card");
      var more = card.querySelector(".more");
      if (!more) return;
      var open = more.hasAttribute("hidden");
      if (open) more.removeAttribute("hidden");
      else more.setAttribute("hidden", "");
      card.classList.toggle("is-open", open);
      expand.setAttribute("aria-expanded", open ? "true" : "false");
      expand.textContent = open ? "收起讲解" : "展开讲解";
      return;
    }
    if (e.target.closest("#open-catalog") || e.target.closest("#pos")) { setCatalog(true); return; }
    if (e.target.closest("#close-catalog")) { setCatalog(false); return; }
    if (e.target.closest("#open-search")) {
      setCatalog(true);
      var field = document.getElementById("q-m");
      if (field) field.focus();
      return;
    }
    var jump = e.target.closest("[data-jump]");
    if (jump) {
      currentId = jump.dataset.jump;
      setCatalog(false);
      alignTo(currentId, false);
      return;
    }
    if (e.target.closest("#prev")) go(-1, true);
    if (e.target.closest("#next")) go(1, true);
  });

  document.querySelectorAll(".search").forEach(function (el) {
    el.addEventListener("input", function () {
      query = el.value.trim().toLowerCase();
      document.querySelectorAll(".search").forEach(function (other) { if (other !== el) other.value = el.value; });
      currentId = "";
      schedule();
    });
  });

  document.getElementById("pager").addEventListener("scroll", onPagerScroll, { passive: true });
  window.addEventListener("scroll", onWindowScroll, { passive: true });
  window.addEventListener("resize", function () {
    var next = mq.matches;
    if (next === mobile) {
      if (mobile) alignTo(currentId, false);
      return;
    }
    mobile = next;
    if (mobile) layoutMobile();
    else layoutDesktop();
    refresh();
  });
  document.addEventListener("keydown", function (e) {
    var typing = e.target && e.target.closest && e.target.closest("input, textarea");
    if (e.key === "Escape") {
      if (catalogOpen) { e.preventDefault(); setCatalog(false); }
      else if (typing) e.target.blur();
      return;
    }
    if (typing || !mobile || catalogOpen) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(1, true); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(-1, true); }
  });

  var skip = document.querySelector(".skip");
  if (skip) {
    var pointSkip = function () { skip.setAttribute("href", mq.matches ? "#pager" : "#chapters"); };
    pointSkip();
    mq.addEventListener("change", pointSkip);
  }
})();
