import { describe, expect, it } from "vitest";
import { createApp, nextTick } from "vue";
import FileManager from "../src/file-manager/FileManager.vue";

// 挂载渲染测试：组件装起来、首轮列目录跑完，页面该出来的都出来。
// 2026-11-26 补——目录白名单移除时漏删了 roots 引用，页面一挂载就抛 ReferenceError，
// 用户看到的正是「正在读取…」永远在转；这类错静态检查和单测都抓不到，只能靠真实挂载。

// 什么文件都没有的假适配器：挂载阶段只用到 list
function fakeApi() {
  return {
    async list() {
      return { entries: [], marker: "", downloadBase: "", limits: { max_size: 0, accept: [] } };
    },
  };
}

async function mountFm(props = { api: fakeApi() }) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const app = createApp(FileManager, props);
  app.mount(el);
  await nextTick();
  // 让 onMounted 里的 load / syncTree 这些异步调用落定
  await new Promise((r) => setTimeout(r, 0));
  return { el, app };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("FileManager 挂载渲染", () => {
  it("首屏不抛错：工具栏、目录树、文件区、状态栏都在，首轮列目录后 loading 收掉", async () => {
    const { el, app } = await mountFm();
    expect(el.querySelector(".fm-toolbar")).toBeTruthy();
    expect(el.querySelector(".fm-tree")).toBeTruthy();
    expect(el.querySelector(".fm-view")).toBeTruthy();
    expect(el.querySelector(".fm-status")).toBeTruthy();
    expect(el.querySelector(".fm-loading")).toBeNull();
    app.unmount();
    el.remove();
  });

  it("切目录失败后旧目录的条目不残留，报错显示出来（2026-11-27 审查 P1）", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const seen = [];
    const app = createApp(FileManager, {
      api: {
        async list({ prefix }) {
          seen.push(prefix);
          if (prefix === "files/坏目录/") throw new Error("对象存储超时");
          return {
            entries:
              prefix === ""
                ? [{ key: "files/坏目录/", name: "坏目录", is_dir: true }]
                : [{ key: `${prefix}旧文件.zip`, name: "旧文件.zip", is_dir: false }],
            marker: "",
            downloadBase: "",
            limits: { max_size: 0, accept: [] },
          };
        },
      },
    });
    app.mount(el);
    await flush();
    expect(el.querySelectorAll("[data-key]").length).toBeGreaterThan(0);
    // 双击文件区里的目录行进坏目录（用户路径），这一路每层都会列一次（syncTree），最后一个 list 是坏目录
    let dirRow = null;
    for (let i = 0; i < 20 && !dirRow; i++) {
      await flush();
      dirRow = el.querySelector('[data-key="files/坏目录/"]');
    }
    expect(dirRow).toBeTruthy();
    dirRow.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    // 清场后 loading 期间旧条目就该消失
    await flush();
    expect(el.querySelector('[data-key$="旧文件.zip"]')).toBeNull();
    // 失败落定：报错与重试按钮出现
    for (let i = 0; i < 10 && !el.textContent.includes("没能列出来"); i++) await flush();
    expect(el.textContent).toContain("没能列出来");
    expect(el.textContent).toContain("对象存储超时");
    app.unmount();
    el.remove();
  });

  it("can 全 false 时动作按钮置灰，删除不发请求（2026-11-27 审查 P1 权限行为）", async () => {
    const removed = [];
    const el = document.createElement("div");
    document.body.appendChild(el);
    const app = createApp(FileManager, {
      api: {
        async list() {
          return {
            entries: [{ key: "files/a.zip", name: "a.zip", is_dir: false }],
            marker: "",
            downloadBase: "",
            limits: { max_size: 0, accept: [] },
          };
        },
        async remove({ keys }) {
          removed.push(...keys);
        },
      },
      can: () => false,
    });
    app.mount(el);
    await flush();
    // 选中唯一一行，点删除
    const tr = el.querySelector(".fm-list tbody tr");
    tr.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    tr.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
    const del = [...el.querySelectorAll(".fm-cmd")].find((b) => b.textContent.includes("删除"));
    expect(del.disabled).toBe(true);
    del.click();
    await flush();
    expect(removed).toEqual([]);
    // 就算确认框被外力打开，doDelete 也会复查权限
    app.unmount();
    el.remove();
  });
});
