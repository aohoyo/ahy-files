import { describe, expect, it } from "vitest";
import { useNavigation } from "../src/file-manager/composables/useNavigation";

describe("useNavigation 路径与前进后退", () => {
  it("从根目录出发，去过的目录都记进历史", () => {
    const nav = useNavigation();
    expect(nav.path.value).toBe("");
    expect(nav.canBack.value).toBe(false);
    expect(nav.canForward.value).toBe(false);
    expect(nav.canUp.value).toBe(false);

    nav.go("files/a/");
    expect(nav.path.value).toBe("files/a/");
    expect(nav.canBack.value).toBe(true);
    nav.go("files/a/b/");
    nav.go("files/");
    expect(nav.canUp.value).toBe(true);
    expect(nav.canBack.value).toBe(true);
  });

  it("后退、前进在历史里走，不新增记录；回到上一级算一次新的导航", () => {
    const nav = useNavigation();
    nav.go("files/");
    nav.go("files/a/");
    nav.back();
    expect(nav.path.value).toBe("files/");
    expect(nav.canForward.value).toBe(true);
    nav.forward();
    expect(nav.path.value).toBe("files/a/");
    expect(nav.canForward.value).toBe(false);
    nav.back();
    nav.back();
    expect(nav.path.value).toBe("");
    nav.back();
    expect(nav.path.value).toBe("");
    nav.forward();
    expect(nav.path.value).toBe("files/");
    nav.up();
    expect(nav.path.value).toBe("");
    expect(nav.canForward.value).toBe(false);
  });

  it("走到一半又岔开，前面的路作废", () => {
    const nav = useNavigation();
    nav.go("a/");
    nav.go("b/");
    nav.back();
    nav.go("c/");
    expect(nav.canForward.value).toBe(false);
    nav.back();
    expect(nav.path.value).toBe("a/");
    nav.forward();
    expect(nav.path.value).toBe("c/");
  });

  it("目录名规范成带尾斜杠；去同一个目录不算导航", () => {
    const nav = useNavigation("files");
    expect(nav.path.value).toBe("files/");
    nav.go("files");
    expect(nav.canBack.value).toBe(false);
    nav.go("/x//y");
    expect(nav.path.value).toBe("x/y/");
    nav.go("");
    expect(nav.path.value).toBe("");
  });
});
