// 把文字写进剪贴板。优先用浏览器的剪贴板接口（要求 https 或本机），
// 用不了或被拒时退回老办法：藏一个文本框选中也复制一份。
export async function writeText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 接口被拒（不是安全来源、用户没授权）：走下面的老办法
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}
