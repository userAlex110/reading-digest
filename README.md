# 收藏即所学 · 调研与分析阅读面板

线上地址：https://useralex110.github.io/reading-digest/

这是一个个人的调研与分析阅读面板。收藏只是入口，核心是两层分析：每周一篇**专题研究**（`studies`），把相关收藏串成趋势；每条近期收藏带一个**分析层**（`analysis`），包括核心观点、核实过的事实、批判性判断、延伸背景、与读者的关联和下一步。数据写在 [`data/articles.json`](data/articles.json)，[`scripts/build.js`](scripts/build.js) 把它生成**一个**可以离线打开的 `index.html`。GitHub Pages 从 `main` 分支的根目录发布这个文件。

页面不加载任何外部字体、脚本或 CDN（国内可直接打开），字体走系统衬线 / 无衬线栈。页面带 `noindex`，仓库里的 [`robots.txt`](robots.txt) 是 `Disallow: /`。不要去掉这两处。

---

## 旧流水线已停用

以前这页是在 Mac 上由 didaMind / `wxdigest` 维护的：launchd 凌晨拉起无头会话，整页重写 `index.html`，再经 GitHub Contents API 推上去。

那条流水线已经停用。现在在 Linux 上改数据文件、本地构建，然后用 git 推送。不要再整页手改 `index.html`。

---

## 每周流程

每周日由滴答清单「微信采集」标签触发一次，只处理**近 7 天创建、未完成**的条目，老条目不回溯（省 token）：

1. 拉取近 7 天未完成的「微信采集」任务，逐条抓正文。抓不到就 `status: fetch_failed`，不按标题编正文。
2. 每条写基础字段（摘要、要点），再写 `analysis`。读过原文的标 `verified: "original"`，只看到标题的标 `"title_only"`。事实只写查得到的，并注明来源和年份；查不到就写「未核实」。
3. 把本周相关的条目串成一篇 `studies` 专题：找共同趋势、给证据和反驳、写对读者的行动建议，列出全部来源。本周没有能串起来的主题，就不硬写。
4. `node scripts/build.js && node scripts/build.js --check`，开 PR，合并到 `main`。
5. 线上页确认可见后，只把已上线的任务在滴答里标完成。

较早的收藏没有 `analysis`，页面会退回只显示摘要和要点，不需要补。

---

## 加一篇

1. 在 `data/articles.json` 的 `articles` 数组里追加一条（字段见下）。同一天、同一分类里，页面顺序就是数组顺序。
2. 构建：

   ```bash
   node scripts/build.js
   ```

3. 把 `data/articles.json` 和生成的 `index.html` **一起**提交，推到 `main`。

只推数据、不推重新构建的 `index.html`，线上不会变，GitHub Actions 的核对也会失败。

### 必填字段

| 字段 | 说明 |
| --- | --- |
| `id` | 稳定 id，规则见下。全文件唯一 |
| `title` | 标题 |
| `url` | 原文链接，`http` 或 `https`，全文件唯一 |
| `category` | 必须是 `categories` 里已有的 `id` |
| `added` | 采集日期，`YYYY-MM-DD`。页面按这个日期分批，新的在前 |
| `status` | `ok`，或正文没抓到时的 `fetch_failed` |
| `summary_label` | 摘要前的标签。正常写 `一句话`，抓取失败写 `仅标题收录` |
| `summary_html` | 摘要。按 HTML 插入，需要强调就写 `<b>`、`<code>` |

### 选填字段

| 字段 | 说明 |
| --- | --- |
| `source.account` | 公众号、作者或仓库名。卡片上显示在标题上方 |
| `source.published` | 原文发布日期，`YYYY-MM-DD`。卡片上只显示月-日 |
| `points_html` | 要点数组，每项是一段 HTML |
| `notes_html` | 卡片上、深入讲解之外的批注，每项是一段 HTML |
| `detail.summary` | 阅读页里「深入讲解」一节的标题。不再做成折叠条 |
| `detail.body_html` | 深入讲解正文 HTML（小标题用 `<h4>`，表格用 `<table>`） |
| `keywords` | 搜不到正文里的词时，补在这里。搜索框会连同正文一起匹配 |
| `wechat` | 微信文章的 `biz`、`mid`、`idx`，有 `sn` 也写上。`biz` 保留链接里的 `=` |
| `ticktick_task_id` | 有对应的滴答任务 id 再填。页面上不展示，只放在 `data-task` 里。没有就不要写这个字段，也不要写 `null` |
| `analysis` | 分析层，结构见下。有它时卡片显示「观点 + 核实标记 + 可信度」，阅读页按分析结构排版 |

`summary_html`、`points_html`、`notes_html`、`detail.body_html` 会原样插入页面。`title` 这类纯文本字段会被转义。

抓取失败时：`status` 设为 `fetch_failed`，`summary_label` 写 `仅标题收录`，在摘要里写明失败原因，**不要编造正文**。这种条目没有 `detail`，阅读页底部的链接是「尝试打开原文」，其他条目是「直达原文」。

### 分析层 `analysis`

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `verified` | 是 | `original`（读过原文核实）或 `title_only`（仅按标题） |
| `verified_note` | 否 | 依据说明，例如「读了全文并对照 GitHub 仓库」 |
| `thesis_html` | 是 | 一句话核心观点：这篇真正说明了什么、该怎么看 |
| `facts` | 否 | `[{ html, source, year?, url?, corroborated?, also? }]`。只写核实过的事实；`year` 可写 `YYYY`、`YYYY-MM` 或 `YYYY-MM-DD` |
| `facts[].corroborated` | 否（建议每条都写） | `true`：除原文外，已用一手来源（仓库、官方文档、数据手册、登记数据）或第二个独立来源复核，页面显示「已交叉验证」；`false`：只有一个来源，页面显示「单一来源」。转述同一份材料的报道不算独立来源 |
| `facts[].also` | 否 | `[{ source, url? }]`，复核用到的其他来源，页面显示为「另见」。有 `also` 时 `corroborated` 必须是 `true` |
| `critique.credibility` | 是 | `A` / `B` / `C` / `D`，按下面的标准评，标准也写在页面的「怎么读这个面板」里 |
| `critique.credibility_note` | 是 | 为什么给这个评级 |

可信度标准（和 `scripts/build.js` 里的 `CRED_CRITERIA` 一致，改一处要同步另一处）：

- **A**：一手材料（论文、官方数据、源码、标准文档、登记数据），关键数字能独立复核，作者没有明显的利益冲突。
- **B**：一手或可靠来源，关键事实能在仓库、文档里对上；但作者利益相关、实验是自己设计的，或缺第三方复现。
- **C**：营销稿、自荐、广告或平台自报数据；核心说法（好不好用、效果多大）无法独立验证。
- **D**：网传、匿名、来源不明，或与已核实的事实冲突。
| `critique.points_html` | 否 | 弱点、反例、夸大之处 |
| `context_html` | 否 | 读者可能不知道的延伸背景 |
| `relevance` | 否 | `[{ area, html }]`，`area` 是 `robotics`（机器人工程 / 嵌入式）、`kaoyan`（考研 · 成大复试）、`agents`（智能体与产品能力）、`aicoding`（AI 编程工具） |
| `next_html` | 否 | 可以做的下一步 |

```json
"analysis": {
  "verified": "original",
  "verified_note": "读了全文",
  "thesis_html": "一句话观点，可含 <b>强调</b>",
  "facts": [{ "html": "具体数字或事实", "source": "来源名", "year": "2026-10-31", "url": "https://...", "corroborated": true, "also": [{ "source": "独立来源", "url": "https://..." }] }],
  "critique": { "credibility": "B", "credibility_note": "评级理由", "points_html": ["弱点一"] },
  "context_html": ["背景一"],
  "relevance": [{ "area": "kaoyan", "html": "和复试的关系" }],
  "next_html": ["下一步"]
}
```

### 专题 `studies`

顶层 `studies` 数组，每项一篇专题，最新的一篇（按 `published`）放在首页最上面，其余列为「往期专题」。专题阅读页地址是 `#s-{id}`。

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 小写字母、数字、连字符，例如 `2026-w45-agent-orchestration` |
| `title` / `dek_html` | 是 | 标题与导语 |
| `published` | 是 | `YYYY-MM-DD` |
| `kicker` | 否 | 眉题，例如「专题研究 · 第 45 周」 |
| `sections` | 是 | `[{ heading, body_html }]`。每节进入目录并随滚动高亮；正文可用 `<p>`、`<ul>`、`<ol>`、`<table>`、`<blockquote>`、`<h3>`、`<p class="caveat">`（折扣 / 修正判断） |
| `article_ids` | 否 | 串起的收藏 id，必须存在于 `articles` |
| `sources` | 否 | `[{ title, site?, date?, url }]` |

### id 怎么取

1. 链接里有 `__biz`、`mid`、`idx`：`wx:{去掉末尾 = 的 biz}:{mid}:{idx}`。同时填写 `wechat`。构建会核对 id 与这三个字段一致。
2. 只有 `sn`：`wxsn:{sn}`。
3. 其他链接：`url:` 加上该 URL 字符串的 SHA-256 前 20 位十六进制。

```bash
node -e "const c=require('crypto');console.log('url:'+c.createHash('sha256').update(process.argv[1]).digest('hex').slice(0,20))" -- 'https://example.com/post'
```

### 例子

正常一条：

```json
{
  "id": "wx:MzA5Nzk3MDQ4OQ:2649736365:1",
  "title": "文章标题",
  "url": "https://mp.weixin.qq.com/s?__biz=MzA5Nzk3MDQ4OQ==&mid=2649736365&idx=1&sn=替换成真实sn",
  "category": "ai",
  "source": { "account": "公众号名", "published": "2026-10-26" },
  "added": "2026-10-26",
  "status": "ok",
  "summary_label": "一句话",
  "summary_html": "摘要可以含 <b>强调</b>。",
  "points_html": ["<b>要点：</b>一句话说明"],
  "keywords": "额外搜索词",
  "detail": {
    "summary": "深入讲解 · 这一节在讲什么",
    "body_html": "<h4>小节</h4><div>正文。</div>"
  },
  "wechat": {
    "biz": "MzA5Nzk3MDQ4OQ==",
    "mid": "2649736365",
    "idx": "1",
    "sn": "替换成真实sn"
  }
}
```

正文没抓到：

```json
{
  "id": "wx:MzkxMTY4NTAyNQ:2247521014:1",
  "title": "只有标题的文章",
  "url": "https://mp.weixin.qq.com/s?__biz=...&mid=...&idx=1&sn=...",
  "category": "ai",
  "source": { "account": "公众号名", "published": "2026-10-25" },
  "added": "2026-10-25",
  "status": "fetch_failed",
  "summary_label": "仅标题收录",
  "summary_html": "抓取失败的原因。不要根据标题猜正文。",
  "points_html": ["除标题外没有可靠正文，不生成摘要与深入讲解"],
  "wechat": { "biz": "...==", "mid": "...", "idx": "1", "sn": "..." }
}
```

### 分类

八个分类已经在 `categories` 里：`ai`、`emb`、`kaoyan`、`job`、`dev`、`idea`、`hw`、`life`。新增分类就往这个数组加一项，带上 `id`、`numeral`、`title`、`badge`、`filter_label`、`color`（`#rrggbb`）。`id` 要用小写字母开头，因为它会变成 CSS 变量名。筛选按钮从这里来。`color` 仍写在数据里，方便以后使用；页面本身只用墨色和朱砂两色，正文里旧的 `var(--分类)` 也会被收成朱砂，不再按分类铺彩虹。

### 校验失败的情况

构建遇到下面任一情况会直接退出，不写出页面：

- `schema_version` 不是 `2`
- 缺必填字段，或字段类型不对
- `id` 重复，或 `url` 重复
- `category` 不在 `categories` 里
- `status` 不是 `ok` / `fetch_failed`
- 日期不是合法的 `YYYY-MM-DD`
- `detail` 缺 `summary` 或 `body_html`
- 填了 `wechat`，但 `id` 与 `biz` + `mid` + `idx` 对不上
- `analysis` 缺 `verified`、`thesis_html`、`critique`，或枚举值不对
- `facts[].corroborated` 不是布尔值，或写了 `also` 却没把 `corroborated` 设为 `true`
- `studies` 的 `id` 格式不对或重复，`article_ids` 引用了不存在的文章
- `articles` 为空

多出来的字段不会报错，构建会忽略。以后要加字段，可以先写上。

---

## 本地构建

需要 Node.js 18 或更新版本。没有第三方依赖。

```bash
node scripts/build.js            # 写出 index.html
node scripts/build.js --check    # 只核对，不写文件
npm run build
npm run check
```

用浏览器直接打开 `index.html` 即可。要看筛选和搜索，也可以：

```bash
python3 -m http.server
```

首页最上面是最新专题，下面按**采集日期从新到旧**分批，同一天里再按分类（壹到捌）排成卡片。桌面端平铺，手机端每批是一行，左右滑动一次一张。有分析层的卡片默认显示「观点」、核实标记和可信度，点开进入完整分析；旧条目照旧显示摘要。手机端（≤860px）首屏压缩了刊头：隐藏副标题、印章和次要统计，只留专题数、分析数和倒计时，筛选栏改成单行横滑，专题块不显示小节目录，保证 390×844 下专题标题、导语和「读专题」按钮不用滚动就能看到。阅读视图（地址栏带 `#`）有目录，滚动时高亮当前小节，页顶有阅读进度，首段首字下沉。不要再做卡片内的上下展开。分类筛选、搜索、距 27 考研初试的倒计时都还在。倒计时的日期是 `site.exam`。

取舍和参照写在 [`design/README.md`](design/README.md)。对照用的三套原型留在 [PR #2](https://github.com/userAlex110/reading-digest/pull/2)。线上页是「专题 + 卡片目录 + 阅读视图」，不是原型里在格子内展开讲解的那一版。

---

## 部署

当前 Pages 来源是**从分支部署**：`main` 的根目录（`build_type: legacy`）。所以发布方式就是把构建好的 `index.html` 提交进仓库。推到 `main` 之后，现有的 Pages 会照常更新。

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) 在推送到 `main` 时运行，也可以在 Actions 页手动触发。它会重新构建，并确认提交里的 `index.html` 和数据一致，同时确认 `robots.txt` 与 `noindex` 还在。不一致就让这次检查失败。失败不会改线上的文件，站点仍是上一次成功提交的那一页。

### 为什么不用 actions/deploy-pages

`actions/deploy-pages` 要先在仓库 **Settings → Pages → Build and deployment** 里把 Source 改成 **GitHub Actions**，否则它的产物不会变成线上页面。在改完之前如果又不再提交 `index.html`，线上会停在旧版本；来源切换和 workflow 如果没对上，站点还可能短暂空白。

这次不改那个开关，发布路径和现在一样。**你不需要做任何 Pages 设置。**

以后如果真想换成 Actions 部署：先确认 workflow 能成功上传页面产物，再把 Pages 来源改成 GitHub Actions，然后才可以不再把 `index.html` 当发布物提交。在那之前保持现状。
