import { describe, expect, it } from "vitest";
import { matchQuery, SORTS, sortEntries, typeOf } from "../src/file-manager/logic/sort";

const e = (name, extra = {}) => ({ key: `files/${name}`, name, dir: false, size: 0, mtime: 0, ...extra });

describe("typeOf 类型", () => {
  it("目录统一是文件夹，用实心文件夹图标", () => {
    const t = typeOf(e("a", { dir: true }));
    expect(t).toMatchObject({ label: "文件夹", icon: "folderFill", image: false });
  });

  it("登记过的后缀按类型表，大小写不分", () => {
    expect(typeOf(e("a.ZIP"))).toMatchObject({ label: "压缩文件", icon: "folderZip" });
    expect(typeOf(e("a.exe"))).toMatchObject({ label: "应用程序", icon: "appGeneric" });
    expect(typeOf(e("a.xlsx"))).toMatchObject({ label: "Excel 工作表", icon: "documentText" });
    expect(typeOf(e("a.mp3"))).toMatchObject({ label: "音频", icon: "speaker" });
  });

  it("没登记的后缀一律是「文件」", () => {
    expect(typeOf(e("a.xyz"))).toMatchObject({ label: "文件", icon: "document" });
    expect(typeOf(e("README"))).toMatchObject({ label: "文件", icon: "document" });
  });

  it("七牛能出缩略图的图片才算 image；svg 归图片类型但不出缩略图", () => {
    for (const n of ["a.png", "a.JPG", "a.gif", "a.webp", "a.bmp"]) expect(typeOf(e(n)).image, n).toBe(true);
    expect(typeOf(e("a.svg")).image).toBe(false);
    expect(typeOf(e("a.svg")).label).toBe("图片");
    expect(typeOf(e("a.txt")).image).toBe(false);
  });
});

describe("sortEntries 排序", () => {
  const list = [
    e("b.txt", { size: 30, mtime: 300 }),
    e("A", { dir: true }),
    e("c.zip", { size: 10, mtime: 100 }),
    e("a.txt", { size: 20, mtime: 200 }),
  ];
  const names = (sort) => sortEntries(list, sort).map((x) => x.name);

  it("四列的顺序和叫法照资源管理器", () => {
    expect(SORTS.map((s) => s.label)).toEqual(["名称", "修改时间", "类型", "大小"]);
  });

  it("文件夹永远在文件前面，各组内部按列排", () => {
    expect(names({ key: "name", dir: 1 })).toEqual(["A", "a.txt", "b.txt", "c.zip"]);
    expect(names({ key: "size", dir: 1 })).toEqual(["A", "c.zip", "a.txt", "b.txt"]);
    expect(names({ key: "mtime", dir: 1 })).toEqual(["A", "c.zip", "a.txt", "b.txt"]);
  });

  it("倒序只翻各组内部，文件夹仍在前面", () => {
    expect(names({ key: "name", dir: -1 })).toEqual(["A", "c.zip", "b.txt", "a.txt"]);
  });

  it("按类型排：同类型再按名字", () => {
    expect(names({ key: "type", dir: 1 })).toEqual(["A", "a.txt", "b.txt", "c.zip"]);
  });

  it("不改原数组", () => {
    sortEntries(list, { key: "name", dir: -1 });
    expect(list.map((x) => x.name)).toEqual(["b.txt", "A", "c.zip", "a.txt"]);
  });
});

describe("matchQuery 当前目录内搜索", () => {
  const a = e("安装说明.txt");
  it("不分大小写的包含匹配；空关键词全匹配", () => {
    expect(matchQuery(a, "说明")).toBe(true);
    expect(matchQuery(e("README"), "readme")).toBe(true);
    expect(matchQuery(a, "不存在")).toBe(false);
    expect(matchQuery(a, "   ")).toBe(true);
  });
});
