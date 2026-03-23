import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      textContent,
      voiceMemoPath,
      photoPath,
      deviceFingerprint,
      locationStatus,
      latitude,
      longitude,
      postcode,
      isAwayFromArea,
      constituencyId,
      anonymised,
    } = body;

    if (!locationStatus) {
      return NextResponse.json(
        { error: "Location status is required" },
        { status: 400 }
      );
    }

    if (!textContent && !voiceMemoPath && !photoPath) {
      return NextResponse.json(
        { error: "At least one form of content is required" },
        { status: 400 }
      );
    }

    const session = await getSession();
    const userId = session.isLoggedIn ? session.userId : undefined;

    const submission = await prisma.submission.create({
      data: {
        textContent: textContent || null,
        voiceMemoPath: voiceMemoPath || null,
        photoPath: photoPath || null,
        deviceFingerprint: deviceFingerprint || null,
        locationStatus,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        postcode: postcode || null,
        isAwayFromArea: isAwayFromArea || false,
        constituencyId: constituencyId || null,
        anonymised: anonymised || false,
        userId: userId || null,
      },
    });

    return NextResponse.json({ success: true, submissionId: submission.id });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: "Failed to save submission" },
      { status: 500 }
    );
  }
}
