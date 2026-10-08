import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRiderSubOrders } from "@/api/orders";
import { updateLocation } from "@/api/riders";

/**
 * Shares the rider's position with the customer while (and only while) they have a
 * delivery in progress. Mounted once in RiderLayout for approved riders.
 *
 * - Active = a delivery-type sub-order that is assigned / picked up / delivering.
 * - Sends at most one position every SEND_EVERY_MS, and ignores very imprecise fixes.
 * - Stops the moment there is no active delivery, and when the rider leaves the app.
 * - Browser limitation: a web app can only read location while it is open in the
 *   foreground. If the screen locks or the app is minimised, updates pause and the
 *   customer sees "last seen" instead of a live position.
 */
const SHARING_STATUSES = ["RIDER_ASSIGNED", "PICKED_UP", "DELIVERING"];
const SEND_EVERY_MS = 12_000;
const MAX_ACCURACY_M = 500;

export default function LiveLocationSharing() {
  const { data } = useQuery({ queryKey: ["rider-suborders"], queryFn: getRiderSubOrders, refetchInterval: 15000 });
  const active = (data?.sub_orders || []).some((o) => o.delivery_type === "delivery" && SHARING_STATUSES.includes(o.status));
  const [state, setState] = useState("idle"); // idle | sharing | denied | unsupported

  useEffect(() => {
    if (!active) { setState("idle"); return undefined; }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) { setState("unsupported"); return undefined; }

    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState("sharing");
        const now = Date.now();
        if (now - lastSent < SEND_EVERY_MS) return;
        if (pos.coords.accuracy > MAX_ACCURACY_M) return;
        lastSent = now;
        updateLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {}); // a missed update is harmless; the next one follows
      },
      (err) => { if (err.code === 1) setState("denied"); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [active]);

  if (state === "idle") return null;

  const text = {
    sharing: "Sharing live location with your customer",
    denied: "Location is off, so your customer can't see you. Allow location for this site in your browser settings.",
    unsupported: "This device can't share location.",
  }[state];

  return (
    <div data-theme="pop" className="pointer-events-none fixed inset-x-0 top-[max(8px,env(safe-area-inset-top))] z-[120] flex justify-center px-3">
      <div className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-full border-2 border-ink px-3.5 py-1.5 text-xs font-bold text-ink shadow-pop-xs ${state === "sharing" ? "bg-white" : "bg-coral"}`}>
        <span className={`h-2 w-2 flex-none rounded-full border border-ink ${state === "sharing" ? "animate-pulse bg-leaf" : "bg-ink"}`} />
        <span className={state === "sharing" ? "truncate" : "leading-snug"}>{text}</span>
      </div>
    </div>
  );
}
