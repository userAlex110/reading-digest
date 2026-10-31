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

function domId(id) {
  return 'e-' + String(id).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function withHeadingIds(html, prefix) {
  const toc = [];
  let n = 0;
  const out = String(html).replace(/<h4(\s[^>]*)?>([\s\S]*?)<\/h4>/gi, (_, _attrs, inner) => {
    const id = `${prefix}-h${n++}`;
    toc.push({ id, text: stripTags(inner) });
    return `<h4 id="${id}" data-spy>${inner}</h4>`;
  });
  return { html: out, toc };
}

function metaLine(article) {
  const bits = [];
  if (article.status === 'fetch_failed') bits.push('仅标题');
  const count = (article.points_html || []).length;
  if (count) bits.push(`${count} 则要点`);
  if (article.detail) bits.push('含讲解');
  return bits.join(' · ') || '收录';
}

function essayEyebrow(article, category) {
  const source = article.source || {};
  const parts = [`${category.numeral} ${category.title}`];
  if (source.account) parts.push(source.account);
  if (source.published) parts.push(`原文 ${source.published.slice(5)}`);
  parts.push(`采集 ${article.added.slice(5)}`);
  return parts.join(' · ');
}

function renderCard(article, category) {
  const id = domId(article.id);
  return `    <a class="card" href="#${esc(id)}" data-id="${esc(article.id)}" data-cat="${esc(category.id)}" data-k="${esc(article.keywords || '')}" aria-labelledby="${esc(id)}-card-title" aria-describedby="${esc(id)}-card-sum">
      <span class="card-rule" aria-hidden="true"></span>
      <span class="card-kicker"><span class="numeral">${esc(category.numeral)}</span><span>${esc(category.badge)}</span><span class="when">${esc(article.added.slice(5))}</span></span>
      <h3 id="${esc(id)}-card-title">${esc(article.title)}</h3>
      <p class="excerpt" id="${esc(id)}-card-sum">${raw(article.summary_html)}</p>
      <span class="card-foot"><span>${esc(metaLine(article))}</span><span class="cue">阅读 <span aria-hidden="true">→</span></span></span>
    </a>`;
}

function renderEssay(article, category) {
  const id = domId(article.id);
  const points = article.points_html || [];
  const notes = article.notes_html || [];
  const linkText = article.status === 'fetch_failed' ? '尝试打开原文' : '直达原文';
  const taskAttr = article.ticktick_task_id ? ` data-task="${esc(article.ticktick_task_id)}"` : '';
  const leadDrop = !article.detail && stripTags(article.summary_html).length >= 70 ? ' drop' : '';
  const toc = [{ id: `${id}-lead`, text: '提要' }];
  if (points.length) toc.push({ id: `${id}-points`, text: '要点' });
  if (notes.length) toc.push({ id: `${id}-notes`, text: '批注' });

  let deepHtml = '';
  if (article.detail) {
    const deepId = `${id}-deep`;
    toc.push({ id: deepId, text: '深入讲解' });
    const headed = withHeadingIds(article.detail.body_html, id);
    headed.html = headed.html.replace(/<table[\s\S]*?<\/table>/gi, (table) => `<div class="table-scroll">${table}</div>`);
    headed.toc.forEach((item) => toc.push(item));
    deepHtml = `
        <section class="deep" id="${esc(deepId)}" data-spy>
          <h2>${esc(article.detail.summary)}</h2>
          <div class="deep-body">
${raw(headed.html)}
          </div>
        </section>`;
  }

  const pointsHtml = points.length
    ? `
        <section class="points" id="${esc(id)}-points" data-spy>
          <h2>要点</h2>
          <ol>
${points.map((point) => `            <li>${raw(point)}</li>`).join('\n')}
          </ol>
        </section>`
    : '';
  const notesHtml = notes.length
    ? `
        <section class="notes" id="${esc(id)}-notes" data-spy>
          <h2>批注</h2>
${notes.map((note) => `          <p>${raw(note)}</p>`).join('\n')}
        </section>`
    : '';
  const tocHtml = toc.map((item) => `            <li><a href="#${esc(item.id)}">${esc(item.text)}</a></li>`).join('\n');

  return `  <article class="essay" id="${esc(id)}" data-id="${esc(article.id)}" data-cat="${esc(category.id)}" tabindex="-1"${taskAttr}>
    <div class="readbar">
      <a class="back" href="#top">← 返回篇目</a>
      <span class="readbar-kicker">${esc(category.badge)}</span>
    </div>
    <div class="essay-sheet">
      <div class="essay-layout">
        <nav class="toc" aria-label="本篇目录">
          <p class="toc-label">目录</p>
          <ol>
${tocHtml}
          </ol>
        </nav>
        <div class="essay-main">
          <p class="eyebrow">${esc(essayEyebrow(article, category))}</p>
          <h1>${esc(article.title)}</h1>
          <p class="lede${leadDrop}" id="${esc(id)}-lead" data-spy><b>${esc(article.summary_label)}：</b>${raw(article.summary_html)}</p>${pointsHtml}${notesHtml}${deepHtml}
          <p class="essay-actions"><a class="textlink" href="${esc(article.url)}" target="_blank" rel="noopener noreferrer">${linkText} <span aria-hidden="true">↗</span></a></p>
        </div>
      </div>
    </div>
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

  const seenDomIds = new Set();
  for (const article of articles) {
    const id = domId(article.id);
    if (seenDomIds.has(id)) throw new Error(`DOM id 冲突：${id}`);
    seenDomIds.add(id);
  }

  const sub = `这里是完整阅读归档，共 ${articles.length} 条，采集于 ${rangeProse(minDate, maxDate)}，按日期分成 ${dates.length} 批。每条都提炼了摘要与要点，硬核文章附深入讲解。点卡片进入阅读页，想读原文一键直达。`;
  let howto = `<b>用法：</b>目录是一排小卡片，点进去读全文，左上角可返回篇目。按采集日期从新到旧排列，也可以用分类或搜索缩小范围。标着「含讲解」的，正文里另有深入讲解。最近一批（${esc(chineseDate(maxDate))}，${newest.length} 条）：${newestTitles}。`;
  if (failed.length) {
    howto += `另有 ${failed.length} 条正文抓取失败，只收录了标题：${failedTitles}。`;
  }

  const filters = categories.map((category) => `      <button class="fbtn" type="button" data-f="${esc(category.id)}" aria-pressed="false">${esc(category.filter_label)}</button>`).join('\n');
  const batches = dates.map((date) => {
    const inBatch = articles.filter((article) => article.added === date);
    const cards = categories.flatMap((category) => inBatch.filter((article) => article.category === category.id));
    return `  <div class="batch" data-batch="${esc(date)}">
    <div class="batch-head"><h2>${esc(chineseDate(date))}</h2><span class="year">${esc(date.slice(0, 4))}</span><span class="cnt">${inBatch.length} 条</span></div>
    <div class="grid">
${cards.map((article) => renderCard(article, byId.get(article.category))).join('\n\n')}
    </div>
  </div>`;
  }).join('\n\n');
  const essays = articles.map((article) => renderEssay(article, byId.get(article.category))).join('\n\n');

  const notes = Array.isArray(site.archive_notes) ? site.archive_notes : [];
  const notesHtml = notes.length
    ? `\n    <br>归档时记下的后续事项：${notes.map((note, index) => `${CIRCLED[index] || `${index + 1}.`} ${esc(note)}`).join(' ')}`
    : '';

  const [examYear, examMonth, examDay] = site.exam.date.split('-').map(Number);
  const css = fs.readFileSync(path.join(__dirname, 'page.css'), 'utf8').trim();
  const colorVars = categories.map((category) => `--${category.id}:var(--seal);`).join('');
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500&family=Noto+Serif+SC:wght@400;600;700&display=swap" rel="stylesheet">
<style>
${css}
:root{${colorVars}}
</style>
</head>
<body>
<div id="progress" role="progressbar" aria-label="阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
<!-- Generated from data/articles.json by scripts/build.js. Edit the data, then rebuild. -->

<div class="library">
${essays}
</div>

<div class="browse" id="top">
<a class="skip" href="#catalog">跳到篇目</a>
<header class="mast">
  <div class="wrap mast-top">
    <div>
      <p class="kicker">${esc(site.kicker)}</p>
      <h1>${raw(site.headline_html)}</h1>
      <p class="sub">${esc(sub)}</p>
    </div>
    <div class="seal" aria-hidden="true">${esc(site.seal)}</div>
  </div>
  <div class="wrap">
    <p class="stats">
      <span><b>${articles.length}</b> 条收藏</span><span class="sep" aria-hidden="true">/</span>
      <span><b>${usedCategoryCount}</b> 大板块</span><span class="sep" aria-hidden="true">/</span>
      <span><b>${rangeChip(minDate, maxDate)}</b> 采集</span><span class="sep" aria-hidden="true">/</span>
      <span><b>${detailCount}</b> 篇含深入讲解</span><span class="sep" aria-hidden="true">/</span>
      <span class="hot" id="countdown"><b>--</b> 天距离 ${esc(site.exam.label)}</span>
    </p>
    <p class="howto">${howto}</p>
  </div>
</header>

<nav class="bar" aria-label="筛选">
  <div class="wrap bar-in">
    <a class="brand" href="#top">收藏即所学</a>
    <div class="filters" id="filters" role="group" aria-label="按分类筛选">
      <button class="fbtn" type="button" data-f="all" aria-pressed="true">全部</button>
${filters}
    </div>
    <input id="q" type="search" placeholder="搜索关键词" aria-label="搜索关键词">
  </div>
</nav>

<main class="catalog wrap" id="catalog">
${batches}

<p class="empty" id="empty" hidden role="status">没有匹配的内容，换个关键词试试～</p>
</main>

<footer class="foot">
  <div class="wrap foot-in">
    <b>关于本页</b>：由 <code>data/articles.json</code> 构建的个人阅读归档，共 ${articles.length} 条，采集于 ${esc(minDate)} 至 ${esc(maxDate)}。摘要与讲解依据原文整理，观点与细节以原文为准。单文件 HTML，可离线打开。
    <br>早期整页由 Mac 上的 didaMind / wxdigest 重写并推送。那条流水线已停用；现在只往数据文件追加条目，再构建这一页。${notesHtml}
  </div>
</footer>
</div>

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
