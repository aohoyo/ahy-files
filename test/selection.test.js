import { describe, expect, it } from "vitest";
import { useSelection } from "../src/file-manager/composables/useSelection";

const KEYS = ["a", "b", "c", "d", "e"];
const ev = (mods = {}) => ({ shiftKey: false, ctrlKey: false, metaKey: false, ...mods });

describe("useSelection 选择", () => {
  it("单击只选一项，并把它记作范围选择的起点", () => {
    const s = useSelection();
    s.pick("b", ev(), KEYS);
    expect([...s.keys.value]).toEqual(["b"]);
    expect(s.anchor.value).toBe("b");
    s.pick("d", ev(), KEYS);
    expect([...s.keys.value]).toEqual(["d"]);
    expect(s.count.value).toBe(1);
  });

  it("Ctrl 加选、再点一次减选", () => {
    const s = useSelection();
    s.pick("b", ev(), KEYS);
    s.pick("d", ev({ ctrlKey: true }), KEYS);
    expect([...s.keys.value].sort()).toEqual(["b", "d"]);
    s.pick("b", ev({ metaKey: true }), KEYS);
    expect([...s.keys.value]).toEqual(["d"]);
  });

  it("Shift 选从起点到这一项的一段，往前选和往后选都行", () => {
    const s = useSelection();
    s.pick("b", ev(), KEYS);
    s.pick("d", ev({ shiftKey: true }), KEYS);
    expect([...s.keys.value]).toEqual(["b", "c", "d"]);
    s.pick("a", ev({ shiftKey: true }), KEYS);
    expect([...s.keys.value]).toEqual(["a", "b"]);
    // 起点不在当前列表里时（比如被搜索过滤掉了），Shift 退化成单击
    s.pick("c", ev({ ctrlKey: true }), KEYS);
    s.pick("e", ev({ shiftKey: true }), ["a", "e"]);
    expect([...s.keys.value]).toEqual(["e"]);
  });

  it("整批设置、追加、清空；刷新后把不在了的键去掉", () => {
    const s = useSelection();
    s.set(["a", "b"]);
    s.toggle("c");
    expect(s.count.value).toBe(3);
    s.retain(new Set(["b", "c", "z"]));
    expect([...s.keys.value]).toEqual(["b", "c"]);
    s.pick("b", ev(), ["b", "c"]);
    s.retain(new Set(["c"]));
    expect(s.anchor.value).toBe("");
    s.clear();
    expect(s.count.value).toBe(0);
  });
});
