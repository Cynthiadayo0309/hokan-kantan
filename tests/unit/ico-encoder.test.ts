import { describe, expect, it } from "vitest";
import { buildIcoBuffer } from "../../src/main/services/IcoEncoder";
import { customIconPath, isAllowedIconSource } from "../../src/main/services/CustomIconService";

describe("custom icon helpers", () => {
  it("builds an ICO file with PNG entries", () => {
    const firstPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1]);
    const secondPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 2]);
    const ico = buildIcoBuffer([
      { width: 16, height: 16, png: firstPng },
      { width: 256, height: 256, png: secondPng }
    ]);

    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    expect(ico.readUInt8(6)).toBe(16);
    expect(ico.readUInt8(22)).toBe(0);
    expect(ico.subarray(38, 43)).toEqual(firstPng);
  });

  it("validates supported source image extensions and userData path", () => {
    expect(isAllowedIconSource("sample.png")).toBe(true);
    expect(isAllowedIconSource("sample.JPG")).toBe(true);
    expect(isAllowedIconSource("sample.webp")).toBe(true);
    expect(isAllowedIconSource("sample.ico")).toBe(true);
    expect(isAllowedIconSource("sample.svg")).toBe(false);
    expect(customIconPath("C:/Users/test/AppData/Roaming/App")).toContain("custom-icon");
  });
});
