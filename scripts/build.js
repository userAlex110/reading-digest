#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

function usage() {
  console.log(`用法: node scripts/build.js [--data 文件] [--out 文件] [--check]

读取 data/articles.json，校验后生成单文件 index.html。
  --check   只校验，并核对仓库里的 index.html 是否与构建结果一致（不写文件）
  --data    数据文件，默认 data/articles.json
  --out     输出路径，默认 index.html（与 --check 一起用时被忽略）`);
}

function parseArgs(argv) {
  const opts = {
    check: false,
    help: false,
    out: path.join(ROOT, 'index.html'),
    data: path.join(ROOT, 'data', 'articles.json'),
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') opts.check = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--out' || arg === '--data') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} 需要一个路径`);
      }
      opts[arg.slice(2)] = path.resolve(value);
    } else {
      throw new Error(`未知参数 ${arg}`);
    }
  }
  return opts;
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function validate(doc) {
  const errors = [];
  const err = (message) => errors.push(message);

  if (!isObject(doc)) {
    return ['根节点必须是对象'];
  }
  if (doc.schema_version !== 1) {
    err(`schema_version 必须是 1，实际是 ${JSON.stringify(doc.schema_version)}`);
  }
  if (!isObject(doc.site)) {
    err('缺少 site 对象');
  } else {
    for (const key of ['title', 'kicker', 'headline_html', 'seal', 'robots']) {
      if (!isNonEmptyString(doc.site[key])) err(`site.${key} 必须是非空字符串`);
    }
    if (!isObject(doc.site.exam)) err('site.exam 必须是对象');
    else {
      if (!isIsoDate(doc.site.exam.date)) err('site.exam.date 必须是 YYYY-MM-DD');
      if (!isNonEmptyString(doc.site.exam.label)) err('site.exam.label 必须是非空字符串');
    }
    if (doc.site.archive_notes !== undefined) {
      if (!Array.isArray(doc.site.archive_notes) || doc.site.archive_notes.some((note) => !isNonEmptyString(note))) {
        err('site.archive_notes 必须是非空字符串数组');
      }
    }
  }

  if (!Array.isArray(doc.categories) || doc.categories.length === 0) {
    err('categories 必须是非空数组');
  }
  const categoryIds = new Set();
  (doc.categories || []).forEach((category, index) => {
    const where = `categories[${index}]`;
    if (!isObject(category)) {
      err(`${where} 必须是对象`);
      return;
    }
    if (typeof category.id !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(category.id)) {
      err(`${where}.id 必须是小写字母开头的短标识（用于 CSS 变量名）`);
    } else if (categoryIds.has(category.id)) {
      err(`重复的分类 id：${category.id}`);
    } else {
      categoryIds.add(category.id);
    }
    for (const key of ['numeral', 'title', 'badge', 'filter_label']) {
      if (!isNonEmptyString(category[key])) err(`${where}.${key} 必须是非空字符串`);
    }
    if (typeof category.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(category.color)) {
      err(`${where}.color 必须是 #rrggbb`);
    }
  });

  if (!Array.isArray(doc.articles) || doc.articles.length === 0) {
    err('articles 必须是非空数组');
  }

  const seenIds = new Map();
  const seenUrls = new Map();
  (doc.articles || []).forEach((article, index) => {
    const where = `articles[${index}]`;
    if (!isObject(article)) {
      err(`${where} 必须是对象`);
      return;
    }
    if (!isNonEmptyString(article.id) || /\s/.test(article.id)) {
      err(`${where}.id 必须是不含空白的非空字符串`);
    } else if (seenIds.has(article.id)) {
      err(`重复的 id：${article.id}（${seenIds.get(article.id)} 与 ${where}）`);
    } else {
      seenIds.set(article.id, where);
    }
    if (!isNonEmptyString(article.title)) err(`${where}.title 必须是非空字符串`);
    if (typeof article.url !== 'string' || !/^https?:\/\//.test(article.url)) {
      err(`${where}.url 必须是 http(s) 链接`);
    } else if (seenUrls.has(article.url)) {
      err(`重复的 url：${article.url}（${seenUrls.get(article.url)} 与 ${where}）`);
    } else {
      seenUrls.set(article.url, where);
    }
    if (!categoryIds.has(article.category)) {
      err(`${where}.category 未在 categories 中定义：${JSON.stringify(article.category)}`);
    }
    if (!isIsoDate(article.added)) err(`${where}.added 必须是 YYYY-MM-DD`);
    if (article.status !== 'ok' && article.status !== 'fetch_failed') {
      err(`${where}.status 必须是 ok 或 fetch_failed`);
    }
    if (!isNonEmptyString(article.summary_label)) err(`${where}.summary_label 必须是非空字符串`);
    if (!isNonEmptyString(article.summary_html)) err(`${where}.summary_html 必须是非空字符串`);
    if (article.points_html !== undefined) {
      if (!Array.isArray(article.points_html) || article.points_html.some((point) => !isNonEmptyString(point))) {
        err(`${where}.points_html 必须是非空字符串数组`);
      }
    }
    if (article.notes_html !== undefined) {
      if (!Array.isArray(article.notes_html) || article.notes_html.some((note) => !isNonEmptyString(note))) {
        err(`${where}.notes_html 必须是非空字符串数组`);
      }
    }
    if (article.keywords !== undefined && typeof article.keywords !== 'string') {
      err(`${where}.keywords 必须是字符串`);
    }
    if (article.detail !== undefined && article.detail !== null) {
      if (!isObject(article.detail)) err(`${where}.detail 必须是对象`);
      else {
        if (!isNonEmptyString(article.detail.summary)) err(`${where}.detail.summary 必须是非空字符串`);
        if (!isNonEmptyString(article.detail.body_html)) err(`${where}.detail.body_html 必须是非空字符串`);
      }
    }
    if (article.source !== undefined) {
      if (!isObject(article.source)) err(`${where}.source 必须是对象`);
      else {
        if (article.source.account !== undefined && !isNonEmptyString(article.source.account)) {
          err(`${where}.source.account 必须是非空字符串`);
        }
        if (article.source.published !== undefined && !isIsoDate(article.source.published)) {
          err(`${where}.source.published 必须是 YYYY-MM-DD`);
        }
        if (!article.source.account && !article.source.published) {
          err(`${where}.source 至少要有 account 或 published`);
        }
      }
    }
    if (article.wechat !== undefined) {
      if (!isObject(article.wechat)) err(`${where}.wechat 必须是对象`);
      else {
        for (const key of ['biz', 'mid', 'idx']) {
          if (!isNonEmptyString(article.wechat[key])) err(`${where}.wechat.${key} 必须是非空字符串`);
        }
        if (article.wechat.sn !== undefined && !isNonEmptyString(article.wechat.sn)) {
          err(`${where}.wechat.sn 必须是非空字符串`);
        }
        if (isNonEmptyString(article.wechat.biz) && isNonEmptyString(article.wechat.mid) && isNonEmptyString(article.wechat.idx)) {
          const expected = `wx:${article.wechat.biz.replace(/=+$/, '')}:${article.wechat.mid}:${article.wechat.idx}`;
          if (article.id !== expected) err(`${where}.id 应为 ${expected}（由 wechat.biz + mid + idx 生成）`);
        }
      }
    }
    if (article.ticktick_task_id !== undefined && !isNonEmptyString(article.ticktick_task_id)) {
      err(`${where}.ticktick_task_id 要填就填非空字符串，没有就省略这个字段`);
    }
  });

  return errors;
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function raw(value) {
  return String(value).replace(/<\/(script)/gi, '<\\/$1');
}

function chineseDate(iso) {
  const [, month, day] = iso.split('-').map(Number);
  return `${month} 月 ${day} 日`;
}

function rangeProse(min, max) {
  const [y1, m1, d1] = min.split('-').map(Number);
  const [y2, m2, d2] = max.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${m1} 月 ${d1} 日至 ${d2} 日`;
  if (y1 === y2) return `${m1} 月 ${d1} 日至 ${m2} 月 ${d2} 日`;
  return `${y1} 年 ${m1} 月 ${d1} 日至 ${y2} 年 ${m2} 月 ${d2} 日`;
}

function slashDate(iso) {
  return iso.slice(5).replace('-', '/');
}

function rangeChip(min, max) {
  if (min.slice(0, 4) === max.slice(0, 4)) return `${slashDate(min)}–${slashDate(max)}`;
  return `${min.replace(/-/g, '/')}–${max.replace(/-/g, '/')}`;
}

function sourceLine(article) {
  const source = article.source || {};
  const account = source.account || '';
  const published = source.published ? source.published.slice(5) : '';
  if (account && published) return `${account} · ${published}`;
  return account || published;
}

function renderCard(article, category) {
  const points = article.points_html || [];
  const notes = article.notes_html || [];
  const linkText = article.status === 'fetch_failed' ? '尝试打开原文 ↗' : '直达原文 ↗';
  const taskAttr = article.ticktick_task_id ? ` data-task="${esc(article.ticktick_task_id)}"` : '';
  const pointsHtml = points.length
    ? `\n      <ul class="points">\n${points.map((point) => `        <li>${raw(point)}</li>`).join('\n')}\n      </ul>`
    : '';
  const notesHtml = notes.map((note) => `\n      <div class="note">${raw(note)}</div>`).join('');
  const detail = article.detail
    ? `\n      <details class="deep"><summary>${esc(article.detail.summary)}</summary>\n        <div class="deep-body">\n${raw(article.detail.body_html)}\n        </div>\n      </details>`
    : '';
  return `    <article class="card" data-id="${esc(article.id)}" data-cat="${esc(category.id)}" style="--c:var(--${category.id})" data-k="${esc(article.keywords || '')}"${taskAttr}>
      <div class="card-top"><span class="badge">${esc(category.badge)}</span><span class="src">${esc(sourceLine(article))}</span></div>
      <h3>${esc(article.title)}</h3>
      <p class="tldr"><b>${esc(article.summary_label)}：</b>${raw(article.summary_html)}</p>${pointsHtml}${notesHtml}${detail}
      <div class="card-foot"><a class="btn" href="${esc(article.url)}" target="_blank">${linkText}</a><span class="when">采集 ${esc(article.added.slice(5))}</span></div>
    </article>`;
}

function renderPage(doc) {
  const { site, categories, articles } = doc;
  const byId = new Map(categories.map((category) => [category.id, category]));
  const dates = [...new Set(articles.map((article) => article.added))].sort().reverse();
  const minDate = dates[dates.length - 1];
  const maxDate = dates[0];
  const usedCategoryCount = categories.filter((category) => articles.some((article) => article.category === category.id)).length;
  const detailCount = articles.filter((article) => article.detail).length;
  const failed = articles.filter((article) => article.status === 'fetch_failed');
  const newest = articles.filter((article) => article.added === maxDate);
  const newestTitles = newest.map((article) => esc(article.title)).join('、');
  const failedTitles = failed.map((article) => esc(article.title)).join('、');

  const sub = `这里是完整阅读归档，共 ${articles.length} 条，采集于 ${rangeProse(minDate, maxDate)}，按日期分成 ${dates.length} 批。每条都提炼了摘要与要点，硬核文章附深入讲解，想读原文一键直达。`;
  let howto = `<b>用法：</b>按采集日期从新到旧往下读，也可以用分类或搜索缩小范围。标着 <b>深入讲解</b> 的可以展开。最近一批（${esc(chineseDate(maxDate))}，${newest.length} 条）：${newestTitles}。`;
  if (failed.length) {
    howto += `另有 ${failed.length} 条正文抓取失败，只收录了标题：${failedTitles}。`;
  }

  const filters = categories.map((category) => `      <button class="fbtn" data-f="${esc(category.id)}">${esc(category.filter_label)}</button>`).join('\n');
  const batches = dates.map((date) => {
    const inBatch = articles.filter((article) => article.added === date);
    const sections = categories.map((category) => {
      const cards = inBatch.filter((article) => article.category === category.id);
      if (!cards.length) return '';
      const grid = cards.length <= 3 ? 'grid solo' : 'grid';
      return `    <section data-sec="${esc(category.id)}">
      <div class="sec-head"><span class="sec-no">${esc(category.numeral)}</span><h2>${esc(category.title)}</h2><span class="cnt">${cards.length} 条</span></div>
      <div class="${grid}">
${cards.map((article) => renderCard(article, byId.get(article.category))).join('\n\n')}
      </div>
    </section>`;
    }).filter(Boolean).join('\n\n');
    return `  <div class="batch" data-batch="${esc(date)}">
    <div class="batch-head"><h2>${esc(chineseDate(date))}</h2><span class="year">${esc(date.slice(0, 4))}</span><span class="cnt">${inBatch.length} 条</span></div>
${sections}
  </div>`;
  }).join('\n\n');

  const notes = Array.isArray(site.archive_notes) ? site.archive_notes : [];
  const notesHtml = notes.length
    ? `\n    <br>归档时记下的后续事项：${notes.map((note, index) => `${CIRCLED[index] || `${index + 1}.`} ${esc(note)}`).join(' ')}`
    : '';

  const [examYear, examMonth, examDay] = site.exam.date.split('-').map(Number);
  const css = fs.readFileSync(path.join(__dirname, 'page.css'), 'utf8').trim();
  const colorVars = categories.map((category) => `--${category.id}:${category.color};`).join('');
  const client = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8')
    .replace(/__EXAM_Y__/g, String(examYear))
    .replace(/__EXAM_M__/g, String(examMonth - 1))
    .replace(/__EXAM_D__/g, String(examDay));

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="${esc(site.robots)}">
<meta name="referrer" content="no-referrer">
<title>${esc(site.title)}</title>
<style>
${css}
:root{${colorVars}}
</style>
</head>
<body>
<div id="progress"></div>
<!-- Generated from data/articles.json by scripts/build.js. Edit the data, then rebuild. -->

<header class="hero">
  <div class="hero-in">
    <div class="seal">${esc(site.seal)}</div>
    <div class="kicker">${esc(site.kicker)}</div>
    <h1>${raw(site.headline_html)}</h1>
    <p class="sub">${esc(sub)}</p>
    <div class="stats">
      <span class="chip"><b>${articles.length}</b>条收藏</span>
      <span class="chip"><b>${usedCategoryCount}</b>大板块</span>
      <span class="chip"><b>${rangeChip(minDate, maxDate)}</b>采集</span>
      <span class="chip"><b>${detailCount}</b>篇含深入讲解</span>
      <span class="chip hot" id="countdown"><b>--</b>天距离 ${esc(site.exam.label)}</span>
    </div>
    <div class="howto">${howto}</div>
  </div>
</header>

<nav class="bar">
  <div class="bar-in">
    <span class="brand">收藏即所学</span>
    <div class="filters" id="filters">
      <button class="fbtn on" data-f="all">全部</button>
${filters}
    </div>
    <input id="q" type="search" placeholder="搜索关键词…" aria-label="搜索关键词">
  </div>
</nav>

<main>
${batches}

<div class="empty" id="empty">没有匹配的内容，换个关键词试试～</div>
</main>

<footer>
  <div class="foot-in">
    <b>关于本页</b>：由 <code>data/articles.json</code> 构建的个人阅读归档，共 ${articles.length} 条，采集于 ${esc(minDate)} 至 ${esc(maxDate)}。摘要与讲解依据原文整理，观点与细节以原文为准。单文件 HTML，可离线打开。
    <br>早期整页由 Mac 上的 didaMind / wxdigest 重写并推送。那条流水线已停用；现在只往数据文件追加条目，再构建这一页。${notesHtml}
  </div>
</footer>

<script>
${client}
</script>
</body>
</html>
`;
}

function firstDiff(built, committed) {
  const builtLines = built.split('\n');
  const committedLines = committed.split('\n');
  const limit = Math.max(builtLines.length, committedLines.length);
  for (let i = 0; i < limit; i++) {
    if (builtLines[i] !== committedLines[i]) {
      return `第 ${i + 1} 行不同\n  构建: ${builtLines[i] ?? '(无)'}\n  文件: ${committedLines[i] ?? '(无)'}`;
    }
  }
  return `行数相同但内容不同（构建 ${built.length} 字符，文件 ${committed.length} 字符）`;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv);
  } catch (error) {
    console.error(error.message);
    usage();
    process.exit(1);
  }
  if (opts.help) {
    usage();
    return;
  }

  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(opts.data, 'utf8'));
  } catch (error) {
    console.error(`无法读取数据文件 ${opts.data}: ${error.message}`);
    process.exit(1);
  }

  const errors = validate(doc);
  if (errors.length) {
    console.error(`数据校验失败（${errors.length}）:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const html = renderPage(doc);
  const detailCount = doc.articles.filter((article) => article.detail).length;
  const failedCount = doc.articles.filter((article) => article.status === 'fetch_failed').length;
  const summary = `${doc.articles.length} 条，${detailCount} 条含深入讲解，${failedCount} 条抓取失败`;

  if (opts.check) {
    const target = path.join(ROOT, 'index.html');
    let current;
    try {
      current = fs.readFileSync(target, 'utf8');
    } catch (error) {
      console.error(`无法读取 ${target}: ${error.message}`);
      process.exit(1);
    }
    if (current !== html) {
      console.error(`index.html 与数据不一致。请运行 node scripts/build.js 后一并提交。\n${firstDiff(html, current)}`);
      process.exit(1);
    }
    console.log(`校验通过，index.html 与数据一致（${summary}）`);
    return;
  }

  const tmp = `${opts.out}.tmp`;
  fs.writeFileSync(tmp, html);
  fs.renameSync(tmp, opts.out);
  console.log(`已写入 ${path.relative(ROOT, opts.out) || opts.out}（${summary}）`);
}

main();
