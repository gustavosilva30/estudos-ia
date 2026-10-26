export interface Unit {
  id: string;
  label: string;
  symbol: string;
  /** Quantas unidades-base cabem nesta unidade (a unidade-base de cada grandeza tem fator 1). */
  factor: number;
}

export interface Quantity {
  id: string;
  label: string;
  units: Unit[];
}

const u = (id: string, label: string, symbol: string, factor: number): Unit => ({ id, label, symbol, factor });

export const QUANTITIES: Quantity[] = [
  {
    id: "comprimento", label: "Comprimento",
    units: [u("m", "metro", "m", 1), u("km", "quilômetro", "km", 1000), u("cm", "centímetro", "cm", 0.01), u("mm", "milímetro", "mm", 0.001),
      u("um", "micrômetro", "µm", 1e-6), u("nm", "nanômetro", "nm", 1e-9), u("mi", "milha", "mi", 1609.344), u("yd", "jarda", "yd", 0.9144),
      u("ft", "pé", "ft", 0.3048), u("in", "polegada", "in", 0.0254), u("nmi", "milha náutica", "nmi", 1852), u("ua", "unidade astronômica", "UA", 1.495978707e11),
      u("al", "ano-luz", "ano-luz", 9.4607304725808e15)],
  },
  {
    id: "massa", label: "Massa",
    units: [u("kg", "quilograma", "kg", 1), u("g", "grama", "g", 0.001), u("mg", "miligrama", "mg", 1e-6), u("ug", "micrograma", "µg", 1e-9),
      u("t", "tonelada", "t", 1000), u("lb", "libra", "lb", 0.45359237), u("oz", "onça", "oz", 0.028349523125), u("ct", "quilate", "ct", 0.0002), u("u", "unidade de massa atômica", "u", 1.66053906660e-27)],
  },
  {
    id: "tempo", label: "Tempo",
    units: [u("s", "segundo", "s", 1), u("ms", "milissegundo", "ms", 0.001), u("us", "microssegundo", "µs", 1e-6), u("min", "minuto", "min", 60),
      u("h", "hora", "h", 3600), u("d", "dia", "d", 86400), u("sem", "semana", "sem", 604800), u("ano", "ano (365 dias)", "ano", 31536000)],
  },
  {
    id: "area", label: "Área",
    units: [u("m2", "metro quadrado", "m²", 1), u("km2", "quilômetro quadrado", "km²", 1e6), u("cm2", "centímetro quadrado", "cm²", 1e-4), u("mm2", "milímetro quadrado", "mm²", 1e-6),
      u("ha", "hectare", "ha", 10000), u("acre", "acre", "acre", 4046.8564224), u("ft2", "pé quadrado", "ft²", 0.09290304), u("in2", "polegada quadrada", "in²", 0.00064516)],
  },
  {
    id: "volume", label: "Volume",
    units: [u("m3", "metro cúbico", "m³", 1), u("L", "litro", "L", 0.001), u("mL", "mililitro", "mL", 1e-6), u("cm3", "centímetro cúbico", "cm³", 1e-6),
      u("gal", "galão (EUA)", "gal", 0.003785411784), u("qt", "quarto de galão (EUA)", "qt", 0.000946352946), u("pt", "pinta (EUA)", "pt", 0.000473176473),
      u("ft3", "pé cúbico", "ft³", 0.028316846592), u("xic", "xícara (240 mL)", "xíc", 0.00024)],
  },
  {
    id: "velocidade", label: "Velocidade",
    units: [u("ms", "metro por segundo", "m/s", 1), u("kmh", "quilômetro por hora", "km/h", 1 / 3.6), u("mph", "milha por hora", "mph", 0.44704),
      u("kn", "nó", "nó", 1852 / 3600), u("fts", "pé por segundo", "ft/s", 0.3048), u("c", "velocidade da luz", "c", 299792458), u("mach", "Mach (ao nível do mar)", "Mach", 340.29)],
  },
  {
    id: "forca", label: "Força",
    units: [u("N", "newton", "N", 1), u("kN", "quilonewton", "kN", 1000), u("kgf", "quilograma-força", "kgf", 9.80665), u("dyn", "dina", "dyn", 1e-5), u("lbf", "libra-força", "lbf", 4.4482216152605)],
  },
  {
    id: "pressao", label: "Pressão",
    units: [u("Pa", "pascal", "Pa", 1), u("kPa", "quilopascal", "kPa", 1000), u("bar", "bar", "bar", 100000), u("atm", "atmosfera", "atm", 101325),
      u("mmHg", "milímetro de mercúrio", "mmHg", 101325 / 760), u("torr", "torr", "Torr", 101325 / 760), u("psi", "libra por polegada quadrada", "psi", 6894.757293168), u("mca", "metro de coluna d'água", "mca", 9806.65)],
  },
  {
    id: "energia", label: "Energia",
    units: [u("J", "joule", "J", 1), u("kJ", "quilojoule", "kJ", 1000), u("cal", "caloria", "cal", 4.184), u("kcal", "quilocaloria", "kcal", 4184),
      u("Wh", "watt-hora", "Wh", 3600), u("kWh", "quilowatt-hora", "kWh", 3.6e6), u("eV", "elétron-volt", "eV", 1.602176634e-19), u("BTU", "BTU", "BTU", 1055.05585262), u("erg", "erg", "erg", 1e-7)],
  },
  {
    id: "potencia", label: "Potência",
    units: [u("W", "watt", "W", 1), u("kW", "quilowatt", "kW", 1000), u("MW", "megawatt", "MW", 1e6), u("cv", "cavalo-vapor", "cv", 735.49875), u("hp", "horsepower", "hp", 745.69987158227), u("BTUh", "BTU por hora", "BTU/h", 0.29307107)],
  },
  {
    id: "angulo", label: "Ângulo",
    units: [u("rad", "radiano", "rad", 1), u("deg", "grau", "°", Math.PI / 180), u("grad", "grado", "gon", Math.PI / 200), u("volta", "volta completa", "volta", 2 * Math.PI), u("arcmin", "minuto de arco", "′", Math.PI / 10800), u("arcsec", "segundo de arco", "″", Math.PI / 648000)],
  },
  {
    id: "dados", label: "Dados digitais",
    units: [u("bit", "bit", "bit", 0.125), u("B", "byte", "B", 1), u("KB", "quilobyte (1000)", "KB", 1e3), u("MB", "megabyte (1000²)", "MB", 1e6), u("GB", "gigabyte (1000³)", "GB", 1e9), u("TB", "terabyte (1000⁴)", "TB", 1e12),
      u("KiB", "kibibyte (1024)", "KiB", 1024), u("MiB", "mebibyte (1024²)", "MiB", 1048576), u("GiB", "gibibyte (1024³)", "GiB", 1073741824), u("TiB", "tebibyte (1024⁴)", "TiB", 1099511627776)],
  },
];

/** Temperatura: conversão afim (não basta multiplicar por um fator). */
export const TEMPERATURE_UNITS = [
  { id: "C", label: "grau Celsius", symbol: "°C" },
  { id: "K", label: "kelvin", symbol: "K" },
  { id: "F", label: "grau Fahrenheit", symbol: "°F" },
  { id: "Ra", label: "grau Rankine", symbol: "°R" },
] as const;

export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number]["id"];

const toKelvin: Record<TemperatureUnit, (v: number) => number> = {
  C: (v) => v + 273.15, K: (v) => v, F: (v) => ((v - 32) * 5) / 9 + 273.15, Ra: (v) => (v * 5) / 9,
};
const fromKelvin: Record<TemperatureUnit, (k: number) => number> = {
  C: (k) => k - 273.15, K: (k) => k, F: (k) => ((k - 273.15) * 9) / 5 + 32, Ra: (k) => (k * 9) / 5,
};

export function convertTemperature(value: number, from: TemperatureUnit, to: TemperatureUnit): number {
  return fromKelvin[to](toKelvin[from](value));
}

export function convert(value: number, from: Unit, to: Unit): number {
  return (value * from.factor) / to.factor;
}

/** Arredonda a 10 algarismos significativos para esconder erros de ponto flutuante (0,30000000000000004). */
export function cleanNumber(value: number): number {
  return Number(value.toPrecision(10));
}

export function formatConverted(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const v = cleanNumber(value);
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e12 || abs < 1e-6) return v.toExponential(6).replace(/\.?0+e/, "e").replace(".", ",");
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 10 });
}

export function findQuantity(id: string): Quantity | undefined {
  return QUANTITIES.find((q) => q.id === id);
}

/** Interpreta o que a pessoa digitou (vírgula ou ponto decimal; notação científica com "e"). */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "" || t === "-" || t === "." ) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
