import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { paths, sources } from "../src/file-manager/icons/fluent";

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(here, "../node_modules/@fluentui/svg-icons/icons");

// 守门：fluent.js 是 scripts/gen-icons.mjs 从 npm 包生成的，不许手改。
// 逐条对照 npm 包里的原文件，谁手改了路径、或表里多了少了别名，这里就红。
describe("图标数据与 @fluentui/svg-icons 一致", () => {
  it("每个别名的路径数据和包里的文件逐字相同", () => {
    expect(Object.keys(paths).sort()).toEqual(Object.keys(sources).sort());
    for (const [alias, file] of Object.entries(sources)) {
      const svg = readFileSync(resolve(iconsDir, `${file}.svg`), "utf8");
      const d = /<path d="([^"]*)"/.exec(svg);
      expect(d, `${file}.svg 里找不到 path`).not.toBeNull();
      expect(paths[alias], `${alias} 与 ${file}.svg 不一致，请跑 npm run icons 重新生成`).toBe(d[1]);
    }
  });

  it("文件管理器用到的图标都在", () => {
    for (const alias of [
      "navBack", "navForward", "navUp", "refresh", "search", "add", "upload", "download",
      "cut", "copy", "paste", "edit", "delete", "link", "more", "sort", "moveTo", "close",
      "check", "lockClosed", "eye", "warning", "viewDetail", "viewList", "viewGrid",
      "chevronDown", "chevronRight", "chevronUp", "chevronLeft", "folder", "folderOpen",
      "folderFill", "folderOpenFill", "document", "documentPdf", "folderZip", "image",
      "video", "documentText", "code", "appGeneric", "speaker", "hardDrive",
    ]) {
      expect(typeof paths[alias], alias).toBe("string");
    }
  });
});
