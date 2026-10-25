import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Verificação OTIMISTA: sem cookie de sessão, manda para o login antes de renderizar.
 * Não é segurança — quem protege os dados é o backend (cada endpoint valida a sessão).
 */
const SESSION_COOKIE = "estudos_session";

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/entrar";
  url.search = next === "/" ? "" : `?proximo=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Só rotas do aplicativo; /entrar, /cadastro, etc. e arquivos estáticos ficam de fora.
  matcher: [
    "/",
    "/dashboard/:path*",
    "/materias/:path*",
    "/biblioteca/:path*",
    "/aulas/:path*",
    "/resumos/:path*",
    "/busca/:path*",
    "/revisao/:path*",
  ],
};
