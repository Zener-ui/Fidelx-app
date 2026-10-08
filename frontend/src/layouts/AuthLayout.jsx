import { Outlet } from "react-router-dom";

/**
 * Shared front door for every role (login, register, forgot/reset password).
 * Always renders in the redesigned ("pop") look — the user's role isn't
 * known until after they sign in, so this layout can't be role-scoped.
 *
 * Layout note: pages that show <AuthTabs /> pull it up by 52px
 * (-mt-[52px]) so it straddles the bottom edge of this orange header.
 * That number is header padding-bottom (56px) minus half the tab height,
 * plus <main>'s top padding (24px). If either padding changes, update
 * AuthTabs' negative margin to match.
 */
export default function AuthLayout() {
  return (
    <div data-theme="pop" className="min-h-screen bg-navy sm:flex sm:items-center sm:justify-center sm:px-4 sm:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-navy sm:min-h-0 sm:overflow-hidden sm:rounded-[34px] sm:border-[3px] sm:border-ink sm:shadow-pop-lg">
        <header className="relative overflow-hidden rounded-b-[34px] border-b-[2.5px] border-ink bg-brand px-5 pb-14 pt-[max(18px,env(safe-area-inset-top))] sm:pt-7">
          <span aria-hidden="true" className="pointer-events-none absolute -right-[90px] -top-[110px] h-[260px] w-[260px] rounded-full bg-[#FF8340]" />
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-[90px] -left-[70px] h-[170px] w-[170px] rounded-full bg-[#FF7A2E]" />

          <div className="relative flex items-center gap-2.5 font-display text-[1.6rem] font-extrabold tracking-[-0.04em] text-ink">
            <span aria-hidden="true" className="relative h-[34px] w-[34px] rounded-[11px] border-[2.5px] border-ink bg-paper shadow-pop-xs">
              <span className="absolute left-[9px] top-[9px] h-2.5 w-2.5 rounded-full bg-brand" />
            </span>
            fidelx
          </div>

          <h1 className="relative mt-5 font-display text-[2.2rem] font-extrabold leading-[0.95] tracking-[-0.045em] text-ink">
            <span className="block">Shop local.</span>
            <span className="block">Delivered fast.</span>
          </h1>
        </header>

        <main className="flex-1 px-5 pb-6 pt-6">
          <Outlet />
        </main>

        <p className="px-5 pb-6 text-center text-xs font-semibold text-slate-muted">
          © {new Date().getFullYear()} Fidelx. All rights reserved.
        </p>
      </div>
    </div>
  );
}
