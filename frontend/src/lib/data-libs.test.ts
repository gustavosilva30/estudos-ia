import katex from "katex";
import { describe, expect, it } from "vitest";
import { CONSTANTS, CONSTANT_GROUPS, constantForCopy, formatConstant } from "./constants-data";
import {
  QUANTITIES, TEMPERATURE_UNITS, cleanNumber, convert, convertTemperature, findQuantity, formatConverted, parseNumber,
} from "./converter";
import { ELEMENTS, ELEMENT_CATEGORIES, elementByNumber, electronConfiguration, searchElements } from "./elements";
import { REFERENCE_TABLES } from "./reference-tables";

const render = (latex: string) => katex.renderToString(latex, { throwOnError: true, strict: "ignore", trust: false });

describe("tabela periódica", () => {
  it("tem os 118 elementos em ordem, com símbolos e nomes únicos", () => {
    expect(ELEMENTS).toHaveLength(118);
    ELEMENTS.forEach((e, i) => expect(e.z).toBe(i + 1));
    expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(118);
    expect(new Set(ELEMENTS.map((e) => e.name)).size).toBe(118);
    for (const e of ELEMENTS) {
      expect(e.symbol).toMatch(/^[A-Z][a-z]?$/);
      expect(e.mass, e.name).toBeGreaterThan(0);
      expect(ELEMENT_CATEGORIES[e.category], e.name).toBeDefined();
      expect(e.period).toBeGreaterThanOrEqual(1);
      expect(e.period).toBeLessThanOrEqual(7);
    }
  });

  it("a massa cresce com o número atômico, exceto os pares históricos conhecidos", () => {
    const exceptions = new Set([19, 28, 53, 91, 93, 95]); // Ar→K, Co→Ni, Te→I, Th→Pa, U→Np, Pu→Am
    for (let z = 2; z <= 118; z++) {
      const prev = ELEMENTS[z - 2].mass;
      const cur = ELEMENTS[z - 1].mass;
      if (exceptions.has(z)) expect(cur, `${ELEMENTS[z - 1].symbol}`).toBeLessThan(prev);
      else expect(cur, `${ELEMENTS[z - 1].symbol} vs ${ELEMENTS[z - 2].symbol}`).toBeGreaterThanOrEqual(prev);
    }
  });

  it("posições na tabela: sem repetição e lantanídeos/actinídeos fora do grid principal", () => {
    const seen = new Set<string>();
    for (const e of ELEMENTS) {
      if (e.group === null) {
        expect(["lantanideo", "actinideo"]).toContain(e.category);
        continue;
      }
      const key = `${e.period}-${e.group}`;
      expect(seen.has(key), `${e.symbol} repete ${key}`).toBe(false);
      seen.add(key);
    }
    expect(ELEMENTS.filter((e) => e.category === "lantanideo").map((e) => e.z)).toEqual(Array.from({ length: 15 }, (_, i) => 57 + i));
    expect(ELEMENTS.filter((e) => e.category === "actinideo").map((e) => e.z)).toEqual(Array.from({ length: 15 }, (_, i) => 89 + i));
    expect(seen.size).toBe(118 - 30);
  });

  it("estados físicos e radioatividade", () => {
    expect(elementByNumber(35)?.state).toBe("líquido"); // Br
    expect(elementByNumber(80)?.state).toBe("líquido"); // Hg
    expect(elementByNumber(8)?.state).toBe("gasoso");
    expect(elementByNumber(26)?.state).toBe("sólido");
    expect(ELEMENTS.filter((e) => e.state === "gasoso")).toHaveLength(11);
    expect(elementByNumber(43)?.radioactive).toBe(true); // Tc
    expect(elementByNumber(82)?.radioactive).toBe(false); // Pb
    expect(elementByNumber(92)?.radioactive).toBe(true); // U
  });

  it("grupos conhecidos", () => {
    const of = (symbol: string) => ELEMENTS.find((e) => e.symbol === symbol)!;
    expect([of("Na").group, of("Ca").group, of("Fe").group, of("Cl").group, of("Ne").group]).toEqual([1, 2, 8, 17, 18]);
    expect(of("Cl").category).toBe("halogenio");
    expect(of("Si").category).toBe("semimetal");
    expect(of("Au").category).toBe("transicao");
  });

  it("busca por nome (sem acento), símbolo e número", () => {
    expect(searchElements("ferro").map((e) => e.symbol)).toEqual(["Fe"]);
    expect(searchElements("FERRO").map((e) => e.symbol)).toEqual(["Fe"]);
    expect(searchElements("oxigenio").map((e) => e.symbol)).toEqual(["O"]);
    expect(searchElements("8").map((e) => e.symbol)).toEqual(["O"]);
    expect(searchElements("Na")[0].name).toBe("Sódio");
    expect(searchElements("")).toHaveLength(118);
    expect(searchElements("xyz")).toEqual([]);
  });

  it("distribuição eletrônica (Pauling): total de elétrons, camadas e valência", () => {
    for (const e of ELEMENTS) {
      const c = electronConfiguration(e.z);
      expect(c.shells.reduce((s, x) => s + x.electrons, 0), e.symbol).toBe(e.z);
    }
    expect(electronConfiguration(1).text).toBe("1s¹");
    expect(electronConfiguration(11).text).toBe("1s² 2s² 2p⁶ 3s¹");
    expect(electronConfiguration(26).text).toBe("1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶");
    expect(electronConfiguration(26).shells.map((s) => s.electrons)).toEqual([2, 8, 14, 2]);
    expect(electronConfiguration(26).shells.map((s) => s.name)).toEqual(["K", "L", "M", "N"]);
    expect([2, 10, 18, 36, 54, 86].map((z) => electronConfiguration(z).valence)).toEqual([2, 8, 8, 8, 8, 8]);
    expect([9, 17, 35].map((z) => electronConfiguration(z).valence)).toEqual([7, 7, 7]); // halogênios
    expect([3, 11, 19].map((z) => electronConfiguration(z).valence)).toEqual([1, 1, 1]); // alcalinos
    expect(electronConfiguration(118).shells).toHaveLength(7);
  });
});

describe("constantes", () => {
  it("ids únicos, valores positivos e símbolos/unidades que desenham", () => {
    expect(new Set(CONSTANTS.map((c) => c.id)).size).toBe(CONSTANTS.length);
    expect(CONSTANTS.length).toBeGreaterThanOrEqual(35);
    const groups = new Set(CONSTANT_GROUPS.map((g) => g.id));
    for (const c of CONSTANTS) {
      expect(groups.has(c.group), c.id).toBe(true);
      expect(c.value, c.id).toBeGreaterThan(0);
      expect(() => render(c.symbol), c.id).not.toThrow();
      if (c.unitTex) expect(() => render(c.unitTex), c.id).not.toThrow();
    }
  });

  it("valores exatos do SI e fatos conhecidos", () => {
    const value = (id: string) => CONSTANTS.find((c) => c.id === id)!.value;
    expect(value("c")).toBe(299792458);
    expect(value("h")).toBe(6.62607015e-34);
    expect(value("e")).toBe(1.602176634e-19);
    expect(value("NA")).toBe(6.02214076e23);
    expect(value("kB")).toBe(1.380649e-23);
    expect(value("R")).toBeCloseTo(value("NA") * value("kB"), 3); // R = N_A · k_B
    expect(value("hbar") * 2 * Math.PI).toBeCloseTo(value("h"), 40);
    expect(value("eV")).toBe(value("e"));
    expect(value("k")).toBeCloseTo(1 / (4 * Math.PI * value("eps0")), -5);
    expect(value("atm")).toBe(101325);
  });

  it("formata em notação científica com vírgula e fornece valor para copiar", () => {
    expect(formatConstant(6.62607015e-34)).toBe("6,62607015 × 10⁻³⁴");
    expect(formatConstant(6.02214076e23)).toBe("6,02214076 × 10²³");
    expect(formatConstant(299792458)).toBe("2,99792458 × 10⁸");
    expect(formatConstant(9.80665)).toBe("9,80665");
    expect(formatConstant(343)).toBe("343");
    expect(constantForCopy(6.62607015e-34)).toBe("6.62607015e-34");
    expect(Number(constantForCopy(1e-14))).toBe(1e-14);
  });
});

describe("conversor de unidades", () => {
  const unit = (quantity: string, id: string) => findQuantity(quantity)!.units.find((u) => u.id === id)!;
  const conv = (value: number, q: string, from: string, to: string) => cleanNumber(convert(value, unit(q, from), unit(q, to)));

  it("grandezas e unidades bem formadas", () => {
    expect(QUANTITIES.length).toBeGreaterThanOrEqual(11);
    for (const q of QUANTITIES) {
      expect(new Set(q.units.map((u) => u.id)).size, q.id).toBe(q.units.length);
      for (const u of q.units) {
        expect(u.factor, `${q.id}.${u.id}`).toBeGreaterThan(0);
        expect(u.label && u.symbol).toBeTruthy();
      }
    }
  });

  it("conversões conhecidas", () => {
    expect(conv(1, "comprimento", "km", "m")).toBe(1000);
    expect(conv(1, "comprimento", "mi", "km")).toBe(1.609344);
    expect(conv(12, "comprimento", "in", "ft")).toBe(1);
    expect(conv(1, "massa", "lb", "g")).toBe(453.59237);
    expect(conv(1, "tempo", "d", "h")).toBe(24);
    expect(conv(1, "area", "ha", "m2")).toBe(10000);
    expect(conv(1, "volume", "L", "mL")).toBe(1000);
    expect(conv(1, "volume", "m3", "L")).toBe(1000);
    expect(conv(36, "velocidade", "kmh", "ms")).toBe(10);
    expect(conv(1, "velocidade", "kn", "kmh")).toBe(1.852);
    expect(conv(1, "pressao", "atm", "mmHg")).toBe(760);
    expect(conv(1, "pressao", "bar", "kPa")).toBe(100);
    expect(conv(1, "energia", "kWh", "J")).toBe(3600000);
    expect(conv(1, "energia", "kcal", "cal")).toBe(1000);
    expect(conv(1, "potencia", "kW", "W")).toBe(1000);
    expect(conv(180, "angulo", "deg", "rad")).toBe(3.141592654);
    expect(conv(1, "angulo", "volta", "deg")).toBe(360);
    expect(conv(1, "dados", "KiB", "B")).toBe(1024);
    expect(conv(1, "dados", "GB", "MB")).toBe(1000);
    expect(conv(8, "dados", "bit", "B")).toBe(1);
    expect(conv(1, "forca", "kgf", "N")).toBe(9.80665);
  });

  it("ida e volta devolve o valor original em todas as unidades", () => {
    for (const q of QUANTITIES) {
      for (const a of q.units) {
        for (const b of q.units) {
          const back = convert(convert(123.456, a, b), b, a);
          expect(Math.abs(back - 123.456) / 123.456, `${q.id}: ${a.id}→${b.id}`).toBeLessThan(1e-9);
        }
      }
    }
  });

  it("temperatura (conversão afim)", () => {
    const t = (v: number, a: "C" | "K" | "F" | "Ra", b: "C" | "K" | "F" | "Ra") => cleanNumber(convertTemperature(v, a, b));
    expect(t(0, "C", "K")).toBe(273.15);
    expect(t(100, "C", "F")).toBe(212);
    expect(t(-40, "C", "F")).toBe(-40);
    expect(t(32, "F", "C")).toBe(0);
    expect(t(0, "K", "C")).toBe(-273.15);
    expect(t(0, "K", "Ra")).toBe(0);
    expect(t(491.67, "Ra", "C")).toBe(0);
    for (const a of TEMPERATURE_UNITS) for (const b of TEMPERATURE_UNITS) expect(convertTemperature(convertTemperature(37, a.id, b.id), b.id, a.id)).toBeCloseTo(37, 8);
  });

  it("formatação e leitura do que se digita", () => {
    expect(cleanNumber(0.1 + 0.2)).toBe(0.3);
    expect(formatConverted(1000)).toBe("1.000");
    expect(formatConverted(0.5)).toBe("0,5");
    expect(formatConverted(0)).toBe("0");
    expect(formatConverted(Number.NaN)).toBe("—");
    expect(formatConverted(6.02214076e23)).toMatch(/e\+?23$/);
    expect(parseNumber("2,5")).toBe(2.5);
    expect(parseNumber(" 1e3 ")).toBe(1000);
    expect(parseNumber("-4")).toBe(-4);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("-")).toBeNull();
  });
});

describe("tabelas de consulta", () => {
  it("ids únicos e todo o LaTeX desenha sem erro", () => {
    expect(new Set(REFERENCE_TABLES.map((t) => t.id)).size).toBe(REFERENCE_TABLES.length);
    const names = REFERENCE_TABLES.map((t) => t.id);
    for (const id of ["derivadas", "integrais", "trigonometria", "angulos-notaveis", "potencias-logaritmos"]) expect(names).toContain(id);
    for (const table of REFERENCE_TABLES) {
      expect(table.rows.length, table.id).toBeGreaterThan(3);
      for (const row of table.rows) {
        expect(row.name).toBeTruthy();
        expect(() => render(row.latex), `${table.id}: ${row.name}`).not.toThrow();
      }
    }
  });
});
