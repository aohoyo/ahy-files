import { paths } from "./fluent";

// 拼出一个 Fluent 图标的 svg 字符串。颜色跟随文字颜色，尺寸由外层的 CSS 定。
export function iconSvg(name) {
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${paths[name] ?? ""}"/></svg>`;
}
