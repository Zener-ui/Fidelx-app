import { useQuery, useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getMyOrders, getOrderWithSubOrders } from "@/api/orders";
import { formatNaira, getStatusDisplay } from "@/utils";
import { Skeleton } from "@/components/common/Loader";

/**
 * Home: orders the customer has paid for that are still in progress.
 * Shows NOTHING when there are none.
 *
 * Why two requests: GET /orders returns flat order rows, and the PARENT
 * order's status only changes on "all delivered" / "all cancelled" — in
 * between it just says PAYMENT_CONFIRMED. The live status (preparing,
 * rider assigned, on the way...) lives on the sub-orders, so each
 * in-progress order's detail is read from the same endpoint (and the same
 * query key) the Order Detail page already uses.
 *
 * Read-only: no mutations, no cart, no navigation logic beyond a link to the
 * existing order detail route.
 */
const IN_PROGRESS = ["PAYMENT_CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "WAITING_RIDER", "RIDER_ASSIGNED", "PICKED_UP", "DELIVERING"];
const FINISHED_SUB = ["DELIVERED", "CANCELLED", "REFUNDED"];
const POLL_MS = 30000; // only while Home is open and the tab is visible
const MAX_SHOWN = 3;

export default function ActiveOrdersStrip() {
  const { data: listData } = useQuery({ queryKey: ["my-orders"], queryFn: getMyOrders });

  const candidates = (listData?.orders || [])
    .filter((o) => IN_PROGRESS.includes(o.status))
    .slice(0, MAX_SHOWN);

  const results = useQueries({
    queries: candidates.map((o) => ({
      queryKey: ["order-detail", o.id],
      queryFn: () => getOrderWithSubOrders(o.id),
      refetchInterval: POLL_MS,
    })),
  });

  if (candidates.length === 0) return null;

  // Keep only orders that still have at least one unfinished sub-order — this
  // also hides an order whose parent status is stale (e.g. a refunded sub-order).
  const entries = results
    .map((r) => r.data?.order)
    .filter((order) => order?.sub_orders?.some((s) => !FINISHED_SUB.includes(s.status)));

  const stillLoading = results.some((r) => r.isLoading);
  if (entries.length === 0 && !stillLoading) return null;

  return (
    <section className="px-5 pt-7">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold tracking-tight">
          {entries.length > 1 ? "Your orders" : "Your order"}
        </h2>
        <Link to="/customer/orders" className="flex-shrink-0 text-sm font-extrabold underline decoration-2 underline-offset-4">
          See all
        </Link>
      </div>

      {entries.length === 0 ? (
        <Skeleton className="h-32 rounded-[22px]" />
      ) : (
        <div className="space-y-4">
          {entries.map((order) => {
            const subs = order.sub_orders.filter((s) => !FINISHED_SUB.includes(s.status));
            const itemCount = subs.reduce(
              (n, s) => n + (s.items || []).reduce((m, it) => m + (Number(it.quantity) || 0), 0),
              0
            );
            return (
              <Link key={order.id} to={`/customer/orders/${order.id}`} className="block">
                <div className="rounded-[22px] border-[2.5px] border-ink bg-sun p-4 shadow-pop transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-pop-xs">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-ink/70">
                    Order #{order.id.slice(0, 8).toUpperCase()}
                  </p>

                  <div className="mt-2.5 space-y-2.5">
                    {subs.map((sub) => {
                      const s = getStatusDisplay(sub.status);
                      return (
                        <div key={sub.id} className="flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate font-display text-xl font-extrabold tracking-tight">
                            {sub.vendors?.business_name}
                          </p>
                          <span className="inline-flex flex-none items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-bold text-ink">
                            <span className={`h-2 w-2 rounded-full bg-current ${s.color}`} />
                            {s.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3.5 flex items-center justify-between gap-3 border-t-2 border-dashed border-ink/30 pt-3">
                    <p className="text-sm font-bold">
                      {itemCount} item{itemCount === 1 ? "" : "s"} · {formatNaira(order.total)}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-extrabold">
                      Track order <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
