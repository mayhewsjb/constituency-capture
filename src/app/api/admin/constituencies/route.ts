import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Lightweight count-only check used for first-boot auto-sync detection
  if (searchParams.get("countOnly") === "true") {
    const count = await prisma.constituency.count();
    return NextResponse.json({ count });
  }

  const constituencies = await prisma.constituency.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { submissions: true } },
    },
  });

  return NextResponse.json({ constituencies });
}
