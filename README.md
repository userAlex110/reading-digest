# 收藏即所学 · 阅读归档

线上地址：https://useralex110.github.io/reading-digest/

这是一份个人阅读摘要。文章写在 [`data/articles.json`](data/articles.json)，[`scripts/build.js`](scripts/build.js) 把它生成**一个**可以离线打开的 `index.html`。GitHub Pages 从 `main` 分支的根目录发布这个文件。

页面带 `noindex`，仓库里的 [`robots.txt`](robots.txt) 是 `Disallow: /`。不要去掉这两处。

---

## 旧流水线已停用

以前这页是在 Mac 上由 didaMind / `wxdigest` 维护的：launchd 凌晨拉起无头会话，整页重写 `index.html`，再经 GitHub Contents API 推上去。

那条流水线已经停用。现在在 Linux 上改数据文件、本地构建，然后用 git 推送。不要再整页手改 `index.html`。

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
| `detail.summary` | 「深入讲解」折叠条上的标题 |
| `detail.body_html` | 深入讲解正文 HTML（小标题用 `<h4>`，表格用 `<table>`） |
| `keywords` | 搜不到正文里的词时，补在这里。搜索框会连同正文一起匹配 |
| `wechat` | 微信文章的 `biz`、`mid`、`idx`，有 `sn` 也写上。`biz` 保留链接里的 `=` |
| `ticktick_task_id` | 有对应的滴答任务 id 再填。页面上不展示，只放在 `data-task` 里。没有就不要写这个字段，也不要写 `null` |

`summary_html`、`points_html`、`notes_html`、`detail.body_html` 会原样插入页面。`title` 这类纯文本字段会被转义。正文里如果写了 `color:var(--分类id)`，构建会把每个分类 id 定义成朱砂，链接仍是同一种颜色。

抓取失败时：`status` 设为 `fetch_failed`，`summary_label` 写 `仅标题收录`，在摘要里写明失败原因，**不要编造正文**。这种卡片是虚线边、斜印「未录入」，标题用意大利体，没有首字下沉，链接写成「尝试打开原文」。其余条目的链接是「阅读原文」。

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

八个分类已经在 `categories` 里：`ai`、`emb`、`kaoyan`、`job`、`dev`、`idea`、`hw`、`life`。新增分类就往这个数组加一项，带上 `id`、`numeral`、`title`、`badge`、`filter_label`、`color`（`#rrggbb`）。`id` 仍须小写字母开头，后接小写字母、数字或连字符。`color` 仍要通过校验，页面本身只用墨色和朱砂，不再按分类上色。筛选按钮的文字来自 `filter_label`。

### 校验失败的情况

构建遇到下面任一情况会直接退出，不写出页面：

- `schema_version` 不是 `1`
- 缺必填字段，或字段类型不对
- `id` 重复，或 `url` 重复
- `category` 不在 `categories` 里
- `status` 不是 `ok` / `fetch_failed`
- 日期不是合法的 `YYYY-MM-DD`
- `detail` 缺 `summary` 或 `body_html`
- 填了 `wechat`，但 `id` 与 `biz` + `mid` + `idx` 对不上
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

页面是一本册页，同一批文章在手机和桌面上共用。窄于 800 像素时一次一张：左右滑动或方向键翻页，底部有上一张、第几张、下一张。点「第几张」或「目录」打开目录，可按时间或分类跳到任意一篇；正文在卡片内部滚动。宽于 800 像素时按章排成三列。默认按采集日期从新到旧，同一天里再按分类（壹到捌）；「按分类」改成按类目分章。左边是章目录（窄于 1100 像素时改到正文上方横排）。讲解在卡片里展开，旁边的卡片保持原来的高度。筛选、搜索、阅读进度和距 27 考研初试的倒计时都还在。倒计时的日期是 `site.exam`。

搜索匹配标题、来源、摘要、要点、批注、深入讲解和 `keywords`。篇目到几百时，筛选只改卡片的显隐，换排列方式是把已有节点移进新的章，不重画整页。

取舍和参照写在 [`design/README.md`](design/README.md)。对照用的三套原型留在 [PR #2](https://github.com/userAlex110/reading-digest/pull/2)。

---

## 部署

当前 Pages 来源是**从分支部署**：`main` 的根目录（`build_type: legacy`）。所以发布方式就是把构建好的 `index.html` 提交进仓库。推到 `main` 之后，现有的 Pages 会照常更新。

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) 在推送到 `main` 时运行，也可以在 Actions 页手动触发。它会重新构建，并确认提交里的 `index.html` 和数据一致，同时确认 `robots.txt` 与 `noindex` 还在。不一致就让这次检查失败。失败不会改线上的文件，站点仍是上一次成功提交的那一页。

### 为什么不用 actions/deploy-pages

`actions/deploy-pages` 要先在仓库 **Settings → Pages → Build and deployment** 里把 Source 改成 **GitHub Actions**，否则它的产物不会变成线上页面。在改完之前如果又不再提交 `index.html`，线上会停在旧版本；来源切换和 workflow 如果没对上，站点还可能短暂空白。

这次不改那个开关，发布路径和现在一样。**你不需要做任何 Pages 设置。**

以后如果真想换成 Actions 部署：先确认 workflow 能成功上传页面产物，再把 Pages 来源改成 GitHub Actions，然后才可以不再把 `index.html` 当发布物提交。在那之前保持现状。
