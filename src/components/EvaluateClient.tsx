"use client";

import { useState } from "react";
import { AddressForm } from "@/components/AddressForm";
import { ScoreCard } from "@/components/ScoreCard";
import { CompetitorList } from "@/components/CompetitorList";
import { ZoneKpis } from "@/components/ZoneKpis";

type EvaluateResult = {
  evaluationId: string;
  address: string;
  formattedAddress: string | null;
  lat: number;
  lng: number;
  scoreTotal: number;
  pillars: {
    demand: number | null;
    competition: number | null;
    accessibility: number | null;
  };
  factors: Array<{
    pillar: string;
    key: string;
    value: number;
    contribution: number;
    note: string;
  }>;
  competitors: Array<{
    name: string;
    competitionType: "direct" | "indirect";
    distanceM: number;
    rating: number | null;
    reviewCount: number;
  }>;
  competitionRadiusM: number;
  warnings: string[];
  scoringConfigVersion: number;
};

export function EvaluateClient() {
  const [address, setAddress] = useState(
    "Av. San Martín 800, Concepción del Uruguay",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluateResult | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, category: "cafeteria" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo evaluar");
      }
      setResult(data as EvaluateResult);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-x-3 lg:gap-y-[6px]">
        <AddressForm
          address={address}
          onAddressChange={setAddress}
          onSubmit={onSubmit}
          loading={loading}
        />

        {result ? (
          <ZoneKpis factors={result.factors} />
        ) : (
          <div className="hidden lg:block" aria-hidden="true" />
        )}

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 lg:col-span-2">
            {error}
          </p>
        )}

        {result && (
          <>
            <ScoreCard
              scoreTotal={result.scoreTotal}
              pillars={result.pillars}
              version={result.scoringConfigVersion}
            />
            <CompetitorList
              competitors={result.competitors ?? []}
              radiusM={result.competitionRadiusM ?? 500}
            />
            <div className="flex min-w-0 flex-col gap-1 px-1 text-xs text-stone-500 lg:col-span-2 lg:flex-row lg:items-center lg:justify-between">
              <p className="break-words lg:max-w-[52%]">
                {result.formattedAddress ?? result.address}
                <span className="text-stone-400">
                  {" "}
                  · {result.lat.toFixed(5)}, {result.lng.toFixed(5)}
                </span>
              </p>
              {result.warnings.length > 0 && (
                <p className="break-words text-amber-700 lg:max-w-[45%] lg:text-right">
                  {result.warnings.join(" · ")}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
