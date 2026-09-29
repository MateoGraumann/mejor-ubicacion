import { prisma } from "@/lib/db";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getPlacesBudgetRemaining(): Promise<{
  used: number;
  budget: number;
  remaining: number;
}> {
  const budget = Number(process.env.PLACES_DAILY_BUDGET ?? 100);
  const row = await prisma.apiUsageDaily.findUnique({
    where: { dateKey: todayKey() },
  });
  const used = row?.placesCalls ?? 0;
  return { used, budget, remaining: Math.max(0, budget - used) };
}

export async function canCallPlaces(cost = 1): Promise<boolean> {
  const { remaining } = await getPlacesBudgetRemaining();
  return remaining >= cost;
}

export async function recordPlacesCalls(count = 1): Promise<void> {
  const dateKey = todayKey();
  await prisma.apiUsageDaily.upsert({
    where: { dateKey },
    create: { dateKey, placesCalls: count, geocodeCalls: 0 },
    update: { placesCalls: { increment: count } },
  });
}

export async function recordGeocodeCalls(count = 1): Promise<void> {
  const dateKey = todayKey();
  await prisma.apiUsageDaily.upsert({
    where: { dateKey },
    create: { dateKey, placesCalls: 0, geocodeCalls: count },
    update: { geocodeCalls: { increment: count } },
  });
}

export function useMockProviders(): boolean {
  if (process.env.USE_MOCK_PROVIDERS === "true") return true;
  return !process.env.GOOGLE_MAPS_API_KEY;
}
