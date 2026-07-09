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
      <p className="text-sm font-semibold uppercase tracking-widest text-gold-600">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold text-ink-900 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-ink-500">{subtitle}</p>}
    </div>
  );
}
