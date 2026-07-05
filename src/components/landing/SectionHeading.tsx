export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold text-slate-50 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-slate-400">{subtitle}</p>}
    </div>
  );
}
