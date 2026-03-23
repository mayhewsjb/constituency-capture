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
  const { digestFrequency, digestDay, digestTime } = body;

  let settings = await prisma.adminSettings.findFirst();
  if (!settings) {
    settings = await prisma.adminSettings.create({
      data: {
        digestFrequency: digestFrequency ?? "weekly",
        digestDay: digestDay ?? "monday",
        digestTime: digestTime ?? "08:00",
      },
    });
  } else {
    settings = await prisma.adminSettings.update({
      where: { id: settings.id },
      data: {
        ...(digestFrequency !== undefined && { digestFrequency }),
        ...(digestDay !== undefined && { digestDay }),
        ...(digestTime !== undefined && { digestTime }),
      },
    });
  }

  return NextResponse.json({ success: true, settings });
}
