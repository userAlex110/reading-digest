/* Inlined into prototypes/a.html, b.html, c.html. Expects MODE and PAYLOAD. */
(function () {
  "use strict";

  var NAME = { a: "册页", b: "目录卡", c: "牌叠" }[MODE];
  var BRAND = String(PAYLOAD.title || "").split("·")[0].trim() || "收藏即所学";
  var mq = window.matchMedia("(max-width: 800px)");
  var state = {
    arrange: "time",
    filter: "all",
    q: "",
    index: 0,
    open: new Set(),
    catalog: false,
    reader: null
  };
  var groups = [];
  var items = [];
  var locking = false;
  var CN = "〇一二三四五六七八九";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function safe(html) {
    return String(html || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  }

  function strip(html) {
    return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  function catOf(a) {
    for (var i = 0; i < PAYLOAD.categories.length; i++) {
      if (PAYLOAD.categories[i].id === a.category) return PAYLOAD.categories[i];
    }
    return { id: a.category, title: a.category, badge: a.category, filter: a.category, numeral: "" };
  }

  function yearCn(iso) {
    return String(iso).slice(0, 4).replace(/\d/g, function (d) { return CN[Number(d)]; });
  }

  function monthDay(iso) {
    return Number(iso.slice(5, 7)) + " 月 " + Number(iso.slice(8, 10)) + " 日";
  }

  function dateLine(a) {
    var pub = (a.published || "").slice(5);
    var added = (a.added || "").slice(5);
    if (!pub) return added;
    if (!added || pub === added) return pub;
    return "刊 " + pub + " · 采集 " + added;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return PAYLOAD.articles.filter(function (a) {
      if (state.filter !== "all" && a.category !== state.filter) return false;
      if (!q) return true;
      var blob = [a.title, a.account, a.keywords, a.summary_label, strip(a.summary_html)].join("\n").toLowerCase();
      return blob.indexOf(q) !== -1;
    });
  }

  function compute() {
    var list = filtered();
    var order = PAYLOAD.categories.map(function (c) { return c.id; });
    if (state.arrange === "time") {
      var sorted = list.slice().sort(function (a, b) {
        if (a.added !== b.added) return a.added < b.added ? 1 : -1;
        var d = order.indexOf(a.category) - order.indexOf(b.category);
        if (d) return d;
        return a.i - b.i;
      });
      var map = new Map();
      sorted.forEach(function (a) {
        if (!map.has(a.added)) map.set(a.added, []);
        map.get(a.added).push(a);
      });
      groups = Array.from(map.entries()).map(function (entry) {
        return {
          key: entry[0],
          kind: "time",
          title: monthDay(entry[0]),
          sub: yearCn(entry[0]),
          numeral: "",
          items: entry[1]
        };
      });
    } else {
      groups = PAYLOAD.categories.map(function (c) {
        return {
          key: c.id,
          kind: "tag",
          title: c.title,
          sub: c.badge,
          numeral: c.numeral,
          items: list.filter(function (a) { return a.category === c.id; }).sort(function (a, b) { return a.i - b.i; })
        };
      }).filter(function (g) { return g.items.length; });
    }
    items = groups.reduce(function (acc, g) { return acc.concat(g.items); }, []);
    if (state.index > items.length - 1) state.index = Math.max(0, items.length - 1);
    if (state.reader && !items.some(function (a) { return a.id === state.reader; })) state.reader = null;
  }

  function seg() {
    return '<div class="seg" role="group" aria-label="排列方式">' +
      '<button type="button" data-act="arrange" data-arrange="time">按时间</button>' +
      '<button type="button" data-act="arrange" data-arrange="tag">按分类</button>' +
      "</div>";
  }

  function filters() {
    var html = '<button type="button" class="chip" data-act="filter" data-filter="all">全部</button>';
    PAYLOAD.categories.forEach(function (c) {
      html += '<button type="button" class="chip" data-act="filter" data-filter="' + esc(c.id) + '">' + esc(c.filter) + "</button>";
    });
    return html;
  }

  function extra(a) {
    var html = "";
    if (a.detail_summary) html += '<p class="dk">' + esc(a.detail_summary) + "</p>";
    if (a.points_html && a.points_html.length) {
      html += '<ol class="points">' + a.points_html.map(function (p) { return "<li>" + safe(p) + "</li>"; }).join("") + "</ol>";
    }
    if (a.detail_html) html += '<div class="body">' + safe(a.detail_html) + "</div>";
    (a.notes_html || []).forEach(function (n) { html += '<p class="note">' + safe(n) + "</p>"; });
    return html;
  }

  function card(a, variant) {
    var failed = a.status !== "ok";
    var cat = catOf(a);
    var open = state.open.has(a.id);
    var idx = items.indexOf(a);
    var num = String(idx + 1).padStart(2, "0");
    var drop = !failed && (variant === "sheet" || variant === "front");
    var clamp = variant === "tile" || variant === "library" || variant === "compact";
    var more = "";
    if (variant !== "compact") {
      more = '<div class="more"' + (open ? "" : " hidden") + ">" + extra(a) + "</div>";
    }
    var act = variant === "compact" ? "read" : "expand";
    var actLabel = variant === "compact" ? "展开讲解" : (open ? "收起讲解" : "展开讲解");
    return '<article class="card ' + variant + (failed ? " is-failed" : "") + (open ? " is-open" : "") + '" data-card="' + esc(a.id) + '">' +
      '<div class="scroll">' +
        '<div class="meta">' +
          (variant === "compact" ? '<span class="no">' + num + "</span>" : "") +
          '<span class="cat">' + esc(cat.badge) + "</span>" +
          '<span class="sep" aria-hidden="true">·</span>' +
          '<time datetime="' + esc(a.published || a.added) + '">' + esc(dateLine(a)) + "</time>" +
          (failed ? '<span class="stamp">未录入</span>' : "") +
        "</div>" +
        "<h3 class=\"title\">" + esc(a.title) + "</h3>" +
        '<p class="source">' + esc(a.account) + "</p>" +
        '<p class="label">' + esc(a.summary_label) + "</p>" +
        '<div class="lead' + (drop ? " drop" : "") + (clamp ? " clamp" : "") + '">' + safe(a.summary_html) + "</div>" +
        more +
      "</div>" +
      '<div class="actions">' +
        '<button type="button" data-act="' + act + '" data-id="' + esc(a.id) + '"' +
          (act === "expand" ? ' aria-expanded="' + (open ? "true" : "false") + '"' : "") + ">" + actLabel + "</button>" +
        '<a href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer">' + (failed ? "尝试打开原文" : "阅读原文") + "</a>" +
      "</div>" +
    "</article>";
  }

  function deskHtml() {
    if (!groups.length) return '<p class="empty">这一叠里没有相符的篇目。</p>';
    return groups.map(function (g) {
      var variant = MODE === "c" ? "compact" : MODE === "b" ? "library" : "tile";
      return '<section class="group" id="grp-' + esc(g.key) + '">' +
        '<header class="ghead">' +
          (g.numeral ? '<span class="numeral">' + esc(g.numeral) + "</span>" : '<span class="year">' + esc(g.sub) + "</span>") +
          "<h2>" + esc(g.title) + "</h2>" +
          '<span class="gcount">' + g.items.length + " 篇</span>" +
        "</header>" +
        '<div class="grid">' + g.items.map(function (a) { return card(a, variant); }).join("") + "</div>" +
      "</section>";
    }).join("");
  }

  function sideHtml() {
    if (!groups.length) return '<p class="empty">没有索引</p>';
    return groups.map(function (g) {
      var label = g.kind === "tag" ? g.numeral + " " + g.sub : g.title;
      return '<a href="#grp-' + esc(g.key) + '"><span>' + esc(label) + "</span><small>" + g.items.length + "</small></a>";
    }).join("");
  }

  function pagesHtml() {
    if (!items.length) return '<div class="page"><p class="empty">这一叠里没有相符的篇目。</p></div>';
    return items.map(function (a) {
      return '<div class="page">' + card(a, "sheet") + "</div>";
    }).join("");
  }

  function catHtml() {
    if (!groups.length) return '<p class="empty">这一叠里没有相符的篇目。</p>';
    var i = 0;
    return groups.map(function (g) {
      var buttons = g.items.map(function (a) {
        var failed = a.status !== "ok";
        var current = i === state.index;
        var html = '<button type="button" data-act="jump" data-i="' + i + '" class="' +
          (current ? "is-current " : "") + (failed ? "is-failed" : "") + '">' +
          "<em>" + String(i + 1).padStart(2, "0") + "</em><span>" + esc(a.title) +
          (failed ? " <i>未录入</i>" : "") + "</span></button>";
        i += 1;
        return html;
      }).join("");
      return "<section><h3>" + esc(g.numeral ? g.numeral + " " + g.title : g.title) + "</h3>" + buttons + "</section>";
    }).join("");
  }

  function readerBody(a) {
    var failed = a.status !== "ok";
    var cat = catOf(a);
    return '<div class="meta">' +
      '<span class="cat">' + esc(cat.badge) + "</span>" +
      '<span class="sep" aria-hidden="true">·</span>' +
      "<time>" + esc(dateLine(a)) + "</time>" +
      (failed ? '<span class="stamp">未录入</span>' : "") +
      "</div>" +
      "<h2>" + esc(a.title) + "</h2>" +
      '<p class="source">' + esc(a.account) + "</p>" +
      '<p class="label">' + esc(a.summary_label) + "</p>" +
      '<div class="lead' + (failed ? "" : " drop") + '">' + safe(a.summary_html) + "</div>" +
      extra(a);
  }

  function shell() {
    var side = MODE === "b"
      ? '<aside class="sidebar"><p class="side-label">索引</p><nav id="side-index"></nav></aside>'
      : "";
    var stage = MODE === "a"
      ? '<div id="pager" class="pager" tabindex="0" aria-roledescription="卡片轮播"></div>'
      : MODE === "b"
        ? '<div id="deck" class="deck" tabindex="0" aria-roledescription="卡片轮播"></div><div id="ticks" aria-hidden="true"></div>'
        : '<div id="stage" class="stage"></div>';
    var foot = MODE === "b" ? "" : (
      '<footer class="mfoot">' +
        '<button type="button" data-act="prev">上一张</button>' +
        '<div class="status"><button type="button" class="pos" data-act="pos" data-pos aria-label="打开目录">1 / 1</button>' +
        (MODE === "c" ? '<small id="remain"></small>' : "") +
        "</div>" +
        '<button type="button" data-act="next">下一张</button>' +
      "</footer>"
    );
    var bControls = MODE === "b"
      ? '<button type="button" data-act="prev">上一张</button><button type="button" class="pos" data-act="pos" data-pos aria-label="打开目录">1 / 1</button><button type="button" data-act="next">下一张</button>'
      : (MODE === "c" ? '<span class="hint">左滑翻篇</span>' : "");
    var reader = MODE === "c"
      ? '<div id="reader" hidden><div class="prog rprog"><span id="reader-fill"></span></div>' +
        '<div class="rbar"><button type="button" data-act="close-reader">回到网格</button><a class="rlink" href="#" target="_blank" rel="noopener noreferrer">阅读原文</a></div>' +
        '<div class="rscroll"><article class="rsheet"></article></div></div>'
      : "";
    return (
      '<div id="desk-prog" class="prog desk-only" aria-hidden="true"><span></span></div>' +
      '<div id="mob-prog" class="prog mob-only" aria-hidden="true"><span></span></div>' +
      '<div id="desk"><header class="top">' +
        '<div class="brand"><p class="eyebrow">设计原型 · ' + esc(NAME) + "</p><h1>" + esc(BRAND) + "</h1></div>" +
        '<div class="controls">' + seg() +
          '<label class="search-wrap"><span class="sr">检索</span><input class="search" type="search" placeholder="检索篇目" aria-label="检索篇目"></label>' +
        "</div>" +
        '<div class="filters" role="group" aria-label="分类">' + filters() + "</div>" +
        '<p class="countline" data-count></p>' +
      "</header>" +
      '<div class="desk-body' + (MODE === "b" ? " with-side" : "") + '">' + side + '<main id="desk-main"></main></div></div>' +
      '<div id="mob"><header class="mhead"><div class="brand-mini"><p class="eyebrow">' + esc(NAME) + "</p><p>" + esc(BRAND) + "</p></div>" +
        bControls +
        '<button type="button" data-act="catalog">目录</button></header>' +
        stage + foot +
        '<div id="catalog" class="catalog" role="dialog" aria-modal="true" aria-label="目录">' +
          '<div class="cat-bar"><button type="button" data-act="close-cat">回到这张</button><h2>目录</h2></div>' +
          '<div class="controls">' + seg() +
            '<label class="search-wrap"><span class="sr">检索</span><input class="search" type="search" placeholder="检索篇目" aria-label="检索篇目"></label>' +
          "</div>" +
          '<div class="filters" role="group" aria-label="分类">' + filters() + "</div>" +
          '<div id="cat-list"></div>' +
        "</div></div>" +
      reader
    );
  }

  function syncChrome() {
    document.querySelectorAll("[data-arrange]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.arrange === state.arrange));
    });
    document.querySelectorAll("[data-filter]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.filter === state.filter));
    });
    var line = items.length + " 篇 · " + (state.arrange === "time" ? "按时间" : "按分类");
    if (state.filter !== "all") {
      var c = PAYLOAD.categories.filter(function (x) { return x.id === state.filter; })[0];
      line += " · " + (c ? c.filter : "");
    }
    if (state.q.trim()) line += " · 检索中";
    document.querySelectorAll("[data-count]").forEach(function (el) { el.textContent = line; });
    var cat = document.getElementById("catalog");
    if (cat) cat.classList.toggle("is-on", state.catalog);
  }

  function updateIndicator() {
    var n = items.length;
    var i = n ? state.index : 0;
    var label = n ? (i + 1) + " / " + n : "0 / 0";
    document.querySelectorAll("[data-pos]").forEach(function (el) { el.textContent = label; });
    document.querySelectorAll('[data-act="prev"]').forEach(function (b) { b.disabled = !n || i <= 0; });
    document.querySelectorAll('[data-act="next"]').forEach(function (b) { b.disabled = !n || i >= n - 1; });
    var fill = document.querySelector("#mob-prog > span");
    if (fill) fill.style.width = n ? ((i + 1) / n * 100) + "%" : "0%";
    document.querySelectorAll("#ticks i").forEach(function (tick, idx) {
      tick.classList.toggle("on", idx === i);
    });
    document.querySelectorAll("#cat-list button").forEach(function (b) {
      b.classList.toggle("is-current", Number(b.dataset.i) === i);
    });
    document.querySelectorAll("#pager > .page, #deck > .page").forEach(function (el, idx) {
      if (idx === i) el.setAttribute("aria-current", "true");
      else el.removeAttribute("aria-current");
    });
    var remain = document.getElementById("remain");
    if (remain) remain.textContent = n ? "还剩 " + Math.max(0, n - 1 - i) + " 张" : "";
  }

  function align(smooth) {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var behavior = smooth && !reduce ? "smooth" : "auto";
    var node = MODE === "a" ? document.getElementById("pager") : document.getElementById("deck");
    if (!node || MODE === "c") return;
    locking = true;
    if (MODE === "a") {
      if (node.clientWidth) node.scrollTo({ left: state.index * node.clientWidth, behavior: behavior });
    } else {
      var el = node.children[state.index];
      if (el) node.scrollTo({ top: el.offsetTop, behavior: behavior });
    }
    window.setTimeout(function () { locking = false; }, smooth ? 480 : 60);
  }

  function paintMobileC() {
    var stage = document.getElementById("stage");
    if (!stage) return;
    if (!items.length) {
      stage.innerHTML = '<p class="empty">这一叠里没有相符的篇目。</p>';
      return;
    }
    var a = items[state.index];
    var next = items[state.index + 1];
    var back = next
      ? '<div class="back">' + (next.status !== "ok" ? '<span class="stamp">未录入</span>' : "") + "<p>" + esc(next.title) + "</p></div>"
      : '<div class="back end"><p>这一叠的末页</p></div>';
    stage.innerHTML = back + card(a, "front");
    bindDeck();
  }

  function paintReader() {
    var root = document.getElementById("reader");
    if (!root) return;
    var a = null;
    for (var i = 0; i < PAYLOAD.articles.length; i++) {
      if (PAYLOAD.articles[i].id === state.reader) a = PAYLOAD.articles[i];
    }
    root.hidden = !a;
    document.body.classList.toggle("reader-on", !!a);
    if (!a) return;
    root.querySelector(".rsheet").innerHTML = readerBody(a);
    var link = root.querySelector(".rlink");
    link.href = a.url;
    link.textContent = a.status === "ok" ? "阅读原文" : "尝试打开原文";
    var sc = root.querySelector(".rscroll");
    sc.scrollTop = 0;
    var fill = document.getElementById("reader-fill");
    if (fill) fill.style.width = "0%";
  }

  function paintLists() {
    compute();
    document.getElementById("desk-main").innerHTML = deskHtml();
    var side = document.getElementById("side-index");
    if (side) side.innerHTML = sideHtml();
    document.getElementById("cat-list").innerHTML = catHtml();
    var ticks = document.getElementById("ticks");
    if (ticks) {
      ticks.innerHTML = items.map(function (_, k) {
        return '<i class="' + (k === state.index ? "on" : "") + '"></i>';
      }).join("");
    }
    if (MODE === "c") paintMobileC();
    else {
      var host = document.getElementById(MODE === "a" ? "pager" : "deck");
      host.innerHTML = pagesHtml();
      align(false);
    }
    syncChrome();
    updateIndicator();
    paintReader();
  }

  function go(i, smooth) {
    if (!items.length) return;
    state.index = Math.max(0, Math.min(items.length - 1, i));
    if (MODE === "c") {
      if (mq.matches) paintMobileC();
      updateIndicator();
      return;
    }
    align(!!smooth);
    updateIndicator();
  }

  function toggleOpen(id) {
    if (state.open.has(id)) state.open.delete(id);
    else state.open.add(id);
    var on = state.open.has(id);
    document.querySelectorAll("[data-card]").forEach(function (el) {
      if (el.getAttribute("data-card") !== id) return;
      el.classList.toggle("is-open", on);
      var more = el.querySelector(".more");
      if (more) more.hidden = !on;
      var btn = el.querySelector('[data-act="expand"]');
      if (btn) {
        btn.textContent = on ? "收起讲解" : "展开讲解";
        btn.setAttribute("aria-expanded", on ? "true" : "false");
      }
    });
  }

  function bindDeck() {
    var cardEl = document.querySelector("#stage .front");
    if (!cardEl) return;
    var dx = 0;
    var active = false;
    var horiz = null;
    var sc = cardEl.querySelector(".scroll");
    cardEl.addEventListener("pointerdown", function (e) {
      if (e.target.closest("a, button")) return;
      if (state.open.has(cardEl.getAttribute("data-card"))) return;
      active = true;
      horiz = null;
      dx = 0;
      cardEl._x0 = e.clientX;
      cardEl._y0 = e.clientY;
      cardEl._scroll0 = sc ? sc.scrollTop : 0;
      cardEl.classList.add("dragging");
      try { cardEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    cardEl.addEventListener("pointermove", function (e) {
      if (!active) return;
      dx = e.clientX - cardEl._x0;
      var dy = e.clientY - cardEl._y0;
      if (horiz === null) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        horiz = Math.abs(dx) > Math.abs(dy);
      }
      if (horiz) {
        cardEl.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 38) + "deg)";
      } else if (sc) {
        sc.scrollTop = cardEl._scroll0 - dy;
      }
    });
    function end() {
      if (!active && horiz !== true) {
        horiz = null;
        cardEl.classList.remove("dragging");
        return;
      }
      var thrown = horiz === true ? dx : 0;
      active = false;
      horiz = null;
      cardEl.classList.remove("dragging");
      cardEl.style.transform = "";
      if (thrown <= -80) go(state.index + 1, true);
      else if (thrown >= 80) go(state.index - 1, true);
    }
    cardEl.addEventListener("pointerup", end);
    cardEl.addEventListener("pointercancel", end);
  }

  function onScrollHost(node, vertical) {
    if (!node) return;
    node.addEventListener("scroll", function () {
      if (locking || !items.length) return;
      var i;
      if (!vertical) {
        if (!node.clientWidth) return;
        i = Math.round(node.scrollLeft / node.clientWidth);
      } else {
        var best = 0;
        var bestD = Infinity;
        Array.prototype.forEach.call(node.children, function (el, idx) {
          var d = Math.abs(el.offsetTop - node.scrollTop);
          if (d < bestD) { bestD = d; best = idx; }
        });
        i = best;
      }
      i = Math.max(0, Math.min(items.length - 1, i));
      if (i === state.index) return;
      state.index = i;
      updateIndicator();
    }, { passive: true });
  }

  function bind() {
    document.body.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b || b.disabled) return;
      var act = b.dataset.act;
      if (act === "prev") go(state.index - 1, true);
      else if (act === "next") go(state.index + 1, true);
      else if (act === "catalog" || act === "pos") {
        state.catalog = true;
        syncChrome();
        var field = document.querySelector("#catalog .search");
        if (field) field.focus();
      } else if (act === "close-cat") {
        state.catalog = false;
        syncChrome();
      } else if (act === "jump") {
        state.catalog = false;
        syncChrome();
        go(Number(b.dataset.i), false);
      } else if (act === "arrange") {
        if (state.arrange === b.dataset.arrange) return;
        state.arrange = b.dataset.arrange;
        state.index = 0;
        paintLists();
      } else if (act === "filter") {
        if (state.filter === b.dataset.filter) return;
        state.filter = b.dataset.filter;
        state.index = 0;
        paintLists();
      } else if (act === "expand") {
        toggleOpen(b.dataset.id || (b.closest("[data-card]") && b.closest("[data-card]").getAttribute("data-card")));
      } else if (act === "read") {
        state.reader = b.dataset.id;
        paintReader();
      } else if (act === "close-reader") {
        state.reader = null;
        paintReader();
      }
    });

    document.querySelectorAll(".search").forEach(function (el) {
      el.addEventListener("input", function () {
        state.q = el.value;
        document.querySelectorAll(".search").forEach(function (other) {
          if (other !== el) other.value = state.q;
        });
        state.index = 0;
        paintLists();
      });
    });

    onScrollHost(document.getElementById("pager"), false);
    onScrollHost(document.getElementById("deck"), true);

    var rscroll = document.querySelector("#reader .rscroll");
    if (rscroll) {
      rscroll.addEventListener("scroll", function () {
        var fill = document.getElementById("reader-fill");
        if (!fill) return;
        var h = rscroll.scrollHeight - rscroll.clientHeight;
        fill.style.width = (h > 0 ? rscroll.scrollTop / h * 100 : 0) + "%";
      }, { passive: true });
    }

    window.addEventListener("scroll", function () {
      if (mq.matches) return;
      var bar = document.querySelector("#desk-prog > span");
      if (!bar) return;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? window.scrollY / h * 100 : 0) + "%";
    }, { passive: true });

    window.addEventListener("resize", function () {
      if (MODE !== "c") align(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.target && e.target.matches && e.target.matches("input, textarea")) {
        if (e.key === "Escape") e.target.blur();
        return;
      }
      if (e.key === "Escape") {
        if (state.reader) { state.reader = null; paintReader(); return; }
        if (state.catalog) { state.catalog = false; syncChrome(); }
        return;
      }
      if (!mq.matches) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(state.index + 1, true); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(state.index - 1, true); }
    });
  }

  document.body.classList.add("mode-" + MODE);
  document.getElementById("app").innerHTML = shell();
  bind();
  paintLists();

  window.__cards = {
    mode: MODE,
    go: function (i) { go(i, false); },
    arrange: function (v) { state.arrange = v; state.index = 0; paintLists(); },
    filter: function (v) { state.filter = v; state.index = 0; paintLists(); },
    search: function (v) {
      state.q = v;
      document.querySelectorAll(".search").forEach(function (el) { el.value = v; });
      state.index = 0;
      paintLists();
    },
    open: function (id) {
      if (MODE === "c" && !mq.matches) { state.reader = id; paintReader(); return; }
      if (!state.open.has(id)) toggleOpen(id);
    },
    index: function () { return state.index; },
    count: function () { return items.length; },
    ids: function () { return items.map(function (a) { return a.id; }); },
    titleAt: function (i) { return items[i] ? items[i].title : ""; },
    reader: function () { return state.reader; }
  };
})();
