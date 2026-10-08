import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { Link } from "react-router-dom";
import { getMyOrders } from "@/api/orders";
import { formatNaira, formatDate, getStatusDisplay } from "@/utils";
import PopHeader from "@/components/common/PopHeader";
import EmptyState from "@/components/common/EmptyState";
import { Skeleton } from "@/components/common/Loader";

// Visual-only: paid orders that aren't finished yet get the yellow "live" card.
const IN_PROGRESS = ["PAYMENT_CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "WAITING_RIDER", "RIDER_ASSIGNED", "PICKED_UP", "DELIVERING"];

export default function OrdersPage() {
  const { data, isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: getMyOrders });
  const orders = data?.orders || [];

  return (
    <div className="min-h-screen animate-fade-in pb-8">
      <PopHeader title="My orders" />
      <div className="space-y-5 px-5 pt-7">
        {isLoading
          ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-[22px]" />)
          : orders.length === 0
            ? <EmptyState icon={Package} title="No orders yet" description="Your order history will appear here" />
            : orders.map((order) => {
                const status = getStatusDisplay(order.status);
                const vendorCount = order.sub_orders?.length || 0;
                return (
                  <Link key={order.id} to={`/customer/orders/${order.id}`} className="block">
                    <div className={`rounded-[22px] border-[2.5px] border-ink p-4 shadow-pop transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-pop-xs ${IN_PROGRESS.includes(order.status) ? "bg-sun" : "bg-white"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-lg font-extrabold tracking-tight">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-muted">
                            {formatDate(order.created_at)}
                            {vendorCount > 0 && ` · ${vendorCount} vendor${vendorCount !== 1 ? "s" : ""}`}
                          </p>
                        </div>
                        <span className="inline-flex flex-none items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-bold text-ink">
                          <span className={`h-2 w-2 rounded-full bg-current ${status.color}`} />
                          {status.label}
                        </span>
                      </div>
                      <div className="mt-3.5 flex items-center justify-between gap-3 border-t-2 border-dashed border-ink/30 pt-3">
                        <p className="font-display text-xl font-extrabold tracking-tight">{formatNaira(order.total)}</p>
                        <span className="text-sm font-extrabold underline decoration-2 underline-offset-4">View order</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
      </div>
    </div>
  );
}
