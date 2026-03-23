import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null; // "voice" or "photo"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let ext = ".bin";
    if (type === "voice") {
      ext = ".webm";
    } else if (type === "photo") {
      const originalName = file.name || "";
      const originalExt = path.extname(originalName).toLowerCase();
      ext = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(originalExt)
        ? originalExt
        : ".jpg";
    }

    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const publicPath = `/uploads/${filename}`;
    return NextResponse.json({ success: true, path: publicPath });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
