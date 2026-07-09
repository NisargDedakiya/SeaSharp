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
    <div className="group rounded-2xl border border-ink-100 bg-white p-6 shadow-premium transition-all duration-300 hover:-translate-y-1 hover:border-gold-400/50 hover:shadow-premium-lg">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/15 font-bold text-gold-600 transition-transform duration-300 group-hover:scale-110">
          {letter}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            status === "Live"
              ? "bg-gold-500/15 text-gold-600"
              : "bg-cream-200 text-ink-400"
          }`}
        >
          {status === "Live" ? "Live in Phase 1" : "Roadmap"}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">{description}</p>
      <ul className="mt-4 space-y-2">
        {points.map((point) => (
          <li key={point} className="flex gap-2 text-sm text-ink-700">
            <span className="text-gold-600">→</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
