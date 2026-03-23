import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, role } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Government/MP accounts require approval
    const isGovAccount = role === "mp";
    const status = isGovAccount ? "pending" : "active";
    const userRole = isGovAccount ? "mp" : "resident";

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: userRole,
        status,
      },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, role: user.role, status: user.status },
      message: isGovAccount
        ? "Account created. Awaiting admin approval."
        : "Account created successfully.",
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
