# 更新日志

## [未发布]

### 新增

- 仓库骨架：包名 `@aohoyo/ahy-web`，发 `.vue` 源码不预编译。
- 适配器约定（`api.js`）：文件管理器只认适配器，另附一份接 `ahy-storage` 的默认实现 `createStorageApi`。
- 纯逻辑与测试：路径口径、同名加序号与名字校验、排序与文件类型、大小与时间格式化。
- Fluent 图标：`scripts/gen-icons.mjs` 从 `@fluentui/svg-icons` 生成用到的图标，测试逐条对照 npm 包守门。
- 演示页（`npm run dev`）：内存里的假文件系统，不开后端能看界面。
