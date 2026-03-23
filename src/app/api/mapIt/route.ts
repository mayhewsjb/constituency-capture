import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAPIT_BASE = "https://mapit.mysociety.org";

interface MapItArea {
  name: string;
  type: string;
  country_name?: string;
}

interface MapItPostcodeResult {
  shortcuts?: { WMC?: number };
  areas?: Record<string, MapItArea>;
}

async function findOrCreateConstituency(name: string) {
  let constituency = await prisma.constituency.findUnique({ where: { name } });
  if (!constituency) {
    constituency = await prisma.constituency.create({ data: { name } });
  }
  return constituency;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const postcode = searchParams.get("postcode");

  try {
    if (lat && lng) {
      const url = `${MAPIT_BASE}/point/4326/${lng},${lat}?type=WMC`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) {
        return NextResponse.json(
          { error: "MapIt API error" },
          { status: res.status }
        );
      }
      const data = (await res.json()) as Record<string, MapItArea>;
      const areas = Object.values(data);
      if (areas.length === 0) {
        return NextResponse.json({ constituency: null, message: "No constituency found for these coordinates" });
      }
      const area = areas[0];
      const constituency = await findOrCreateConstituency(area.name);
      return NextResponse.json({ constituency });
    }

    if (postcode) {
      const cleanPostcode = postcode.replace(/\s+/g, "").toUpperCase();
      const url = `${MAPIT_BASE}/postcode/${cleanPostcode}`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) {
        if (res.status === 404) {
          return NextResponse.json({ error: "Postcode not found" }, { status: 404 });
        }
        return NextResponse.json(
          { error: "MapIt API error" },
          { status: res.status }
        );
      }
      const data = (await res.json()) as MapItPostcodeResult;
      const wmcId = data.shortcuts?.WMC;
      if (!wmcId || !data.areas) {
        return NextResponse.json({ constituency: null, message: "No constituency found for this postcode" });
      }
      const wmcArea = data.areas[wmcId.toString()];
      if (!wmcArea) {
        return NextResponse.json({ constituency: null, message: "No constituency found for this postcode" });
      }
      const constituency = await findOrCreateConstituency(wmcArea.name);
      return NextResponse.json({ constituency });
    }

    return NextResponse.json(
      { error: "Either lat/lng or postcode is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("MapIt error:", error);
    return NextResponse.json(
      { error: "Failed to lookup constituency" },
      { status: 500 }
    );
  }
}
