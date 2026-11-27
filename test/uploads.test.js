import { afterEach, describe, expect, it, vi } from "vitest";
import { useUploads } from "../src/file-manager/composables/useUploads";

// 上传队列：适配器自己传、拿凭证按表单直传两条路都走到，外加撞名重试与取消。
const tick = () => new Promise((r) => setTimeout(r, 0));
// 用真的 File：按表单直传那条路会把文件放进 FormData，普通对象会被转成字符串
const file = (name, size = 100) => new File([new Uint8Array(size)], name);
const items = (...rels) => rels.map((rel) => ({ file: file(rel.split("/").pop()), key: `files/${rel}`, rel }));

// 让排着的异步步骤都跑完
async function settle(queue) {
  for (let i = 0; i < 50 && queue.summary.value.working; i++) await tick();
}

describe("useUploads 适配器自己传", () => {
  it("每个文件交给适配器的 upload，带进度；全部结束后交代一次，并报出涉及的目录和它们的上层", async () => {
    const calls = [];
    const settled = [];
    const api = {
      async upload({ key, file: f, onProgress }) {
        calls.push(key);
        for (const n of [f.size / 2, f.size]) onProgress(n);
      },
    };
    const q = useUploads({ api, onSettled: (list, dirs) => settled.push({ list, dirs }) });
    q.enqueue(items("a/b/c.zip", "a/d.txt"));
    expect(q.panel.open).toBe(true);
    await settle(q);
    expect(calls.sort()).toEqual(["files/a/b/c.zip", "files/a/d.txt"]);
    expect(q.tasks.value.map((t) => t.status)).toEqual(["done", "done"]);
    expect(settled.length).toBe(1);
    expect(settled[0].list.length).toBe(2);
    expect([...settled[0].dirs].sort()).toEqual(["", "files/", "files/a/", "files/a/b/"]);
    expect(q.summary.value).toMatchObject({ total: 2, done: 2, failed: 0, working: false, percent: 100 });
    // 关浮层只收浮层，记录留着（关掉后还能从上传入口点回来）；清空是单独的动作
    q.close();
    expect(q.panel.open).toBe(false);
    expect(q.tasks.value.length).toBe(2);
    q.clear();
    expect(q.tasks.value.length).toBe(0);
  });

  it("适配器报错的记成失败，带着原因；同批其他文件照传", async () => {
    const api = {
      async upload({ key }) {
        if (key.endsWith("bad.zip")) throw new Error("空间不够了");
      },
    };
    const q = useUploads({ api, onSettled: () => {} });
    q.enqueue(items("good.zip", "bad.zip"));
    await settle(q);
    const bad = q.tasks.value.find((t) => t.key.endsWith("bad.zip"));
    expect(bad.status).toBe("error");
    expect(bad.error).toBe("空间不够了");
    expect(q.summary.value).toMatchObject({ done: 1, failed: 1 });
  });

  it("最多三个同时传，多出来的排队", async () => {
    let active = 0;
    let peak = 0;
    const api = {
      async upload() {
        peak = Math.max(peak, ++active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      },
    };
    const q = useUploads({ api, onSettled: () => {} });
    q.enqueue(items("1.zip", "2.zip", "3.zip", "4.zip", "5.zip"));
    await settle(q);
    expect(peak).toBe(3);
    expect(q.tasks.value.every((t) => t.status === "done")).toBe(true);
  });
});

// 假的 XMLHttpRequest：记下每次发出去的表单，由测试决定什么时候回什么。
function installXhr() {
  const sent = [];
  const xhrs = [];
  class FakeXHR {
    constructor() {
      this.upload = {};
      this.status = 0;
      this.responseText = "";
      xhrs.push(this);
    }
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader() {}
    send(body) {
      this.body = body;
      sent.push(this);
    }
    progress(loaded) {
      this.upload.onprogress?.({ lengthComputable: true, loaded, total: 100 });
    }
    respond(status, text) {
      this.status = status;
      this.responseText = text;
      this.onload?.();
    }
    abort() {
      this.aborted = true;
      this.onabort?.();
    }
  }
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
  return { sent, xhrs, FakeXHR };
}

afterEach(() => vi.unstubAllGlobals());

describe("useUploads 按表单直传", () => {
  it("先拿凭证，再把 key、token、文件用表单发给凭证给的上传地址；进度回到任务上", async () => {
    const { sent } = installXhr();
    const tickets = [];
    const api = {
      async uploadTicket({ name, key }) {
        tickets.push({ name, key });
        return { token: `tok-${key}`, key, uploadUrl: "https://up.example.com" };
      },
    };
    const q = useUploads({ api, onSettled: () => {} });
    q.enqueue(items("装机包.zip"));
    for (let i = 0; i < 5 && !sent.length; i++) await tick();
    expect(tickets).toEqual([{ name: "装机包.zip", key: "files/装机包.zip" }]);
    expect(sent.length).toBe(1);
    expect(sent[0].method).toBe("POST");
    expect(sent[0].url).toBe("https://up.example.com");
    expect(sent[0].body.get("key")).toBe("files/装机包.zip");
    expect(sent[0].body.get("token")).toBe("tok-files/装机包.zip");
    expect(sent[0].body.get("file").name).toBe("装机包.zip");

    sent[0].progress(40);
    expect(q.tasks.value[0].loaded).toBe(40);
    expect(q.summary.value.percent).toBe(40);
    sent[0].respond(200, "{}");
    await settle(q);
    expect(q.tasks.value[0].status).toBe("done");
  });

  it("对象存储说同名已存在（614）：换下一个序号重试，最后落在不重名的名字上", async () => {
    const { sent } = installXhr();
    const keys = [];
    const api = {
      async uploadTicket({ key }) {
        keys.push(key);
        return { token: "t", key, uploadUrl: "https://up.example.com" };
      },
    };
    const q = useUploads({ api, onSettled: () => {} });
    q.enqueue(items("a.zip"));
    for (let i = 0; i < 5 && !sent.length; i++) await tick();
    sent[0].respond(614, '{"error":"file exists"}');
    for (let i = 0; i < 5 && sent.length < 2; i++) await tick();
    sent[1].respond(200, "{}");
    await settle(q);
    expect(keys).toEqual(["files/a.zip", "files/a (1).zip"]);
    expect(q.tasks.value[0].key).toBe("files/a (1).zip");
    expect(q.tasks.value[0].status).toBe("done");
  });

  it("别的失败不重试，记下原因；网络中断也算失败", async () => {
    const { sent, xhrs } = installXhr();
    const api = { async uploadTicket({ key }) { return { token: "t", key, uploadUrl: "https://up" }; } };
    const q = useUploads({ api, onSettled: () => {} });
    q.enqueue(items("a.zip", "b.zip"));
    for (let i = 0; i < 5 && sent.length < 2; i++) await tick();
    sent[0].respond(403, '{"error":"forbidden"}');
    xhrs.find((x) => x !== sent[0] && x.body).onerror?.();
    await settle(q);
    const [a, b] = q.tasks.value;
    expect(a.status).toBe("error");
    expect(a.error).toMatch(/403/);
    expect(b.status).toBe("error");
    expect(b.error).toMatch(/网络/);
    expect(sent.length).toBe(2);
  });

  it("重试有上限：一直撞名就记成失败，不无限试下去", async () => {
    const { sent } = installXhr();
    const api = { async uploadTicket({ key }) { return { token: "t", key, uploadUrl: "https://up" }; } };
    const q = useUploads({ api, onSettled: () => {} });
    q.enqueue(items("a.zip"));
    for (let round = 0; round < 10 && q.summary.value.working; round++) {
      for (let i = 0; i < 5 && sent.length === round; i++) await tick();
      if (sent[round]) sent[round].respond(614, '{"error":"file exists"}');
      await tick();
    }
    await settle(q);
    expect(sent.length).toBe(5);
    expect(q.tasks.value[0].status).toBe("error");
    expect(q.tasks.value[0].error).toMatch(/同名/);
  });

  it("取消：在传的中断、排队的作废，已经传完的留着，交代时不把作废的算进去", async () => {
    const { sent, xhrs } = installXhr();
    const settled = [];
    const api = { async uploadTicket({ key }) { return { token: "t", key, uploadUrl: "https://up" }; } };
    const q = useUploads({ api, onSettled: (list) => settled.push(list) });
    q.enqueue(items("1.zip", "2.zip", "3.zip", "4.zip", "5.zip"));
    for (let i = 0; i < 5 && sent.length < 3; i++) await tick();
    sent[0].respond(200, "{}");
    await tick();
    q.cancel();
    // 取消后浮层不关：记录留着，看得到哪些取消了（2026-11-26 改）
    expect(q.panel.open).toBe(true);
    await settle(q);
    const statuses = q.tasks.value.map((t) => t.status);
    expect(statuses.filter((s) => s === "canceled").length).toBe(4);
    expect(statuses.filter((s) => s === "done").length).toBe(1);
    expect(settled.length).toBe(1);
    expect(settled[0].map((t) => t.rel)).toEqual(["1.zip"]);
    // 三个在传的被中断，两个排队的没发出去
    expect(xhrs.filter((x) => x.aborted).length).toBe(3);
    expect(xhrs.filter((x) => x.body).length).toBe(4);
  });

  it("凭证还没回来就取消：不再发请求，任务记成已取消（2026-11-27 审查 P1）", async () => {
    const { sent } = installXhr();
    let releaseTicket;
    const gate = new Promise((resolve) => (releaseTicket = resolve));
    const api = {
      async uploadTicket({ key }) {
        await gate;
        return { token: "t", key, uploadUrl: "https://up" };
      },
    };
    const q = useUploads({ api, onSettled: () => {} });
    q.enqueue(items("a.zip", "b.zip", "c.zip"));
    for (let i = 0; i < 5 && q.tasks.value.filter((t) => t.status === "uploading").length < 3; i++) await tick();
    // 三个都卡在取凭证，此时取消：abort 事件已经发过去了
    q.cancel();
    releaseTicket();
    await settle(q);
    expect(q.tasks.value.map((t) => t.status)).toEqual(["canceled", "canceled", "canceled"]);
    expect(sent.length).toBe(0);
  });

  it("上一批已经结束，再传一批时旧记录清掉，表头只数当前批（2026-11-27 审查 P1）", async () => {
    const api = {
      async upload({ key }) {
        // 挂住第一批，之后好同时放开
      },
    };
    let releaseAll;
    const gate = new Promise((resolve) => (releaseAll = resolve));
    const q = useUploads({
      api: { upload: async (a) => { if (a.key.includes("1")) await gate; } },
      onSettled: () => {},
    });
    q.enqueue(items("1.zip", "2.zip"));
    await tick();
    // 1.zip 还挂着，2.zip 先传完
    await settle(q);
    expect(q.summary.value).toMatchObject({ total: 2, working: true, done: 1 });
    releaseAll();
    await settle(q);
    expect(q.summary.value).toMatchObject({ total: 2, done: 2, working: false });
    // 第二批入队：旧记录清掉，只剩新批
    q.enqueue(items("9.zip"));
    expect(q.tasks.value.map((t) => t.rel)).toEqual(["9.zip"]);
    expect(q.summary.value).toMatchObject({ total: 1 });
    await settle(q);
  });
});
