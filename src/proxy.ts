import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { PERSONA_COOKIE, isDemoMode, personaByKey } from "@/lib/personas";

// Optimistic check only — real authorization happens in the DAL / handlers.
export function proxy(request: NextRequest) {
  const demo = isDemoMode();
  const identified = demo ? !!personaByKey(request.cookies.get(PERSONA_COOKIE)?.value) : !!getSessionCookie(request);
  if (!identified) {
    const url = new URL(demo ? "/welcome" : "/login", request.url);
    if (!demo && request.nextUrl.pathname !== "/") url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|welcome|_next/static|_next/image|favicon.ico).*)"],
};
