import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// SHA-256 helper using Node.js crypto (matches the Edge-compatible version in middleware)
function getExpectedSessionToken(pin: string): string {
  const secret = process.env.SESSION_SECRET || "dev_group_stockcave_session_secret_key";
  return crypto.createHash("sha256").update(`${pin}:${secret}`).digest("hex");
}

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    const correctPin = process.env.GROUP_PIN || "1234";

    if (!pin || pin !== correctPin) {
      return NextResponse.json({ success: false, error: "잘못된 PIN 번호입니다." }, { status: 401 });
    }

    // Generate secure session token
    const token = getExpectedSessionToken(pin);

    // Set secure HTTP-only cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set("stockcave_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days session
    });

    return response;
  } catch (error) {
    console.error("Auth API Error:", error);
    return NextResponse.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// Log out by clearing the session cookie
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("stockcave_session", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
  return response;
}
