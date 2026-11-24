import { describe, expect, it } from "vitest";
import { fmtSize, fmtTime, sumSize } from "../src/file-manager/logic/format";

const KB = 1024;
const MB = KB * 1024;

describe("fmtSize 大小", () => {
  it("B / KB / MB / GB 逐级进位，MB 起保留一位小数", () => {
    expect(fmtSize(0)).toBe("0 B");
    expect(fmtSize(640)).toBe("640 B");
    expect(fmtSize(2048)).toBe("2 KB");
    expect(fmtSize(3.2 * KB)).toBe("3 KB");
    expect(fmtSize(432 * KB)).toBe("432 KB");
    expect(fmtSize(129.4 * MB)).toBe("129.4 MB");
    expect(fmtSize(1536 * MB)).toBe("1.5 GB");
  });

  it("没有值回空串（目录那一格不显示）", () => {
    expect(fmtSize(undefined)).toBe("");
    expect(fmtSize(null)).toBe("");
  });
});

describe("fmtTime 时间", () => {
  it("按本地时区显示到分钟", () => {
    const sec = new Date(2026, 10, 20, 14, 3).getTime() / 1000;
    expect(fmtTime(sec)).toBe("2026/11/20 14:03");
    const pad = new Date(2026, 0, 5, 8, 7).getTime() / 1000;
    expect(fmtTime(pad)).toBe("2026/01/05 08:07");
  });

  it("0 回空串", () => {
    expect(fmtTime(0)).toBe("");
  });
});

describe("sumSize 已选合计", () => {
  it("只加文件，目录不算", () => {
    expect(
      sumSize([
        { dir: true, size: 0 },
        { dir: false, size: 100 },
        { dir: false, size: 50 },
      ]),
    ).toBe(150);
    expect(sumSize([])).toBe(0);
  });
});
