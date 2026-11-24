/**
 * 适配器约定：文件管理器不直接调任何后端接口，只认这里列出的几个方法。
 * 各后台自己实现一份（接自己的请求层，带登录态和错误提示）；接 ahy-storage 的可以直接用
 * createStorageApi。约定只有三条：
 *   1. 方法出错就 reject，message 是一句给使用者看的话。提示由文件管理器统一弹，适配器自己不要再弹。
 *   2. 路径口径见 logic/path.js：根目录是空串，目录以 / 结尾。
 *   3. 条目的 mtime 是 unix 秒（和 ahy-storage 的 put_at 一致）。
 *
 * @typedef {Object} FmEntry 一个条目（文件或目录）
 * @property {string}  key    对象全名；目录以 / 结尾
 * @property {string}  name   当前目录下的名字，不含路径
 * @property {boolean} dir    是不是目录
 * @property {number}  size   文件字节数，目录为 0
 * @property {number}  mtime  修改时间，unix 秒；没有为 0
 *
 * @typedef {Object} FmLimits 后端对上传的限制
 * @property {number}   maxSize 单文件上限，字节
 * @property {string[]} accept  允许的后缀（小写、带点）；空数组表示不限制类型
 *
 * @typedef {Object} FmListResult 列目录的结果
 * @property {string}   prefix       规范化后的目录
 * @property {FmEntry[]} entries     子目录和文件
 * @property {string}   marker       非空表示还有下一页，原样传回给下一次 list
 * @property {string}   downloadBase 下载基地址（scheme://域名），不含尾斜杠
 * @property {FmLimits} [limits]     上传限制；后端没给就没有这个字段
 *
 * @typedef {Object} FmTransferItem 移动或复制时的一项
 * @property {string} key  源对象全名
 * @property {string} [name] 想要的目标名字；不给就沿用原名。重名时后端会自动加「 (n)」
 *
 * @typedef {Object} FmApi 适配器
 * @property {(args: {prefix: string, marker?: string, fresh?: boolean}) => Promise<FmListResult>} list
 *   列一个目录。fresh 为真时跳过后端缓存回源（直传不经过后端，传完要带它刷新）
 * @property {(args: {name: string, key: string}) => Promise<{token: string, key: string, uploadUrl: string}>} uploadTicket
 *   签一张直传凭证。name 是原文件名，key 是完整对象名
 * @property {(args: {key: string, file: File, onProgress: (loaded: number) => void, signal: AbortSignal}) => Promise<void>} [upload]
 *   可选。给了就用它传文件（本地存储、演示页用）；不给时文件管理器自己拿 uploadTicket 的凭证按七牛表单直传
 * @property {(args: {prefix: string, name: string}) => Promise<void>} createFolder 在 prefix 下建一个叫 name 的目录
 * @property {(args: {key: string, to: string}) => Promise<void>} rename 改名；目录和文件都是传完整的新对象名
 * @property {(args: {items: FmTransferItem[], toDir: string}) => Promise<Array<{from: string, to: string}>>} move
 *   把 items 移进 toDir，回每一项实际落下的对象名
 * @property {(args: {items: FmTransferItem[], toDir: string}) => Promise<Array<{from: string, to: string}>>} copy
 *   同 move，但源对象留着
 * @property {(args: {keys: string[]}) => Promise<void>} remove 删除；目录传带尾斜杠的目录名，连同里面的东西一起删
 * @property {(args: {key: string}) => (string | Promise<string>)} downloadUrl 原件的下载地址
 * @property {(args: {key: string}) => (string | Promise<string>)} [linkUrl]
 *   复制链接用的直链；不给就用 downloadUrl
 * @property {(args: {key: string, width: number}) => (string | Promise<string>)} thumbUrl
 *   图片缩略图地址，width 是显示宽度的两倍；回字符串或回 Promise 都行
 */
import { encodeKey } from "./logic/path";

/**
 * 内置的请求层：fetch 加 Bearer 令牌，拆 ahy 的响应信封 {code, message, data}。
 * 刷新登录态这类事各后台不同，有需要的后台传自己的 request 进来。
 *
 * @param {{baseUrl?: string, getToken?: () => string}} [options]
 */
export function createRequest(options = {}) {
  const { baseUrl = "", getToken } = options;
  return async function request({ method = "GET", url, query, body }) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    const qs = new URLSearchParams(
      Object.entries(query || {}).filter(([, v]) => v != null && v !== ""),
    ).toString();
    const res = await fetch(baseUrl + url + (qs ? `?${qs}` : ""), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let env = null;
    try {
      env = await res.json();
    } catch {
      // 响应不是 JSON：按状态码报
    }
    const code = env && typeof env.code === "number" ? env.code : res.status;
    if (!res.ok || code !== 0) {
      throw new Error((env && env.message) || `请求失败（${res.status}）`);
    }
    return env.data;
  };
}

/**
 * 接 ahy-storage 的默认适配器（管理接口在 /v1/storage/admin，签票在 /v1/storage/ticket）。
 * 下载地址和缩略图地址按公开读的桶拼；私有桶要签名，请自己实现这两个方法。
 *
 * @param {{request?: Function, base?: string, ticketUrl?: string, baseUrl?: string, getToken?: () => string}} [options]
 */
export function createStorageApi(options = {}) {
  const { base = "/v1/storage/admin", ticketUrl = "/v1/storage/ticket" } = options;
  const request = options.request || createRequest(options);
  // 下载基地址由后端随列目录的结果下发，记下来给下载地址和缩略图地址用
  let downloadBase = "";

  // 名字以 / 结尾的就是目录（七牛的目录占位对象），后端没标 is_dir 也按目录认
  const mapEntry = (e) => ({
    key: e.key,
    name: e.name,
    dir: !!e.is_dir || e.key.endsWith("/"),
    size: e.size || 0,
    mtime: e.put_at || 0,
  });
  const transfer = (path) => async ({ items, toDir }) => {
    const d = await request({
      method: "POST",
      url: `${base}/${path}`,
      body: {
        items: items.map(({ key, name }) => (name ? { key, name } : { key })),
        to_dir: toDir,
      },
    });
    return d.items || [];
  };

  return {
    async list({ prefix, marker, fresh }) {
      const d = await request({
        url: `${base}/list`,
        query: { prefix: prefix || undefined, marker: marker || undefined, fresh: fresh ? "1" : undefined },
      });
      if (d.download_base) downloadBase = d.download_base;
      return {
        prefix: d.prefix || "",
        entries: [...(d.dirs || []), ...(d.files || [])].map(mapEntry),
        marker: d.marker || "",
        downloadBase: d.download_base || downloadBase,
        limits: d.limits || undefined,
      };
    },
    async uploadTicket({ name, key }) {
      // 对象名第一段就是上传域（files/… 对应 scope=files），凭证接口按它校验
      const t = await request({
        method: "POST",
        url: ticketUrl,
        body: { filename: name, scope: key.split("/")[0], key },
      });
      return { token: t.token, key: t.key, uploadUrl: t.upload_url };
    },
    createFolder({ prefix, name }) {
      return request({ method: "POST", url: `${base}/mkdir`, body: { key: `${prefix}${name}/` } });
    },
    rename({ key, to }) {
      return request({ method: "POST", url: `${base}/rename`, body: { key, to } });
    },
    move: transfer("move"),
    copy: transfer("copy"),
    remove({ keys }) {
      return request({ method: "POST", url: `${base}/delete`, body: { keys } });
    },
    // attname 让七牛按原文件名另存，而不是在浏览器里直接打开图片或 PDF
    downloadUrl({ key }) {
      return `${downloadBase}/${encodeKey(key)}?attname=${encodeURIComponent(key.split("/").pop())}`;
    },
    linkUrl({ key }) {
      return `${downloadBase}/${encodeKey(key)}`;
    },
    thumbUrl({ key, width }) {
      return `${downloadBase}/${encodeKey(key)}?imageView2/2/w/${width}/h/${width}`;
    },
  };
}
