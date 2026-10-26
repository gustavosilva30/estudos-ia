export type ElementCategory =
  | "alcalino" | "alcalino-terroso" | "transicao" | "pos-transicao" | "semimetal" | "ametal" | "halogenio"
  | "gas-nobre" | "lantanideo" | "actinideo" | "desconhecida";

export const ELEMENT_CATEGORIES: Record<ElementCategory, { label: string; color: string }> = {
  alcalino: { label: "Metais alcalinos", color: "#ef4444" },
  "alcalino-terroso": { label: "Metais alcalino-terrosos", color: "#f97316" },
  transicao: { label: "Metais de transição", color: "#eab308" },
  "pos-transicao": { label: "Outros metais", color: "#84cc16" },
  semimetal: { label: "Semimetais", color: "#14b8a6" },
  ametal: { label: "Ametais", color: "#22c55e" },
  halogenio: { label: "Halogênios", color: "#06b6d4" },
  "gas-nobre": { label: "Gases nobres", color: "#8b5cf6" },
  lantanideo: { label: "Lantanídeos", color: "#ec4899" },
  actinideo: { label: "Actinídeos", color: "#d946ef" },
  desconhecida: { label: "Propriedades químicas desconhecidas", color: "#94a3b8" },
};

export type MatterState = "sólido" | "líquido" | "gasoso" | "desconhecido";

export interface ChemElement {
  z: number;
  symbol: string;
  name: string;
  /** Massa atômica (u). Para elementos sem isótopo estável, o número de massa do isótopo mais estável. */
  mass: number;
  category: ElementCategory;
  period: number;
  /** Grupo 1–18; null para lantanídeos e actinídeos (ficam nas linhas abaixo da tabela). */
  group: number | null;
  state: MatterState;
  radioactive: boolean;
}

type Row = [z: number, symbol: string, name: string, mass: number, category: ElementCategory, period: number, group: number | null];

const A = "alcalino", AT = "alcalino-terroso", T = "transicao", P = "pos-transicao", S = "semimetal", N = "ametal", H = "halogenio", G = "gas-nobre", L = "lantanideo", AC = "actinideo", U = "desconhecida";

const ROWS: Row[] = [
  [1, "H", "Hidrogênio", 1.008, N, 1, 1], [2, "He", "Hélio", 4.0026, G, 1, 18],
  [3, "Li", "Lítio", 6.94, A, 2, 1], [4, "Be", "Berílio", 9.0122, AT, 2, 2], [5, "B", "Boro", 10.81, S, 2, 13], [6, "C", "Carbono", 12.011, N, 2, 14],
  [7, "N", "Nitrogênio", 14.007, N, 2, 15], [8, "O", "Oxigênio", 15.999, N, 2, 16], [9, "F", "Flúor", 18.998, H, 2, 17], [10, "Ne", "Neônio", 20.18, G, 2, 18],
  [11, "Na", "Sódio", 22.99, A, 3, 1], [12, "Mg", "Magnésio", 24.305, AT, 3, 2], [13, "Al", "Alumínio", 26.982, P, 3, 13], [14, "Si", "Silício", 28.085, S, 3, 14],
  [15, "P", "Fósforo", 30.974, N, 3, 15], [16, "S", "Enxofre", 32.06, N, 3, 16], [17, "Cl", "Cloro", 35.45, H, 3, 17], [18, "Ar", "Argônio", 39.948, G, 3, 18],
  [19, "K", "Potássio", 39.098, A, 4, 1], [20, "Ca", "Cálcio", 40.078, AT, 4, 2], [21, "Sc", "Escândio", 44.956, T, 4, 3], [22, "Ti", "Titânio", 47.867, T, 4, 4],
  [23, "V", "Vanádio", 50.942, T, 4, 5], [24, "Cr", "Cromo", 51.996, T, 4, 6], [25, "Mn", "Manganês", 54.938, T, 4, 7], [26, "Fe", "Ferro", 55.845, T, 4, 8],
  [27, "Co", "Cobalto", 58.933, T, 4, 9], [28, "Ni", "Níquel", 58.693, T, 4, 10], [29, "Cu", "Cobre", 63.546, T, 4, 11], [30, "Zn", "Zinco", 65.38, T, 4, 12],
  [31, "Ga", "Gálio", 69.723, P, 4, 13], [32, "Ge", "Germânio", 72.63, S, 4, 14], [33, "As", "Arsênio", 74.922, S, 4, 15], [34, "Se", "Selênio", 78.971, N, 4, 16],
  [35, "Br", "Bromo", 79.904, H, 4, 17], [36, "Kr", "Criptônio", 83.798, G, 4, 18],
  [37, "Rb", "Rubídio", 85.468, A, 5, 1], [38, "Sr", "Estrôncio", 87.62, AT, 5, 2], [39, "Y", "Ítrio", 88.906, T, 5, 3], [40, "Zr", "Zircônio", 91.224, T, 5, 4],
  [41, "Nb", "Nióbio", 92.906, T, 5, 5], [42, "Mo", "Molibdênio", 95.95, T, 5, 6], [43, "Tc", "Tecnécio", 98, T, 5, 7], [44, "Ru", "Rutênio", 101.07, T, 5, 8],
  [45, "Rh", "Ródio", 102.91, T, 5, 9], [46, "Pd", "Paládio", 106.42, T, 5, 10], [47, "Ag", "Prata", 107.87, T, 5, 11], [48, "Cd", "Cádmio", 112.41, T, 5, 12],
  [49, "In", "Índio", 114.82, P, 5, 13], [50, "Sn", "Estanho", 118.71, P, 5, 14], [51, "Sb", "Antimônio", 121.76, S, 5, 15], [52, "Te", "Telúrio", 127.6, S, 5, 16],
  [53, "I", "Iodo", 126.9, H, 5, 17], [54, "Xe", "Xenônio", 131.29, G, 5, 18],
  [55, "Cs", "Césio", 132.91, A, 6, 1], [56, "Ba", "Bário", 137.33, AT, 6, 2],
  [57, "La", "Lantânio", 138.91, L, 6, null], [58, "Ce", "Cério", 140.12, L, 6, null], [59, "Pr", "Praseodímio", 140.91, L, 6, null], [60, "Nd", "Neodímio", 144.24, L, 6, null],
  [61, "Pm", "Promécio", 145, L, 6, null], [62, "Sm", "Samário", 150.36, L, 6, null], [63, "Eu", "Európio", 151.96, L, 6, null], [64, "Gd", "Gadolínio", 157.25, L, 6, null],
  [65, "Tb", "Térbio", 158.93, L, 6, null], [66, "Dy", "Disprósio", 162.5, L, 6, null], [67, "Ho", "Hólmio", 164.93, L, 6, null], [68, "Er", "Érbio", 167.26, L, 6, null],
  [69, "Tm", "Túlio", 168.93, L, 6, null], [70, "Yb", "Itérbio", 173.05, L, 6, null], [71, "Lu", "Lutécio", 174.97, L, 6, null],
  [72, "Hf", "Háfnio", 178.49, T, 6, 4], [73, "Ta", "Tântalo", 180.95, T, 6, 5], [74, "W", "Tungstênio", 183.84, T, 6, 6], [75, "Re", "Rênio", 186.21, T, 6, 7],
  [76, "Os", "Ósmio", 190.23, T, 6, 8], [77, "Ir", "Irídio", 192.22, T, 6, 9], [78, "Pt", "Platina", 195.08, T, 6, 10], [79, "Au", "Ouro", 196.97, T, 6, 11],
  [80, "Hg", "Mercúrio", 200.59, T, 6, 12], [81, "Tl", "Tálio", 204.38, P, 6, 13], [82, "Pb", "Chumbo", 207.2, P, 6, 14], [83, "Bi", "Bismuto", 208.98, P, 6, 15],
  [84, "Po", "Polônio", 209, P, 6, 16], [85, "At", "Astato", 210, H, 6, 17], [86, "Rn", "Radônio", 222, G, 6, 18],
  [87, "Fr", "Frâncio", 223, A, 7, 1], [88, "Ra", "Rádio", 226, AT, 7, 2],
  [89, "Ac", "Actínio", 227, AC, 7, null], [90, "Th", "Tório", 232.04, AC, 7, null], [91, "Pa", "Protactínio", 231.04, AC, 7, null], [92, "U", "Urânio", 238.03, AC, 7, null],
  [93, "Np", "Neptúnio", 237, AC, 7, null], [94, "Pu", "Plutônio", 244, AC, 7, null], [95, "Am", "Amerício", 243, AC, 7, null], [96, "Cm", "Cúrio", 247, AC, 7, null],
  [97, "Bk", "Berquélio", 247, AC, 7, null], [98, "Cf", "Califórnio", 251, AC, 7, null], [99, "Es", "Einstênio", 252, AC, 7, null], [100, "Fm", "Férmio", 257, AC, 7, null],
  [101, "Md", "Mendelévio", 258, AC, 7, null], [102, "No", "Nobélio", 259, AC, 7, null], [103, "Lr", "Laurêncio", 266, AC, 7, null],
  [104, "Rf", "Rutherfórdio", 267, T, 7, 4], [105, "Db", "Dúbnio", 268, T, 7, 5], [106, "Sg", "Seabórgio", 269, T, 7, 6], [107, "Bh", "Bóhrio", 270, T, 7, 7],
  [108, "Hs", "Hássio", 277, T, 7, 8], [109, "Mt", "Meitnério", 278, U, 7, 9], [110, "Ds", "Darmstácio", 281, U, 7, 10], [111, "Rg", "Roentgênio", 282, U, 7, 11],
  [112, "Cn", "Copernício", 285, U, 7, 12], [113, "Nh", "Nihônio", 286, U, 7, 13], [114, "Fl", "Fleróvio", 289, U, 7, 14], [115, "Mc", "Moscóvio", 290, U, 7, 15],
  [116, "Lv", "Livermório", 293, U, 7, 16], [117, "Ts", "Tenesso", 294, U, 7, 17], [118, "Og", "Oganessônio", 294, U, 7, 18],
];

const GASES = new Set([1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86]);
const LIQUIDS = new Set([35, 80]);

export const ELEMENTS: ChemElement[] = ROWS.map(([z, symbol, name, mass, category, period, group]) => ({
  z, symbol, name, mass, category, period, group,
  state: z >= 104 ? "desconhecido" : GASES.has(z) ? "gasoso" : LIQUIDS.has(z) ? "líquido" : "sólido",
  radioactive: z === 43 || z === 61 || z >= 84,
}));

export function elementByNumber(z: number): ChemElement | undefined {
  return ELEMENTS[z - 1];
}

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function searchElements(query: string): ChemElement[] {
  const q = normalize(query);
  if (!q) return ELEMENTS;
  return ELEMENTS.filter(
    (e) => e.symbol.toLowerCase() === q || String(e.z) === q || normalize(e.name).includes(q) || e.symbol.toLowerCase().startsWith(q),
  );
}

// ---------- distribuição eletrônica (diagrama de Pauling) ----------

const SUBSHELL_ORDER = ["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p", "5s", "4d", "5p", "6s", "4f", "5d", "6p", "7s", "5f", "6d", "7p"];
const CAPACITY: Record<string, number> = { s: 2, p: 6, d: 10, f: 14 };
const SHELL_NAMES = ["K", "L", "M", "N", "O", "P", "Q"];

export interface ElectronConfiguration {
  /** Subníveis na ordem do diagrama de Pauling, por exemplo "1s² 2s² 2p⁶ 3s¹". */
  text: string;
  /** Elétrons por camada (K, L, M...), em ordem crescente de n. */
  shells: { name: string; electrons: number }[];
  /** Elétrons da camada de valência (a mais externa ocupada). */
  valence: number;
}

const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => String(n).split("").map((d) => SUPERSCRIPTS[Number(d)]).join("");

/**
 * Distribuição pelo diagrama de Pauling (a que se ensina na escola). Alguns elementos (Cr, Cu, Pd, Ag, Au...)
 * têm configuração real ligeiramente diferente; o diagrama não as considera.
 */
export function electronConfiguration(z: number): ElectronConfiguration {
  let left = z;
  const parts: string[] = [];
  const perShell: number[] = [];
  for (const sub of SUBSHELL_ORDER) {
    if (left <= 0) break;
    const n = Number(sub[0]);
    const count = Math.min(left, CAPACITY[sub[1]]);
    parts.push(`${sub}${sup(count)}`);
    perShell[n - 1] = (perShell[n - 1] ?? 0) + count;
    left -= count;
  }
  const shells = perShell.map((electrons, i) => ({ name: SHELL_NAMES[i], electrons: electrons ?? 0 }));
  return { text: parts.join(" "), shells, valence: shells[shells.length - 1]?.electrons ?? 0 };
}
