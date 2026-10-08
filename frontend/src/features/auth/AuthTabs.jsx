import { Link } from "react-router-dom";

/**
 * Sign in / Create account switcher.
 * Both options are ordinary links to the EXISTING /login and /register
 * routes — no new routes or behaviour. `state` is forwarded to the link so
 * a "bounced here from a protected page" redirect (location.state.from)
 * survives the same way it did with the old text links:
 *   - LoginPage passes its location.state (as its old "Create one" link did)
 *   - RegisterPage passes nothing (its old "Sign in" link didn't either)
 *
 * The negative top margin pairs with AuthLayout's header/main padding —
 * see the note there before changing either.
 */
export default function AuthTabs({ active, state }) {
  const base = "grid min-h-[46px] place-items-center rounded-full text-base font-extrabold";
  const on = `${base} bg-ink text-white`;
  const off = `${base} text-ink`;

  return (
    <nav
      aria-label="Account"
      className="relative z-10 -mt-[52px] mb-7 grid grid-cols-2 gap-1.5 rounded-full border-[3px] border-ink bg-white p-1.5 shadow-pop"
    >
      {active === "login" ? (
        <span aria-current="page" className={on}>Sign in</span>
      ) : (
        <Link to="/login" className={off}>Sign in</Link>
      )}
      {active === "register" ? (
        <span aria-current="page" className={on}>Create account</span>
      ) : (
        <Link to="/register" state={state} className={off}>Create account</Link>
      )}
    </nav>
  );
}
