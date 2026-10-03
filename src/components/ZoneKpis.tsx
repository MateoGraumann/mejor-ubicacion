type Factor = {
  key: string;
  value: number;
  note: string;
};

type Props = {
  factors: Factor[];
};

const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

export function ZoneKpis({ factors }: Props) {
  const density = factors.find((factor) => factor.key === "density");
  const targetAge = factors.find((factor) => factor.key === "age_20_45");
  const zoneName = density?.note.match(/^Zona (.+?):/)?.[1];

  return (
    <div className="grid grid-cols-2 gap-2 lg:h-[38px]">
      <Kpi
        label="Demanda"
        value={density ? numberFormatter.format(density.value) : "N/D"}
        detail={
          density
            ? `hab/km²${zoneName ? ` · ${zoneName}` : ""}`
            : "Sin datos censales"
        }
      />
      <Kpi
        label="Rango etario"
        value={
          targetAge ? `${Math.round(targetAge.value * 100)}%` : "N/D"
        }
        detail={targetAge ? "entre 20–45 años" : "Sin datos censales"}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 shadow-sm lg:h-[38px]">
      <strong className="shrink-0 text-lg leading-none text-stone-900">
        {value}
      </strong>
      <div className="min-w-0 leading-none">
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-stone-600">
          {label}
        </p>
        <p className="mt-1 truncate text-[10px] text-stone-400">{detail}</p>
      </div>
    </div>
  );
}
