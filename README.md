# ahy-files

ahy 框架的前端模板仓：Vue 3 组件与页面模板，发 `.vue` 源码不预编译，由使用方的打包器编译。第一个模板是文件管理，界面仿 Windows 资源管理器。

## 一句话

任何后台引进框架就有一套文件管理，不用各写各的；后端接口在 `ahy-storage`，前端在这里。

## 文件管理（第一期）

照设计稿 v3 做的，和 Windows 资源管理器同一套交互：

- **导航**：地址栏面包屑、后退、前进、上一级、刷新，左侧「快速访问」目录树展开到当前所在的位置。
- **六种视图**：大图标、中图标、小图标、列表、详细信息（默认）、平铺；排序点列头或命令栏的「排序」。
- **选择**：单击、Ctrl 加选、Shift 连选、空白处拖动框选、Ctrl+A 全选；状态栏显示选了几项、多大。
- **浏览**：当前目录内搜索；大目录分页加载（「加载更多」）。
- **图片缩略图**：对象存储实时生成，按显示宽度的两倍取图；取不到退回图片图标。点开预览可左右切换，另给「下载原图」。
- **上传**：按钮或把文件、整个文件夹拖进窗口，保留目录结构；右下角浮层显示每个文件和总进度，可收起、取消；同名自动变成「名字 (1)」。
- **新建与改名**：新建文件夹、重命名都在列表里就地改，不弹框；名字不合规当场提示。
- **剪切、复制、粘贴**，以及「移动到」「复制到」的选目录框；同一个目录里复制出来的叫「名字 - 副本」。
- **删除**：单个、多选、整个文件夹，先确认；第一期不进回收站。
- **下载与复制链接**。
- **右键菜单与快捷键**：Delete、F2、Ctrl+C / X / V、Ctrl+A、F5、Backspace、Enter。
- **权限**：没权限的命令置灰，悬停能看到原因；只读目录在地址栏标着「只读」。

图标全部是微软 Fluent（MIT）。

## 依赖

| 依赖 | 版本 | 谁装 |
|------|------|------|
| vue | ^3.5 | 使用方装 |
| element-plus | >=2.13 | 使用方装。包里只用到了 `ElDialog`、`ElMessage` 两个组件，连同它们的样式一起显式引入；取色全用 Element Plus 的 CSS 变量，明暗主题跟着使用方走 |

## 怎么引进

各后台在 `package.json` 里写 git 地址，npm 直接从 git 装。**锁到完整 commit sha，不要写 tag 名**——
tag 可以移动，写 tag 会让同一份 lock 在不同时间装出不同代码；写 commit 才能复现。仓是公开的，匿名 https 就能拉：

```json
"@aohoyo/ahy-files": "git+https://github.com/aohoyo/ahy-files.git#<commit-sha>"
```

使用方不用为本包改任何构建配置。两种构建：

- **Vite + Element Plus 按需自动引入**（`unplugin-vue-components`，aohoyo 后台的做法）：已核实，生产构建和开发模式都跑通，不加 `optimizeDeps` 配置，加了排除也一样。
- **rspack + vue-loader + Element Plus 全量注册**（lanta 后台的做法）：已核实，`npm ci` 装通、生产构建零错。
  注意包内 `.js` 的相对导入不带扩展名，所以包的 `package.json` **不能**写 `"type": "module"`
  （写了 rspack 会按严格 ESM 解析，`../logic/sort` 这种导入直接报模块找不到）。

两条使用方要知道的事：

- **本包只从 `element-plus/es` 引 Element Plus，不从裸的 `element-plus` 引。** 按需自动引入的项目里，页面自己的导入被插件改写到 `element-plus/es` 并预构建；裸的 `element-plus` 入口没人预构建，从它引会让开发模式下整页起不来（2026-11-25 实测：报 `dayjs/dayjs.min.js does not provide an export named 'default'`）。有守门测试盯着，见 `test/isolation.test.js`。
- **本地联调请用 `npm pack` 打出来的压缩包，别写目录路径。** 写目录路径 npm 会做一个链接，本包自己的开发依赖（另一份 Vue、另一份 Element Plus）会被一并带进使用方，出现两套运行时。

## 怎么用

```vue
<script setup>
import { FileManager, createStorageApi } from "@aohoyo/ahy-files";
import request from "@/utils/request";

// silent：文件管理器自己弹提示，请求层别再弹一遍
const api = createStorageApi({
  request: ({ method, url, query, body }) => request({ url, method, params: query, data: body, silent: true }),
});
const can = (action) => ({ upload: hasPerm("files:update"), delete: hasPerm("files:delete") })[action] ?? true;
</script>

<template>
  <FileManager :api="api" :can="can" />
</template>
```

组件收什么：

| 入参 | 干什么 |
|------|--------|
| `api` | 必填。适配器，方法见下表 |
| `writableRoots` | 哪些目录能写，默认只有 `files/`；其余目录只读浏览 |
| `can` | 权限回调 `can(action)`，action 是 `upload` `create` `rename` `move` `copy` `delete` `download` 之一；不传就都行。没权限的命令置灰 |
| `accept`、`maxSize` | 允许的后缀（数组）和单文件上限（字节）；不传按后端随列目录返回的来 |

组件要填满父容器的高度：父容器得是定高的纵向弹性盒（演示页的 `.card` 就是这么写的）。

## 适配器

组件不直接调任何后端接口，只认下面这些方法。接 `ahy-storage` 的直接用 `createStorageApi`；别的后端自己实现一份，约定三条：出错 reject 且 `message` 是给使用者看的话，提示由组件统一弹；根目录是空串、目录以 `/` 结尾；条目的 `mtime` 是 unix 秒。

| 方法 | 入参 | 返回 |
|------|------|------|
| `list` | `prefix`、`marker`、`fresh` | `{ prefix, entries, marker, downloadBase, limits }`；`fresh` 为真时跳过后端缓存回源 |
| `uploadTicket` | `name`、`key` | `{ token, key, uploadUrl }` 直传凭证 |
| `upload` | 可选。`key`、`file`、`onProgress`、`signal` | 给了就用它传文件（本地存储、演示页用）；不给时组件拿凭证按七牛表单直传 |
| `createFolder` | `prefix`、`name` | |
| `rename` | `key`、`to` | 完整的新对象名 |
| `move`、`copy` | `items`（`{ key, name? }`）、`toDir` | 每项实际落下的 `{ from, to }`；重名由后端加「 (n)」 |
| `remove` | `keys` | 目录传带尾斜杠的目录名，连同内容一起删 |
| `downloadUrl` | `key` | 下载地址；`linkUrl` 可选，是复制链接用的直链 |
| `thumbUrl` | `key`、`width` | 图片缩略图地址；回字符串或回 Promise 都行 |

## 配套后端接口

在 `ahy-storage`，前缀 `/v1/storage/admin`，都走 ahy 的响应信封：

| 方法 | 路径 | 干什么 |
|------|------|--------|
| GET | /list | 列目录：`prefix`、`marker`、`fresh=1` |
| GET | /stat | 看单个对象：`key` |
| POST | /mkdir | 建目录 |
| POST | /rename | 改名 |
| POST | /move、/copy | 移动、复制 |
| POST | /delete | 批量删除 |

写规矩（哪些目录能写、保护名单、接口对应哪个权限码）在 `ahy-storage` 的配置 `module.storage.manage` 里。

## 已知限制

- 一次移动、复制、删除最多 500 项，组件会自动分批；一个文件夹里的对象超过 1000 个时后端会回「文件夹太大」，第一期不做后台任务。
- 搜索只搜当前目录里已经加载的内容；搜索时如果还有没加载的页，先点「加载更多」。
- 拖入文件夹靠浏览器的目录条目接口，Chrome、Edge 支持；Firefox 旧版本只收得到文件、收不到目录结构。
- 上传没有断点续传和暂停（第二期）。
- 文件夹的改名、移动、复制、删除是一次同步请求，期间盖着「正在处理」，没有百分比进度。

## 开发

```bash
npm install
npm run dev      # 演示页 http://127.0.0.1:5183 ，接假数据，不开后端
npm test         # vitest
npm run icons    # 改了 scripts/gen-icons.mjs 的图标表之后重新生成
```
