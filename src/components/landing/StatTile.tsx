export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="group rounded-xl border border-ink-100 bg-white p-6 text-center shadow-premium transition-all duration-300 hover:-translate-y-1 hover:border-gold-400/50 hover:shadow-premium-lg">
      <div className="text-3xl font-bold text-gold-600 transition-transform duration-300 group-hover:scale-105">{value}</div>
      <div className="mt-1 text-sm text-ink-500">{label}</div>
    </div>
  );
}
