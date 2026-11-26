import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

// 演示页（dev/ 目录）的 dev 服务：接假数据，不开后端也能看界面。
// 和使用方一样从包名引入，演示页怎么写、别人就怎么用。
export default defineConfig({
  root: resolve(root, "dev"),
  plugins: [vue()],
  resolve: {
    alias: { "@aohoyo/ahy-files": resolve(root, "src") },
  },
  server: { host: "127.0.0.1", port: 5183, strictPort: true },
});
