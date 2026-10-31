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

function yearCn(iso) {
  const digits = '〇一二三四五六七八九';
  return iso.slice(0, 4).replace(/\d/g, (digit) => digits[digit]);
}

function dateLine(article) {
  const published = article.source && article.source.published ? article.source.published.slice(5) : '';
  const added = article.added.slice(5);
  if (published && published !== added) return `刊 ${published} · 采集 ${added}`;
  return published || added;
}

function extraHtml(article) {
  const parts = [];
  if (article.detail && article.detail.summary) parts.push(`<p class="dk">${esc(article.detail.summary)}</p>`);
  const points = article.points_html || [];
  if (points.length) parts.push(`<ol class="points">${points.map((point) => `<li>${raw(point)}</li>`).join('')}</ol>`);
  if (article.detail && article.detail.body_html) parts.push(`<div class="body">${raw(article.detail.body_html)}</div>`);
  for (const note of article.notes_html || []) parts.push(`<p class="note">${raw(note)}</p>`);
  return parts.join('');
}

function renderCard(article, category, index) {
  const failed = article.status === 'fetch_failed';
  const taskAttr = article.ticktick_task_id ? ` data-task="${esc(article.ticktick_task_id)}"` : '';
  const account = article.source && article.source.account ? article.source.account : '';
  const when = article.source && article.source.published ? article.source.published : article.added;
  const extra = extraHtml(article);
  const more = extra
    ? `<div class="more" id="more-${index}" hidden>${extra}</div>`
    : '';
  const expand = extra
    ? `<button type="button" class="expand" aria-expanded="false" aria-controls="more-${index}">展开讲解</button>`
    : '';
  return `    <article class="card${failed ? ' is-failed' : ''}" data-id="${esc(article.id)}" data-cat="${esc(category.id)}" data-added="${esc(article.added)}" data-i="${index}" data-k="${esc(article.keywords || '')}"${taskAttr}>
      <div class="scroll">
        <div class="meta"><span class="cat">${esc(category.badge)}</span><span class="sep" aria-hidden="true">·</span><time datetime="${esc(when)}">${esc(dateLine(article))}</time>${failed ? '<span class="stamp">未录入</span>' : ''}</div>
        <h3 class="title">${esc(article.title)}</h3>
        <p class="source">${esc(account)}</p>
        <p class="label">${esc(article.summary_label)}</p>
        <div class="lead">${raw(article.summary_html)}</div>
        ${more}
      </div>
      <div class="actions">${expand}<a href="${esc(article.url)}" target="_blank" rel="noopener noreferrer">${failed ? '尝试打开原文' : '阅读原文'}</a></div>
    </article>`;
}

function orderedItems(doc) {
  const order = new Map(doc.categories.map((category, index) => [category.id, index]));
  return doc.articles.map((article, index) => ({ article, index })).sort((a, b) => {
    if (a.article.added !== b.article.added) return a.article.added < b.article.added ? 1 : -1;
    const diff = order.get(a.article.category) - order.get(b.article.category);
    if (diff) return diff;
    return a.index - b.index;
  });
}

function filterButtons(categories) {
  const all = `        <button type="button" class="chip" data-filter="all" aria-pressed="true">全部</button>`;
  const rest = categories.map((category) => `        <button type="button" class="chip" data-filter="${esc(category.id)}" data-title="${esc(category.title)}" data-numeral="${esc(category.numeral)}" data-badge="${esc(category.badge)}" aria-pressed="false">${esc(category.filter_label)}</button>`).join('\n');
  return `${all}\n${rest}`;
}

function arrangeButtons() {
  return `        <div class="seg" role="group" aria-label="排列方式">
          <button type="button" data-arrange="time" aria-pressed="true">按时间</button>
          <button type="button" data-arrange="tag" aria-pressed="false">按分类</button>
        </div>`;
}

function renderPage(doc) {
  const { site, categories, articles } = doc;
  const byId = new Map(categories.map((category) => [category.id, category]));
  const items = orderedItems(doc);
  const groups = [];
  for (const item of items) {
    const key = item.article.added;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  const dates = groups.map((group) => group.key);
  const minDate = dates[dates.length - 1];
  const maxDate = dates[0];
  const chapters = groups.map((group) => `    <section class="group" id="grp-${esc(group.key)}" data-key="${esc(group.key)}">
      <header class="ghead"><span class="year">${esc(yearCn(group.key))}</span><h2>${esc(chineseDate(group.key))}</h2><span class="gcount">${group.items.length} 篇</span></header>
      <div class="grid">
${group.items.map(({ article, index }) => renderCard(article, byId.get(article.category), index)).join('\n')}
      </div>
    </section>`).join('\n');
  const indexLinks = groups.map((group) => `          <a href="#grp-${esc(group.key)}"><span>${esc(chineseDate(group.key))}</span><small>${group.items.length}</small></a>`).join('\n');
  const notes = Array.isArray(site.archive_notes) ? site.archive_notes : [];
  const notesHtml = notes.length
    ? `<br>归档时记下的后续事项：${notes.map((note, index) => `${CIRCLED[index] || `${index + 1}.`} ${esc(note)}`).join(' ')}`
    : '';
  const [examYear, examMonth, examDay] = site.exam.date.split('-').map(Number);
  const catVars = doc.categories.map((category) => `  --${category.id}: var(--accent);`).join('\n');
  const css = fs.readFileSync(path.join(__dirname, 'page.css'), 'utf8')
    .replace('/* __CAT_VARS__ */', catVars)
    .trim();
  const client = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8')
    .replace(/__EXAM_Y__/g, String(examYear))
    .replace(/__EXAM_M__/g, String(examMonth - 1))
    .replace(/__EXAM_D__/g, String(examDay));
  const brand = site.title.split('·')[0].trim();
  const filters = filterButtons(categories);
  const arrange = arrangeButtons();

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
</style>
</head>
<body>
<a class="skip" href="#chapters">跳到正文</a>
<div id="desk-prog" class="prog" role="progressbar" aria-label="阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
<div id="mob-prog" class="prog" role="progressbar" aria-label="翻页进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
<!-- Generated from data/articles.json by scripts/build.js. Edit the data, then rebuild. -->

<header class="top">
  <div class="brand">
    <p class="eyebrow">${esc(site.kicker)}</p>
    <h1>${raw(site.headline_html)}</h1>
    <p class="exam" id="countdown">距 ${esc(site.exam.label)} <b>--</b> 天</p>
  </div>
  <div class="tools">
${arrange}
    <input id="q" class="search" type="search" placeholder="检索篇目" aria-label="检索篇目" autocomplete="off">
  </div>
  <div class="filters" id="filters" role="group" aria-label="分类">
${filters}
  </div>
  <p class="countline" id="countline">${articles.length} 篇 · 按时间</p>
</header>

<div class="desk-body">
  <aside class="sidebar">
    <p class="side-label">章节</p>
    <nav id="side-index" aria-label="章节">
${indexLinks}
    </nav>
  </aside>
  <main id="chapters">
${chapters}
    <p id="empty-desk" class="empty" hidden>这一叠里没有相符的篇目。</p>
  </main>
</div>

<footer class="site-foot">
  <div class="foot-in">
    <b>关于本页</b>：由 <code>data/articles.json</code> 构建的个人阅读归档，共 ${articles.length} 篇，采集于 ${esc(minDate)} 至 ${esc(maxDate)}。手机一次读一篇，桌面按时间或分类分章。摘要与讲解依据原文整理，观点与细节以原文为准。标着「未录入」的是正文没抓到的篇目。单文件 HTML，可离线打开。
    <br>早期整页由 Mac 上的 didaMind / wxdigest 重写并推送。那条流水线已停用；现在只往数据文件追加条目，再构建这一页。${notesHtml}
  </div>
</footer>

<div id="mob">
  <header class="mhead">
    <div class="who"><p class="eyebrow">册页</p><p>${esc(brand)}</p></div>
    <button type="button" id="open-search">检索</button>
    <button type="button" id="open-catalog">目录</button>
  </header>
  <div id="pager" tabindex="0" aria-label="文章卡片"></div>
  <p id="empty-mob" class="empty" hidden>这一叠里没有相符的篇目。</p>
  <footer class="mfoot">
    <button type="button" id="prev">上一张</button>
    <button type="button" id="pos" aria-live="polite">1 / 1</button>
    <button type="button" id="next">下一张</button>
  </footer>
  <div id="catalog" role="dialog" aria-modal="true" aria-labelledby="catalog-title" hidden>
    <div class="cat-bar"><button type="button" id="close-catalog">回到这张</button><h2 id="catalog-title">目录</h2></div>
    <div class="tools">
${arrange}
      <input id="q-m" class="search" type="search" placeholder="检索篇目" aria-label="检索篇目" autocomplete="off">
    </div>
    <div class="filters" id="filters-m" role="group" aria-label="分类">
${filters}
    </div>
    <div id="cat-list"></div>
  </div>
</div>
<div id="bin" hidden></div>

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
