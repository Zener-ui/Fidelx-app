import { useQuery } from "@tanstack/react-query";
import { Package, ShoppingBag, Wallet, Landmark, Star, Settings, Bell, Share2 } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { getVendorEarnings } from "@/api/vendors";
import { getVendorSubOrders } from "@/api/orders";
import { updateAvailability } from "@/api/vendors";
import { getMyVendorProfile } from "@/api/vendors";
import { getReferralStats } from "@/api/vendors";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatNaira, getStatusDisplay, getAvailabilityDisplay } from "@/utils";
import { useAuthStore } from "@/store/authStore";
import Card from "@/components/common/Card";
import { Skeleton } from "@/components/common/Loader";
import Loader from "@/components/common/Loader";
import toast from "react-hot-toast";

const AVAIL_OPTIONS = ["OPEN","BUSY","CLOSED","TEMPORARILY_UNAVAILABLE"];

// ---- visual-only helpers (no data, routing or money logic) ----
const AVAILABILITY_DOT = {
  OPEN: "bg-leaf",
  BUSY: "bg-sun",
  CLOSED: "bg-bad",
  TEMPORARILY_UNAVAILABLE: "bg-bad",
};

const TILE_TINTS = ["bg-sun", "bg-lime", "bg-coral", "bg-lilac", "bg-mint", "bg-peach"];

const ROUND_BTN =
  "relative grid h-11 w-11 flex-none place-items-center rounded-full border-[2.5px] border-ink bg-white shadow-pop-sm transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]";

const SECTION_TITLE = "font-display text-xl font-extrabold tracking-tight";

export default function VendorDashboard() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data: profileData, isLoading: profileLoading } = useQuery({ queryKey: ["vendor-profile"], queryFn: getMyVendorProfile });
  const vendor = profileData?.vendor;
  const isApproved = vendor?.status === "approved";

  // Login routes here regardless of approval status, but /me/earnings
  // is gated to approved vendors only server-side. An unapproved
  // vendor landing here previously just sat on failed/retrying
  // queries with no indication why. Vendor onboarding already renders
  // the correct state (pending / rejected / failed verification).
  const { data: earningsData, isLoading: earningsLoading } = useQuery({
    queryKey: ["vendor-earnings"], queryFn: getVendorEarnings, enabled: isApproved,
  });
  const { data: ordersData } = useQuery({
    queryKey: ["vendor-suborders"], queryFn: getVendorSubOrders, refetchInterval: 30000, enabled: isApproved,
  });
  const { data: referralData } = useQuery({
    queryKey: ["vendor-referrals"], queryFn: getReferralStats, enabled: isApproved,
  });

  const availMutation = useMutation({
    mutationFn: updateAvailability,
    onSuccess: () => { toast.success("Availability updated"); qc.invalidateQueries({ queryKey: ["vendor-profile"] }); },
    onError: (err) => toast.error(err.message),
  });

  const earnings = earningsData;
  const activeOrders = ordersData?.sub_orders?.filter((o) => !["DELIVERED","CANCELLED","REFUNDED"].includes(o.status)) || [];
  const avail = getAvailabilityDisplay(vendor?.availability_status);
  // When opening hours (not the vendor's own switch) are closing the store, say so.
  const closedByHours = vendor?.effective_availability?.reason === "hours";

  // The link a vendor shares (WhatsApp status, etc.) to send people
  // straight to their public storefront — no account needed to browse.
  // Uses navigator.share on devices that support it (native share
  // sheet straight to WhatsApp/etc.), falls back to copy-to-clipboard
  // everywhere else.
  const storeLink = vendor?.id ? `${window.location.origin}/s/${vendor.id}` : "";
  const handleShareStore = async () => {
    if (!storeLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: vendor?.business_name || "My store on Fidelx", url: storeLink });
        return;
      } catch {
        // User cancelled the native share sheet, or it's unsupported for
        // this content — clipboard fallback below still gets them a usable link.
      }
    }
    try {
      await navigator.clipboard.writeText(storeLink);
      toast.success("Store link copied!");
    } catch {
      toast.error("Couldn't copy the link — try again.");
    }
  };

  if (profileLoading) return <Loader fullscreen />;
  if (!isApproved) return <Navigate to="/vendor/onboarding" replace />;

  return (
    <div className="min-h-screen animate-fade-in pb-8">
      {/* Header */}
      <header className="relative overflow-hidden rounded-b-[34px] border-b-[2.5px] border-ink bg-brand px-5 pb-7 pt-[max(18px,env(safe-area-inset-top))] md:pt-8">
        <span aria-hidden="true" className="pointer-events-none absolute -right-[90px] -top-[110px] h-[260px] w-[260px] rounded-full bg-[#FF8340]" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-[90px] -left-[70px] h-[170px] w-[170px] rounded-full bg-[#FF7A2E]" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 font-display text-[1.6rem] font-extrabold tracking-[-0.04em] text-ink">
            <span aria-hidden="true" className="relative h-[34px] w-[34px] rounded-[11px] border-[2.5px] border-ink bg-paper shadow-pop-xs">
              <span className="absolute left-[9px] top-[9px] h-2.5 w-2.5 rounded-full bg-brand" />
            </span>
            fidelx
          </div>
          <Link to="/vendor/notifications" aria-label="Notifications" className={ROUND_BTN}>
            <Bell className="h-5 w-5 text-ink" strokeWidth={2.2} />
          </Link>
        </div>

        <h1 className="relative mt-5 font-display text-[2.2rem] font-extrabold leading-[0.95] tracking-[-0.045em] text-ink">
          <span className="block">Good day,</span>
          <span className="block break-words">{vendor?.business_name}</span>
        </h1>

        {avail?.label && (
          <div className="relative mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-[0.82rem] font-extrabold text-ink shadow-pop-xs">
            <span className={`h-2.5 w-2.5 rounded-full border-[1.5px] border-ink ${AVAILABILITY_DOT[closedByHours ? "CLOSED" : vendor?.availability_status] || "bg-slate-soft"}`} />
            {closedByHours
              ? `Closed by opening hours${vendor.effective_availability.next_open_label ? ` · ${vendor.effective_availability.next_open_label}` : ""}`
              : `Store is ${avail.label.toLowerCase()}`}
          </div>
        )}
      </header>

      <div className="space-y-8 px-5 pt-7">
        {/* Store status */}
        <section>
          <h2 className={`mb-3 ${SECTION_TITLE}`}>Store status</h2>
          <Card className="p-4">
            <div className="flex flex-wrap gap-2.5" role="group" aria-label="Store status">
              {AVAIL_OPTIONS.map((s) => {
                const selected = vendor?.availability_status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => availMutation.mutate({ availability_status: s })}
                    className={`inline-flex items-center gap-2 rounded-full border-[2.5px] border-ink px-3.5 py-2 text-sm font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                      selected ? "bg-ink text-white" : "bg-white text-ink"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full border-[1.5px] ${selected ? "border-white" : "border-ink"} ${AVAILABILITY_DOT[s]}`} />
                    {getAvailabilityDisplay(s).label}
                  </button>
                );
              })}
            </div>
          </Card>
        </section>

        {/* Share store link — the customer-acquisition channel: a
            vendor posts this on their own WhatsApp status/socials,
            and anyone who taps it lands on a public store page with
            no account required to browse. */}
        <section>
          <h2 className={`mb-3 ${SECTION_TITLE}`}>Your store link</h2>
          <Card className="p-4">
            <div className="flex items-center gap-2.5">
              <div className="min-w-0 flex-1 rounded-2xl border-2 border-ink bg-navy-mid px-3.5 py-2.5">
                <p className="truncate text-sm font-semibold text-ink">{storeLink}</p>
              </div>
              <button
                type="button"
                onClick={handleShareStore}
                className="inline-flex flex-none items-center gap-1.5 rounded-full border-[2.5px] border-ink bg-brand px-4 py-2.5 text-sm font-extrabold text-ink shadow-pop-sm transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]"
              >
                <Share2 className="h-4 w-4" strokeWidth={2.4} />
                Share
              </button>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-muted">Share this on your WhatsApp status — anyone who taps it can browse your store right away.</p>
            {referralData?.total_referred > 0 && (
              <p className="mt-3 border-t-2 border-dashed border-peach pt-3 text-sm font-extrabold text-ink">
                {referralData.total_referred} {referralData.total_referred === 1 ? "person has" : "people have"} joined Fidelx through your link
              </p>
            )}
          </Card>
        </section>

        {/* Earnings summary */}
        <section>
          <h2 className={`mb-3 ${SECTION_TITLE}`}>Earnings</h2>
          <div className="grid grid-cols-2 gap-3.5">
            {[
              { label: "Available",    value: earnings?.available_balance, primary: true },
              { label: "Pending",      value: earnings?.pending_balance },
              { label: "Total earned", value: earnings?.total_earned },
              { label: "Withdrawn",    value: earnings?.total_withdrawn },
            ].map(({ label, value, primary }) => {
              const inner = (
                <>
                  <p className="text-xs font-bold text-ink/80">{label}</p>
                  {earningsLoading ? <Skeleton className="mt-2 h-7 w-24" /> : (
                    <p className="mt-1 break-words font-display text-[1.35rem] font-extrabold leading-tight tracking-tight text-ink">{formatNaira(value)}</p>
                  )}
                </>
              );
              return primary ? (
                <div key={label} className="rounded-[22px] border-[2.5px] border-ink bg-brand p-4 shadow-pop">{inner}</div>
              ) : (
                <Card key={label} className="p-4">{inner}</Card>
              );
            })}
          </div>
        </section>

        {/* Active orders */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={SECTION_TITLE}>Active orders ({activeOrders.length})</h2>
            <Link to="/vendor/orders" className="flex-shrink-0 text-sm font-extrabold underline decoration-2 underline-offset-4">See all →</Link>
          </div>
          {activeOrders.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm font-semibold text-slate-muted">No active orders</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeOrders.slice(0, 3).map((o) => {
                const s = getStatusDisplay(o.status);
                return (
                  <Card key={o.id} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <p className="font-display text-base font-extrabold">#{o.id.slice(0,8).toUpperCase()}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-muted">{o.delivery_type}</p>
                    </div>
                    <span className="inline-flex flex-none items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-bold text-ink">
                      <span className={`h-2 w-2 rounded-full bg-current ${s.color}`} />
                      {s.label}
                    </span>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick links */}
        <section>
          <h2 className={`mb-3 ${SECTION_TITLE}`}>Quick actions</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { to: "/vendor/products",    icon: Package, label: "Products" },
              { to: "/vendor/orders",      icon: ShoppingBag, label: "Orders" },
              { to: "/vendor/earnings",    icon: Wallet, label: "Earnings" },
              { to: "/vendor/withdrawals", icon: Landmark, label: "Withdraw" },
              { to: "/vendor/reviews",     icon: Star, label: "Reviews" },
              { to: "/vendor/settings",    icon: Settings, label: "Settings" },
            ].map(({ to, icon: Icon, label }, i) => (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center gap-2.5 rounded-[20px] border-[2.5px] border-ink bg-white px-2 py-4 text-center shadow-pop-sm transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]"
              >
                <span className={`grid h-12 w-12 place-items-center rounded-full border-2 border-ink ${TILE_TINTS[i % TILE_TINTS.length]}`}>
                  <Icon className="h-6 w-6 text-ink" strokeWidth={2} />
                </span>
                <span className="text-sm font-extrabold">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
