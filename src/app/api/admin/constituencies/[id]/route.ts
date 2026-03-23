import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 20;
  const skip = (page - 1) * limit;

  const constituency = await prisma.constituency.findUnique({
    where: { id },
  });

  if (!constituency) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
      where: { constituencyId: id },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        textContent: true,
        voiceMemoPath: true,
        photoPath: true,
        anonymised: true,
        locationStatus: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
    prisma.submission.count({ where: { constituencyId: id } }),
  ]);

  return NextResponse.json({
    constituency,
    submissions,
    pagination: {
      page,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
