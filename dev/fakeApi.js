// 演示页用的假适配器：一个内存里的文件系统，把适配器约定的每个方法都实现一遍，
// 行为照着真后端来（只读目录拒写、同名加序号、不能把文件夹移进自己里面），
// 可以当「适配器怎么写」的活例子看。数据取自设计稿。
import { baseName, copyName, extOf, parentDir, uniqueName } from "@aohoyo/ahy-web";

const MB = 1048576;
const KB = 1024;
const D = (s) => new Date(s).getTime() / 1000;
const now = () => Math.floor(Date.now() / 1000);
const THUMB = "https://cdn.lantapay.com/brand/lantapay-desktop-1920x1080.png";
const IMG = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);
const WRITABLE = ["files/"];

// dir → { dirs: Map<名字, 修改时间>, files: Map<名字, { size, mtime }> }
const FS = new Map();
const kids = (p) => {
  if (!FS.has(p)) FS.set(p, { dirs: new Map(), files: new Map() });
  return FS.get(p);
};
const dir = (p, name, time) => kids(p).dirs.set(name, D(time));
const file = (p, name, size, time) => kids(p).files.set(name, { size, mtime: D(time) });

[
  "backup", "brand", "customer-avatar", "files", "fonts", "logo",
  "release", "rustdesk", "tts", "webview2", "weixin",
].forEach((n, i) => dir("", n, `2026-10-0${(i % 9) + 1}T10:00:00`));

dir("files/", "安装包", "2026-11-21T09:20:00");
dir("files/", "装机包", "2026-11-19T09:12:00");
dir("files/", "品牌物料", "2026-11-20T14:03:00");
file("files/", "安装说明.txt", 2048, "2026-11-21T09:20:00");
file("files/", "配置模板.json", 1180, "2026-11-18T16:40:00");

dir("files/装机包/", "2025", "2025-12-28T17:02:00");
dir("files/装机包/", "2026", "2026-11-19T09:12:00");
file("files/装机包/", "懒獭收款-装机包.zip", 129.4 * MB, "2026-11-19T09:12:00");
file("files/装机包/", "启动器.exe", 14.3 * MB, "2026-11-21T09:12:00");
file("files/装机包/", "微信 3.9.12.exe", 168.2 * MB, "2026-11-16T15:30:00");
file("files/装机包/", "WebView2 运行时.exe", 172.6 * MB, "2026-11-16T15:31:00");
file("files/装机包/", "桌面背景图.png", 432 * KB, "2026-11-20T14:03:00");
file("files/装机包/", "开机自检清单.pdf", 1.8 * MB, "2026-11-20T10:26:00");
file("files/装机包/", "装机演示.mp4", 86.2 * MB, "2026-11-15T11:48:00");
file("files/装机包/", "装机记录.json", 3.2 * KB, "2026-11-21T09:12:00");

dir("files/装机包/2026/", "11 月", "2026-11-19T09:12:00");
file("files/装机包/2026/", "安装包.zip", 129.4 * MB, "2026-11-19T09:12:00");
file("files/装机包/2026/", "启动器.exe", 14.3 * MB, "2026-11-21T09:12:00");
file("files/装机包/2026/", "门店照片.jpg", 2.4 * MB, "2026-11-20T14:03:00");
file("files/装机包/2025/", "安装包-旧版.zip", 118.9 * MB, "2025-12-28T17:02:00");

dir("files/品牌物料/", "宣传图", "2026-11-20T14:03:00");
file("files/品牌物料/", "宣传单-正面.jpg", 1.9 * MB, "2026-11-20T14:03:00");
file("files/品牌物料/", "产品介绍.pdf", 5.6 * MB, "2026-11-20T14:03:00");

dir("files/安装包/", "2025", "2026-11-19T09:12:00");
dir("files/安装包/", "2026", "2026-11-19T09:12:00");
file("files/安装包/", "安装包.zip", 129.4 * MB, "2026-11-21T09:12:00");
file("files/安装包/", "启动器.exe", 14.3 * MB, "2026-11-21T09:12:00");
file("files/安装包/", "说明.txt", 640, "2026-11-21T09:20:00");

dir("release/", "launcher", "2026-11-21T09:12:00");
dir("release/launcher/", "0.2647.3", "2026-11-21T09:12:00");
file("release/launcher/0.2647.3/", "launcher.zip", 14.3 * MB, "2026-11-21T09:12:00");
file("brand/", "lantapay-desktop-1920x1080.png", 819 * KB, "2026-11-20T14:03:00");

const isWritable = (p) => WRITABLE.some((w) => p === w || p.startsWith(w));
const byName = (a, b) => a.name.localeCompare(b.name, "zh");
const fail = (message) => Promise.reject(new Error(message));
// 假装网络有延迟，加载态才看得见
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function listDir(p) {
  const k = kids(p);
  const dirs = [...k.dirs].map(([name, mtime]) => ({ key: `${p}${name}/`, name, dir: true, size: 0, mtime }));
  const files = [...k.files].map(([name, f]) => ({ key: `${p}${name}`, name, dir: false, size: f.size, mtime: f.mtime }));
  return [...dirs.sort(byName), ...files.sort(byName)];
}

function find(p, key) {
  return listDir(p).find((e) => e.key === key) || null;
}

function subtree(p, out = []) {
  out.push(p);
  for (const [name] of kids(p).dirs) subtree(`${p}${name}/`, out);
  return out;
}

function removeKey(p, key) {
  const k = kids(p);
  if (key.endsWith("/")) {
    k.dirs.delete(baseName(key));
    for (const d of subtree(key)) FS.delete(d);
  } else {
    k.files.delete(baseName(key));
  }
}

function assertWritable(p, what) {
  if (!isWritable(p)) return fail(`这个目录只读，${what}只能作用在 files 目录里`);
  return null;
}

// 把一项放进 target。撞名时：同目录复制出来的叫「名字 - 副本」，其余加「 (n)」。
function transfer(mode, from, entry, target, name) {
  const k = kids(target);
  const pool = entry.dir ? k.dirs : k.files;
  const taken = (n) => pool.has(n);
  let nn = name || entry.name;
  if (taken(nn)) nn = uniqueName(taken, mode === "copy" && from === target ? copyName(nn) : nn);
  if (entry.dir) {
    k.dirs.set(nn, entry.mtime || now());
    for (const e of listDir(entry.key)) transfer("copy", entry.key, e, `${target}${nn}/`);
    if (mode === "cut") removeKey(from, entry.key);
  } else {
    k.files.set(nn, { size: entry.size, mtime: entry.mtime || now() });
    if (mode === "cut") removeKey(from, entry.key);
  }
  return entry.dir ? `${target}${nn}/` : `${target}${nn}`;
}

// 建假适配器。can 传 false 可以演示「没有权限时命令置灰」。
export function createFakeApi() {
  return {
    async list({ prefix }) {
      await wait(120);
      return {
        prefix,
        entries: prefix === "" && !FS.has("") ? [] : listDir(prefix),
        marker: "",
        downloadBase: "https://cdn.lantapay.com",
        limits: { maxSize: 1024 * MB, accept: [] },
      };
    },
    async uploadTicket({ key }) {
      await wait(60);
      assertWritable(prefixOf(key), "上传");
      return { token: "fake", key, uploadUrl: "fake://upload" };
    },
    // 演示页没有真的对象存储，上传由适配器自己演：按文件大小走一段进度，走完落进文件系统。
    async upload({ key, file: f, onProgress }) {
      const total = f.size;
      const steps = Math.max(3, Math.min(24, Math.ceil(total / (400 * KB))));
      for (let i = 1; i <= steps; i++) {
        await wait(90);
        onProgress(Math.round((total * i) / steps));
      }
      const p = prefixOf(key);
      ensureDir(p); // 拖整个文件夹进来时，中间的目录顺手建出来
      kids(p).files.set(baseName(key), { size: total, mtime: now() });
    },
    async createFolder({ prefix, name }) {
      await wait(100);
      const bad = assertWritable(prefix, "新建");
      if (bad) return bad;
      if (kids(prefix).dirs.has(name) || kids(prefix).files.has(name)) return fail("此位置已经有同名的文件或文件夹");
      kids(prefix).dirs.set(name, now());
    },
    async rename({ key, to }) {
      await wait(100);
      const from = parentDir(key) ?? "";
      const bad = assertWritable(from, "改名");
      if (bad) return bad;
      const entry = find(from, key);
      if (!entry) return fail("找不到这个文件或文件夹");
      if (find(parentDir(to) ?? "", to)) return fail("此位置已经有同名的文件或文件夹");
      transfer("cut", from, entry, parentDir(to) ?? "", baseName(to.replace(/\/$/, "")));
    },
    async move({ items, toDir }) {
      await wait(200);
      return transferAll("cut", items, toDir);
    },
    async copy({ items, toDir }) {
      await wait(200);
      return transferAll("copy", items, toDir);
    },
    async remove({ keys }) {
      await wait(200);
      for (const key of keys) {
        const bad = assertWritable(parentDir(key) ?? "", "删除");
        if (bad) return bad;
        removeKey(parentDir(key) ?? "", key);
      }
    },
    downloadUrl({ key }) {
      return imageKey(key) ? `${THUMB}?attname=${encodeURIComponent(baseName(key))}` : "about:blank";
    },
    linkUrl({ key }) {
      return imageKey(key) ? THUMB : "about:blank";
    },
    thumbUrl({ key, width }) {
      return `${THUMB}?imageView2/2/w/${width}/h/${width}`;
    },
  };
}

function prefixOf(key) {
  return key.slice(0, key.lastIndexOf("/") + 1);
}

// 建出 p 这一路上的每一级目录（拖整个文件夹上传时中间目录要跟着出现）。
function ensureDir(p) {
  let cur = "";
  for (const seg of p.split("/").filter(Boolean)) {
    if (!kids(cur).dirs.has(seg)) kids(cur).dirs.set(seg, now());
    cur += `${seg}/`;
  }
}

function imageKey(key) {
  return IMG.has(extOf(key));
}

async function transferAll(mode, items, toDir) {
  const bad = assertWritable(toDir, mode === "cut" ? "移动" : "复制");
  if (bad) return bad;
  const out = [];
  for (const it of items) {
    const from = parentDir(it.key) ?? "";
    const entry = find(from, it.key);
    if (!entry) continue;
    if (mode === "cut" && from === toDir) continue;
    if (mode === "cut" && it.key.endsWith("/") && (toDir === it.key || toDir.startsWith(it.key))) {
      return fail("不能把文件夹移到它自己里面");
    }
    out.push({ from: it.key, to: transfer(mode, from, entry, toDir, it.name) });
  }
  return out;
}
