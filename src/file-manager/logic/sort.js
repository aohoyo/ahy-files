import { extOf } from "./path";

// 文件类型表：后缀 → [类型名, 图标, 图标色]。没登记的后缀一律按「文件」处理。
const TYPES = {
  zip: ["压缩文件", "folderZip", "#8a6bd1"],
  rar: ["压缩文件", "folderZip", "#8a6bd1"],
  "7z": ["压缩文件", "folderZip", "#8a6bd1"],
  gz: ["压缩文件", "folderZip", "#8a6bd1"],
  exe: ["应用程序", "appGeneric", "#3b7bd4"],
  msi: ["安装程序包", "appGeneric", "#3b7bd4"],
  dll: ["应用程序扩展", "appGeneric", "#3b7bd4"],
  png: ["图片", "image", "#2f9e6e"],
  jpg: ["图片", "image", "#2f9e6e"],
  jpeg: ["图片", "image", "#2f9e6e"],
  gif: ["图片", "image", "#2f9e6e"],
  webp: ["图片", "image", "#2f9e6e"],
  svg: ["图片", "image", "#2f9e6e"],
  bmp: ["图片", "image", "#2f9e6e"],
  pdf: ["PDF 文档", "documentPdf", "#e5484d"],
  mp4: ["视频", "video", "#e07a3f"],
  mov: ["视频", "video", "#e07a3f"],
  mp3: ["音频", "speaker", "#2f8fb3"],
  wav: ["音频", "speaker", "#2f8fb3"],
  flac: ["音频", "speaker", "#2f8fb3"],
  m4a: ["音频", "speaker", "#2f8fb3"],
  aac: ["音频", "speaker", "#2f8fb3"],
  txt: ["文本文档", "documentText", "#7a8394"],
  json: ["JSON 文件", "code", "#b07d1e"],
  doc: ["Word 文档", "documentText", "#2b6cd4"],
  docx: ["Word 文档", "documentText", "#2b6cd4"],
  xls: ["Excel 工作表", "documentText", "#1e8e5a"],
  xlsx: ["Excel 工作表", "documentText", "#1e8e5a"],
};
const GENERIC = ["文件", "document", "#7a8394"];
const FOLDER_COLOR = "#f0b13b";

// 七牛实时缩略图（imageView2）认得、浏览器也画得出来的图片格式。
// svg 七牛不处理，tiff、psd 浏览器画不出来，它们只归「图片」类型、显示图片图标。
const THUMB_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);

// 排序列：顺序和叫法照资源管理器「详细信息」的列头。
export const SORTS = [
  { key: "name", label: "名称" },
  { key: "mtime", label: "修改时间" },
  { key: "type", label: "类型" },
  { key: "size", label: "大小" },
];

// 一项的类型信息：类型名、用哪个图标、图标色，以及能不能出缩略图、能不能点开预览。
export function typeOf(entry) {
  if (entry.dir) return { label: "文件夹", icon: "folderFill", color: FOLDER_COLOR, image: false };
  const t = TYPES[extOf(entry.name)] || GENERIC;
  const image = THUMB_EXT.has(extOf(entry.name));
  return { label: t[0], icon: t[1], color: t[2], image };
}

const byName = (a, b) => a.name.localeCompare(b.name, "zh");

// 按某一列比较（不分正倒序，和设计稿一致：点一下正序、再点一下倒序）。大小与时间相同时按名称定序，结果才稳定。
function compareBy(key) {
  switch (key) {
    case "mtime":
      return (a, b) => (a.mtime || 0) - (b.mtime || 0) || byName(a, b);
    case "type":
      return (a, b) => typeOf(a).label.localeCompare(typeOf(b).label, "zh") || byName(a, b);
    case "size":
      return (a, b) => (a.size || 0) - (b.size || 0) || byName(a, b);
    default:
      return byName;
  }
}

// 给一个目录里的条目排序：文件夹永远排在文件前面，两组各自按 sort 排；dir 为 -1 时整组倒过来。
export function sortEntries(entries, sort) {
  const cmp = compareBy(sort.key);
  const ordered = (list) => (sort.dir < 0 ? [...list].sort(cmp).reverse() : [...list].sort(cmp));
  const dirs = entries.filter((e) => e.dir);
  const files = entries.filter((e) => !e.dir);
  return [...ordered(dirs), ...ordered(files)];
}

// 当前目录内搜索：名字里含关键词就算（不分大小写）；空关键词全都匹配。
export function matchQuery(entry, query) {
  const q = query.trim().toLowerCase();
  return !q || entry.name.toLowerCase().includes(q);
}
