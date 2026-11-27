import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

// 列出 src 下所有源码文件
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
}

const sources = walk(src)
  .filter((f) => /\.(js|vue)$/.test(f) && !f.endsWith("fluent.js"))
  .map((f) => ({ file: f.slice(src.length + 1).replace(/\\/g, "/"), code: readFileSync(f, "utf8") }));

describe("三条隔离规矩", () => {
  it("不直接调后端接口：除了适配器的默认实现，源码里没有发请求的代码，也没有写死的接口地址", () => {
    for (const { file, code } of sources) {
      // 适配器的默认实现除外，它本来就是发请求的那一个
      if (file.endsWith("api.js") || file.endsWith("useUploads.js")) continue;
      expect(code, `${file} 里不该出现 fetch(`).not.toMatch(/\bfetch\s*\(/);
      expect(code, `${file} 里不该出现 XMLHttpRequest`).not.toMatch(/XMLHttpRequest/);
      expect(code, `${file} 里不该出现 axios`).not.toMatch(/\baxios\b/);
      // 只有适配器默认实现知道接口路径，组件里只认 fm.api
      expect(code, `${file} 里不该写死接口地址`).not.toMatch(/["'`]\/v1\//);
    }
  });

  it("Element Plus 只从 element-plus/es 引，用到的组件都显式引入并带上样式", () => {
    const importers = sources.filter(({ code }) => /from ["']element-plus/.test(code));
    for (const { file, code } of importers) {
      // 裸的 element-plus 在按需引入的 Vite 工程里没有被预构建，开发模式下会整页起不来
      // （2026-11-25 实测：报 dayjs 不提供默认导出）
      expect(code, `${file} 不能从裸的 element-plus 引`).not.toMatch(/from ["']element-plus["']/);
      expect(code, `${file} 只能从 element-plus/es 引`).toMatch(/from ["']element-plus\/es["']/);
    }
    // 用到的组件与其样式成对出现：按需引入样式的项目不会替依赖包补样式
    for (const { file, code } of sources) {
      const usesDialog = /<ElDialog\b/.test(code);
      const usesMessage = /\bElMessage\(/.test(code);
      const hasDialogStyle = /element-plus\/es\/components\/dialog\/style\/css/.test(code);
      const hasMessageStyle = /element-plus\/es\/components\/message\/style\/css/.test(code);
      expect(!usesDialog || hasDialogStyle, `${file} 用了 ElDialog 就要带它的样式`).toBe(true);
      expect(!usesMessage || hasMessageStyle, `${file} 用了 ElMessage 就要带它的样式`).toBe(true);
    }
  });

  it("不用全局状态单例：没有 pinia、vuex，也不往 window 上挂状态", () => {
    for (const { file, code } of sources) {
      expect(code, `${file} 里不该用 pinia`).not.toMatch(/from ["']pinia/);
      expect(code, `${file} 里不该用 vuex`).not.toMatch(/from ["']vuex/);
      expect(code, `${file} 里不该往 window 挂状态`).not.toMatch(/window\.__?\w+\s*=/);
    }
  });

  it("scoped 样式里命中 v-html 注入节点的选择器必须 :deep 包裹", () => {
    // svg 都经 FmIcon / v-html 注入，节点上没有本组件的 scope 属性；
    // 不包 :deep 的规则静默失效，还不会被任何构建检查发现（2026-11-27 审查 P1 实测踩过）
    for (const { file, code } of sources) {
      const m = code.match(/<style[^>]*scoped[^>]*>([\s\S]*?)<\/style>/);
      if (!m) continue;
      const css = m[1].replace(/\/\*[\s\S]*?\*\//g, "");
      for (const rule of css.match(/[^{}]+\{[^{}]*\}/g) || []) {
        const sel = rule.slice(0, rule.indexOf("{")).trim();
        for (const one of sel.split(",")) {
          const t = one.trim();
          if (!t || t.startsWith("@") || t === "from" || t === "to") continue;
          if (/\bsvg\b/.test(t) && !t.includes(":deep(")) {
            throw new Error(`${file} 的 scoped 选择器「${t}」命中 v-html 注入的 svg，不带本组件 scope 属性，要用 :deep 包裹`);
          }
        }
      }
    }
  });
});
