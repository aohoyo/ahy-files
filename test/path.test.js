import { describe, expect, it } from "vitest";
import { baseName, crumbs, encodeKey, extOf, isUnder, isWritable, parentDir, splitName, toDir } from "../src/file-manager/logic/path";

describe("toDir 规范成目录键", () => {
  it("补尾斜杠、去首斜杠、合并重复斜杠", () => {
    expect(toDir("files/a")).toBe("files/a/");
    expect(toDir("/files/a/")).toBe("files/a/");
    expect(toDir("files//a///b")).toBe("files/a/b/");
    expect(toDir("  files/a  ")).toBe("files/a/");
  });

  it("根目录的各种写法都回空串", () => {
    for (const v of ["", "/", "//", "   ", null, undefined]) expect(toDir(v)).toBe("");
  });

  it("中文名和带点的名字原样保留", () => {
    expect(toDir("files/装机包 2026/")).toBe("files/装机包 2026/");
    expect(toDir("files/a.b/c")).toBe("files/a.b/c/");
  });
});

describe("parentDir 上一级", () => {
  it("逐级往上，到根回空串，根再往上回 null", () => {
    expect(parentDir("files/a/b/")).toBe("files/a/");
    expect(parentDir("files/a/")).toBe("files/");
    expect(parentDir("files/")).toBe("");
    expect(parentDir("")).toBeNull();
  });
});

describe("baseName 名字", () => {
  it("目录和文件都取最后一段", () => {
    expect(baseName("files/a/")).toBe("a");
    expect(baseName("files/a/b.zip")).toBe("b.zip");
    expect(baseName("files/中文 说明.txt")).toBe("中文 说明.txt");
    expect(baseName("")).toBe("");
  });
});

describe("crumbs 面包屑", () => {
  it("第一级固定叫全部文件，其后每级带累计路径", () => {
    expect(crumbs("")).toEqual([{ name: "全部文件", path: "" }]);
    expect(crumbs("files/a/b/")).toEqual([
      { name: "全部文件", path: "" },
      { name: "files", path: "files/" },
      { name: "a", path: "files/a/" },
      { name: "b", path: "files/a/b/" },
    ]);
  });
});

describe("isUnder / isWritable 可写范围", () => {
  const roots = ["files/"];

  it("目录自己、子目录、目录里的文件都算在内", () => {
    expect(isUnder("files/", "files/")).toBe(true);
    expect(isUnder("files/a/", "files/")).toBe(true);
    expect(isUnder("files/a/b.txt", "files/")).toBe(true);
  });

  it("别的根目录、只差一个字符的前缀都不算", () => {
    expect(isUnder("release/", "files/")).toBe(false);
    expect(isUnder("files2/a", "files/")).toBe(false);
    expect(isUnder("files", "files/")).toBe(false);
    expect(isUnder("", "files/")).toBe(false);
  });

  it("可写根是空串时全部可写；多个根任意命中即可", () => {
    expect(isWritable("release/x/", [""])).toBe(true);
    expect(isWritable("brand/", ["files/", "brand/"])).toBe(true);
    expect(isWritable("backup/", ["files/", "brand/"])).toBe(false);
    expect(isWritable("files/a/", [])).toBe(false);
  });
});

describe("splitName / extOf 后缀", () => {
  it("只认最后一个点，点开头的名字不算有后缀", () => {
    expect(splitName("a.zip")).toEqual(["a", ".zip"]);
    expect(splitName("a.tar.gz")).toEqual(["a.tar", ".gz"]);
    expect(splitName("README")).toEqual(["README", ""]);
    expect(splitName(".gitignore")).toEqual([".gitignore", ""]);
  });

  it("extOf 回小写、不带点", () => {
    expect(extOf("A.ZIP")).toBe("zip");
    expect(extOf("README")).toBe("");
    expect(extOf("x.JsOn")).toBe("json");
  });
});

describe("encodeKey 下载地址", () => {
  it("逐段编码，斜杠保留", () => {
    expect(encodeKey("files/中文 说明#1.txt")).toBe("files/" + encodeURIComponent("中文 说明#1.txt"));
    expect(encodeKey("files/a/b.png")).toBe("files/a/b.png");
  });
});
