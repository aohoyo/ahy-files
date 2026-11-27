import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequest, createStorageApi } from "../src/file-manager/api";

// 记下每次请求，按设定回数据；默认什么都不回。
function fakeRequest(reply = () => ({})) {
  const calls = [];
  const request = async (args) => {
    calls.push(args);
    return reply(args, calls.length);
  };
  return { calls, request };
}

describe("createStorageApi 接 ahy-storage 的默认适配器", () => {
  it("list 把目录和文件并成条目，目录在前；翻页标记与下载基地址原样带回", async () => {
    const { calls, request } = fakeRequest(() => ({
      prefix: "files/",
      dirs: [{ key: "files/a/", name: "a", is_dir: true }],
      files: [
        { key: "files/x.zip", name: "x.zip", is_dir: false, size: 123, put_at: 1700000000 },
        { key: "files/y/", name: "y", is_dir: false, size: 5 },
      ],
      marker: "m1",
      download_base: "https://cdn.example.com",
      limits: { max_size: 1024, accept: [] },
    }));
    const api = createStorageApi({ request });

    const r = await api.list({ prefix: "files/", marker: "", fresh: true });
    expect(r.prefix).toBe("files/");
    expect(r.marker).toBe("m1");
    expect(r.downloadBase).toBe("https://cdn.example.com");
    // 后端蛇形 max_size 映射成逻辑层的 maxSize：透传的话超限预检永远不触发（2026-11-27 审查 P1）
    expect(r.limits).toEqual({ maxSize: 1024, accept: [] });
    expect(r.entries).toEqual([
      { key: "files/a/", name: "a", dir: true, size: 0, mtime: 0 },
      { key: "files/x.zip", name: "x.zip", dir: false, size: 123, mtime: 1700000000 },
      // 后端没标 is_dir 但名字以 / 结尾的，也按目录认
      { key: "files/y/", name: "y", dir: true, size: 5, mtime: 0 },
    ]);
    expect(calls[0]).toMatchObject({ url: "/v1/storage/admin/list", query: { prefix: "files/", fresh: "1" } });
    expect(calls[0].query.marker).toBeUndefined();
  });

  it("list 记住下载基地址；后端某次没带也用上一次的", async () => {
    let n = 0;
    const { request } = fakeRequest(() => ({ download_base: n++ === 0 ? "https://cdn.example.com" : "" }));
    const api = createStorageApi({ request });
    await api.list({ prefix: "" });
    const r = await api.list({ prefix: "files/" });
    expect(r.downloadBase).toBe("https://cdn.example.com");
  });

  it("uploadTicket 用对象名第一段当上传域，回凭证三件", async () => {
    const { calls, request } = fakeRequest(() => ({ token: "t", key: "files/a.zip", upload_url: "https://up", url: "u" }));
    const api = createStorageApi({ request });
    const t = await api.uploadTicket({ name: "a.zip", key: "files/a.zip" });
    expect(t).toEqual({ token: "t", key: "files/a.zip", uploadUrl: "https://up" });
    expect(calls[0]).toMatchObject({
      url: "/v1/storage/ticket",
      body: { filename: "a.zip", scope: "files", key: "files/a.zip" },
    });
  });

  it("建目录、改名、删除发到各自的接口，对象名原样", async () => {
    const { calls, request } = fakeRequest();
    const api = createStorageApi({ request });
    await api.createFolder({ prefix: "files/", name: "新建文件夹" });
    await api.rename({ key: "files/a/", to: "files/b/" });
    await api.remove({ keys: ["files/x.zip", "files/a/"] });
    expect(calls).toEqual([
      { method: "POST", url: "/v1/storage/admin/mkdir", body: { key: "files/新建文件夹/" } },
      { method: "POST", url: "/v1/storage/admin/rename", body: { key: "files/a/", to: "files/b/" } },
      { method: "POST", url: "/v1/storage/admin/delete", body: { keys: ["files/x.zip", "files/a/"] } },
    ]);
  });

  it("移动和复制：想要的目标名字带上，没说的不带；回每一项实际落下的名字", async () => {
    const { calls, request } = fakeRequest(() => ({ items: [{ from: "files/a.zip", to: "files/x/a (1).zip" }] }));
    const api = createStorageApi({ request });
    const items = [{ key: "files/a.zip", name: "a - 副本.zip" }, { key: "files/b/" }];
    const out = await api.copy({ items, toDir: "files/x/" });
    expect(out).toEqual([{ from: "files/a.zip", to: "files/x/a (1).zip" }]);
    expect(calls[0]).toMatchObject({
      url: "/v1/storage/admin/copy",
      body: { items: [{ key: "files/a.zip", name: "a - 副本.zip" }, { key: "files/b/" }], to_dir: "files/x/" },
    });
    await api.move({ items, toDir: "files/" });
    expect(calls[1].url).toBe("/v1/storage/admin/move");
  });

  it("下载地址带 attname 另存、链接是干净直链、缩略图按宽度取图", async () => {
    const { request } = fakeRequest(() => ({ download_base: "https://cdn.example.com" }));
    const api = createStorageApi({ request });
    await api.list({ prefix: "" });
    const key = "files/桌面 背景图.png";
    expect(api.downloadUrl({ key })).toBe(
      `https://cdn.example.com/files/${encodeURIComponent("桌面 背景图.png")}?attname=${encodeURIComponent("桌面 背景图.png")}`,
    );
    expect(api.linkUrl({ key })).toBe(`https://cdn.example.com/files/${encodeURIComponent("桌面 背景图.png")}`);
    expect(api.thumbUrl({ key, width: 192 })).toBe(
      `https://cdn.example.com/files/${encodeURIComponent("桌面 背景图.png")}?imageView2/2/w/192/h/192`,
    );
  });

  it("接口前缀可以改：有的后台网关前面还有一段", async () => {
    const { calls, request } = fakeRequest(() => ({ token: "t", key: "files/a", upload_url: "u" }));
    const api = createStorageApi({ request, base: "/gw/v1/storage/admin", ticketUrl: "/gw/v1/storage/ticket" });
    await api.list({ prefix: "" });
    await api.uploadTicket({ name: "a", key: "files/a" });
    expect(calls.map((c) => c.url)).toEqual(["/gw/v1/storage/admin/list", "/gw/v1/storage/ticket"]);
  });
});

describe("createRequest 内置请求层", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stub = (status, body) => {
    const fetchMock = vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("成功时拆信封回 data，带 Bearer 令牌，空参数不进地址", async () => {
    const fetchMock = stub(200, { code: 0, message: "ok", data: { hello: 1 } });
    const request = createRequest({ getToken: () => "tok" });
    const out = await request({ url: "/v1/x", query: { a: 1, b: "", c: undefined } });
    expect(out).toEqual({ hello: 1 });
    expect(fetchMock.mock.calls[0][0]).toBe("/v1/x?a=1");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });

  it("失败时抛后端给的那句话；没有话就按状态码说", async () => {
    stub(403, { code: 403, message: "这个目录只读" });
    await expect(createRequest()({ url: "/v1/x" })).rejects.toThrow("这个目录只读");
    stub(200, { code: 400, message: "名字不合法" });
    await expect(createRequest()({ url: "/v1/x" })).rejects.toThrow("名字不合法");
    stub(500, "not json");
    await expect(createRequest()({ url: "/v1/x" })).rejects.toThrow("请求失败（500）");
  });

  it("有请求体时按 JSON 发", async () => {
    const fetchMock = stub(200, { code: 0, data: null });
    await createRequest()({ method: "POST", url: "/v1/x", body: { a: 1 } });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", body: '{"a":1}' });
  });
});
