import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const TWFY_BASE = "https://www.theyworkforyou.com/api";

interface TwfyMP {
  person_id: string;
  name: string;
  constituency: string;
  email?: string;
  party?: string;
}

export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.TWFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TWFY_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const url = `${TWFY_BASE}/getMPs?output=json&key=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json(
        { error: `TheyWorkForYou API error: ${res.status}` },
        { status: res.status }
      );
    }

    const mps = (await res.json()) as TwfyMP[];

    let updated = 0;
    let created = 0;

    for (const mp of mps) {
      if (!mp.constituency) continue;

      const existing = await prisma.constituency.findUnique({
        where: { name: mp.constituency },
      });

      if (existing) {
        await prisma.constituency.update({
          where: { name: mp.constituency },
          data: {
            mpName: mp.name,
            mpEmail: mp.email || null,
          },
        });
        updated++;
      } else {
        await prisma.constituency.create({
          data: {
            name: mp.constituency,
            mpName: mp.name,
            mpEmail: mp.email || null,
          },
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Refreshed MP data: ${created} constituencies created, ${updated} updated`,
      stats: { created, updated, total: mps.length },
    });
  } catch (error) {
    console.error("TWFY refresh error:", error);
    return NextResponse.json(
      { error: "Failed to refresh MP data" },
      { status: 500 }
    );
  }
}
