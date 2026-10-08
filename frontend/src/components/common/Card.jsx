import { clsx } from "clsx";

export default function Card({ children, className = "", onClick, hover = false }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "bg-surface rounded-2xl border border-surface-border",
        "pop:border-[2.5px] pop:border-ink pop:rounded-[22px] pop:shadow-pop",
        (hover || onClick) && "pop:transition-all pop:duration-150 pop:active:translate-x-[2px] pop:active:translate-y-[2px] pop:active:shadow-pop-xs",
        hover && "cursor-pointer hover:border-navy-light transition-all duration-150 hover:shadow-card",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}
