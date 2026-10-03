type Competitor = {
  name: string;
  competitionType: "direct" | "indirect";
  distanceM: number;
  rating: number | null;
  reviewCount: number;
};

export function CompetitorList({
  competitors,
  radiusM,
}: {
  competitors: Competitor[];
  radiusM: number;
}) {
  const direct = competitors.filter((c) => c.competitionType === "direct");
  const indirect = competitors.filter((c) => c.competitionType === "indirect");

  return (
    <section className="rounded-2xl border border-stone-200 bg-white/90 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900">
        Competidores en {radiusM} m
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        {competitors.length} locales encontrados (datos SerpAPI / Google Maps)
      </p>

      {competitors.length === 0 ? (
        <p className="mt-4 text-sm text-stone-600">
          No se encontraron competidores en este radio.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          <CompetitorGroup title="Directos (cafetería / café / panadería)" items={direct} />
          <CompetitorGroup title="Indirectos (resto / bar)" items={indirect} />
        </div>
      )}
    </section>
  );
}

function CompetitorGroup({
  title,
  items,
}: {
  title: string;
  items: Competitor[];
}) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
          {title}
        </p>
        <p className="mt-1 text-sm text-stone-500">Ninguno</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {title} · {items.length}
      </p>
      <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-100 bg-stone-50">
        {items.map((c) => (
          <li
            key={`${c.name}-${c.distanceM}`}
            className="flex items-start justify-between gap-3 px-4 py-3"
          >
            <div>
              <p className="font-medium text-stone-900">{c.name}</p>
              <p className="text-sm text-stone-500">
                {Math.round(c.distanceM)} m
                {c.rating != null
                  ? ` · ★ ${c.rating.toFixed(1)} (${c.reviewCount} reseñas)`
                  : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
