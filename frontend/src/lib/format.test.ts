import { describe, expect, it } from "vitest";
import { firstName, formatDate, parseDate } from "./format";

describe("parseDate", () => {
  it("trata data sem hora como o dia local (sem recuar por fuso)", () => {
    const d = parseDate("2026-10-25");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 25]);
  });

  it("mantém instantes ISO completos", () => {
    expect(parseDate("2026-10-25T13:00:00Z").toISOString()).toBe("2026-10-25T13:00:00.000Z");
  });
});

describe("formatDate", () => {
  it("mostra o mesmo dia informado", () => {
    expect(formatDate("2026-10-25")).toContain("25");
    expect(formatDate("2026-01-01")).toContain("1");
  });
});

describe("firstName", () => {
  it("usa o nome ou, na falta dele, a parte local do e-mail", () => {
    expect(firstName("Marina Souza", "m@example.com")).toBe("Marina");
    expect(firstName(null, "lucas.silva@example.com")).toBe("lucas.silva");
    expect(firstName("  ", "ana@example.com")).toBe("ana");
  });
});
