import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Store } from "lucide-react";
import toast from "react-hot-toast";
import { getMyOrders, getOrderWithSubOrders } from "@/api/orders";
import { getProduct } from "@/api/products";
import { getVendor } from "@/api/vendors";
import { useCartStore } from "@/store/cartStore";
import { formatDate } from "@/utils";
import Card from "@/components/common/Card";
import Button from "@/components/common/Button";
import Modal from "@/components/common/Modal";
import { Skeleton } from "@/components/common/Loader";
import { buildReorderPlan, isStoreBlocked, describePlanNotes, summarizeItems } from "./reorderPlan";

/**
 * Home (bottom): "Order again" for stores the customer has already received an
 * order from. Shows NOTHING if they have no delivered orders.
 *
 * Unit = one store (a sub-order), because the cart is one-store-only. Newest
 * delivered order per store, up to 3 stores.
 *
 * Tapping "Order again" never writes blindly. It first reads the LIVE store and
 * LIVE products, drops what is no longer available, caps quantities to stock,
 * uses today's prices, and only then adds to the cart through the existing
 * cart store. If the cart holds a different store, the same "Start a new
 * cart?" confirmation as the Product page is shown. Nothing is placed or paid
 * here — the customer lands on the Cart page and checks out as usual.
 */
const TINTS = ["bg-sun", "bg-lime", "bg-coral", "bg-lilac", "bg-mint"];
const tintFor = (id) => TINTS[String(id || "").split("").reduce((s, c) => s + c.charCodeAt(0), 0) % TINTS.length];
const MAX_STORES = 3;
const FRESH_MS = 10 * 60 * 1000; // delivered orders don't change; avoid refetching on every Home visit

export default function OrderAgainSection() {
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [conflict, setConflict] = useState(null);

  const { data: listData } = useQuery({ queryKey: ["my-orders"], queryFn: getMyOrders });
  const delivered = (listData?.orders || []).filter((o) => o.status === "DELIVERED").slice(0, MAX_STORES);

  const results = useQueries({
    queries: delivered.map((o) => ({
      queryKey: ["order-detail", o.id],
      queryFn: () => getOrderWithSubOrders(o.id),
      staleTime: FRESH_MS,
    })),
  });

  // newest first; one entry per store
  const seen = new Set();
  const entries = [];
  results.forEach((r) => {
    const order = r.data?.order;
    if (!order) return;
    (order.sub_orders || []).forEach((sub) => {
      if (sub.status !== "DELIVERED" || !sub.items?.length || !sub.vendor_id || seen.has(sub.vendor_id)) return;
      seen.add(sub.vendor_id);
      entries.push({
        vendor_id: sub.vendor_id,
        vendor_name: sub.vendors?.business_name,
        logo_url: sub.vendors?.logo_url,
        items: sub.items,
        date: order.created_at,
      });
    });
  });

  const commit = (plan, { replace = false } = {}) => {
    if (replace) useCartStore.getState().clearCart();
    plan.add.forEach((item) => useCartStore.getState().addItem(item));
    const notes = describePlanNotes(plan);
    if (notes) toast(`Added to your cart. ${notes}`, { duration: 6000 });
    else toast.success("Items added to your cart");
    navigate("/customer/cart");
  };

  const handleReorder = async (entry) => {
    if (busyId) return;
    setBusyId(entry.vendor_id);
    try {
      const [vendorRes, ...productResults] = await Promise.allSettled([
        getVendor(entry.vendor_id),
        ...entry.items.map((it) => getProduct(it.product_id)),
      ]);

      const vendor = vendorRes.status === "fulfilled" ? vendorRes.value?.vendor : null;
      if (!vendor || isStoreBlocked(vendor)) {
        toast.error(`${entry.vendor_name || "This store"} isn't taking orders right now`);
        return;
      }

      const plan = buildReorderPlan(entry.items, productResults, vendor);
      if (plan.add.length === 0) {
        toast.error("None of these items are available right now");
        return;
      }

      const cart = useCartStore.getState();
      const cartVendorId = cart.getCartVendorId();
      if (cartVendorId && cartVendorId !== entry.vendor_id) {
        setConflict({ plan, newStoreName: vendor.business_name, otherStoreName: cart.items[0]?.vendor_name });
        return;
      }
      commit(plan);
    } catch {
      toast.error("Couldn't reorder right now — please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmSwitchStore = () => {
    if (!conflict) return;
    const { plan } = conflict;
    setConflict(null);
    commit(plan, { replace: true });
  };

  if (delivered.length === 0) return null;
  const stillLoading = results.some((r) => r.isLoading);
  if (entries.length === 0 && !stillLoading) return null;

  return (
    <section className="mt-2">
      <h2 className="px-5 pb-4 pt-8 font-display text-2xl font-extrabold tracking-tight">Order again</h2>

      {entries.length === 0 ? (
        <div className="px-5"><Skeleton className="h-36 rounded-[22px]" /></div>
      ) : (
        <div className="space-y-4 px-5">
          {entries.map((entry) => (
            <Card key={entry.vendor_id} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-2xl border-2 border-ink ${tintFor(entry.vendor_id)}`}>
                  {entry.logo_url ? (
                    <img src={entry.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-6 w-6 text-ink" strokeWidth={1.75} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-extrabold tracking-tight">{entry.vendor_name}</p>
                  <p className="truncate text-sm font-semibold text-slate-muted">{summarizeItems(entry.items)}</p>
                  <p className="text-xs font-semibold text-slate-soft">Ordered {formatDate(entry.date)}</p>
                </div>
              </div>
              <Button
                size="md"
                className="mt-3.5 w-full"
                loading={busyId === entry.vendor_id}
                disabled={!!busyId}
                onClick={() => handleReorder(entry)}
                aria-label={`Order again from ${entry.vendor_name}`}
              >
                <RotateCcw className="h-4 w-4" strokeWidth={2.4} />
                Order again
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!conflict} onClose={() => setConflict(null)} title="Start a new cart?" size="sm">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-muted">
            Your cart contains items from <span className="font-semibold text-ink">{conflict?.otherStoreName || "another store"}</span>.
            Start a new cart to order from <span className="font-semibold text-ink">{conflict?.newStoreName}</span> instead?
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConflict(null)}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={confirmSwitchStore}>Clear &amp; Switch</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
