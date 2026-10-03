import { EvaluateClient } from "@/components/EvaluateClient";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl">
        <p className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Mejor Ubicación
        </p>
        <h1 className="mt-3 max-w-xl text-lg text-stone-700 sm:text-xl">
          Score de viabilidad para cafeterías en Concepción del Uruguay.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-stone-500">
          Ingresá una dirección y obtené un puntaje basado en demanda,
          competencia y accesibilidad.
        </p>
      </div>

      <div className="mt-5">
        <EvaluateClient />
      </div>
    </main>
  );
}
