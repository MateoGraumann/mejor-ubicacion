import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateAddress } from "@/lib/scoring/evaluate";

const bodySchema = z.object({
  address: z.string().min(3).max(240),
  category: z.string().default("cafeteria"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = bodySchema.parse(json);
    const result = await evaluateAddress(body.address, body.category);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al evaluar ubicación";
    const status = message.includes("fuera de") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
