import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// 只管测试。演示页的 dev 服务在 vite.config.js。
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.js"],
    // 挂载渲染测试要加载组件带进来的 element-plus 样式：把它内联进 vite 转换管线，
    // 否则 node_modules 里的 css 导入会以外部依赖直读，报 Unknown file extension
    server: { deps: { inline: ["element-plus"] } },
  },
});
