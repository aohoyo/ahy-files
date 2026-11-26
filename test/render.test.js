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

async function mountFm() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const app = createApp(FileManager, { api: fakeApi() });
  app.mount(el);
  await nextTick();
  // 让 onMounted 里的 load / syncTree 这些异步调用落定
  await new Promise((r) => setTimeout(r, 0));
  return { el, app };
}

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
});
