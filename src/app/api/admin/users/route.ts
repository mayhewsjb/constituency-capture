import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pendingUsers = await prisma.user.findMany({
    where: { status: "pending" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users: pendingUsers });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userId, action } = body;

  if (!userId || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }

  const newStatus = action === "approve" ? "active" : "rejected";

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus },
    select: { id: true, email: true, role: true, status: true },
  });

  return NextResponse.json({ success: true, user });
}
