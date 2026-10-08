import { clsx } from "clsx";

const variants = {
  primary:   "bg-teal text-navy font-semibold hover:bg-teal-dark active:scale-95",
  secondary: "bg-surface-raised text-ink border border-surface-border hover:bg-navy-light active:scale-95",
  danger:    "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95",
  ghost:     "text-slate-soft hover:text-ink hover:bg-surface-raised active:scale-95",
  outline:   "border border-teal text-teal hover:bg-teal/10 active:scale-95",
};

// "pop" theme additions — only apply inside <... data-theme="pop">.
// Outline + hard offset shadow; pressing shifts the button into its shadow.
const POP_PRESS =
  "pop:border-[2.5px] pop:border-ink pop:shadow-pop-sm pop:active:translate-x-[3px] pop:active:translate-y-[3px] pop:active:scale-100 pop:active:shadow-[1px_1px_0_rgb(var(--c-ink))] pop:disabled:shadow-none pop:disabled:translate-x-0 pop:disabled:translate-y-0";

const popVariants = {
  primary:   `pop:bg-brand pop:text-ink ${POP_PRESS}`,
  secondary: `pop:bg-white pop:text-ink ${POP_PRESS}`,
  danger:    `pop:bg-white pop:text-bad ${POP_PRESS}`,
  outline:   `pop:bg-white pop:text-ink ${POP_PRESS}`,
  ghost:     "pop:text-ink",
};

const popSizes = {
  sm: "pop:min-h-[44px] pop:px-4",
  md: "pop:min-h-[48px] pop:px-6",
  lg: "pop:min-h-[54px] pop:px-7",
  xl: "pop:min-h-[58px] pop:text-[1.05rem]",
};

const sizes = {
  sm:  "px-3 py-1.5 text-sm rounded-xl",
  md:  "px-5 py-2.5 text-sm rounded-xl",
  lg:  "px-6 py-3.5 text-base rounded-2xl",
  xl:  "px-8 py-4 text-base rounded-2xl w-full",
};

export default function Button({
  children, variant = "primary", size = "md",
  loading = false, disabled = false,
  className = "", icon, ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 transition-all duration-150 font-medium",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        "pop:rounded-full pop:font-bold",
        variants[variant], sizes[size],
        popVariants[variant], popSizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
