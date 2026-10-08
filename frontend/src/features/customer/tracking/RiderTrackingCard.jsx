import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSubOrderTracking } from "@/api/orders";
import { Skeleton } from "@/components/common/Loader";
import { describeTracking } from "./trackingMath";

/**
 * Live rider tracking card shown on Order detail while a delivery is in the rider phase.
 * A stylised street map (same visual language as the design reference): dashed route,
 * an ink-outlined trail that fills as the rider closes in, a store pin, a home pin and a
 * rider marker that glides along the route. Positions are REAL (polled every 10s);
 * nothing is simulated. If there is no live position it says so instead of guessing.
 *
 * Read-only: no mutations, no writes. The status tracker above it is unchanged.
 */
const ROUTE = "M44 170 L136 170 Q150 170 150 156 L150 108 Q150 94 164 94 L230 94 Q244 94 244 80 L244 54 Q244 40 258 40 L318 40";
const STORE_PT = { x: 44, y: 170 };
const HOME_PT = { x: 318, y: 40 };
const POLL_MS = 10_000;

// City blocks between the streets (streets are drawn on top, so blocks just need to fill the cells)
const XS = [0, 44, 150, 244, 318, 360];
const YS = [0, 40, 94, 170, 210];
const FILLS = ["#FFD1AD", "#F7C39A", "#FFD9BC", "#BFE8A0"];
const BLOCKS = (() => {
  const out = [];
  for (let i = 0; i < XS.length - 1; i++) {
    for (let j = 0; j < YS.length - 1; j++) {
      const x = XS[i] + 13, y = YS[j] + 13, w = XS[i + 1] - XS[i] - 26, h = YS[j + 1] - YS[j] - 26;
      if (w >= 12 && h >= 12) out.push({ x, y, w, h, fill: FILLS[(i * 3 + j * 2) % FILLS.length], key: `${i}-${j}` });
    }
  }
  return out;
})();

const INK = "#2F170B";

export default function RiderTrackingCard({ subOrderId }) {
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["sub-order-tracking", subOrderId],
    queryFn: () => getSubOrderTracking(subOrderId),
    refetchInterval: POLL_MS,
    retry: 1,
  });

  const tracking = data?.tracking;
  const maxRemainingRef = useRef(0);

  // "now", corrected to the server's clock so a wrong phone clock can't make a fresh position look stale
  const serverNow = tracking?.server_time ? Date.parse(tracking.server_time) : Date.now();
  const nowMs = serverNow + (Date.now() - (dataUpdatedAt || Date.now()));

  const vm = tracking?.active
    ? describeTracking({
        status: tracking.status,
        rider: tracking.rider,
        store: tracking.store,
        destination: tracking.destination,
        vehicle: tracking.vehicle,
        nowMs,
        maxRemainingKm: maxRemainingRef.current,
      })
    : null;

  useEffect(() => {
    if (vm?.remainingKm) maxRemainingRef.current = Math.max(maxRemainingRef.current, vm.remainingKm);
  }, [vm?.remainingKm]);

  // Place the rider on the route. The first placement is instant; later ones glide (CSS transition).
  const pathRef = useRef(null);
  const [geo, setGeo] = useState({ len: 0, x: STORE_PT.x, y: STORE_PT.y, placed: false, animate: false });
  // Drawn position is clamped so the rider marker never sits on top of the store or home pin.
  const progress = Math.min(0.9, Math.max(0.08, vm?.progress ?? 0));
  useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    const pt = el.getPointAtLength(len * progress);
    setGeo((g) => ({ len, x: pt.x, y: pt.y, placed: true, animate: g.placed }));
  }, [progress, !!vm]);

  if (isLoading) return <Skeleton className="h-64 rounded-[22px]" />;
  if (!vm) return null; // not trackable (or the request failed): the status tracker above still tells the story

  const live = vm.mode === "live" || vm.mode === "arriving";
  const stale = vm.mode === "stale";
  const arriving = vm.mode === "arriving";
  const len = geo.len || 1000;
  const glide = geo.animate ? "1.2s cubic-bezier(.22,1,.36,1)" : "none";
  const dash = {
    strokeDasharray: len,
    strokeDashoffset: len * (1 - progress),
    style: { transition: geo.animate ? `stroke-dashoffset ${glide}` : "none" },
  };

  return (
    <div className="overflow-hidden rounded-[22px] border-[3px] border-ink bg-white shadow-pop">
      <div className="relative border-b-[3px] border-ink bg-peach">
        <svg viewBox="0 0 360 210" className="block h-auto w-full" role="img" aria-label={`Rider map. ${vm.headline}. ${vm.subline}`}>
          <rect width="360" height="210" fill="#FFE2CB" />
          {BLOCKS.map((b) => <rect key={b.key} x={b.x} y={b.y} width={b.w} height={b.h} rx="8" fill={b.fill} />)}
          <path d="M0 170H360M0 94H360M0 40H360M44 0V210M150 0V210M244 0V210M318 0V210" stroke="#fff" strokeWidth="18" fill="none" />

          {/* route: dashed base, then the trail (ink outline + orange fill) that grows with progress */}
          <path d={ROUTE} fill="none" stroke={INK} strokeOpacity=".3" strokeWidth="3" strokeDasharray="3 8" strokeLinecap="round" />
          <path ref={pathRef} d={ROUTE} fill="none" stroke={INK} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" {...dash} />
          <path d={ROUTE} fill="none" stroke="#FF6B1A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" {...dash} />

          {/* store pin */}
          <g transform={`translate(${STORE_PT.x} ${STORE_PT.y})`}>
            <circle r="17" fill="#FFC53D" stroke={INK} strokeWidth="3" />
            <path d="M-8 -1H8V8H-8ZM-9 -1L-6 -8H6L9 -1" fill="none" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
          </g>

          {/* home pin (pulses when the rider is almost there) */}
          <g transform={`translate(${HOME_PT.x} ${HOME_PT.y})`}>
            {arriving && <circle className="fx-ring" r="17" fill="#FF6B1A" />}
            <circle r="17" fill="#FF6B1A" stroke={INK} strokeWidth="3" />
            <path d="M-8 1L0 -8L8 1M-5 0V8H5V0" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* rider */}
          <g style={{ transform: `translate(${geo.x}px, ${geo.y}px)`, transition: geo.animate ? `transform ${glide}` : "none", opacity: stale ? 0.6 : 1 }}>
            {live && <circle className="fx-ring" r="16" fill="#FFC53D" />}
            <circle r="16" fill="#FFC53D" stroke={INK} strokeWidth="3" />
            <g className={live ? "fx-bob" : undefined} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="-6.5" cy="4" r="3.2" />
              <circle cx="6.5" cy="4" r="3.2" />
              <path d="M-6.5 4L-2 -3H4L6.5 4M-2 -3L0 4H-6.5M4 -3L3 -7H6" />
            </g>
          </g>
        </svg>

        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-extrabold text-ink">
          <span className={`h-2 w-2 rounded-full border border-ink ${live ? "animate-pulse bg-leaf" : stale ? "bg-slate-soft" : "bg-sun"}`} />
          {live ? "Live" : stale ? "Last known position" : "On the way"}
        </span>
      </div>

      <div className={`flex items-center justify-between gap-3 p-4 ${arriving ? "bg-sun" : "bg-white"}`} aria-live="polite">
        <div className="min-w-0">
          <p className="font-display text-xl font-extrabold leading-tight tracking-tight">{vm.headline}</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-muted">{vm.subline}</p>
        </div>
        {vm.etaText && (
          <span className="flex-none rounded-full border-[2.5px] border-ink bg-sun px-3 py-1.5 font-display text-lg font-extrabold shadow-pop-xs">
            {vm.etaText}
          </span>
        )}
      </div>
    </div>
  );
}
