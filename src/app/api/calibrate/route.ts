import { NextResponse } from "next/server";
import { calibrateCategory } from "@/lib/scoring/calibrate";

export async function POST(request: Request) {
  const secret = process.env.CALIBRATE_SECRET ?? "";
  const header = request.headers.get("x-calibrate-secret") ?? "";

  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await calibrateCategory("cafeteria");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Calibration failed",
      },
      { status: 500 },
    );
  }
}
