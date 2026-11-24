const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

// 字节数说成人话：不到 1KB 显示 B，不到 1MB 显示整 KB，再往上保留一位小数。
export function fmtSize(n) {
  if (n == null || Number.isNaN(n)) return "";
  if (n >= GB) return `${(n / GB).toFixed(1)} GB`;
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`;
  if (n >= KB) return `${Math.round(n / KB)} KB`;
  return `${n} B`;
}

const pad = (v) => String(v).padStart(2, "0");

// unix 秒 → YYYY/MM/DD HH:mm（按浏览器本地时区）。0 或缺值回空串，目录那一格就不显示时间。
export function fmtTime(sec) {
  if (!sec) return "";
  const x = new Date(sec * 1000);
  return `${x.getFullYear()}/${pad(x.getMonth() + 1)}/${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

// 已选条目里文件大小的合计，供状态栏显示。
export function sumSize(entries) {
  return entries.reduce((s, e) => s + (e.dir ? 0 : e.size || 0), 0);
}
