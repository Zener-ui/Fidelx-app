import plugin from "tailwindcss/plugin";

/**
 * Theme architecture
 * ------------------
 * Every legacy colour token (teal, navy, slate, surface, ink) now reads from
 * a CSS variable. The DEFAULT values of those variables (see src/index.css)
 * are EXACTLY the old hex values, so any screen NOT inside a themed wrapper
 * renders pixel-identical to before (vendor, rider, admin today).
 *
 * The redesign ("pop" theme) activates only inside an element carrying
 * data-theme="pop" (AppShell sets it when given theme="pop"; AuthLayout sets
 * it for the auth screens). Inside it, the same variables resolve to the new
 * palette, and any class prefixed with `pop:` applies.
 *
 * NOTE on legacy names: `teal` is the brand ACCENT (orange), `navy` is the
 * page BACKGROUND (paper). The names are historical; use the new honest
 * names below (brand, paper, peach ...) in new code.
 */
const rgb = (v) => `rgb(var(${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ---- legacy tokens (names kept so no existing class breaks) ----
        teal: {
          DEFAULT: rgb("--c-accent"),
          dark: rgb("--c-accent-dark"),
          light: "rgb(var(--c-accent) / 0.094)",
        },
        blue: {
          accent: "#1F744F",
        },
        navy: {
          DEFAULT: rgb("--c-navy"),
          mid: rgb("--c-navy-mid"),
          light: rgb("--c-navy-light"),
          border: rgb("--c-navy-border"),
        },
        slate: {
          muted: rgb("--c-muted"),
          soft: rgb("--c-soft"),
        },
        surface: {
          DEFAULT: rgb("--c-surface"),
          raised: rgb("--c-surface"),
          border: rgb("--c-line"),
        },
        ink: {
          DEFAULT: rgb("--c-ink"),
        },

        // ---- new honest names (used by the "pop" redesign) ----
        brand: { DEFAULT: "#FF6B1A", deep: "#D94F00" },
        paper: "#FFF9F3",
        peach: "#FFE2CB",
        sun: "#FFC53D",
        coral: "#FF9D80",
        lime: { DEFAULT: "#9BDC73" },
        lilac: "#C5A1EC",
        mint: "#70D3C5",
        leaf: "#2E9E5B",
        bad: "#B83A00",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 2px 16px rgba(34,24,17,0.06)",
        glow: "0 0 24px rgba(223,80,12,0.12)",
        // hard, blur-free offset shadows (the "pop" signature)
        "pop-xs": "2px 2px 0 rgb(var(--c-ink))",
        "pop-sm": "3px 3px 0 rgb(var(--c-ink))",
        pop: "5px 5px 0 rgb(var(--c-ink))",
        "pop-lg": "7px 7px 0 rgb(var(--c-ink))",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
    },
  },
  plugins: [
    // `pop:` variant — applies only inside <... data-theme="pop">
    plugin(({ addVariant }) => {
      addVariant("pop", '[data-theme="pop"] &');
    }),
  ],
};
