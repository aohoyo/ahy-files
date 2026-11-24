# ahy-web

ahy 框架的前端模板仓：Vue 3 组件与页面模板，发 `.vue` 源码不预编译，由使用方的打包器编译。第一个模板是文件管理，界面仿 Windows 资源管理器。

## 一句话

任何后台引进框架就有一套文件管理，不用各写各的；后端接口在 `ahy-storage`，前端在这里。

## 当前状态

骨架已立：适配器约定、纯逻辑（路径、命名、排序、格式化）和测试都在；文件管理器的界面按批次补齐，见 `CHANGELOG.md`。

## 依赖

| 依赖 | 版本 | 谁装 |
|------|------|------|
| vue | ^3.5 | 使用方装 |
| element-plus | >=2.13 | 使用方装；用到的 `ElDialog`、`ElMessage` 在包里显式引入 |

## 怎么引进

各后台在 `package.json` 里写 git 地址加版本号，npm 直接从 git 装：

```json
"@aohoyo/ahy-web": "git+ssh://git@github.com/aohoyo/ahy-web.git#v0.1.0"
```

目标是在两种构建下都不用改使用方的配置（rspack + vue-loader 的 lanta 后台、Vite 的 aohoyo 后台）：

- rspack + vue-loader：`.vue` 规则不排除依赖包就行。
- Vite：依赖包里有 `.vue` 源码，要把它排除出依赖预构建，否则 esbuild 扫描时报错：

  ```js
  optimizeDeps: { exclude: ["@aohoyo/ahy-web"] }
  ```

## 怎么用

```vue
<script setup>
import { FileManager, createStorageApi } from "@aohoyo/ahy-web";
import request from "@/utils/request";

// 第三个参数是 silent：文件管理器自己弹提示，请求层别再弹一遍
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
| `upload` | 可选。`key`、`file`、`onProgress`、`signal` | 给了就用它传文件；不给时组件拿凭证按七牛表单直传 |
| `createFolder` | `prefix`、`name` | |
| `rename` | `key`、`to` | 完整的新对象名 |
| `move`、`copy` | `items`（`{ key, name? }`）、`toDir` | 每项实际落下的 `{ from, to }`；重名由后端加「 (n)」 |
| `remove` | `keys` | 目录传带尾斜杠的目录名，连同内容一起删 |
| `downloadUrl` | `key` | 下载地址；`linkUrl` 可选，是复制链接用的直链 |
| `thumbUrl` | `key`、`width` | 图片缩略图地址 |

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

## 开发

```bash
npm install
npm run dev      # 演示页 http://127.0.0.1:5183 ，接假数据，不开后端
npm test         # vitest
npm run icons    # 改了 scripts/gen-icons.mjs 的图标表之后重新生成
```
