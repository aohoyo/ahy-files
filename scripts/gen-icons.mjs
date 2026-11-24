// 从 npm 包 @fluentui/svg-icons 生成 src/file-manager/icons/fluent.js。
//
// 为什么不直接 import 那个包：它没有 JS 入口，是两万多个裸 .svg 文件（解包 12.9MB），
// 要用就得靠打包器的 ?raw 之类约定，使用方的构建配置就成了本包的隐性依赖。
// 这里只取用到的几十个，生成一个纯 JS 模块，任何打包器都能直接编。
//
// 用法：npm run icons。要换图标只改下面这张表；生成物不许手改，
// test/icons.test.js 会逐条对照 npm 包校验。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 别名 → 包内文件名（都在包的 icons/ 目录下，24 号）。
const TABLE = {
  // 工具栏与命令栏
  navBack: "arrow_left_24_regular",
  navForward: "arrow_right_24_regular",
  navUp: "arrow_up_24_regular",
  refresh: "arrow_sync_24_regular",
  search: "search_24_regular",
  add: "add_24_regular",
  upload: "arrow_upload_24_regular",
  download: "arrow_download_24_regular",
  cut: "cut_24_regular",
  copy: "copy_24_regular",
  paste: "clipboard_paste_24_regular",
  edit: "edit_24_regular",
  delete: "delete_24_regular",
  link: "link_24_regular",
  more: "more_horizontal_24_regular",
  sort: "arrow_sort_24_regular",
  moveTo: "folder_arrow_right_24_regular",
  close: "dismiss_24_regular",
  check: "checkmark_24_regular",
  lockClosed: "lock_closed_24_regular",
  eye: "eye_24_regular",
  warning: "warning_24_regular",
  // 视图
  viewDetail: "apps_list_detail_24_regular",
  viewList: "apps_list_24_regular",
  viewGrid: "grid_24_regular",
  chevronDown: "chevron_down_24_regular",
  chevronRight: "chevron_right_24_regular",
  chevronUp: "chevron_up_24_regular",
  chevronLeft: "chevron_left_24_regular",
  // 文件与文件夹
  folder: "folder_24_regular",
  folderOpen: "folder_open_24_regular",
  folderFill: "folder_24_filled",
  folderOpenFill: "folder_open_24_filled",
  document: "document_24_regular",
  documentPdf: "document_pdf_24_regular",
  folderZip: "folder_zip_24_regular",
  image: "image_24_regular",
  video: "video_24_regular",
  documentText: "document_text_24_regular",
  code: "code_24_regular",
  appGeneric: "app_generic_24_regular",
  speaker: "speaker_2_24_regular",
  hardDrive: "hard_drive_24_regular",
  // 以下只给演示页的外壳用，不属于文件管理器
  shellHome: "home_24_regular",
  shellPerson: "person_24_regular",
  shellShop: "building_shop_24_regular",
  shellChat: "chat_24_regular",
  shellCloud: "cloud_24_regular",
  shellSettings: "settings_24_regular",
};

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(here, "../node_modules/@fluentui/svg-icons/icons");
const outFile = resolve(here, "../src/file-manager/icons/fluent.js");

const paths = {};
for (const [alias, file] of Object.entries(TABLE)) {
  const svg = readFileSync(resolve(iconsDir, `${file}.svg`), "utf8");
  const d = /<path d="([^"]*)"/.exec(svg);
  if (!d) throw new Error(`${file}.svg 里找不到 path`);
  paths[alias] = d[1];
}

const body = Object.entries(paths)
  .map(([alias, d]) => `  ${alias}: ${JSON.stringify(d)},`)
  .join("\n");
const sources = Object.entries(TABLE)
  .map(([alias, file]) => `  ${alias}: ${JSON.stringify(file)},`)
  .join("\n");

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  `// 本文件由 scripts/gen-icons.mjs 从 @fluentui/svg-icons 生成，不许手改。
// 图标来自微软 Fluent UI System Icons（MIT 许可），每个别名对应包里的一个文件，见 sources。

// 各图标的 path 数据（24×24 网格，配色靠 fill="currentColor"）。
export const paths = {
${body}
};

// 各别名在 npm 包里的文件名（不带 .svg），守门测试拿它逐条对照。
export const sources = {
${sources}
};
`,
);
console.log(`已生成 ${Object.keys(paths).length} 个图标 → ${outFile}`);
