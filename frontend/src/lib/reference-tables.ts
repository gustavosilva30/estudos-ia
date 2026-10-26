const tex = String.raw;

export interface TableRow {
  name: string;
  /** Expressão em LaTeX, já em modo de exibição. */
  latex: string;
  note?: string;
}

export interface ReferenceTable {
  id: string;
  title: string;
  intro?: string;
  rows: TableRow[];
}

/** Tabelas de consulta rápida (sem cálculo): derivadas, integrais, trigonometria, potências e logaritmos... */
export const REFERENCE_TABLES: ReferenceTable[] = [
  {
    id: "derivadas", title: "Derivadas",
    intro: "Regras e derivadas das funções elementares (u e v são funções de x; a, n e c são constantes).",
    rows: [
      { name: "Constante", latex: tex`\dfrac{d}{dx}\,c = 0` },
      { name: "Potência", latex: tex`\dfrac{d}{dx}\,x^n = n\,x^{n-1}` },
      { name: "Constante vezes função", latex: tex`\dfrac{d}{dx}\,[c\,u] = c\,u'` },
      { name: "Soma e diferença", latex: tex`\dfrac{d}{dx}\,[u \pm v] = u' \pm v'` },
      { name: "Produto", latex: tex`\dfrac{d}{dx}\,[u\,v] = u'v + u\,v'` },
      { name: "Quociente", latex: tex`\dfrac{d}{dx}\left[\dfrac{u}{v}\right] = \dfrac{u'v - u\,v'}{v^2}` },
      { name: "Regra da cadeia", latex: tex`\dfrac{d}{dx}\,f(g(x)) = f'(g(x))\cdot g'(x)` },
      { name: "Exponencial de base e", latex: tex`\dfrac{d}{dx}\,e^x = e^x` },
      { name: "Exponencial de base a", latex: tex`\dfrac{d}{dx}\,a^x = a^x\ln a` },
      { name: "Logaritmo natural", latex: tex`\dfrac{d}{dx}\,\ln x = \dfrac{1}{x}` },
      { name: "Logaritmo de base a", latex: tex`\dfrac{d}{dx}\,\log_a x = \dfrac{1}{x\ln a}` },
      { name: "Raiz quadrada", latex: tex`\dfrac{d}{dx}\,\sqrt{x} = \dfrac{1}{2\sqrt{x}}` },
      { name: "Seno", latex: tex`\dfrac{d}{dx}\,\sin x = \cos x` },
      { name: "Cosseno", latex: tex`\dfrac{d}{dx}\,\cos x = -\sin x` },
      { name: "Tangente", latex: tex`\dfrac{d}{dx}\,\tan x = \sec^2 x` },
      { name: "Arco seno", latex: tex`\dfrac{d}{dx}\,\arcsin x = \dfrac{1}{\sqrt{1-x^2}}` },
      { name: "Arco cosseno", latex: tex`\dfrac{d}{dx}\,\arccos x = -\dfrac{1}{\sqrt{1-x^2}}` },
      { name: "Arco tangente", latex: tex`\dfrac{d}{dx}\,\arctan x = \dfrac{1}{1+x^2}` },
      { name: "Seno hiperbólico", latex: tex`\dfrac{d}{dx}\,\sinh x = \cosh x` },
      { name: "Cosseno hiperbólico", latex: tex`\dfrac{d}{dx}\,\cosh x = \sinh x` },
    ],
  },
  {
    id: "integrais", title: "Integrais",
    intro: "Integrais indefinidas básicas (C é a constante de integração).",
    rows: [
      { name: "Constante", latex: tex`\int a\,dx = a\,x + C` },
      { name: "Potência (n ≠ −1)", latex: tex`\int x^n\,dx = \dfrac{x^{n+1}}{n+1} + C` },
      { name: "Inverso", latex: tex`\int \dfrac{1}{x}\,dx = \ln|x| + C` },
      { name: "Exponencial de base e", latex: tex`\int e^x\,dx = e^x + C` },
      { name: "Exponencial de base a", latex: tex`\int a^x\,dx = \dfrac{a^x}{\ln a} + C` },
      { name: "Seno", latex: tex`\int \sin x\,dx = -\cos x + C` },
      { name: "Cosseno", latex: tex`\int \cos x\,dx = \sin x + C` },
      { name: "Secante ao quadrado", latex: tex`\int \sec^2 x\,dx = \tan x + C` },
      { name: "Tangente", latex: tex`\int \tan x\,dx = -\ln|\cos x| + C` },
      { name: "Logaritmo natural", latex: tex`\int \ln x\,dx = x\ln x - x + C` },
      { name: "Inversa de 1 + x²", latex: tex`\int \dfrac{1}{1+x^2}\,dx = \arctan x + C` },
      { name: "Inversa de √(1 − x²)", latex: tex`\int \dfrac{1}{\sqrt{1-x^2}}\,dx = \arcsin x + C` },
      { name: "Por partes", latex: tex`\int u\,dv = u\,v - \int v\,du` },
      { name: "Teorema fundamental do cálculo", latex: tex`\int_a^b f(x)\,dx = F(b) - F(a)` },
    ],
  },
  {
    id: "trigonometria", title: "Trigonometria",
    intro: "Identidades e fórmulas de ângulos.",
    rows: [
      { name: "Relação fundamental", latex: tex`\sin^2\theta + \cos^2\theta = 1` },
      { name: "Tangente", latex: tex`\tan\theta = \dfrac{\sin\theta}{\cos\theta}` },
      { name: "Secante e cossecante", latex: tex`\sec\theta = \dfrac{1}{\cos\theta} \qquad \csc\theta = \dfrac{1}{\sin\theta}` },
      { name: "Relações derivadas", latex: tex`1 + \tan^2\theta = \sec^2\theta \qquad 1 + \cot^2\theta = \csc^2\theta` },
      { name: "Seno da soma", latex: tex`\sin(a \pm b) = \sin a\cos b \pm \cos a\sin b` },
      { name: "Cosseno da soma", latex: tex`\cos(a \pm b) = \cos a\cos b \mp \sin a\sin b` },
      { name: "Tangente da soma", latex: tex`\tan(a \pm b) = \dfrac{\tan a \pm \tan b}{1 \mp \tan a\tan b}` },
      { name: "Arco duplo (seno)", latex: tex`\sin 2\theta = 2\sin\theta\cos\theta` },
      { name: "Arco duplo (cosseno)", latex: tex`\cos 2\theta = \cos^2\theta - \sin^2\theta = 1 - 2\sin^2\theta = 2\cos^2\theta - 1` },
      { name: "Arco duplo (tangente)", latex: tex`\tan 2\theta = \dfrac{2\tan\theta}{1 - \tan^2\theta}` },
      { name: "Arco metade", latex: tex`\sin^2\dfrac{\theta}{2} = \dfrac{1 - \cos\theta}{2} \qquad \cos^2\dfrac{\theta}{2} = \dfrac{1 + \cos\theta}{2}` },
      { name: "Produto em soma", latex: tex`\sin a\cos b = \dfrac{\sin(a+b) + \sin(a-b)}{2}` },
      { name: "Lei dos senos", latex: tex`\dfrac{a}{\sin A} = \dfrac{b}{\sin B} = \dfrac{c}{\sin C} = 2R` },
      { name: "Lei dos cossenos", latex: tex`a^2 = b^2 + c^2 - 2bc\cos A` },
      { name: "Conversão", latex: tex`\pi\ \text{rad} = 180^\circ \qquad 1\ \text{rad} \approx 57{,}3^\circ` },
    ],
  },
  {
    id: "angulos-notaveis", title: "Ângulos notáveis",
    intro: "Valores exatos de seno, cosseno e tangente.",
    rows: [
      { name: "0° (0 rad)", latex: tex`\sin = 0 \quad \cos = 1 \quad \tan = 0` },
      { name: "30° (π/6)", latex: tex`\sin = \dfrac{1}{2} \quad \cos = \dfrac{\sqrt{3}}{2} \quad \tan = \dfrac{\sqrt{3}}{3}` },
      { name: "45° (π/4)", latex: tex`\sin = \dfrac{\sqrt{2}}{2} \quad \cos = \dfrac{\sqrt{2}}{2} \quad \tan = 1` },
      { name: "60° (π/3)", latex: tex`\sin = \dfrac{\sqrt{3}}{2} \quad \cos = \dfrac{1}{2} \quad \tan = \sqrt{3}` },
      { name: "90° (π/2)", latex: tex`\sin = 1 \quad \cos = 0 \quad \tan\ \text{não existe}` },
      { name: "180° (π)", latex: tex`\sin = 0 \quad \cos = -1 \quad \tan = 0` },
      { name: "270° (3π/2)", latex: tex`\sin = -1 \quad \cos = 0 \quad \tan\ \text{não existe}` },
      { name: "360° (2π)", latex: tex`\sin = 0 \quad \cos = 1 \quad \tan = 0` },
    ],
  },
  {
    id: "potencias-logaritmos", title: "Potências, raízes e logaritmos",
    intro: "Propriedades operatórias (com as condições de existência: bases positivas e diferentes de 1 nos logaritmos).",
    rows: [
      { name: "Produto de potências", latex: tex`a^m\cdot a^n = a^{m+n}` },
      { name: "Quociente de potências", latex: tex`\dfrac{a^m}{a^n} = a^{m-n}` },
      { name: "Potência de potência", latex: tex`(a^m)^n = a^{m\cdot n}` },
      { name: "Potência de produto", latex: tex`(a\,b)^n = a^n\,b^n` },
      { name: "Expoente negativo e zero", latex: tex`a^{-n} = \dfrac{1}{a^n} \qquad a^0 = 1\ (a \ne 0)` },
      { name: "Expoente fracionário", latex: tex`a^{m/n} = \sqrt[n]{a^m}` },
      { name: "Produto de raízes", latex: tex`\sqrt[n]{a}\cdot\sqrt[n]{b} = \sqrt[n]{ab}` },
      { name: "Definição de logaritmo", latex: tex`\log_b a = x \Leftrightarrow b^x = a` },
      { name: "Logaritmo do produto", latex: tex`\log_b(xy) = \log_b x + \log_b y` },
      { name: "Logaritmo do quociente", latex: tex`\log_b\dfrac{x}{y} = \log_b x - \log_b y` },
      { name: "Logaritmo da potência", latex: tex`\log_b x^n = n\log_b x` },
      { name: "Mudança de base", latex: tex`\log_b a = \dfrac{\log_c a}{\log_c b}` },
      { name: "Consequências", latex: tex`\log_b 1 = 0 \qquad \log_b b = 1 \qquad b^{\log_b a} = a` },
    ],
  },
  {
    id: "limites", title: "Limites notáveis",
    rows: [
      { name: "Limite fundamental trigonométrico", latex: tex`\lim_{x\to 0}\dfrac{\sin x}{x} = 1` },
      { name: "Limite de (1 − cos x)/x", latex: tex`\lim_{x\to 0}\dfrac{1-\cos x}{x} = 0` },
      { name: "Número de Euler", latex: tex`\lim_{n\to\infty}\left(1 + \dfrac{1}{n}\right)^n = e` },
      { name: "Exponencial", latex: tex`\lim_{x\to 0}\dfrac{e^x - 1}{x} = 1` },
      { name: "Logaritmo", latex: tex`\lim_{x\to 0}\dfrac{\ln(1+x)}{x} = 1` },
      { name: "Regra de L'Hôpital", latex: tex`\lim_{x\to a}\dfrac{f(x)}{g(x)} = \lim_{x\to a}\dfrac{f'(x)}{g'(x)}\ (\text{formas } 0/0 \text{ ou } \infty/\infty)` },
    ],
  },
  {
    id: "geometria", title: "Áreas e volumes (resumo)",
    rows: [
      { name: "Quadrado e retângulo", latex: tex`A = \ell^2 \qquad A = b\,h` },
      { name: "Triângulo", latex: tex`A = \dfrac{b\,h}{2}` },
      { name: "Paralelogramo e losango", latex: tex`A = b\,h \qquad A = \dfrac{D\,d}{2}` },
      { name: "Trapézio", latex: tex`A = \dfrac{(B+b)\,h}{2}` },
      { name: "Círculo", latex: tex`A = \pi r^2 \qquad C = 2\pi r` },
      { name: "Cubo", latex: tex`V = a^3 \qquad A_t = 6a^2 \qquad d = a\sqrt{3}` },
      { name: "Paralelepípedo", latex: tex`V = a\,b\,c \qquad A_t = 2(ab+ac+bc)` },
      { name: "Prisma e cilindro", latex: tex`V = A_b\,h \qquad V_{cil} = \pi r^2 h` },
      { name: "Pirâmide e cone", latex: tex`V = \dfrac{A_b\,h}{3} \qquad V_{cone} = \dfrac{\pi r^2 h}{3}` },
      { name: "Esfera", latex: tex`V = \dfrac{4}{3}\pi r^3 \qquad A = 4\pi r^2` },
    ],
  },
];
