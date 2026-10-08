import { useState } from "react";
import { Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getVendorSubOrders, updateSubOrderStatus } from "@/api/orders";
import { formatNaira, formatDateTime, getStatusDisplay } from "@/utils";
import PopHeader from "@/components/common/PopHeader";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import { Skeleton } from "@/components/common/Loader";

const TABS = ["All","Active","Completed"];

export default function VendorOrdersPage() {
  const [tab, setTab] = useState("All");
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["vendor-suborders"],
    queryFn: getVendorSubOrders,
    refetchInterval: 20000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => updateSubOrderStatus(id, status),
    onSuccess: () => { toast.success("Order status updated"); qc.invalidateQueries({ queryKey: ["vendor-suborders"] }); },
    onError: (err) => toast.error(err.message),
  });

  const orders = data?.sub_orders || [];
  const filtered = orders.filter((o) => {
    if (tab === "Active") return !["DELIVERED","CANCELLED","REFUNDED"].includes(o.status);
    if (tab === "Completed") return o.status === "DELIVERED";
    return true;
  });

  return (
    <div className="min-h-screen pb-6">
      <PopHeader title="Orders" subtitle="Keep every order moving." />
      <div className="px-4 pt-4 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-full border-[2.5px] border-ink px-4 py-2 text-sm font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                tab === t ? "bg-ink text-white" : "bg-white text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-[22px]" />)}
          </div>
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title="No orders" description={`No ${tab.toLowerCase()} orders`} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filtered.map((order) => {
              const s = getStatusDisplay(order.status);
              const canStartPreparing = order.status === "PAYMENT_CONFIRMED";
              // Locks in cancellation-proof territory the moment the
              // vendor accepts — see orderStateMachine.js. A customer
              // can no longer cancel once this happens.
              const canMarkReady = order.status === "PREPARING";
              // For a genuine self-pickup order, the vendor can now confirm
              // the customer actually collected it — this transition didn't
              // exist at all before, so pickup orders had no way to ever
              // be marked complete.
              const canConfirmPickedUp = order.status === "READY_FOR_PICKUP" && order.delivery_type === "pickup";
              return (
                <div key={order.id} className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-base font-extrabold text-ink">#{order.id.slice(0,8).toUpperCase()}</p>
                    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-bold text-ink">
                      <span className={`h-2 w-2 rounded-full bg-current ${s.color}`} />
                      {s.label}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {order.order_items?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 border-b-2 border-dashed border-peach pb-2 text-sm last:border-0">
                        <span className="min-w-0 font-semibold text-ink">{item.products?.name} × {item.quantity}</span>
                        <span className="shrink-0 font-bold text-ink">{formatNaira(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t-[2.5px] border-ink pt-3">
                    <p className="text-xs font-semibold text-ink/70">{formatDateTime(order.created_at)}</p>
                    <p className="font-display text-base font-extrabold text-brand-deep">{formatNaira(order.vendor_payout)}</p>
                  </div>

                  {canStartPreparing && (
                    <button
                      onClick={() => updateMutation.mutate({ id: order.id, status: "PREPARING" })}
                      className="mt-3 w-full rounded-full border-[2.5px] border-ink bg-sun px-4 py-3 text-sm font-extrabold text-ink shadow-pop-sm transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]"
                    >
                      Accept &amp; Start Preparing
                    </button>
                  )}
                  {canMarkReady && (
                    <button
                      onClick={() => updateMutation.mutate({ id: order.id, status: "READY_FOR_PICKUP" })}
                      className="mt-3 w-full rounded-full border-[2.5px] border-ink bg-lime px-4 py-3 text-sm font-extrabold text-ink shadow-pop-sm transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]"
                    >
                      {order.delivery_type === "pickup" ? "Mark Ready for Pickup" : "Mark Ready — Find Rider"}
                    </button>
                  )}
                  {canConfirmPickedUp && (
                    <button
                      onClick={() => updateMutation.mutate({ id: order.id, status: "DELIVERED" })}
                      className="mt-3 w-full rounded-full border-[2.5px] border-ink bg-leaf px-4 py-3 text-sm font-extrabold text-white shadow-pop-sm transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]"
                    >
                      Confirm Customer Picked Up
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
