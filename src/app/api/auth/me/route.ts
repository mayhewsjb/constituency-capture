import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({
      user: {
        userId: session.userId,
        email: session.email,
        role: session.role,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
