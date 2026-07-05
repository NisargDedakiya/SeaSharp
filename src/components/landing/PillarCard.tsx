export function PillarCard({
  letter,
  title,
  description,
  points,
  status = "Live",
}: {
  letter: string;
  title: string;
  description: string;
  points: string[];
  status?: "Live" | "Roadmap";
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 font-bold text-emerald-400">
          {letter}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            status === "Live"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          {status === "Live" ? "Live in Phase 1" : "Roadmap"}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-slate-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
      <ul className="mt-4 space-y-2">
        {points.map((point) => (
          <li key={point} className="flex gap-2 text-sm text-slate-300">
            <span className="text-emerald-400">→</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
