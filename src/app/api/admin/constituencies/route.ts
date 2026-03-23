import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const constituencies = await prisma.constituency.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { submissions: true } },
    },
  });

  return NextResponse.json({ constituencies });
}
