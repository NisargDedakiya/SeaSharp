# SeaSharp UI/UX Design System

> Status: the visual language below (brand, color, motion) is already live in
> the Phase 1 codebase — see [docs/README.md](./README.md). The component
> library section describes the v2.0 target of formalizing it on shadcn/ui.

## Brand

- **Logo**: navy/blue gradient ship forming an "S", with a compass arc and
  wave motif — `public/logo-mark.png` (icon only) and `public/logo-full.png`
  (mark + wordmark + tagline). Favicon and app icons are generated from the
  mark (`src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico`).
- **Wordmark**: "Sea" in solid `slate-50`, "Sharp" in a `sky-400 → sky-300`
  gradient — see `src/components/Navbar.tsx`.
- **Tagline**: "One Platform. Every Trade. Anywhere in the World."

## Color

Built on Tailwind's stock palettes — no custom color tokens in
`tailwind.config.ts`. The logo's blue (~`#0098DC`) sits almost exactly on
`sky-500`/`sky-600`, so `sky` was adopted as the single brand accent
(replacing an earlier `emerald` accent).

| Token | Usage |
|---|---|
| `sky-400` / `sky-500` | Primary accent — links, primary buttons, active states, brand highlights |
| `slate-950` / `slate-900` | Page background (dark theme only — SeaSharp does not ship a light theme) |
| `slate-800` | Borders, dividers, resting card backgrounds |
| `slate-400` / `slate-500` | Secondary/muted text |
| `slate-50` / `slate-100` | Primary text on dark backgrounds |
| `emerald-400` | Reserved exclusively for the "Trusted Partner" STS tier and other rare, genuinely-positive semantic signals — never used as a second brand accent, to keep its meaning distinct from `sky` |
| `amber-400` | STS "Reliable" tier, general caution/pending states |

Gradients: primary CTAs use `bg-gradient-to-r from-sky-500 to-sky-400` with a
soft glow shadow (`shadow-[0_0_20px_-6px_rgba(56,189,248,0.6)]`) rather than a
flat fill — this is the signature "premium fintech" button treatment used
throughout.

## Typography

System font stack via Tailwind defaults (no custom webfont loaded yet — a
v2.0 candidate is a single variable font for headings, TBD). Scale:

| Role | Class |
|---|---|
| Hero H1 | `text-4xl sm:text-6xl font-bold tracking-tight` |
| Section H2 | `text-3xl sm:text-4xl font-bold` |
| Card title | `text-lg font-semibold` |
| Body | `text-sm` / `text-base`, `text-slate-400` for secondary |
| Eyebrow label | `text-sm font-semibold uppercase tracking-widest text-sky-400` |

## Motion

`framer-motion` powers all animation. Two reusable primitives
(`src/components/Reveal.tsx`) cover nearly every case:

- **`Reveal`** — fades + slides a section up into view once, on scroll
  (`whileInView`, `viewport={{ once: true }}`). Use for section headings and
  standalone content blocks.
- **`RevealStagger` / `RevealStaggerItem`** — same effect, staggered per
  child. Use for any grid of cards (stat tiles, pillar cards, RFQ cards) so
  items cascade in rather than popping simultaneously.

Hover interaction pattern for cards (stat tiles, pillar cards, marketplace
listings): `hover:-translate-y-1` lift + `hover:border-sky-500/40` +
a soft sky glow shadow + `transition-all duration-300`. Applied consistently
via a shared class recipe rather than one-off per component.

Decorative background: `.animate-aurora` (a slow-drifting blurred gradient
blob, `globals.css`) behind hero/CTA sections for depth without distracting
from foreground content. The logo mark itself gets a subtle `.animate-bob`
idle animation in the hero.

Motion budget: nothing loops faster than ~6s, nothing blocks interactivity,
and every scroll animation runs once (`once: true`) — SeaSharp's motion is
atmospheric, never a UX obstacle.

## Components today (Phase 1)

Hand-built, Tailwind-only components in `src/components/`: `Navbar`,
`Reveal`/`RevealStagger`, `TrustStrip`, `StsBadge`, landing page's
`HeroIntro`, `HowItWorks`, `Faq`, `PillarCard`, `SectionHeading`, `StatTile`,
plus feature components (`KycPanel`, `LoanPanel`, `CountdownTimer`,
marketplace's `MarketplaceBrowser`, `BidPanel`, `BidList`, `EscrowTracker`).

## Component library (v2.0 target)

Migrate to **shadcn/ui** as the primitive layer (`src/components/ui/`),
themed to the tokens above via its CSS-variable theming — not to replace the
hand-built components above, but to stop hand-rolling primitives (dialogs,
dropdowns, toasts, form controls) that shadcn already solves accessibly.
Existing hand-built components (`StsBadge`, `PillarCard`, `Reveal`, etc.) stay
as-is; they compose shadcn primitives rather than being replaced by them.

Rule: reach for a shadcn primitive first for anything with complex a11y
requirements (modals, comboboxes, menus); keep bespoke components for
SeaSharp-specific visual identity (badges, hero sections, trust signals).

## Layout conventions

- Marketing/landing content: `mx-auto max-w-5xl` to `max-w-6xl` per section,
  generous `py-24` vertical rhythm between sections, alternating
  `bg-slate-950` / `bg-slate-900/20` backgrounds to separate sections without
  hard borders everywhere.
- App/dashboard content: `mx-auto max-w-4xl` for focused single-entity views
  (RFQ detail, dashboard), card-based layout (`rounded-xl border
  border-slate-800 bg-slate-900/40`) as the base unit for any discrete piece
  of information.
- Forms: single-column, label-above-input, `rounded-md border
  border-slate-700 bg-slate-950` inputs with `focus:border-sky-500/60`.

## Accessibility

- Color contrast: body text (`slate-400` on `slate-950`) and interactive text
  (`sky-400` on `slate-950`) both meet WCAG AA for normal text size.
- All decorative motion/background elements (`aurora` blobs, bob animation)
  are marked `aria-hidden`.
- Every icon-only or icon+badge element (verified checkmarks, STS badges)
  carries accompanying text, never an icon alone as the only signal.
- Focus states: interactive elements must have a visible focus ring
  (shadcn primitives provide this by default in v2.0; hand-built components
  use Tailwind's `focus:` variants explicitly).
- `prefers-reduced-motion`: v2.0 adds a check that disables `Reveal`/
  `RevealStagger`'s transform animation (falling back to an instant
  opacity-only appearance) — not yet implemented in Phase 1, tracked as a
  follow-up.
