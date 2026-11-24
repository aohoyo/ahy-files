import { describe, expect, it } from "vitest";
import { checkName, copyName, nextNumbered, uniqueName } from "../src/file-manager/logic/naming";

describe("checkName 名字能不能用", () => {
  it("正常名字回空串", () => {
    for (const n of ["a", "新建文件夹", "装机包 2026.zip", ".gitignore", "a.b.c"]) {
      expect(checkName(n)).toBe("");
    }
  });

  it("空的、单独的点、连续两个点都拒", () => {
    expect(checkName("")).not.toBe("");
    expect(checkName(".")).not.toBe("");
    expect(checkName("..")).not.toBe("");
    expect(checkName("a..b")).toMatch(/连续两个点/);
  });

  it("资源管理器禁用的九个字符逐个拒", () => {
    for (const ch of ['\\', "/", ":", "*", "?", '"', "<", ">", "|"]) {
      expect(checkName(`a${ch}b`), `字符 ${ch}`).not.toBe("");
    }
    expect(checkName("a\tb")).not.toBe("");
  });

  it("超长拒", () => {
    expect(checkName("a".repeat(200))).toBe("");
    expect(checkName("a".repeat(201))).toMatch(/200/);
  });
});

describe("uniqueName 同名加序号", () => {
  const taken = (names) => (n) => names.includes(n);

  it("没被占就原名", () => {
    expect(uniqueName(taken([]), "a.zip")).toBe("a.zip");
  });

  it("被占了从 (1) 起试，序号加在主名和后缀之间", () => {
    expect(uniqueName(taken(["a.zip"]), "a.zip")).toBe("a (1).zip");
    expect(uniqueName(taken(["a.zip", "a (1).zip"]), "a.zip")).toBe("a (2).zip");
    expect(uniqueName(taken(["新建文件夹", "新建文件夹 (1)"]), "新建文件夹")).toBe("新建文件夹 (2)");
  });

  it("多点的主名不被拆错", () => {
    expect(uniqueName(taken(["a.tar.gz"]), "a.tar.gz")).toBe("a.tar (1).gz");
  });
});

describe("nextNumbered 上传撞名后的下一个候选", () => {
  it("没有序号就加 (1)，有序号就加一", () => {
    expect(nextNumbered("a.zip")).toBe("a (1).zip");
    expect(nextNumbered("a (1).zip")).toBe("a (2).zip");
    expect(nextNumbered("新建文件夹 (3)")).toBe("新建文件夹 (4)");
  });

  it("名字里本来就带括号的只认结尾的序号", () => {
    expect(nextNumbered("a (v2).zip")).toBe("a (v2) (1).zip");
  });
});

describe("copyName 同目录副本", () => {
  it("主名后加「 - 副本」，后缀留在最后", () => {
    expect(copyName("a.zip")).toBe("a - 副本.zip");
    expect(copyName("新建文件夹")).toBe("新建文件夹 - 副本");
    expect(copyName("a.tar.gz")).toBe("a.tar - 副本.gz");
  });
});
