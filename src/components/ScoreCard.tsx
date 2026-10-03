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
  hint,
  value,
  color,
  highIsBad = false,
}: {
  label: string;
  hint?: string;
  value: number | null;
  color: string;
  /** If true, a high displayed value means more pressure / worse for opening. */
  highIsBad?: boolean;
}) {
  const display =
    value == null ? null : highIsBad ? Math.round((100 - value) * 10) / 10 : value;

  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-sm text-stone-600">
        <div>
          <span>{label}</span>
          {hint && (
            <p className="text-xs text-stone-400">{hint}</p>
          )}
        </div>
        <span className="shrink-0 font-medium text-stone-800">
          {display == null ? "N/D" : `${display.toFixed(1)}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${display ?? 0}%` }}
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
        <Bar
          label="Demanda"
          hint="Más alto = más potencial de clientes"
          value={pillars.demand}
          color="bg-sky-600"
        />
        <Bar
          label="Saturación de competencia"
          hint="Más alto = más locales compitiendo cerca"
          value={pillars.competition}
          color="bg-violet-600"
          highIsBad
        />
        <Bar
          label="Accesibilidad"
          hint="Más alto = mejor llegada y entorno"
          value={pillars.accessibility}
          color="bg-teal-600"
        />
      </div>
    </section>
  );
}
