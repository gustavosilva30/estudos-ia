export type ConstantGroup = "fundamentais" | "fisica" | "quimica" | "astronomia";

export const CONSTANT_GROUPS: { id: ConstantGroup; label: string }[] = [
  { id: "fundamentais", label: "Constantes fundamentais" },
  { id: "fisica", label: "Física geral" },
  { id: "quimica", label: "Química" },
  { id: "astronomia", label: "Astronomia e Terra" },
];

export interface PhysicalConstant {
  id: string;
  name: string;
  /** Símbolo em LaTeX. */
  symbol: string;
  value: number;
  unit: string;
  /** Unidade em LaTeX (para exibição desenhada). */
  unitTex: string;
  group: ConstantGroup;
  note?: string;
}

type Row = [id: string, name: string, symbol: string, value: number, unit: string, unitTex: string, group: ConstantGroup, note?: string];

// Valores CODATA 2018/2022; as constantes definidas pelo SI (c, h, e, k_B, N_A) são exatas.
const ROWS: Row[] = [
  ["c", "Velocidade da luz no vácuo", "c", 299792458, "m/s", "\\text{m/s}", "fundamentais", "Exata (define o metro)."],
  ["h", "Constante de Planck", "h", 6.62607015e-34, "J·s", "\\text{J·s}", "fundamentais", "Exata."],
  ["hbar", "Constante de Planck reduzida", "\\hbar", 1.054571817e-34, "J·s", "\\text{J·s}", "fundamentais", "ħ = h / 2π."],
  ["e", "Carga elementar", "e", 1.602176634e-19, "C", "\\text{C}", "fundamentais", "Exata."],
  ["kB", "Constante de Boltzmann", "k_B", 1.380649e-23, "J/K", "\\text{J/K}", "fundamentais", "Exata."],
  ["NA", "Constante de Avogadro", "N_A", 6.02214076e23, "mol⁻¹", "\\text{mol}^{-1}", "fundamentais", "Exata."],
  ["G", "Constante gravitacional", "G", 6.6743e-11, "N·m²/kg²", "\\text{N·m}^2/\\text{kg}^2", "fundamentais"],
  ["eps0", "Permissividade elétrica do vácuo", "\\varepsilon_0", 8.8541878128e-12, "F/m", "\\text{F/m}", "fundamentais"],
  ["mu0", "Permeabilidade magnética do vácuo", "\\mu_0", 1.25663706212e-6, "N/A²", "\\text{N/A}^2", "fundamentais"],
  ["k", "Constante eletrostática (Coulomb)", "k", 8.9875517923e9, "N·m²/C²", "\\text{N·m}^2/\\text{C}^2", "fundamentais", "k = 1 / 4πε₀ (≈ 9 × 10⁹ nos exercícios)."],
  ["sigma", "Constante de Stefan-Boltzmann", "\\sigma", 5.670374419e-8, "W/(m²·K⁴)", "\\text{W/(m}^2\\text{·K}^4)", "fundamentais"],
  ["alpha", "Constante de estrutura fina", "\\alpha", 7.2973525693e-3, "adimensional", "", "fundamentais"],
  ["g", "Aceleração padrão da gravidade", "g", 9.80665, "m/s²", "\\text{m/s}^2", "fisica", "Valor padrão; nos exercícios usa-se 9,8 ou 10."],
  ["atm", "Atmosfera padrão", "\\text{atm}", 101325, "Pa", "\\text{Pa}", "fisica", "1 atm = 760 mmHg."],
  ["vsom", "Velocidade do som no ar (20 °C)", "v_{som}", 343, "m/s", "\\text{m/s}", "fisica", "Aproximadamente; varia com a temperatura."],
  ["rhoAgua", "Densidade da água (4 °C)", "\\rho_{água}", 1000, "kg/m³", "\\text{kg/m}^3", "fisica", "1 g/cm³."],
  ["cAgua", "Calor específico da água (líquida)", "c_{água}", 4186, "J/(kg·K)", "\\text{J/(kg·K)}", "fisica", "≈ 1 cal/(g·°C)."],
  ["LfusGelo", "Calor latente de fusão do gelo", "L_f", 334000, "J/kg", "\\text{J/kg}", "fisica", "≈ 80 cal/g."],
  ["LvapAgua", "Calor latente de vaporização da água", "L_v", 2260000, "J/kg", "\\text{J/kg}", "fisica", "≈ 540 cal/g."],
  ["cal", "Caloria em joules", "\\text{cal}", 4.184, "J", "\\text{J}", "fisica", "1 cal = 4,184 J."],
  ["me", "Massa do elétron", "m_e", 9.1093837015e-31, "kg", "\\text{kg}", "quimica"],
  ["mp", "Massa do próton", "m_p", 1.67262192369e-27, "kg", "\\text{kg}", "quimica"],
  ["mn", "Massa do nêutron", "m_n", 1.67492749804e-27, "kg", "\\text{kg}", "quimica"],
  ["u", "Unidade de massa atômica", "u", 1.66053906660e-27, "kg", "\\text{kg}", "quimica", "1 u = 1/12 da massa do ¹²C."],
  ["R", "Constante universal dos gases", "R", 8.314462618, "J/(mol·K)", "\\text{J/(mol·K)}", "quimica"],
  ["Ratm", "Constante dos gases (atm·L)", "R", 0.082057366, "atm·L/(mol·K)", "\\text{atm·L/(mol·K)}", "quimica", "Nos exercícios: 0,082."],
  ["F", "Constante de Faraday", "F", 96485.33212, "C/mol", "\\text{C/mol}", "quimica", "Nos exercícios: 96 500 C/mol."],
  ["Vm", "Volume molar (0 °C, 1 atm)", "V_m", 22.414, "L/mol", "\\text{L/mol}", "quimica", "CNTP clássicas: 22,4 L/mol."],
  ["Kw", "Produto iônico da água (25 °C)", "K_w", 1e-14, "mol²/L²", "\\text{mol}^2/\\text{L}^2", "quimica", "pH + pOH = 14."],
  ["Rinf", "Constante de Rydberg", "R_\\infty", 10973731.56816, "m⁻¹", "\\text{m}^{-1}", "quimica"],
  ["eV", "Elétron-volt em joules", "\\text{eV}", 1.602176634e-19, "J", "\\text{J}", "quimica", "1 eV = 1,602 × 10⁻¹⁹ J."],
  ["Mterra", "Massa da Terra", "M_T", 5.9722e24, "kg", "\\text{kg}", "astronomia"],
  ["Rterra", "Raio médio da Terra", "R_T", 6.371e6, "m", "\\text{m}", "astronomia"],
  ["Msol", "Massa do Sol", "M_\\odot", 1.98847e30, "kg", "\\text{kg}", "astronomia"],
  ["Rsol", "Raio do Sol", "R_\\odot", 6.957e8, "m", "\\text{m}", "astronomia"],
  ["Mlua", "Massa da Lua", "M_L", 7.342e22, "kg", "\\text{kg}", "astronomia"],
  ["dTL", "Distância média Terra–Lua", "d_{TL}", 3.844e8, "m", "\\text{m}", "astronomia"],
  ["UA", "Unidade astronômica", "\\text{UA}", 1.495978707e11, "m", "\\text{m}", "astronomia", "Distância média Terra–Sol."],
  ["al", "Ano-luz", "\\text{ano-luz}", 9.4607304725808e15, "m", "\\text{m}", "astronomia"],
  ["pc", "Parsec", "\\text{pc}", 3.0856775814914e16, "m", "\\text{m}", "astronomia"],
];

export const CONSTANTS: PhysicalConstant[] = ROWS.map(([id, name, symbol, value, unit, unitTex, group, note]) => ({
  id, name, symbol, value, unit, unitTex, group, note,
}));

/** Valor legível em notação científica com vírgula decimal, por exemplo "6,62607015 × 10⁻³⁴". */
export function formatConstant(value: number): string {
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) {
    const [mantissa, exponent] = value.toExponential().split("e");
    const exp = String(Number(exponent)).replace("-", "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]);
    return `${mantissa.replace(".", ",")} × 10${exp}`;
  }
  return String(value).replace(".", ",");
}

/** Valor para copiar e colar em cálculos (ponto decimal, notação com "e"). */
export function constantForCopy(value: number): string {
  return String(value);
}
