import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// 只管测试。演示页的 dev 服务在 vite.config.js。
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.js"],
  },
});
