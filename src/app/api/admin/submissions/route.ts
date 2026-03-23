import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const skip = (page - 1) * limit;

  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        constituency: { select: { name: true } },
        user: { select: { email: true } },
      },
    }),
    prisma.submission.count(),
  ]);

  return NextResponse.json({
    submissions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
