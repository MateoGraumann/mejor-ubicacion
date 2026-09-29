type Factor = {
  pillar: string;
  key: string;
  value: number;
  contribution: number;
  note: string;
};

const PILLAR_LABEL: Record<string, string> = {
  demand: "Demanda",
  competition: "Competencia",
  accessibility: "Accesibilidad",
};

export function FactorList({
  factors,
  warnings,
}: {
  factors: Factor[];
  warnings: string[];
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white/90 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900">Factores</h2>
      <ul className="mt-4 space-y-3">
        {factors.map((f) => (
          <li
            key={`${f.pillar}-${f.key}`}
            className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              {PILLAR_LABEL[f.pillar] ?? f.pillar}
            </p>
            <p className="text-stone-800">{f.note}</p>
          </li>
        ))}
      </ul>
      {warnings.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Avisos</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
