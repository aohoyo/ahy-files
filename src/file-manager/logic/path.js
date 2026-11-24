/**
 * 路径口径（前后端统一）：根目录是空串；目录一律以 / 结尾，如 files/a/；文件键不以 / 结尾。
 * 七牛没有真目录，目录占位对象和目录同名，所以目录键既能当地址用，也能当对象名拿去改名、移动、删除。
 */

// 把接口回的、或使用方传进来的前缀规范成目录键：去掉首斜杠、合并重复斜杠、补尾斜杠；根目录回空串。
export function toDir(prefix) {
  const s = String(prefix ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
  if (!s) return "";
  return s.endsWith("/") ? s : `${s}/`;
}

// 上一级目录；已在根目录时回 null（工具栏的「上一级」据此置灰）。
export function parentDir(dir) {
  if (dir === "") return null;
  const i = dir.slice(0, -1).lastIndexOf("/");
  return i < 0 ? "" : dir.slice(0, i + 1);
}

// 目录或文件的名字：files/a/ 回 a，files/a/b.txt 回 b.txt，根目录回空串。
export function baseName(key) {
  const parts = key.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] ?? "";
}

// 地址栏的面包屑：第一级固定叫「全部文件」，其后每级带 上一步累计的目录键。
export function crumbs(dir) {
  const out = [{ name: "全部文件", path: "" }];
  let acc = "";
  for (const seg of dir.split("/").filter(Boolean)) {
    acc += `${seg}/`;
    out.push({ name: seg, path: acc });
  }
  return out;
}

// key 是否在 rootDir 之内（含它自己）。rootDir 是空串时恒为真：根目录装着一切。
// 逐段比而不是只比字符串前缀：files2/ 不在 files/ 之内。
export function isUnder(key, rootDir) {
  if (rootDir === "") return true;
  return key === rootDir || key.startsWith(rootDir);
}

// 能否写这个目录：落在任意一个可写根之内就算。
export function isWritable(dir, writableRoots) {
  return writableRoots.some((root) => isUnder(dir, root));
}

// 把名字拆成 主名.后缀 两段；没有后缀或以点开头（.gitignore）时后缀为空串。
export function splitName(name) {
  const i = name.lastIndexOf(".");
  return i > 0 ? [name.slice(0, i), name.slice(i)] : [name, ""];
}

// 后缀（小写、不带点）；没有后缀回空串。
export function extOf(name) {
  return splitName(name)[1].slice(1).toLowerCase();
}

// 对象的下载地址路径：逐段编码，中文、空格、# 才拼得出打得开的地址。
export function encodeKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}
