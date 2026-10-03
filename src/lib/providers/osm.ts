import { prisma } from "@/lib/db";
import { gridCellKey, haversineMeters, type LatLng } from "@/lib/geo";
import type { AccessibilitySnapshot } from "@/lib/scoring/types";

type OsmPayload = {
  roadClass: AccessibilitySnapshot["roadClass"];
  isCorner: boolean;
  complements: Array<{
    name: string;
    kind: string;
    lat: number;
    lng: number;
  }>;
};

async function fetchOverpass(
  center: LatLng,
  radiusM: number,
): Promise<OsmPayload> {
  const query = `
    [out:json][timeout:25];
    (
      way(around:${radiusM},${center.lat},${center.lng})[highway~"^(primary|secondary|tertiary|residential)$"];
      node(around:${radiusM},${center.lat},${center.lng})[amenity~"^(school|university|bank|hospital|library)$"];
      node(around:${radiusM},${center.lat},${center.lng})[leisure=park];
      node(around:${radiusM},${center.lat},${center.lng})[office];
      node(around:${radiusM},${center.lat},${center.lng})[highway=bus_stop];
    );
    out body center 40;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

  const data = (await res.json()) as {
    elements: Array<{
      type: string;
      tags?: Record<string, string>;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
    }>;
  };

  let roadClass: AccessibilitySnapshot["roadClass"] = "unknown";
  const highwayRank: Record<string, number> = {
    primary: 3,
    secondary: 2,
    tertiary: 1,
    residential: 0,
  };
  let best = -1;
  const complements: OsmPayload["complements"] = [];
  let wayCount = 0;

  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    if (tags.highway && highwayRank[tags.highway] !== undefined) {
      wayCount += 1;
      if (highwayRank[tags.highway] > best) {
        best = highwayRank[tags.highway];
        roadClass = tags.highway as AccessibilitySnapshot["roadClass"];
      }
    }

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;

    const kind =
      tags.amenity ||
      tags.leisure ||
      (tags.office
        ? "office"
        : tags.highway === "bus_stop"
          ? "bus_station"
          : null);
    if (!kind) continue;

    complements.push({
      name: tags.name || kind,
      kind,
      lat,
      lng,
    });
  }

  return {
    roadClass:
      roadClass === "unknown" && wayCount > 0 ? "residential" : roadClass,
    isCorner: wayCount >= 3,
    complements,
  };
}

export type OsmLookupResult = {
  snapshot: AccessibilitySnapshot | null;
  warnings: string[];
};

export async function getAccessibility(
  cityId: string,
  center: LatLng,
  radiusM: number,
): Promise<OsmLookupResult> {
  const warnings: string[] = [];
  const cell = gridCellKey(center);
  const now = new Date();
  const ttlDays = Number(process.env.OSM_CACHE_TTL_DAYS ?? 30);

  const cached = await prisma.osmCache.findUnique({
    where: { cityId_gridCell: { cityId, gridCell: cell } },
  });

  let payload: OsmPayload | null = null;

  if (cached && cached.expiresAt > now) {
    payload = cached.payload as OsmPayload;
  } else {
    try {
      payload = await fetchOverpass(center, radiusM);

      await prisma.osmCache.upsert({
        where: { cityId_gridCell: { cityId, gridCell: cell } },
        create: {
          cityId,
          gridCell: cell,
          payload,
          expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
        },
        update: {
          payload,
          fetchedAt: now,
          expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
        },
      });
    } catch (e) {
      warnings.push(
        `OSM no disponible: ${e instanceof Error ? e.message : "error"}`,
      );
      if (cached) {
        payload = cached.payload as OsmPayload;
        warnings.push("Usando cache OSM expirado.");
      }
    }
  }

  if (!payload) {
    return { snapshot: null, warnings };
  }

  const complements = payload.complements
    .map((c) => ({
      name: c.name,
      kind: c.kind,
      distanceM: haversineMeters(center, { lat: c.lat, lng: c.lng }),
    }))
    .filter((c) => c.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);

  return {
    snapshot: {
      roadClass: payload.roadClass,
      isCorner: payload.isCorner,
      complementsCount: complements.length,
      complements,
    },
    warnings,
  };
}
