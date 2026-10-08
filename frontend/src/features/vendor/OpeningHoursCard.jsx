import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import toast from "react-hot-toast";
import { updateVendorHours } from "@/api/vendors";
import Button from "@/components/common/Button";

/**
 * Vendor opening hours. Opt-in: with the switch off nothing about the store changes.
 * While on, customers cannot order outside these hours (the server enforces it).
 * Times are Nigerian time (WAT). A closing time earlier than the opening time runs past midnight.
 */
const DAYS = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];
const DEFAULT_WEEK = {
  mon: { open: "08:00", close: "20:00" }, tue: { open: "08:00", close: "20:00" }, wed: { open: "08:00", close: "20:00" },
  thu: { open: "08:00", close: "20:00" }, fri: { open: "08:00", close: "20:00" }, sat: { open: "09:00", close: "18:00" },
  sun: null,
};
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const isFullWeek = (h) => !!h && typeof h === "object" && DAYS.every(([k]) => k in h);

export default function OpeningHoursCard({ vendor }) {
  const qc = useQueryClient();
  const [on, setOn] = useState(!!vendor.use_opening_hours);
  const [week, setWeek] = useState(() => (isFullWeek(vendor.opening_hours) ? vendor.opening_hours : DEFAULT_WEEK));
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: updateVendorHours,
    onSuccess: () => {
      toast.success(on ? "Opening hours saved" : "Opening hours turned off");
      return qc.invalidateQueries({ queryKey: ["vendor-profile"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const setDay = (key, patch) => { setError(""); setWeek((w) => ({ ...w, [key]: patch })); };
  const toggleDay = (key) => setDay(key, week[key] ? null : { open: "08:00", close: "20:00" });
  const copyMonday = () => { setError(""); setWeek((w) => Object.fromEntries(DAYS.map(([k]) => [k, w.mon ? { ...w.mon } : null]))); };

  const validate = () => {
    for (const [key, label] of DAYS) {
      const d = week[key];
      if (!d) continue;
      if (!TIME_RE.test(d.open || "") || !TIME_RE.test(d.close || "")) return `Set an opening and closing time for ${label}.`;
      if (d.open === d.close) return `${label}: opening and closing time can't be the same.`;
    }
    if (on && DAYS.every(([k]) => !week[k])) return "Turn on at least one day, or switch opening hours off.";
    return "";
  };

  const save = () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setError("");
    mutation.mutate({ use_opening_hours: on, opening_hours: week });
  };

  const eff = vendor.effective_availability;
  const timeInput = "w-[6.2rem] rounded-xl border-2 border-ink bg-white px-2 py-1.5 text-sm font-semibold text-ink shadow-pop-xs outline-none focus:shadow-pop-sm disabled:opacity-40";

  return (
    <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full border-2 border-ink bg-peach">
            <Clock className="h-4 w-4 text-ink" strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold leading-tight tracking-tight">Opening hours</p>
            <p className="text-xs font-semibold text-slate-muted">Customers can't order outside these hours.</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Use opening hours"
          onClick={() => { setOn((v) => !v); setError(""); }}
          className={`relative h-7 w-12 flex-none rounded-full border-[2.5px] border-ink transition-colors ${on ? "bg-leaf" : "bg-white"}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full border-2 border-ink bg-white transition-all ${on ? "left-[1.35rem]" : "left-0.5"}`} />
        </button>
      </div>

      {eff?.reason === "hours" && (
        <p className="mt-3 rounded-2xl border-2 border-ink bg-coral px-3 py-2 text-xs font-extrabold">
          Your store is closed right now because of your opening hours.{eff.next_open_label ? ` ${eff.next_open_label}.` : ""}
        </p>
      )}

      <div className={`mt-4 space-y-2.5 ${on ? "" : "opacity-60"}`}>
        {DAYS.map(([key, label]) => {
          const d = week[key];
          return (
            <div key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <label className="flex w-28 cursor-pointer items-center gap-2 text-sm font-extrabold">
                <input type="checkbox" checked={!!d} onChange={() => toggleDay(key)} className="h-4 w-4 accent-[#FF6B1A]" />
                {label}
              </label>
              {d ? (
                <div className="flex items-center gap-2">
                  <input type="time" aria-label={`${label} opens`} value={d.open} onChange={(e) => setDay(key, { ...d, open: e.target.value })} className={timeInput} />
                  <span className="text-xs font-bold text-slate-muted">to</span>
                  <input type="time" aria-label={`${label} closes`} value={d.close} onChange={(e) => setDay(key, { ...d, close: e.target.value })} className={timeInput} />
                </div>
              ) : (
                <span className="text-sm font-semibold text-slate-muted">Closed</span>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={copyMonday} className="mt-3 text-xs font-extrabold underline decoration-2 underline-offset-4">
        Copy Monday's hours to every day
      </button>
      <p className="mt-2 text-xs font-medium leading-relaxed text-slate-muted">
        Times are in Nigerian time. A closing time earlier than the opening time means you stay open past midnight.
        Your Closed / Temporarily unavailable switch still works on top of these hours.
      </p>

      {error && <p className="mt-3 text-sm font-semibold text-red-400">{error}</p>}
      <Button className="mt-4" size="lg" loading={mutation.isPending} onClick={save}>Save opening hours</Button>
    </div>
  );
}
