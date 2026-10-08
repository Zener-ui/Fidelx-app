import { useState, useEffect } from "react";
import { Bike, Store, Tag, CheckCircle2, X, Clock, WalletCards } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { createOrder } from "@/api/orders";
import { initializePayment } from "@/api/payments";
import { estimateDelivery } from "@/api/delivery";
import { useCartStore } from "@/store/cartStore";
import { formatNaira } from "@/utils";
import { getFeeSettings } from "@/api/fees";
import { getWallet } from "@/api/wallet";
import client from "@/api/client";
import TopBar from "@/components/layout/TopBar";
import Button from "@/components/common/Button";
import GpsLocationCapture from "@/components/common/GpsLocationCapture";
import { useStoreOpenStatus } from "./useStoreOpenStatus";

const IDEMPOTENCY_KEY = uuidv4(); // stable for this checkout session

export default function CheckoutPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { items, toOrderPayload, clearCart, subtotal } = useCartStore();

  const { data: feeData } = useQuery({
    queryKey: ["fee-settings"],
    queryFn: getFeeSettings,
    staleTime: 5 * 60 * 1000,
  });
  const platformFeeRate = Number(feeData?.fees?.platform_fee_percentage ?? 3) / 100;

  const [deliveryType, setDeliveryType] = useState("delivery");
  // Closed store (manual status or opening hours): friendly notice + disabled pay button.
  // The server refuses the order too, so this is a courtesy, not the safeguard.
  const { blocked: storeBlocked, message: storeMessage } = useStoreOpenStatus(items[0]?.vendor_id, items[0]?.vendor_name);
  const [location, setLocation] = useState({ lat: null, lng: null, description: "", voice_note_url: null });
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("wallet");

  const walletQuery = useQuery({ queryKey: ["customer-wallet"], queryFn: getWallet, staleTime: 30 * 1000 });
  const walletBalance = Number(walletQuery.data?.wallet?.balance || 0);

  // Redirect if cart is empty
  useEffect(() => { if (items.length === 0) navigate("/customer/cart"); }, [items]);

  // Get first vendor ID for delivery estimate
  const firstVendorId = items[0]?.vendor_id;

  const estimateQuery = useQuery({
    queryKey: ["delivery-estimate", firstVendorId, location.lat, location.lng],
    queryFn: () => estimateDelivery({ vendor_id: firstVendorId, delivery_lat: location.lat, delivery_lng: location.lng }),
    enabled: !!firstVendorId && !!location.lat && !!location.lng && deliveryType === "delivery",
  });

  // react-query v5 removed onSuccess/onError from useQuery (they only
  // exist on useMutation now) — this used to be a useState populated
  // by a query onSuccess callback that silently never fired, so the
  // fee was calculated correctly by the backend but never reached the
  // UI. Reading it straight from the query's own reactive data fixes
  // that without needing a callback at all.
  const estimatedFee = estimateQuery.data?.estimate?.delivery_fee ?? null;

  const orderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: async (orderData) => {
      // createOrder normally returns order.id. If the idempotency
      // check finds an order that already exists, the backend may return
      // order_id at the top level instead. Normalize both response shapes
      // before initializing Paystack.
      const order_id = orderData.order?.id || orderData.order_id;
      if (!order_id) {
        throw new Error("Order was created, but its ID could not be determined. Please try again.");
      }
      const method = orderData.payment_method || orderData.order?.payment_method;
      if (method === "fidelx_wallet") {
        clearCart();
        qc.invalidateQueries({ queryKey: ["customer-wallet"] });
        navigate(`/customer/orders/${order_id}`);
        return;
      }
      try {
        const payData = await initializePayment(order_id);
        clearCart();
        window.location.href = payData.authorization_url;
      } catch (err) {
        toast.error(err.message || "Payment initialization failed. Your order was created. Please contact support.");
      }
    },
    onError: (err) => toast.error(err.message || "Failed to place order"),
  });

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      setCouponError("Enter a coupon code.");
      return;
    }

    setCouponLoading(true);
    setCouponError("");
    try {
      const result = await client.post("/coupons/validate", {
        code,
        vendor_id: firstVendorId || null,
        subtotal: subtotal(),
        delivery_fee: deliveryFee,
      });

      if (!result?.valid) {
        setAppliedCoupon(null);
        setCouponError(result?.message || "This coupon can't be applied.");
        return;
      }

      setAppliedCoupon({
        code: result.coupon?.code || code.toUpperCase(),
        type: result.coupon?.type,
        description: result.coupon?.description,
        discount: Number(result.discount_amount || 0),
      });
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message || "This coupon can't be applied.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError("");
    setCouponCode("");
  };

  const handlePlaceOrder = () => {
    if (deliveryType === "delivery" && (!location.lat || !location.lng)) {
      toast.error("Tap \"Set Delivery Location\" to continue");
      return;
    }
    if (deliveryType === "delivery" && !location.description?.trim() && !location.voice_note_url) {
      toast.error("Please describe where you are, by typing or voice note");
      return;
    }
    if (deliveryType === "delivery" && estimateQuery.isError) {
      toast.error("Can't place this order until a valid delivery fee can be calculated");
      return;
    }

    orderMutation.mutate({
      items: toOrderPayload(),
      delivery_type: deliveryType,
      delivery_address: deliveryType === "delivery" ? location.description : null,
      delivery_lat: deliveryType === "delivery" ? location.lat : null,
      delivery_lng: deliveryType === "delivery" ? location.lng : null,
      delivery_description: deliveryType === "delivery" ? location.description : null,
      delivery_voice_note_url: deliveryType === "delivery" ? location.voice_note_url : null,
      idempotency_key: IDEMPOTENCY_KEY,
      coupon_code: appliedCoupon?.code || null,
      payment_method: paymentMethod,
    });
  };

  const deliveryFee = estimatedFee || 0;
  const platformFee = Math.round(subtotal() * platformFeeRate);
  const couponDiscount = Math.min(Number(appliedCoupon?.discount || 0), subtotal() + platformFee + deliveryFee);
  const total = Math.max(0, subtotal() + platformFee + deliveryFee - couponDiscount);
  useEffect(() => { if (walletQuery.isSuccess) setPaymentMethod(walletBalance >= total ? "wallet" : "paystack"); else if (walletQuery.isError) setPaymentMethod("paystack"); }, [walletQuery.isSuccess, walletQuery.isError, walletBalance, total]);

  return (
    <div className="min-h-screen pb-48">
      <TopBar title="Checkout" showBack />

      <div className="space-y-5 px-4 py-4">
        {storeBlocked && (
          <div className="flex items-start gap-2.5 rounded-[20px] border-[2.5px] border-ink bg-coral p-3.5 shadow-pop-xs">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink" strokeWidth={2.4} />
            <p className="text-sm font-extrabold">{storeMessage}</p>
          </div>
        )}

        {/* Delivery type */}
        <div>
          <p id="delivery-option-label" className="mb-2.5 text-sm font-bold">Delivery option</p>
          <div role="radiogroup" aria-labelledby="delivery-option-label" className="grid grid-cols-2 gap-3.5">
            {[
              { value: "delivery", icon: Bike, label: "Delivery", desc: "Delivered to you" },
              { value: "pickup",   icon: Store, label: "Pickup",   desc: "Collect from store" },
            ].map(({ value, icon: Icon, label, desc }) => (
              <button key={value} type="button" role="radio" aria-checked={deliveryType === value} onClick={() => setDeliveryType(value)}
                className={`rounded-[20px] border-[2.5px] border-ink p-3.5 text-left transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${deliveryType === value ? "bg-sun shadow-pop-sm" : "bg-white shadow-pop-xs"}`}>
                <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-white">
                  <Icon className="h-5 w-5 text-ink" strokeWidth={2.2} />
                </span>
                <p className="mt-2 font-display text-base font-extrabold tracking-tight">{label}</p>
                <p className="text-xs font-semibold text-slate-muted">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Delivery form */}
        {deliveryType === "delivery" && (
          <div className="space-y-3.5">
            <GpsLocationCapture
              showVoiceMemo
              onChange={(loc) => setLocation(loc)}
            />
            {estimateQuery.isFetching && <p className="text-xs font-semibold text-slate-muted">Calculating delivery fee...</p>}
            {estimateQuery.isError && (
              <p className="text-sm font-semibold text-red-400">
                {estimateQuery.error?.message || "Couldn't calculate a delivery fee for this location. Try setting your location again."}
              </p>
            )}
            {estimatedFee !== null && !estimateQuery.isFetching && !estimateQuery.isError && (
              <p className="inline-flex rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-extrabold">Delivery fee: {formatNaira(estimatedFee)}</p>
            )}
          </div>
        )}

        {/* Order items summary */}
        <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-extrabold tracking-tight">Items ({items.length})</h3>
            {items[0]?.vendor_name && (
              <Link to={`/customer/store/${firstVendorId}`} className="truncate text-xs font-extrabold text-brand-deep underline decoration-2 underline-offset-2">
                {items[0].vendor_name}
              </Link>
            )}
          </div>
          {items.map((item, i) => (
            <div key={i} className="flex justify-between border-b-2 border-dashed border-peach py-2 text-sm last:border-0">
              <span className="mr-2 flex-1 truncate font-semibold text-slate-muted">{item.name} × {item.quantity}</span>
              <span className="flex-shrink-0 font-extrabold">{formatNaira(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>

        {/* Coupon */}
        <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop-sm">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-peach">
              <Tag className="h-4 w-4 text-ink" strokeWidth={2.2} />
            </span>
            <h3 className="font-display text-lg font-extrabold tracking-tight">Have a coupon?</h3>
          </div>

          {!appliedCoupon ? (
            <div className="flex gap-2.5">
              <input
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleApplyCoupon(); }}
                placeholder="Enter coupon code"
                autoCapitalize="characters"
                className="min-w-0 flex-1 rounded-2xl border-[2.5px] border-ink bg-white px-3.5 py-2.5 text-sm font-semibold text-ink shadow-pop-sm outline-none transition-all duration-150 placeholder:text-slate-soft focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-pop"
              />
              <Button size="md" onClick={handleApplyCoupon} loading={couponLoading}>
                Apply
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-2xl border-[2.5px] border-ink bg-lime px-3.5 py-2.5 shadow-pop-xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-ink" strokeWidth={2.2} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">{appliedCoupon.code}</p>
                  <p className="text-xs font-semibold">Discount: {formatNaira(couponDiscount)}</p>
                </div>
              </div>
              <button type="button" onClick={handleRemoveCoupon} className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-ink" aria-label="Remove coupon">
                <X className="h-4 w-4" strokeWidth={2.6} />
              </button>
            </div>
          )}

          {couponError && <p className="mt-2.5 text-sm font-semibold text-red-400">{couponError}</p>}
        </div>

        {/* Price breakdown */}
        <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop">
          <h3 className="mb-2 font-display text-lg font-extrabold tracking-tight">Price breakdown</h3>
          <div className="flex justify-between py-1 text-sm font-semibold"><span className="text-slate-muted">Subtotal</span><span>{formatNaira(subtotal())}</span></div>
          <div className="flex justify-between py-1 text-sm font-semibold"><span className="text-slate-muted">Platform fee ({Math.round(platformFeeRate * 100)}%)</span><span>{formatNaira(platformFee)}</span></div>
          {deliveryType === "delivery" && (
            <div className="flex justify-between py-1 text-sm font-semibold">
              <span className="text-slate-muted">Delivery fee</span>
              <span>{deliveryFee ? formatNaira(deliveryFee) : "—"}</span>
            </div>
          )}
          {couponDiscount > 0 && (
            <div className="flex justify-between py-1 text-sm font-extrabold text-leaf">
              <span>Coupon discount</span>
              <span>-{formatNaira(couponDiscount)}</span>
            </div>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t-[2.5px] border-ink pt-3">
            <span className="font-display text-lg font-extrabold tracking-tight">Total</span>
            <span className="font-display text-[1.35rem] font-extrabold tracking-tight">{formatNaira(total)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border-[2.5px] border-ink bg-sun p-4 shadow-pop">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 flex-none place-items-center rounded-full border-2 border-ink bg-white">
            <WalletCards className="h-5 w-5 text-ink" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-base font-extrabold">Fidelx Wallet</p>
              <span className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase">Recommended</span>
            </div>
            <p className="mt-0.5 text-xs font-bold">Refunds to your wallet are instant for reorders, and checkout is faster next time.</p>
            <p className="mt-2 text-sm font-extrabold">Balance: {formatNaira(walletQuery.data?.wallet?.balance || 0)}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button type="button" disabled={walletBalance < total} onClick={() => setPaymentMethod("wallet")} className={`rounded-2xl border-2 border-ink p-3 text-left ${paymentMethod === "wallet" && walletBalance >= total ? "bg-white shadow-pop-xs" : "bg-white/60"}`}>
            <p className="text-sm font-extrabold">Pay with Wallet</p>
            <p className="text-[11px] font-semibold text-slate-muted">{walletBalance >= total ? "Fastest option" : "Not enough balance"}</p>
          </button>
          <button type="button" onClick={() => setPaymentMethod("paystack")} className={`rounded-2xl border-2 border-ink p-3 text-left ${paymentMethod === "paystack" ? "bg-white shadow-pop-xs" : "bg-white/60"}`}>
            <p className="text-sm font-extrabold">Paystack</p>
            <p className="text-[11px] font-semibold text-slate-muted">Pay without wallet balance</p>
          </button>
        </div>
        {paymentMethod === "wallet" && walletBalance >= total && (
          <p className="mt-3 text-xs font-extrabold">Wallet payment selected. Your wallet will be debited only if the order is created successfully.</p>
        )}
      </div>

      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-[100] mx-auto max-w-lg border-t-[3px] border-ink bg-navy p-4">
        <Button size="xl" onClick={handlePlaceOrder} loading={orderMutation.isPending} disabled={storeBlocked || (paymentMethod === "wallet" && walletBalance < total)}>
          {paymentMethod === "wallet" ? `Pay ${formatNaira(total)} with Fidelx Wallet` : `Pay ${formatNaira(total)} with Paystack`}
        </Button>
      </div>
    </div>
  );
}
