import { Check } from "lucide-react";
import { clsx } from "clsx";

const DELIVERY_STEPS = [
  { key: "PAYMENT_CONFIRMED", label: "Confirmed" },
  { key: "PREPARING", label: "Preparing" },
  { key: "WAITING_RIDER", label: "Finding Rider" },
  { key: "RIDER_ASSIGNED", label: "Rider Assigned" },
  { key: "PICKED_UP", label: "Picked Up" },
  { key: "DELIVERING", label: "On the Way" },
  { key: "DELIVERED", label: "Delivered" },
];

const PICKUP_STEPS = [
  { key: "PAYMENT_CONFIRMED", label: "Confirmed" },
  { key: "PREPARING", label: "Preparing" },
  { key: "READY_FOR_PICKUP", label: "Ready" },
  { key: "DELIVERED", label: "Collected" },
];

const TERMINAL_EXCEPTIONS = ["CANCELLED", "REFUNDED", "DISPUTED"];

/**
 * Horizontal step-progress tracker for a single sub-order.
 * Falls back to a plain status pill for terminal/exception states
 * (cancelled, refunded, disputed) where a "progress" framing doesn't fit.
 *
 * The step labels sit under each dot from the `sm` breakpoint up; on phones
 * there isn't room for seven labels, so the CURRENT step is always spelled
 * out underneath ("Finding Rider · Step 3 of 7"). Same data, nothing new.
 */
export default function OrderProgress({ status, deliveryType, statusDisplay }) {
  if (TERMINAL_EXCEPTIONS.includes(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-bold text-ink">
        <span className={`h-2 w-2 rounded-full bg-current ${statusDisplay.color}`} />
        {statusDisplay.label}
      </span>
    );
  }

  const steps = deliveryType === "pickup" ? PICKUP_STEPS : DELIVERY_STEPS;
  const currentIndex = steps.findIndex((s) => s.key === status);
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div className="w-full">
      <div className="flex w-full items-center py-1">
        {steps.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          const isLast = i === steps.length - 1;
          const complete = active && isLast; // final step reached (Delivered / Collected)
          return (
            <div key={step.key} className={clsx("flex items-center", !isLast && "flex-1")}>
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                <div className={clsx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink transition-colors",
                  complete ? "bg-leaf text-white" : done ? "bg-ink text-white" : active ? "bg-brand shadow-pop-xs" : "bg-white"
                )}>
                  {done || complete
                    ? <Check className="h-3.5 w-3.5" strokeWidth={3.2} />
                    : <span className={clsx("h-1.5 w-1.5 rounded-full", active ? "bg-ink animate-pulse" : "bg-slate-soft")} />}
                </div>
                <span className={clsx(
                  "hidden w-14 text-center text-[9px] leading-tight sm:block",
                  active ? "font-extrabold text-ink" : done ? "font-bold text-ink" : "font-semibold text-slate-muted"
                )}>
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div className={clsx("mx-1 h-[3px] flex-1 rounded-full", done ? "bg-ink" : "bg-peach")} />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-sm font-extrabold">
        {steps[activeIndex].label}
        <span className="font-bold text-slate-muted"> · Step {activeIndex + 1} of {steps.length}</span>
      </p>
    </div>
  );
}
