import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Standard Web Crypto SHA-256 helper (Edge-compatible)
async function getExpectedSessionToken(): Promise<string> {
  const pin = process.env.GROUP_PIN || "1234";
  const secret = process.env.SESSION_SECRET || "dev_group_stockcave_session_secret_key";
  
  const message = `${pin}:${secret}`;
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths that do not require PIN authentication
  const isAuthPage = pathname === "/login";
  const isAuthApi = pathname === "/api/auth";
  const isStaticAsset = pathname.startsWith("/_next") || pathname.startsWith("/favicon.ico") || pathname.includes(".");

  if (isAuthPage || isAuthApi || isStaticAsset) {
    return NextResponse.next();
  }

  // Read session cookie
  const sessionCookie = request.cookies.get("stockcave_session")?.value;
  const expectedToken = await getExpectedSessionToken();

  if (!sessionCookie || sessionCookie !== expectedToken) {
    // If not authenticated, redirect to login page
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Map paths to apply this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication API)
     * - login (login page)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
