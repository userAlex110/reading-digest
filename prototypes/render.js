#!/usr/bin/env node
"use strict";

/*
 * 只写 prototypes/ 里的原型页。
 * 不读取、不改写仓库根目录的 index.html，也不调用 scripts/build.js。
 */

const fs = require("fs");
const path = require("path");

const here = __dirname;
const root = path.resolve(here, "..");
const raw = JSON.parse(fs.readFileSync(path.join(root, "data/articles.json"), "utf8"));
const css = fs.readFileSync(path.join(here, "prototype.css"), "utf8");
const client = fs.readFileSync(path.join(here, "runtime.js"), "utf8");

const payload = {
  title: raw.site.title,
  kicker: raw.site.kicker,
  exam: raw.site.exam,
  categories: raw.categories.map(function (c) {
    return {
      id: c.id,
      numeral: c.numeral,
      title: c.title,
      badge: c.badge,
      filter: c.filter_label
    };
  }),
  articles: raw.articles.map(function (a, i) {
    return {
      i: i,
      id: a.id,
      title: a.title,
      url: a.url,
      category: a.category,
      account: a.source.account,
      published: a.source.published,
      added: a.added,
      status: a.status,
      summary_label: a.summary_label,
      summary_html: a.summary_html,
      points_html: a.points_html || [],
      notes_html: a.notes_html || [],
      detail_summary: (a.detail && a.detail.summary) || "",
      detail_html: (a.detail && a.detail.body_html) || "",
      keywords: a.keywords || ""
    };
  })
};

function embed(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const DATA = embed(payload);
const ROBOTS = raw.site.robots || "noindex, nofollow";

const options = [
  {
    id: "a",
    file: "a.html",
    name: "册页",
    blurb: "手机横向一页一卡，桌面按章铺成三列。讲解在卡片里展开。"
  },
  {
    id: "b",
    file: "b.html",
    name: "目录卡",
    blurb: "手机纵向轻翻，下一张露一条边；桌面左侧是索引，卡片是双线书目。"
  },
  {
    id: "c",
    file: "c.html",
    name: "牌叠",
    blurb: "手机是可以拂开的一叠；桌面是编号密卡，点开后才进入阅读页。"
  }
];

function writeOut(name, contents) {
  if (name.includes("..") || path.isAbsolute(name)) throw new Error("bad name " + name);
  const dest = path.join(here, name);
  if (path.dirname(dest) !== here) throw new Error("refusing " + dest);
  fs.writeFileSync(dest, contents);
  return dest;
}

function page(opt) {
  const title = "方案 " + opt.id.toUpperCase() + " · " + opt.name + " — 设计原型";
  return [
    "<!DOCTYPE html>",
    '<html lang="zh-CN">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="' + ROBOTS + '">',
    "<title>" + title + "</title>",
    "<style>",
    css,
    "</style>",
    "</head>",
    "<body>",
    '<div id="app"></div>',
    "<script>",
    "const MODE = " + JSON.stringify(opt.id) + ";",
    "const PAYLOAD = " + DATA + ";",
    client,
    "</script>",
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

function indexPage() {
  const cards = options.map(function (opt) {
    return (
      '<li><a href="' + opt.file + '"><span>方案 ' + opt.id.toUpperCase() + "</span>" +
      "<strong>" + opt.name + "</strong><em>" + opt.blurb + "</em></a></li>"
    );
  }).join("");
  return [
    "<!DOCTYPE html>",
    '<html lang="zh-CN">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="' + ROBOTS + '">',
    "<title>卡片方案 · 设计原型</title>",
    "<style>",
    "body{margin:0;background:#f4efe4;color:#2c241c;font-family:'Noto Serif CJK SC','Songti SC',serif;}",
    "main{max-width:40rem;margin:0 auto;padding:48px 22px 72px;}",
    "p{letter-spacing:.18em;color:rgba(44,36,28,.64);}",
    "h1{font-weight:600;letter-spacing:.08em;font-size:2rem;}",
    "ol{list-style:none;padding:0;margin:28px 0 0;}",
    "a{display:block;color:inherit;text-decoration:none;padding:18px 0;border-top:1px solid rgba(44,36,28,.2);}",
    "span{color:#8f3d32;letter-spacing:.14em;font-size:.85rem;}",
    "strong{display:block;font-size:1.45rem;font-weight:600;margin:4px 0;}",
    "em{font-style:normal;color:rgba(44,36,28,.72);}",
    "</style>",
    "</head>",
    "<body><main>",
    "<p>设计原型 · 未替换线上页</p>",
    "<h1>三套卡片</h1>",
    "<ol>",
    cards,
    "</ol>",
    "<p style=\"letter-spacing:0;margin-top:28px\">数据来自 data/articles.json。重新生成：node prototypes/render.js</p>",
    "</main></body></html>",
    ""
  ].join("\n");
}

options.forEach(function (opt) {
  writeOut(opt.file, page(opt));
  console.log("wrote", opt.file);
});
writeOut("index.html", indexPage());
console.log("wrote index.html");
console.log("articles", payload.articles.length);

const order = payload.categories.map(function (c) { return c.id; });
const sorted = payload.articles.slice().sort(function (a, b) {
  if (a.added !== b.added) return a.added < b.added ? 1 : -1;
  const d = order.indexOf(a.category) - order.indexOf(b.category);
  if (d) return d;
  return a.i - b.i;
});
sorted.forEach(function (a, i) {
  if (i < 9 || a.status !== "ok") {
    console.log(String(i).padStart(2, " "), a.added, a.category, a.status, a.title.slice(0, 28));
  }
});
