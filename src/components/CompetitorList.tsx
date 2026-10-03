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
  const directCompetitors = competitors.filter(
    (competitor) => competitor.competitionType === "direct",
  );

  return (
    <section className="h-full rounded-2xl border border-stone-200 bg-white/90 p-4 shadow-sm">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Competencia directa
          </h2>
          <p className="text-xs text-stone-500">
            Cafeterías, cafés o panaderías en {radiusM} m
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
          {directCompetitors.length}{" "}
          {directCompetitors.length === 1 ? "local" : "locales"}
        </span>
      </div>

      {directCompetitors.length === 0 ? (
        <p className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
          No se encontraron competidores directos en este radio.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {directCompetitors.map((competitor) => (
            <li
              key={`${competitor.name}-${competitor.distanceM}`}
              className="min-w-0 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2"
            >
              <p className="truncate text-sm font-medium text-stone-900">
                {competitor.name}
              </p>
              <p className="truncate text-xs text-stone-500">
                {Math.round(competitor.distanceM)} m
                {competitor.rating != null
                  ? ` · ★ ${competitor.rating.toFixed(1)} (${competitor.reviewCount} reseñas)`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
