import { computed, reactive, ref } from "vue";
import { baseName, parentDir } from "../logic/path";
import { nextNumbered } from "../logic/naming";

// 上传队列：最多几个同时传，每个任务带自己的进度。适配器给了 upload 就用它传；
// 没给就自己拿直传凭证，按对象存储的表单格式传（用 XMLHttpRequest 是因为要上传进度，fetch 拿不到）。
const CONCURRENCY = 3;
// 列表没列全、或者别人刚传了同名的，对象存储会拒收：换下一个序号再试，最多这么多次
const RENAME_RETRIES = 4;

export function useUploads({ api, onSettled }) {
  const tasks = ref([]);
  const panel = reactive({ open: false, small: false });
  let seq = 0;
  let active = 0;
  let pendingBatch = null; // 这一批涉及的目录，全部结束后交给外面去刷新
  const controllers = new Set();

  const summary = computed(() => {
    const list = tasks.value;
    const live = list.filter((t) => t.status !== "canceled");
    const bytes = live.reduce((s, t) => s + t.size, 0);
    const loaded = live.reduce((s, t) => s + t.loaded, 0);
    const of = (status) => list.filter((t) => t.status === status).length;
    return {
      total: live.length,
      done: of("done"),
      failed: of("error"),
      working: list.some((t) => t.status === "wait" || t.status === "uploading"),
      next: Math.min(of("done") + of("uploading") + 1, live.length),
      percent: bytes ? Math.round((loaded / bytes) * 100) : 100,
    };
  });

  // 收下一批要传的文件：每一项是 { file, key, rel }，key 是落下的对象名，rel 是显示用的相对路径。
  function enqueue(items) {
    if (!items.length) return;
    const dirs = new Set(pendingBatch || []);
    for (const it of items) {
      let dir = parentDir(it.key);
      for (;;) {
        dirs.add(dir);
        if (dir === "") break;
        dir = parentDir(dir);
      }
      tasks.value.push({
        id: ++seq, key: it.key, rel: it.rel, file: it.file,
        size: it.file.size, loaded: 0, status: "wait", error: "",
      });
    }
    pendingBatch = dirs;
    panel.open = true;
    panel.small = false;
    pump();
  }

  function pump() {
    while (active < CONCURRENCY) {
      const next = tasks.value.find((t) => t.status === "wait");
      if (!next) break;
      run(next);
    }
  }

  async function run(task) {
    active++;
    task.status = "uploading";
    const ctrl = new AbortController();
    controllers.add(ctrl);
    let key = task.key;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await uploadOne(task, key, ctrl.signal);
          break;
        } catch (e) {
          if (attempt >= RENAME_RETRIES || !e?.exists) throw e;
          key = parentDir(key) + nextNumbered(baseName(key));
          task.loaded = 0;
        }
      }
      task.key = key;
      task.loaded = task.size;
      task.status = "done";
    } catch (e) {
      task.status = ctrl.signal.aborted ? "canceled" : "error";
      task.error = ctrl.signal.aborted ? "" : e?.message || "上传失败";
    } finally {
      controllers.delete(ctrl);
      active--;
      if (active === 0 && !tasks.value.some((t) => t.status === "wait")) settle();
      else pump();
    }
  }

  // 一批全部结束（传完、失败或取消）时交代一次：只报这一批里还没报过的任务，两批挨着传时才不会重复计数。
  function settle() {
    if (!pendingBatch) return;
    const dirs = [...pendingBatch];
    pendingBatch = null;
    const fresh = tasks.value.filter((t) => t.status !== "canceled" && !t.reported);
    for (const t of fresh) t.reported = true;
    onSettled(fresh, dirs);
  }

  function uploadOne(task, key, signal) {
    if (typeof api.upload === "function") {
      return api.upload({ key, file: task.file, signal, onProgress: (n) => (task.loaded = n) });
    }
    return formUpload(task, key, signal);
  }

  async function formUpload(task, key, signal) {
    const ticket = await api.uploadTicket({ name: task.file.name, key });
    await postForm(ticket.uploadUrl, { key: ticket.key, token: ticket.token, file: task.file }, task, signal);
  }

  function postForm(url, fields, task, signal) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("key", fields.key);
      form.append("token", fields.token);
      form.append("file", fields.file);
      xhr.open("POST", url);
      xhr.upload.onprogress = (e) => e.lengthComputable && (task.loaded = e.loaded);
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(uploadError(xhr)));
      xhr.onerror = () => reject(new Error("网络中断，上传失败"));
      xhr.onabort = () => reject(Object.assign(new Error("已取消"), { aborted: true }));
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
      xhr.send(form);
    });
  }

  // 对象存储拒绝时的原因。同名已存在要单独认出来，外面靠它换序号重试。
  function uploadError(xhr) {
    let detail = "";
    try {
      detail = JSON.parse(xhr.responseText)?.error || "";
    } catch {
      // 回的不是 JSON，只有状态码
    }
    if (xhr.status === 614 || /exists/i.test(detail)) {
      return Object.assign(new Error("同名文件已存在"), { exists: true });
    }
    return new Error(`上传失败：对象存储返回 ${xhr.status}${detail ? " " + detail : ""}`);
  }

  // 取消：在传的中断，排着队的作废；已经传完的留在存储里。浮层不关——
  // 记录留在原地，使用者看得到哪些传完了、哪些被取消了（2026-11-26 创始人定）。
  function cancel() {
    for (const t of tasks.value) if (t.status === "wait") t.status = "canceled";
    for (const c of controllers) c.abort();
  }

  // 收起或关掉浮层只动浮层本身；记录留着，命令栏的上传入口能再点回来。
  function close() {
    panel.open = false;
    panel.small = false;
  }

  // 真正清空这批记录（上传入口的「清空记录」用）。还在传时不清。
  function clear() {
    if (summary.value.working) return;
    tasks.value = [];
    panel.open = false;
    panel.small = false;
  }

  return { tasks, panel, summary, enqueue, cancel, close, clear };
}
