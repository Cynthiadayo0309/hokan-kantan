import { describe, expect, it } from "vitest";
import { dateKeysBetween } from "../../src/renderer/utils/date";

describe("date utils", () => {
  it("keeps local date keys when listing a monthly range", () => {
    const dates = dateKeysBetween("2026-06-01", "2026-06-30");

    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe("2026-06-01");
    expect(dates.at(-1)).toBe("2026-06-30");
    expect(dates).not.toContain("2026-05-31");
  });
});
