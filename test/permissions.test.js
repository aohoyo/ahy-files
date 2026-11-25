import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

// 权限回调的行为是组件内部逻辑，这里用源码断言钉住三件事（交叉审 P2-6/P2-7）。
// 真正跑起来的验证在演示页与 lanta 后台里做，这两条是防回退的守门。
describe("权限口径", () => {
  const fm = readFileSync(resolve(src, "file-manager/composables/useFileManager.js"), "utf8");

  it("动作名是白名单，未知动作一律不放行", () => {
    expect(fm).toMatch(/const ACTIONS = new Set\(\[[^\]]*"upload"[^\]]*"download"[^\]]*\]\)/);
    expect(fm).toMatch(/ACTIONS\.has\(action\)\s*&&/);
  });

  it("复制链接与下载同口径过权限", () => {
    expect(fm).toMatch(/async function copyLink[\s\S]{0,200}can\("download"\)/);
    expect(fm).toMatch(/link: state\(files > 0 && can\("download"\)/);
  });

  it("删除框单项也把名字列出来", () => {
    const dlg = readFileSync(resolve(src, "file-manager/components/FmDeleteDialog.vue"), "utf8");
    expect(dlg).not.toMatch(/v-if="list\.length > 1"/);
    expect(dlg).toMatch(/v-for="e in list"/);
  });

  it("快捷键只在焦点属于文件管理器时生效", () => {
    expect(fm).toMatch(/const inFm = t instanceof Element && !!t\.closest\("\.fm"\)/);
    expect(fm).toMatch(/if \(!activeInFm\) return;/);
  });
});
