/**
 * The orange page header used by the redesigned screens: brand mark, big
 * title, optional subtitle, and optional extra content (e.g. a progress bar).
 * Presentation only.
 */
export default function PopHeader({ title, subtitle, children }) {
  return (
    <header className="relative overflow-hidden rounded-b-[34px] border-b-[2.5px] border-ink bg-brand px-5 pb-7 pt-[max(18px,env(safe-area-inset-top))] md:pt-8">
      <span aria-hidden="true" className="pointer-events-none absolute -right-[90px] -top-[110px] h-[260px] w-[260px] rounded-full bg-[#FF8340]" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-[90px] -left-[70px] h-[170px] w-[170px] rounded-full bg-[#FF7A2E]" />

      <div className="relative flex items-center gap-2.5 font-display text-[1.6rem] font-extrabold tracking-[-0.04em] text-ink">
        <span aria-hidden="true" className="relative h-[34px] w-[34px] rounded-[11px] border-[2.5px] border-ink bg-paper shadow-pop-xs">
          <span className="absolute left-[9px] top-[9px] h-2.5 w-2.5 rounded-full bg-brand" />
        </span>
        fidelx
      </div>

      <h1 className="relative mt-5 font-display text-[2.2rem] font-extrabold leading-[0.95] tracking-[-0.045em] text-ink">{title}</h1>
      {subtitle && <p className="relative mt-2 font-semibold text-ink">{subtitle}</p>}
      {children && <div className="relative mt-4">{children}</div>}
    </header>
  );
}
