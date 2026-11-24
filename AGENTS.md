# AGENTS.md — ahy-web 仓库规范

> 规范唯一入口 = 工作区根 `AGENTS.md`；本文件只放本仓库覆盖项。冲突时以本仓库为准。

## 仓库定位

ahy 框架的前端模板仓：Vue 3 组件与页面，发 `.vue` 源码不预编译，由使用方的打包器编译。第一个模板是文件管理（`src/file-manager/`），界面仿 Windows 资源管理器。

## 硬性约定

- **发源码不预编译**：包里只有 `src/`，不产 `dist/`。写法要同时迁就两种打包器（rspack + vue-loader、Vite），不依赖任何打包器专属的语法或配置。
- **三条隔离规矩**（组件能在各后台之间搬的前提）：
  1. 不直接调任何后端接口，只认 `api.js` 里的适配器；
  2. 用到的 Element Plus 组件全部显式引入（aohoyo 那边按需自动引入，靠全局注册会解析不到）；
  3. 不用全局状态单例，状态都收在组件内部。
- **图标全用微软 Fluent**（`@fluentui/svg-icons`，MIT）。`src/file-manager/icons/fluent.js` 是 `scripts/gen-icons.mjs` 的生成物，不许手改：换图标改脚本里的表，跑 `npm run icons`；`test/icons.test.js` 逐条对照 npm 包守门。
- **取色只用 Element Plus 的 CSS 变量**（`--el-*`），明暗跟着使用方走，不自造配色表；文件类型图标的颜色除外（那是图标本身的颜色）。样式写原生 CSS，不用 sass。
- 注释写中文，只写代码表达不了的信息；导出的函数和组件要有说明。全仓禁 emoji。
- 完成标准：`npm test` 全绿，改了组件再看一眼演示页（`npm run dev`，截 1920×1080 自己对设计稿）。

## 目录

```
ahy-web/
├── src/index.js               出口
├── src/file-manager/
│   ├── FileManager.vue        整页
│   ├── api.js                 适配器约定 + 接 ahy-storage 的默认实现
│   ├── logic/                 纯逻辑：路径、命名、排序、格式化（都有测试）
│   ├── composables/           路径与历史、选择、剪切板、上传任务
│   ├── components/            地址栏、命令栏、目录树、各视图、右键菜单、上传浮层、预览
│   └── icons/                 Fluent 图标数据（生成物）
├── dev/                       演示页，接假数据
├── scripts/gen-icons.mjs      图标生成器
└── test/                      vitest
```
