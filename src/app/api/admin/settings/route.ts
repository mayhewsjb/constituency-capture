import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let settings = await prisma.adminSettings.findFirst();
  if (!settings) {
    settings = await prisma.adminSettings.create({ data: {} });
  }

  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { defaultDigestTime } = body;

  let settings = await prisma.adminSettings.findFirst();
  if (!settings) {
    settings = await prisma.adminSettings.create({
      data: { defaultDigestTime: defaultDigestTime || null },
    });
  } else {
    settings = await prisma.adminSettings.update({
      where: { id: settings.id },
      data: { defaultDigestTime: defaultDigestTime || null },
    });
  }

  return NextResponse.json({ success: true, settings });
}
