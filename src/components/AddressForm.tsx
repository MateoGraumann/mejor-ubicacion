"use client";

type Props = {
  address: string;
  onAddressChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export function AddressForm({
  address,
  onAddressChange,
  onSubmit,
  loading,
}: Props) {
  return (
    <form
      className="flex w-full flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="sr-only" htmlFor="address">
        Dirección
      </label>
      <input
        id="address"
        type="text"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        placeholder="Ej: Av. San Martín 800, Concepción del Uruguay"
        className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 shadow-sm outline-none ring-amber-700/30 placeholder:text-stone-400 focus:ring-2"
        required
        minLength={3}
      />
      <button
        type="submit"
        disabled={loading || address.trim().length < 3}
        className="rounded-xl bg-amber-800 px-6 py-3 font-medium text-amber-50 transition hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Evaluando…" : "Evaluar ubicación"}
      </button>
    </form>
  );
}
