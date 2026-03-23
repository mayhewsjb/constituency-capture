import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { syncMPData } from "@/lib/syncMPData";

export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncMPData();

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json(result);
}
