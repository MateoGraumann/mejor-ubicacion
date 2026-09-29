type Pillars = {
  demand: number | null;
  competition: number | null;
  accessibility: number | null;
};

type Props = {
  scoreTotal: number;
  pillars: Pillars;
  version: number;
};

function Bar({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-stone-600">
        <span>{label}</span>
        <span className="font-medium text-stone-800">
          {value == null ? "N/D" : `${value.toFixed(1)}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export function ScoreCard({ scoreTotal, pillars, version }: Props) {
  const tone =
    scoreTotal >= 70
      ? "text-emerald-800"
      : scoreTotal >= 45
        ? "text-amber-800"
        : "text-rose-800";

  return (
    <section className="rounded-2xl border border-stone-200 bg-white/90 p-6 shadow-sm backdrop-blur">
      <p className="text-sm uppercase tracking-[0.2em] text-stone-500">
        Score de viabilidad
      </p>
      <p className={`mt-2 text-6xl font-semibold tabular-nums ${tone}`}>
        {scoreTotal.toFixed(1)}
        <span className="text-2xl text-stone-400">/100</span>
      </p>
      <p className="mt-1 text-xs text-stone-400">
        Configuración de scoring v{version}
      </p>
      <div className="mt-6 space-y-4">
        <Bar label="Demanda" value={pillars.demand} color="bg-sky-600" />
        <Bar
          label="Competencia"
          value={pillars.competition}
          color="bg-violet-600"
        />
        <Bar
          label="Accesibilidad"
          value={pillars.accessibility}
          color="bg-teal-600"
        />
      </div>
    </section>
  );
}
