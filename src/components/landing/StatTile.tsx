export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-sky-500/40 hover:bg-slate-900/80 hover:shadow-[0_0_30px_-12px_rgba(56,189,248,0.5)]">
      <div className="text-3xl font-bold text-sky-400 transition-transform duration-300 group-hover:scale-105">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
    </div>
  );
}
