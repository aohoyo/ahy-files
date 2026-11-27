import { computed, markRaw, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus/es";
// 组件和它的样式一起引：按需自动引入样式的项目只处理它自己的页面，不会管依赖包里的组件
import "element-plus/es/components/message/style/css";
import { useNavigation } from "./useNavigation";
import { useSelection } from "./useSelection";
import { useUploads } from "./useUploads";
import { baseName, crumbs, extOf, isUnder, parentDir, toDir } from "../logic/path";
import { checkName, copyName, uniqueName } from "../logic/naming";
import { SORTS, matchQuery, sortEntries, typeOf } from "../logic/sort";
import { fmtSize } from "../logic/format";
import { writeText } from "../logic/clipboard";

// 六种视图，顺序和叫法照资源管理器的「查看」菜单
export const VIEWS = [
  ["lg", "大图标"],
  ["md", "中图标"],
  ["sm", "小图标"],
  ["list", "列表"],
  ["details", "详细信息"],
  ["tiles", "平铺"],
];
const VIEW_ICON = { details: "viewDetail", list: "viewList" };
// 一次移动、复制、删除最多交给后端多少项；再多分批，顺带能报出批次进度
const CHUNK = 200;
// 新建文件夹弹窗还没提交时用的占位键（不进列表）
const NEW_KEY = "\u0000new";
const PREF_KEY = "ahy-file-manager:prefs";
// 要落在可写目录里才算数的动作；其余的（下载、复制到别处）不受只读限制
const WRITE_ACTIONS = new Set(["upload", "create", "rename", "move", "delete"]);

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY)) || {};
  } catch {
    return {};
  }
}

// 文件管理器的全部状态与动作。props 是 FileManager 收的入参；返回的东西交给子组件用。
export function useFileManager(props) {
  const api = markRaw(props.api);
  const nav = useNavigation();
  const selection = useSelection();
  const path = nav.path;
  const prefs = loadPrefs();

  // ---- 能做什么 ----
  // 可写与否只看权限回调（不设目录白名单：整个桶都能写，文件管理入口本身有 admin 权限码门控）。
  // writableRoots 入参保留只为兼容旧用法，但不再据此判断。
  const writable = computed(() => true);
  // 权限判断：不传 can 就全开（各后台自己决定要不要管）；传了就按它的答复来。
  // 动作名收成白名单，未知动作一律 false——组件以后新增动作，不会被老的使用方静默放行。
  const ACTIONS = new Set(["upload", "create", "rename", "move", "copy", "delete", "download"]);
  const can = (action) =>
    ACTIONS.has(action) && (typeof props.can !== "function" || !!props.can(action));
  const may = (action) => can(action) && (!WRITE_ACTIONS.has(action) || writable.value);
  // 命令置灰的原因：没有权限
  const why = (action) => (!can(action) ? "没有权限" : !writable.value ? "这个目录只读" : "");

  // ---- 列表 ----
  const entries = ref([]);
  const marker = ref("");
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref("");
  const query = ref("");
  const sort = ref(prefs.sort || { key: "name", dir: 1 });
  const view = ref(prefs.view || "details");
  const spinning = ref(false);
  const limits = ref(null);
  // 上传限制：入参优先，没传就按后端随列目录带回的来
  const maxSize = computed(() => props.maxSize ?? limits.value?.maxSize ?? 0);
  const accept = computed(() => (props.accept ?? limits.value?.accept ?? []).map((e) => String(e).toLowerCase()));

  watch([sort, view], () => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ sort: sort.value, view: view.value }));
    } catch {
      // 隐私模式等存不了：下次还按默认来
    }
  });

  // 改名弹窗的状态：正在改哪一项、输入框里的字。isNew 是新建文件夹还没提交
  const renaming = ref(null);
  const renameRetry = ref(0);
  // 文件区给回来的「把焦点交还给我」：改名提交后调用，免得焦点落在 body 上
  let viewFocus = null;
  const setViewFocus = (fn) => (viewFocus = fn);

  // 当前显示的条目：搜过的、排好序的。新建文件夹走弹窗输入，列表里不出占位条目。
  const visible = computed(() =>
    sortEntries(
      entries.value.filter((e) => matchQuery(e, query.value)),
      sort.value,
    ),
  );
  const visibleKeys = computed(() => visible.value.map((e) => e.key));
  const selected = computed(() => {
    const ks = selection.keys.value;
    return visible.value.filter((e) => ks.has(e.key));
  });
  const selectedFiles = computed(() => selected.value.filter((e) => !e.dir));

  let seq = 0;
  // 列当前目录。more 是接着上一页往下取；fresh 跳过后端缓存回源。
  async function load({ fresh = false, more = false } = {}) {
    const mine = ++seq;
    if (more) {
      loadingMore.value = true;
    } else {
      loading.value = true;
      // 非翻页一律先清场：切目录或刷新失败时，旧目录的条目不能挂在新路径下——
      // 挂着还能被选中删除，删的其实是旧目录里的文件（审查发现）
      entries.value = [];
      marker.value = "";
      selection.clear();
    }
    error.value = "";
    try {
      const r = await api.list({ prefix: path.value, marker: more ? marker.value : undefined, fresh });
      // 期间又发了新的请求（换了目录、点了刷新），这一份作废
      if (mine !== seq) return;
      const incoming = r.entries.map((e) => ({ ...e, dir: !!e.dir || e.key.endsWith("/") }));
      if (more) {
        const have = new Set(entries.value.map((e) => e.key));
        entries.value = entries.value.concat(incoming.filter((e) => !have.has(e.key)));
      } else {
        entries.value = incoming;
      }
      marker.value = r.marker || "";
      if (r.limits) limits.value = r.limits;
      selection.retain(new Set(entries.value.map((e) => e.key)));
      // 左侧目录树里这一层跟着列表走，省一次请求
      tree.dirs[path.value] = entries.value.filter((e) => e.dir).map((e) => e.key);
    } catch (e) {
      if (mine === seq) error.value = e?.message || "列目录失败，请稍后重试";
    } finally {
      if (mine === seq) {
        loading.value = false;
        loadingMore.value = false;
      }
    }
  }

  // 翻页只在没有任何加载在跑时才接：目录切换正在进行时旧 marker 已经清了，别拿新目录配旧页
  const loadMore = () => !loading.value && !loadingMore.value && marker.value && load({ more: true });

  async function refresh() {
    spinning.value = true;
    setTimeout(() => (spinning.value = false), 600);
    await load({ fresh: true });
  }

  // ---- 左侧目录树 ----
  // dirs：每个目录下有哪些子目录（看过的才记）；expanded：展开着的目录。根目录永远展开。
  const tree = reactive({ expanded: new Set([""]), dirs: {}, loading: {} });
  const treeRows = computed(() => {
    const rows = [];
    const walk = (dir, depth) => {
      const subs = tree.dirs[dir];
      rows.push({
        key: dir,
        name: dir ? baseName(dir) : "全部文件",
        depth,
        // 还没看过的目录先留着展开箭头，点开发现是空的再收掉
        has: dir === "" || subs == null || subs.length > 0,
        open: tree.expanded.has(dir),
      });
      if (tree.expanded.has(dir) && subs) for (const k of subs) walk(k, depth + 1);
    };
    walk("", 0);
    return rows;
  });

  async function loadTree(dir, fresh = false) {
    if (tree.dirs[dir] != null || tree.loading[dir]) return;
    tree.loading[dir] = true;
    try {
      const r = await api.list({ prefix: dir, fresh });
      tree.dirs[dir] = r.entries.filter((e) => e.dir).map((e) => e.key);
    } catch (e) {
      toast(e?.message || "列目录失败，请稍后重试", "error");
    } finally {
      delete tree.loading[dir];
    }
  }

  function toggleTree(dir) {
    if (dir === "") return;
    if (tree.expanded.has(dir)) tree.expanded.delete(dir);
    else {
      tree.expanded.add(dir);
      loadTree(dir);
    }
  }

  // 进到一个目录时，把它这一路的每一层都展开
  async function syncTree(p) {
    let acc = "";
    tree.expanded.add("");
    await loadTree("");
    for (const seg of p.split("/").filter(Boolean)) {
      acc += `${seg}/`;
      tree.expanded.add(acc);
      await loadTree(acc);
    }
  }

  // 写操作之后把受影响目录（连同它们的上层）在目录树里的记录丢掉；正展开着的立刻回源重列。
  // 当前目录不用管：随后重列当前目录时会顺带刷新它这一层。
  function invalidateTree(dirs) {
    const all = new Set([""]);
    for (const d of dirs) {
      for (let cur = d; cur != null; cur = parentDir(cur)) all.add(cur);
    }
    for (const d of all) {
      if (d === path.value) continue;
      delete tree.dirs[d];
      if (tree.expanded.has(d)) loadTree(d, true);
    }
  }

  // ---- 提示与长操作 ----
  function toast(message, type = "info") {
    if (message) ElMessage({ message, type, customClass: "fm-toast", duration: 2400, showClose: false, grouping: true });
  }

  const busy = ref("");
  // 长操作：盖上「正在处理」，同一时间只许一个；出错只提示一次。
  // 回成功与否：批量操作中途失败时后端已经动了一部分，调用方失败也要回源刷新。
  async function run(label, fn) {
    if (busy.value) return false;
    busy.value = label;
    let ok = false;
    try {
      await fn();
      ok = true;
    } catch (e) {
      toast(e?.message || "操作失败，请稍后重试", "error");
    } finally {
      busy.value = "";
    }
    return ok;
  }

  // 分批交给后端，把各批的结果接起来
  async function inBatches(items, verb, fn) {
    const n = Math.ceil(items.length / CHUNK);
    let out = [];
    for (let i = 0; i < items.length; i += CHUNK) {
      busy.value = `${verb}（第 ${i / CHUNK + 1}/${n} 批）…`;
      out = out.concat((await fn(items.slice(i, i + CHUNK))) || []);
    }
    return out;
  }

  // 写操作之后的收尾：回源重列当前目录，刷新目录树，按需要选中指定的条目
  async function afterWrite(dirs, select) {
    await load({ fresh: true });
    invalidateTree(dirs);
    if (select) selection.set(select.filter((k) => entries.value.some((e) => e.key === k)));
  }

  // ---- 打开、下载、复制链接 ----
  const viewer = ref(null);
  const viewerImages = computed(() => visible.value.filter((e) => !e.dir && typeOf(e).image));

  function open(entry) {
    if (entry.dir) nav.go(entry.key);
    else if (typeOf(entry).image) viewer.value = { key: entry.key };
    else download([entry]);
  }

  async function download(list) {
    if (list.length !== 1) return toast("一次下载一个文件，打包下载放在下一版本");
    if (!can("download")) return toast("没有权限下载", "error");
    try {
      const url = await api.downloadUrl({ key: list[0].key });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast(e?.message || "下载失败", "error");
    }
  }

  async function copyLink(list) {
    if (!list.length) return;
    // 产出的是下载地址，和「下载」同口径过权限
    if (!can("download")) return toast("没有权限复制下载链接", "error");
    const links = [];
    for (const e of list) {
      try {
        links.push(await (api.linkUrl ? api.linkUrl({ key: e.key }) : api.downloadUrl({ key: e.key })));
      } catch (err) {
        return toast(err?.message || "取下载链接失败", "error");
      }
    }
    const ok = await writeText(links.join("\n"));
    if (!ok) return toast("复制失败，请手动复制", "error");
    toast(list.length > 1 ? `已复制 ${list.length} 个下载链接` : "已复制下载链接", "success");
  }

  // ---- 剪切、复制、粘贴、移动到、复制到 ----
  // 剪贴板只在组件里记着，不进系统剪贴板：里面存的是对象名，出了这个页面没有意义。
  const clip = ref(null);
  // 剪切的东西不能原地粘贴；复制的可以（留一份副本）
  const canPaste = computed(() => !!clip.value && !(clip.value.mode === "cut" && clip.value.from === path.value));
  const isCut = (key) =>
    clip.value?.mode === "cut" && clip.value.from === path.value && clip.value.items.some((it) => it.key === key);

  function cutOrCopy(mode) {
    const list = selected.value;
    if (!list.length || (mode === "cut" ? !may("move") : !can("copy"))) return;
    clip.value = { mode, from: path.value, items: list.map((e) => ({ key: e.key, name: e.name, dir: e.dir })) };
  }

  // 定每一项的目标名字：移回原目录的跳过；在同一个目录里复制出来的叫「名字 - 副本」
  const planItems = (mode, items, target) =>
    items
      .filter((it) => !(mode === "cut" && parentDir(it.key) === target))
      .map((it) => (mode === "copy" && parentDir(it.key) === target ? { key: it.key, name: copyName(it.name) } : { key: it.key }));

  async function sendItems(mode, items, from, target) {
    if (!may(mode === "cut" ? "move" : "copy")) return toast("没有权限执行这个操作", "error");
    let out = [];
    const ok = await run("正在处理…", async () => {
      out = await inBatches(items, mode === "cut" ? "正在移动" : "正在复制", (part) =>
        api[mode === "cut" ? "move" : "copy"]({ items: part, toDir: target }),
      );
      if (out.length) {
        toast(`已${mode === "cut" ? "移动" : "复制"} ${out.length} 项到「${baseName(target) || "全部文件"}」`, "success");
      }
    });
    // 失败也回源：后端是「前 N 项已完成」之后才报错，已经搬走的得从列表里消失（审查发现）
    await afterWrite([from, target], ok ? out.map((t) => t.to) : undefined);
  }

  function paste() {
    const c = clip.value;
    if (!c || !may(c.mode === "cut" ? "move" : "copy")) return;
    const target = path.value;
    if (c.mode === "cut" && c.items.some((it) => it.dir && isUnder(target, it.key))) {
      return toast("不能把文件夹移到它自己里面", "error");
    }
    const items = planItems(c.mode, c.items, target);
    if (!items.length) return;
    // 剪切粘贴只做一次：不管成没成都清掉，免得失败之后再粘一遍
    if (c.mode === "cut") clip.value = null;
    sendItems(c.mode, items, c.from, target);
  }

  // 「移动到」「复制到」：弹选目录的框
  const moveDialog = ref(null);
  function askTransfer(mode, list = selected.value) {
    if (!list.length || (mode === "cut" ? !may("move") : !can("copy"))) return;
    moveDialog.value = { mode, entries: list };
  }
  function doTransfer(target) {
    const d = moveDialog.value;
    moveDialog.value = null;
    if (!d) return;
    // 弹窗开着的时候权限可能已经变了，发请求前复查一道（审查发现）
    if (!may(d.mode === "cut" ? "move" : "copy")) return toast("没有权限执行这个操作", "error");
    const items = planItems(d.mode, d.entries, target);
    if (items.length) sendItems(d.mode, items, path.value, target);
  }

  // ---- 删除 ----
  const confirmDelete = ref(null);
  function askDelete(list = selected.value) {
    if (list.length && may("delete")) confirmDelete.value = list;
  }
  function doDelete() {
    const list = confirmDelete.value;
    confirmDelete.value = null;
    if (!list) return;
    if (!may("delete")) return toast("没有权限执行这个操作", "error");
    run("正在删除…", async () => {
      await inBatches(list.map((e) => e.key), "正在删除", (keys) => api.remove({ keys }));
      toast(`已删除 ${list.length} 项`, "success");
    }).then(() => afterWrite([path.value]));
  }

  // ---- 新建文件夹、改名 ----
  const takenIn = (name) => entries.value.some((e) => e.name === name);

  function startRename(entry = selected.value.length === 1 ? selected.value[0] : null) {
    if (!entry || renaming.value || !may("rename")) return;
    renaming.value = { key: entry.key, name: entry.name, value: entry.name, dir: entry.dir, isNew: false };
  }

  function startNewFolder() {
    if (renaming.value || !may("create")) return;
    const name = uniqueName(takenIn, "新建文件夹");
    renaming.value = { key: NEW_KEY, name, value: name, dir: true, isNew: true };
  }

  function cancelRename() {
    renaming.value = null;
  }

  // 提交改名。新建的什么都没填就当取消；名字不合规时提示并让输入框继续留着。
  async function commitRename() {
    const r = renaming.value;
    if (!r || r.saving) return;
    // 提交前复查权限：弹窗开着的时候权限可能已经变了（审查发现）
    if (!may(r.isNew ? "create" : "rename")) {
      renaming.value = null;
      return toast("没有权限执行这个操作", "error");
    }
    const name = String(r.value ?? "").trim();
    const reject = (msg) => {
      toast(msg, "error");
      renameRetry.value++;
    };
    if (r.isNew && !name) {
      renaming.value = null;
      return;
    }
    const bad = checkName(name);
    if (bad) return reject(bad);
    if (name !== r.name && takenIn(name)) return reject("此位置已经有同名的文件或文件夹");
    if (!r.isNew && name === r.name) {
      renaming.value = null;
      return;
    }
    const to = `${parentDir(r.key)}${name}${r.dir ? "/" : ""}`;
    r.saving = true;
    try {
      if (r.isNew) await api.createFolder({ prefix: path.value, name });
      else await api.rename({ key: r.key, to });
      renaming.value = null;
      await afterWrite([path.value], [to]);
      // 输入框随改名一起没了，焦点会落回 body：交还给文件区，接着双击、按快捷键都还管用
      viewFocus?.();
    } catch (e) {
      renaming.value = null;
      toast(e?.message || "没有改成，请稍后重试", "error");
      viewFocus?.();
    } finally {
      r.saving = false;
    }
  }

  // ---- 上传 ----
  const uploads = useUploads({
    api,
    onSettled: async (list, dirs) => {
      const failed = list.filter((t) => t.status === "error").length;
      const ok = list.filter((t) => t.status === "done").length;
      if (failed) toast(`${failed} 个文件没有传上去`, "error");
      else if (ok) toast(`已上传 ${ok} 个文件`, "success");
      invalidateTree(dirs);
      await load({ fresh: true });
    },
  });

  // 在指定目录里现建一个「新建文件夹 (n)」并回它的完整键；「移动到」弹窗用。
  // 权限、查重与提示都收在这里，弹窗不再自己摸 api（那条入口曾绕过权限）。
  async function createFolderAt(dir) {
    if (!may("create")) {
      toast(why("create") || "没有权限新建文件夹", "error");
      return null;
    }
    const r = await api.list({ prefix: dir });
    const taken = new Set(r.entries.map((e) => e.name));
    const name = uniqueName((n) => taken.has(n), "新建文件夹");
    await api.createFolder({ prefix: dir, name });
    return `${dir}${name}/`;
  }

  // 收下一批要传的文件（每一项是 { file, rel }，rel 是带上相对目录的路径）。先查类型和大小，
  // 再定落下的对象名：落点 = 当前目录 + 相对路径，同名的加序号。
  function addFiles(list) {
    if (!may("upload")) return toast(why("upload") || "这个目录不能上传", "error");
    const ok = [];
    const rejected = [];
    for (const f of list) {
      const name = baseName(f.rel.replace(/\/$/, ""));
      if (checkName(name)) rejected.push(`${name}：文件名不合法`);
      else if (maxSize.value && f.file.size > maxSize.value) rejected.push(`${name}：超过 ${fmtSize(maxSize.value)} 的上限`);
      else if (accept.value.length && !accept.value.includes(`.${extOf(name)}`)) rejected.push(`${name}：不支持的文件类型`);
      else ok.push(f);
    }
    if (rejected.length) {
      toast(`${rejected[0]}${rejected.length > 1 ? `，另有 ${rejected.length - 1} 个文件没有上传` : ""}`, "error");
    }
    if (!ok.length) return;
    const used = new Set(entries.value.map((e) => e.key));
    uploads.enqueue(
      ok.map((f) => {
        const dir = path.value + f.rel.slice(0, f.rel.length - f.file.name.length);
        const key = dir + uniqueName((n) => used.has(dir + n), f.file.name);
        used.add(key);
        return { file: f.file, key, rel: f.rel };
      }),
    );
  }

  const fileInput = ref(null);
  const folderInput = ref(null);
  const pickFiles = () => fileInput.value?.click();
  const pickFolder = () => folderInput.value?.click();
  function onPicked(e) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    addFiles(files.map((file) => ({ file, rel: file.webkitRelativePath || file.name })));
  }

  // 拖进来：能用目录条目接口就逐层读出相对路径（整个文件夹的结构才留得住），用不了就只收文件。
  // webkitGetAsEntry 必须在拖放事件还活着的时候同步取全——事件一结束拖拽数据就进保护模式，
  // 之后再取回 null，多选的拖拽只会进第一项（实测过）。
  async function readDrop(dt) {
    const items = [...(dt.items || [])];
    const out = [];
    let skipped = 0;
    const walk = async (entry, rel, depth) => {
      if (!entry) return;
      // 层数封顶：拖进来的结构没有环，封顶只是防手滑拖一个异常深的目录把页面卡住
      if (depth > 8) {
        skipped++;
        return;
      }
      if (entry.isFile) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject)).catch(() => null);
        if (file) out.push({ file, rel: rel + file.name });
        else skipped++;
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        // 这个接口一次只吐一批，要读到空数组才算完
        for (;;) {
          const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject)).catch(() => []);
          if (!batch.length) break;
          for (const child of batch) await walk(child, `${rel}${entry.name}/`, depth + 1);
        }
      }
    };
    const roots = items.map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null));
    if (roots.some(Boolean)) {
      for (const root of roots) await walk(root, "", 0);
      if (skipped) toast(`${skipped} 个条目读不出来，已跳过`, "error");
      return out;
    }
    return [...(dt.files || [])].map((file) => ({ file, rel: file.name }));
  }

  // 拖着文件在组件上方晃：进去计数、出来减一，免得在子元素之间移动时提示一闪一闪。
  // 拖放事件一律接管：不拦的话浏览器会自己打开那个文件，把后台页面导走。
  const dropping = ref(false);
  let dragDepth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  function onDragEnter(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (++dragDepth === 1) dropping.value = may("upload");
  }
  function onDragOver(e) {
    if (hasFiles(e)) e.preventDefault();
  }
  function onDragLeave(e) {
    if (--dragDepth <= 0 || !e.relatedTarget) {
      dragDepth = 0;
      dropping.value = false;
    }
  }
  async function onDrop(e) {
    dragDepth = 0;
    dropping.value = false;
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (!may("upload")) return toast(why("upload") || "这个目录不能上传", "error");
    addFiles(await readDrop(e.dataTransfer));
  }

  // ---- 右键菜单 ----
  // 菜单的位置：x、y 是左上角想放的地方；above 给了就表示可以从这个高度往上翻（贴着窗口底边放不下时用）；
  // up 为真是一定往上开（状态栏上的那两个按钮）。
  const menu = ref(null);
  const openMenu = (x, y, items, extra = {}) => (menu.value = { x, y, items, ...extra });
  const closeMenu = () => (menu.value = null);

  const setSort = (key) => (sort.value = sort.value.key === key ? { key, dir: -sort.value.dir } : { key, dir: 1 });
  const sortMenu = () => SORTS.map((s) => ({ icon: "sort", label: s.label, checked: sort.value.key === s.key, onClick: () => setSort(s.key) }));
  const viewMenu = () =>
    VIEWS.map(([k, label]) => ({ icon: VIEW_ICON[k] || "viewGrid", label, checked: view.value === k, onClick: () => (view.value = k) }));
  // 上传入口：除了选文件，还能把收起的上传记录重新调出来（关掉浮层不等于丢了记录）、清空已结束的记录
  const uploadMenu = () => [
    { icon: "document", label: "上传文件", onClick: pickFiles },
    { icon: "folder", label: "上传文件夹", onClick: pickFolder },
    ...(uploads.tasks.value.length
      ? [
          "-",
          { icon: "upload", label: `上传记录（${uploads.tasks.value.length}）`, onClick: () => (uploads.panel.open = true) },
          ...(!uploads.summary.value.working
            ? [{ icon: "delete", label: "清空记录", onClick: () => uploads.clear() }]
            : []),
        ]
      : []),
  ];
  const selectAll = () => selection.set(visibleKeys.value);

  // 右键点在一条上：它不在当前选择里就先单独选中它，菜单对整批选择生效
  function entryMenu(entry, ev) {
    if (!selection.keys.value.has(entry.key)) selection.only(entry.key);
    const many = selected.value.length > 1;
    openMenu(ev.clientX, ev.clientY, [
      entry.dir
        ? { icon: "folderOpen", label: "打开", key: "Enter", onClick: () => nav.go(entry.key) }
        : typeOf(entry).image
          ? { icon: "eye", label: "预览", key: "Enter", onClick: () => (viewer.value = { key: entry.key }) }
          : { icon: "download", label: "下载", key: "Enter", onClick: () => download([entry]) },
      ...(entry.dir ? [] : [{ icon: "link", label: "复制下载链接", onClick: () => copyLink([entry]) }]),
      "-",
      { icon: "cut", label: "剪切", key: "Ctrl+X", disabled: !may("move"), onClick: () => cutOrCopy("cut") },
      { icon: "copy", label: "复制", key: "Ctrl+C", disabled: !can("copy"), onClick: () => cutOrCopy("copy") },
      "-",
      { icon: "edit", label: "重命名", key: "F2", disabled: !may("rename") || many, onClick: () => startRename(entry) },
      { icon: "moveTo", label: "移动到", disabled: !may("move"), onClick: () => askTransfer("cut") },
      { icon: "copy", label: "复制到", disabled: !can("copy"), onClick: () => askTransfer("copy") },
      "-",
      { icon: "delete", label: "删除", key: "Delete", disabled: !may("delete"), onClick: () => askDelete() },
    ]);
  }

  function blankMenu(ev) {
    openMenu(ev.clientX, ev.clientY, [
      { icon: "refresh", label: "刷新", key: "F5", onClick: refresh },
      { icon: "add", label: "新建文件夹", disabled: !may("create"), onClick: startNewFolder },
      { icon: "upload", label: "上传", disabled: !may("upload"), sub: uploadMenu },
      {
        icon: "paste",
        label: "粘贴",
        key: "Ctrl+V",
        disabled: !clip.value || !may(clip.value.mode === "cut" ? "move" : "copy") || !canPaste.value,
        onClick: paste,
      },
      "-",
      { icon: "sort", label: "排序", sub: sortMenu },
      { icon: "viewGrid", label: "查看", sub: viewMenu },
      "-",
      { icon: "check", label: "全部选中", key: "Ctrl+A", onClick: selectAll },
    ]);
  }

  // ---- 命令栏：每条命令亮不亮，不亮是为什么 ----
  const cmd = computed(() => {
    const sel = selected.value;
    const one = sel.length === 1;
    const many = sel.length > 0;
    const files = sel.filter((e) => !e.dir).length;
    const no = (whyNot) => whyNot || "";
    const state = (enabled, whyNot) => (enabled ? "" : no(whyNot));
    const clipMode = clip.value?.mode === "cut" ? "move" : "copy";
    return {
      create: state(may("create"), why("create")),
      upload: state(may("upload"), why("upload")),
      cut: state(many && may("move"), many ? why("move") : "先选中要剪切的项目"),
      copy: state(many && can("copy"), many ? "没有权限" : "先选中要复制的项目"),
      paste: state(canPaste.value && may(clipMode), !clip.value ? "没有可粘贴的内容" : !canPaste.value ? "已经在原处了" : why(clipMode)),
      rename: state(one && may("rename"), one ? why("rename") : many ? "一次只能改一个名字" : "先选中要改名的项目"),
      moveTo: state(many && may("move"), many ? why("move") : "先选中要移动的项目"),
      copyTo: state(many && can("copy"), many ? "没有权限" : "先选中要复制的项目"),
      delete: state(many && may("delete"), many ? why("delete") : "先选中要删除的项目"),
      more: state(many || writable.value, many ? "" : "这个目录只读"),
      download: state(one && !sel[0].dir && can("download"), one && sel[0].dir ? "文件夹打包下载放在下一版本" : many > 1 ? "一次下载一个文件，打包下载放在下一版本" : "没有权限"),
      link: state(files > 0 && can("download"), many && !files ? "文件夹没有下载链接" : !can("download") ? "没有权限" : ""),
    };
  });

  // ---- 快捷键 ----
  // 挂在 document 上而不是只挂组件根：点了勾选框、对话框按钮之后焦点会挪到别处，
  // 只挂组件根时 F2 / Delete 就接不到了。但输入框与弹层里的按键不抢。
  function onKeydown(ev) {
    const t = ev.target;
    if (ev.key === "Escape") {
      closeMenu();
      return;
    }
    // 输入框、文本框里的按键留给它们自己（改名弹窗的 Enter、Esc 在弹窗里处理）
    if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    // 焦点不在文件管理器里就不抢：挂在 document 上是为了勾选框、关掉的对话框之后
    // 还能按 F2/Delete，但注意力若在后台别处（左侧导航、页头、别的弹层），按 Delete / Ctrl+V
    // 不该动文件管理器里残留的选择——那会误删或误粘。
    const inFm = t instanceof Element && !!t.closest(".fm");
    // .el-image-viewer__wrapper 是 ElImageViewer 传送到 body 下的根节点
    const inDialog = t instanceof Element && !!t.closest(".fm-dialog, .fm-viewer, .fm-menu, .el-image-viewer__wrapper");
    // 弹层里只管 Esc（菜单关掉、弹窗自己关），Delete / F2 / Ctrl+V 这些一律不接：
    // 预览大图时按 Delete 不该把背后选中的文件删掉
    if (inDialog) return;
    if (!inFm) {
      const active = document.activeElement;
      const activeInFm = active instanceof Element && !!active.closest(".fm");
      if (!activeInFm) return;
    }
    const mod = ev.ctrlKey || ev.metaKey;
    const key = ev.key.toLowerCase();
    if (mod && key === "a") {
      ev.preventDefault();
      selectAll();
    } else if (mod && key === "c") cutOrCopy("copy");
    else if (mod && key === "x") cutOrCopy("cut");
    else if (mod && key === "v") paste();
    else if (mod || ev.altKey) return;
    else if (ev.key === "F2") {
      ev.preventDefault();
      startRename();
    } else if (ev.key === "Delete") askDelete();
    else if (ev.key === "F5") {
      ev.preventDefault();
      refresh();
    } else if (ev.key === "Backspace") {
      ev.preventDefault();
      nav.up();
    } else if (ev.key === "Enter") {
      if (selected.value.length === 1) open(selected.value[0]);
    }
  }

  // ---- 起步与联动 ----
  watch(path, () => {
    selection.clear();
    query.value = "";
    closeMenu();
    load();
    syncTree(path.value);
  });
  onMounted(() => {
    load();
    syncTree(path.value);
  });

  const pick = (key, ev) => selection.pick(key, ev, visibleKeys.value);

  return reactive({
    api,
    // 路径
    path,
    crumbs: computed(() => crumbs(path.value)),
    canBack: nav.canBack,
    canForward: nav.canForward,
    canUp: nav.canUp,
    go: nav.go,
    back: nav.back,
    forward: nav.forward,
    up: nav.up,
    writable,
    writableRoots: [],
    // 与 writable 同口径：不设目录白名单，任何目录都可作为移动、复制的目标
    canWriteDir: () => true,
    may,
    why,
    // 列表
    entries,
    visible,
    visibleKeys,
    marker,
    hasMore: computed(() => !!marker.value),
    loading,
    loadingMore,
    error,
    query,
    sort,
    sorts: SORTS,
    setSort,
    view,
    views: VIEWS,
    viewIcon: computed(() => VIEW_ICON[view.value] || "viewGrid"),
    spinning,
    refresh,
    load,
    loadMore,
    matchCount: computed(() => (query.value.trim() ? visible.value.length : 0)),
    // 目录树
    tree,
    treeRows,
    toggleTree,
    invalidateTree,
    syncTree,
    // 选择
    selected,
    selectedFiles,
    selectedSize: computed(() => selected.value.reduce((s, e) => s + (e.dir ? 0 : e.size || 0), 0)),
    selectedCount: computed(() => selected.value.length),
    isSelected: (key) => selection.keys.value.has(key),
    allSelected: computed(() => visibleKeys.value.length > 0 && selected.value.length === visibleKeys.value.length),
    someSelected: computed(() => selected.value.length > 0 && selected.value.length < visibleKeys.value.length),
    pick,
    toggle: selection.toggle,
    setSelection: selection.set,
    addSelection: (keys) => selection.set([...new Set([...selection.keys.value, ...keys])]),
    clearSelection: selection.clear,
    selectAll,
    // 剪贴板与搬动
    clip,
    canPaste,
    isCut,
    cutOrCopy,
    paste,
    askTransfer,
    doTransfer,
    moveDialog,
    // 删除
    confirmDelete,
    askDelete,
    doDelete,
    // 新建与改名
    renaming,
    renameRetry,
    startRename,
    startNewFolder,
    commitRename,
    cancelRename,
    setViewFocus,
    // 打开、下载
    open,
    download,
    copyLink,
    viewer,
    viewerImages,
    // 上传。队列自己管自己的响应式，不再包一层
    uploads: markRaw(uploads),
    addFiles,
    createFolderAt,
    fileInput,
    folderInput,
    pickFiles,
    pickFolder,
    onPicked,
    dropping,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    // 菜单、快捷键、提示、长操作
    menu,
    openMenu,
    closeMenu,
    entryMenu,
    blankMenu,
    sortMenu,
    viewMenu,
    uploadMenu,
    cmd,
    onKeydown,
    toast,
    busy,
    typeOf,
  });
}
