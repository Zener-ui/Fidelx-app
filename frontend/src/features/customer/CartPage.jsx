import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShoppingCart, Package, X, AlertTriangle, Clock } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { formatNaira } from "@/utils";
import { getProduct } from "@/api/products";
import { getFeeSettings } from "@/api/fees";
import { useQuery } from "@tanstack/react-query";
import TopBar from "@/components/layout/TopBar";
import Button from "@/components/common/Button";
import EmptyState from "@/components/common/EmptyState";
import { useStoreOpenStatus } from "./useStoreOpenStatus";

// Visual-only: round outlined +/- button for a cart line's quantity.
const QTY_BTN =
  "grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-white text-base font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";
const NOTICE =
  "flex items-start gap-2.5 rounded-[20px] border-[2.5px] border-ink bg-sun p-3.5 shadow-pop-xs";

export default function CartPage() {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, subtotal, clearCart, syncWithStock } = useCartStore();
  const { data: feeData } = useQuery({
    queryKey: ["fee-settings"],
    queryFn: getFeeSettings,
    staleTime: 5 * 60 * 1000,
  });
  const platformFeeRate = Number(feeData?.fees?.platform_fee_percentage ?? 3) / 100;
  const [stockNotice, setStockNotice] = useState(null);
  // Closed store (manual status or opening hours): friendly notice + disabled checkout button.
  const { blocked: storeBlocked, message: storeMessage } = useStoreOpenStatus(items[0]?.vendor_id, items[0]?.vendor_name);

  // Re-check live stock every time the cart is opened — a tab left open
  // for a while can hold quantities that no longer match what's actually
  // available. Checkout would still correctly reject an oversell, but the
  // customer wouldn't see why until they hit "place order".
  useEffect(() => {
    let cancelled = false;
    const productIds = [...new Set(items.map((i) => i.product_id))];
    if (productIds.length === 0) return;

    Promise.all(productIds.map((id) => getProduct(id).then((r) => [id, r.product]).catch(() => [id, null])))
      .then((pairs) => {
        if (cancelled) return;
        const liveProductsById = Object.fromEntries(pairs.filter(([, p]) => p));
        const result = syncWithStock(liveProductsById);
        if (result.changed) setStockNotice(result);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <TopBar title="Cart" />
        {stockNotice && (
          <div className={`mx-4 mt-4 ${NOTICE}`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={2.4} />
            <div className="space-y-0.5 text-sm font-semibold">
              {stockNotice.removed.map((name) => <p key={name}>{name} sold out and was removed from your cart.</p>)}
            </div>
          </div>
        )}
        <EmptyState icon={ShoppingCart} title="Your cart is empty" description="Add items to get started" action={() => navigate("/customer/search")} actionLabel="Browse Products" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-48">
      <TopBar title={`Cart (${items.length})`} right={
        <button
          onClick={clearCart}
          className="rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-extrabold text-bad shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          Clear all
        </button>
      } />

      <div className="space-y-5 px-4 py-4">
        {storeBlocked && (
          <div className="flex items-start gap-2.5 rounded-[20px] border-[2.5px] border-ink bg-coral p-3.5 shadow-pop-xs">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={2.4} />
            <p className="text-sm font-extrabold">{storeMessage}</p>
          </div>
        )}
        {stockNotice && (
          <div className={NOTICE}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={2.4} />
            <div className="space-y-0.5 text-sm font-semibold">
              {stockNotice.removed.map((name) => <p key={name}>{name} sold out and was removed from your cart.</p>)}
              {stockNotice.reduced.map((r) => <p key={r.name}>{r.name} only has {r.to} left — quantity was adjusted from {r.from}.</p>)}
            </div>
          </div>
        )}

        <div className="rounded-[22px] border-[2.5px] border-ink bg-white px-3.5 py-1 shadow-pop">
          {items.map((item) => {
            const key = `${item.product_id}_${item.variant_id || ""}`;
            return (
              <div key={key} className="flex gap-3 border-b-2 border-dashed border-peach py-3.5 last:border-0">
                <div className="grid h-[60px] w-[60px] flex-shrink-0 place-items-center overflow-hidden rounded-[14px] border-2 border-ink bg-peach">
                  {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-ink" strokeWidth={1.75} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{item.name}</p>
                  <Link to={`/customer/store/${item.vendor_id}`} onClick={(e) => e.stopPropagation()} className="inline-block text-xs font-semibold text-slate-muted underline decoration-2 underline-offset-2">{item.vendor_name}</Link>
                  <p className="mt-0.5 text-sm font-extrabold text-brand-deep">{formatNaira(item.price)}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <button onClick={() => updateQuantity(item.product_id, item.variant_id, item.quantity - 1)}
                      aria-label={`Decrease ${item.name}`} className={QTY_BTN}>−</button>
                    <span className="min-w-[1.25rem] text-center text-sm font-extrabold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product_id, item.variant_id, item.quantity + 1)}
                      aria-label={`Increase ${item.name}`} className={QTY_BTN}>+</button>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => removeItem(item.product_id, item.variant_id)} aria-label={`Remove ${item.name}`}
                    className="grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-white text-ink"><X className="h-3.5 w-3.5" strokeWidth={2.6} /></button>
                  <p className="text-sm font-extrabold">{formatNaira(item.price * item.quantity)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order summary */}
        <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop">
          <h3 className="mb-2 font-display text-lg font-extrabold tracking-tight">Order summary</h3>
          <div className="flex justify-between py-1 text-sm font-semibold">
            <span className="text-slate-muted">Subtotal</span>
            <span>{formatNaira(subtotal())}</span>
          </div>
          <div className="flex justify-between py-1 text-sm font-semibold">
            <span className="text-slate-muted">Platform fee ({Math.round(platformFeeRate * 100)}%)</span>
            <span>{formatNaira(subtotal() * platformFeeRate)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm font-semibold">
            <span className="text-slate-muted">Delivery fee</span>
            <span className="text-slate-muted">Calculated at checkout</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t-[2.5px] border-ink pt-3">
            <span className="font-display text-lg font-extrabold tracking-tight">Estimated total</span>
            <span className="font-display text-[1.35rem] font-extrabold tracking-tight">{formatNaira(subtotal() * (1 + platformFeeRate))}</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 mx-auto max-w-lg border-t-[3px] border-ink bg-navy p-4">
        <Button size="xl" onClick={() => navigate("/customer/checkout")} disabled={storeBlocked}>
          Proceed to Checkout · {formatNaira(subtotal() * (1 + platformFeeRate))}
        </Button>
      </div>
    </div>
  );
}
