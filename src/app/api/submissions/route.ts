import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submissions = await prisma.submission.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      constituency: { select: { name: true, mpName: true } },
    },
  });

  return NextResponse.json({ submissions });
}
