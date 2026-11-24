import { splitName } from "./path";

// 资源管理器同款禁用字符（斜杠、反斜杠、冒号、星号、问号、双引号、尖括号、竖线）与控制字符。
const BAD_CHARS = /[\u0000-\u001f\\/:*?"<>|]/;
const BAD_CHARS_MSG = '文件名不能含 \\ / : * ? " < > |';
// 单个名字的长度上限。七牛整个对象名上限 1024 字节，留足目录那一段的余量。
const MAX_NAME = 200;

// 名字能不能用：能用回空串，不能用回一句给使用者看的原因。
export function checkName(name) {
  if (!name) return "名字不能为空";
  if (name === "." || name === "..") return "名字不能是 . 或 ..";
  // 后端对含 .. 的对象名一律拒绝（防目录穿越），这里提前说清楚
  if (name.includes("..")) return "文件名不能含连续两个点";
  if (BAD_CHARS.test(name)) return BAD_CHARS_MSG;
  if (name.length > MAX_NAME) return `名字不能超过 ${MAX_NAME} 个字符`;
  return "";
}

// 在 taken(name) 为真的名字之外，找一个没被占用的：先用原名，被占了依次试「主名 (1)」「主名 (2)」。
export function uniqueName(taken, name) {
  if (!taken(name)) return name;
  const [base, ext] = splitName(name);
  for (let i = 1; ; i++) {
    const cand = `${base} (${i})${ext}`;
    if (!taken(cand)) return cand;
  }
}

// 上传撞了同名之后的下一个候选：a.zip 回 a (1).zip，a (1).zip 回 a (2).zip。
export function nextNumbered(name) {
  const m = /^(.*) \((\d+)\)(\.[^.]*)?$/.exec(name);
  if (m) return `${m[1]} (${Number(m[2]) + 1})${m[3] ?? ""}`;
  const [base, ext] = splitName(name);
  return `${base} (1)${ext}`;
}

// 同一个目录里复制出来的那一份叫「主名 - 副本.后缀」，和资源管理器一致。
export function copyName(name) {
  const [base, ext] = splitName(name);
  return `${base} - 副本${ext}`;
}
