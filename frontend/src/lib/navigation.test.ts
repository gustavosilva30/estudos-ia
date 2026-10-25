import { describe, expect, it } from "vitest";
import { safeNext } from "./navigation";

describe("safeNext", () => {
  it("aceita caminhos internos", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/biblioteca?q=teste")).toBe("/biblioteca?q=teste");
  });

  it("usa o painel quando não há destino", () => {
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext("")).toBe("/dashboard");
  });

  it("recusa destinos externos ou que parecem externos", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil"]) {
      expect(safeNext(bad)).toBe("/dashboard");
    }
  });
});
