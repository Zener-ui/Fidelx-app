import { useState, useEffect } from "react";
import { Package, AlertTriangle, Store, BadgeCheck, Star, Share2 } from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getProduct } from "@/api/products";
import { getVendorReviews } from "@/api/reviews";
import { getVendor } from "@/api/vendors";
import { useCartStore } from "@/store/cartStore";
import { formatNaira, getAvailabilityDisplay } from "@/utils";
import { setReferredVendor } from "@/utils/referral";
import { tintFor, AVAILABILITY_DOT } from "@/utils/popTint";
import PublicCartButton from "@/components/common/PublicCartButton";
import TopBar from "@/components/layout/TopBar";
import Button from "@/components/common/Button";
import Modal from "@/components/common/Modal";
import Loader, { Skeleton } from "@/components/common/Loader";
import ErrorState from "@/components/common/ErrorState";

// Visual-only: round outlined +/- button used by the quantity stepper.
const STEP_BTN =
  "grid h-11 w-11 place-items-center rounded-full border-[2.5px] border-ink bg-white text-xl font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const addItem = useCartStore((s) => s.addItem);
  const replaceCartWithItem = useCartStore((s) => s.replaceCartWithItem);

  const [selectedVariant, setSelectedVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  // One cart = one store (Fidelx pilot rule). When addItem reports a
  // conflict, this holds the pending item + the other store's name so
  // the confirm modal can offer "clear cart and switch stores?".
  const [storeConflict, setStoreConflict] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["product", id],
    queryFn: () => getProduct(id),
  });

  const { data: reviewData } = useQuery({
    queryKey: ["vendor-reviews", data?.product?.vendors?.id],
    queryFn: () => getVendorReviews(data.product.vendors.id, { limit: 5 }),
    enabled: !!data?.product?.vendors?.id,
  });

  // Someone can land directly on a shared product link (/p/:id)
  // without ever visiting the store page first — capture attribution
  // here too, once we know which vendor this product belongs to.
  // Same rule as StorePage: only on the public path.
  const vendorIdForAttribution = data?.product?.vendors?.id;
  useEffect(() => {
    if (location.pathname.startsWith("/p") && vendorIdForAttribution) {
      setReferredVendor(vendorIdForAttribution);
    }
  }, [location.pathname, vendorIdForAttribution]);

  // GET /products/:id doesn't include the store's availability_status, so the
  // "store closed / unavailable" guard below could never fire. Read it from the
  // store endpoint instead — same query key as StorePage, so it is usually
  // already cached when arriving from a store. Switches itself off if the
  // product endpoint ever starts returning the status.
  const productVendor = data?.product?.vendors;
  const { data: liveVendorData } = useQuery({
    queryKey: ["store", productVendor?.id],
    queryFn: () => getVendor(productVendor.id),
    enabled: !!productVendor?.id && productVendor?.availability_status === undefined,
  });
  const availabilityStatus = productVendor?.availability_status ?? liveVendorData?.vendor?.availability_status;

  if (isLoading) return <Loader fullscreen text="Loading product..." />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const product = data?.product;
  const vendor = product?.vendors;
  const variants = product?.variants || [];
  const avail = getAvailabilityDisplay(availabilityStatus);

  const isUnavailable = availabilityStatus === "CLOSED" || availabilityStatus === "TEMPORARILY_UNAVAILABLE";
  const outOfStock = product?.stock_quantity <= 0;

  const effectivePrice = selectedVariant
    ? product.price + (selectedVariant.price_adjustment || 0)
    : product.price;

  const handleAddToCart = () => {
    if (isUnavailable) { toast.error("This store is currently unavailable"); return; }
    if (outOfStock) { toast.error("This item is out of stock"); return; }

    const cartItem = {
      product_id: product.id,
      variant_id: selectedVariant?.id || null,
      name: product.name,
      price: effectivePrice,
      image: product.images?.[0] || null,
      vendor_id: vendor?.id,
      vendor_name: vendor?.business_name,
      quantity: qty,
    };

    const result = addItem(cartItem);
    if (!result.ok) {
      setStoreConflict({ item: cartItem, otherStoreName: result.conflictVendorName });
      return;
    }
    toast.success(`${product.name} added to cart`);
  };

  const confirmSwitchStore = () => {
    if (!storeConflict) return;
    replaceCartWithItem(storeConflict.item);
    toast.success(`Started a new cart for ${storeConflict.item.vendor_name}`);
    setStoreConflict(null);
  };

  const ctaLabel = outOfStock ? "Out of Stock" : isUnavailable ? "Store Unavailable" : `Add to Cart · ${formatNaira(effectivePrice * qty)}`;

  // Always the public /p/:id link, regardless of which path the
  // current viewer is on — whoever they share this with won't be
  // logged in, so this is the entry point that actually works for
  // them (browse + add to cart with no account, sign up at checkout).
  const shareLink = `${window.location.origin}/p/${id}`;
  const handleShare = async () => {
    const shareData = {
      title: product.name,
      text: `Check out ${product.name} on Fidelx — ${formatNaira(product.price)}`,
      url: shareLink,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Cancelled the native share sheet — clipboard fallback below
        // still gets them a usable link.
      }
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success("Product link copied!");
    } catch {
      toast.error("Couldn't copy the link — try again.");
    }
  };

  return (
    <div data-theme="pop" className="min-h-screen bg-navy pb-44 lg:pb-8">
      <TopBar showBack right={
        <button
          onClick={handleShare}
          aria-label="Share product"
          className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-white text-ink shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <Share2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>
      } />

      <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:px-8 lg:pt-4">
        {/* Image gallery */}
        <div className="relative aspect-square border-b-[2.5px] border-ink bg-peach lg:sticky lg:top-20 lg:self-start lg:overflow-hidden lg:rounded-[22px] lg:border-[2.5px] lg:shadow-pop">
          {product.images?.length > 0 ? (
            <>
              <img src={product.images[imgIdx]} alt={product.name} className="h-full w-full object-cover" />
              {product.images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full border-2 border-ink bg-white px-2 py-1.5">
                  {product.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIdx(i)}
                      aria-label={`Show photo ${i + 1}`}
                      className={`h-2.5 rounded-full border-2 border-ink transition-all ${i === imgIdx ? "w-6 bg-brand" : "w-2.5 bg-white"}`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center"><Package className="h-16 w-16 text-ink" strokeWidth={1.5} /></div>
          )}
        </div>

        <div className="space-y-6 px-4 py-5 lg:px-0 lg:py-0">
          {/* Title + Price */}
          <div>
            <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight lg:text-3xl">{product.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <p className="rounded-full border-[2.5px] border-ink bg-sun px-3.5 py-1 font-display text-2xl font-extrabold shadow-pop-xs">{formatNaira(effectivePrice)}</p>
              {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-coral px-2.5 py-1 text-xs font-bold"><AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.2} /> Only {product.stock_quantity} left</p>
              )}
              {outOfStock && <p className="inline-flex rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-bold text-bad">Out of stock</p>}
            </div>
          </div>

          {/* Vendor */}
          {vendor && (
            <div className="flex items-center gap-3 rounded-[20px] border-[2.5px] border-ink bg-white p-3 shadow-pop-sm">
              <div className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-ink ${tintFor(vendor.id)}`}>
                {vendor.logo_url ? <img src={vendor.logo_url} alt={vendor.business_name} className="h-full w-full object-cover" /> : <Store className="h-6 w-6 text-ink" strokeWidth={1.75} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{vendor.business_name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                    <span className={`h-2 w-2 rounded-full border border-ink ${AVAILABILITY_DOT[availabilityStatus] || "bg-slate-soft"}`} />
                    {avail.label}
                  </span>
                  {vendor.is_verified && <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-deep"><BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.2} /> Verified</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-sun text-ink" strokeWidth={2} />
                <span className="text-xs font-extrabold">{vendor.rating || "New"}</span>
              </div>
            </div>
          )}

          {/* Variants */}
          {variants.length > 0 && (
            <div>
              <p className="mb-2.5 text-sm font-bold">Select option</p>
              <div className="flex flex-wrap gap-2.5">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                    disabled={v.stock_quantity <= 0}
                    aria-pressed={selectedVariant?.id === v.id}
                    className={`rounded-full border-[2.5px] border-ink px-4 py-2 text-sm font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${
                      selectedVariant?.id === v.id ? "bg-ink text-white" : "bg-white text-ink"
                    }`}
                  >
                    {v.value}
                    {v.price_adjustment !== 0 && (
                      <span className="ml-1 text-xs font-bold opacity-80">
                        ({v.price_adjustment > 0 ? "+" : ""}{formatNaira(v.price_adjustment)})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <p className="mb-2.5 text-sm font-bold">Quantity</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className={STEP_BTN}
              >−</button>
              <span className="w-8 text-center font-display text-xl font-extrabold">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(product.stock_quantity, q + 1))}
                disabled={qty >= product.stock_quantity}
                aria-label="Increase quantity"
                className={`${STEP_BTN} disabled:opacity-40 disabled:shadow-none`}
              >+</button>
            </div>
          </div>

          {/* Add to cart — inline on desktop, sticky bar takes over on mobile */}
          <div className="hidden pt-1 lg:block">
            <Button size="xl" onClick={handleAddToCart} disabled={outOfStock || isUnavailable}>
              {ctaLabel}
            </Button>
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <p className="mb-2 text-sm font-bold">Description</p>
              <p className="text-sm font-medium leading-relaxed text-slate-muted">{product.description}</p>
            </div>
          )}

          {/* Reviews */}
          {reviewData?.reviews?.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-bold">Customer reviews</p>
              <div className="space-y-3.5">
                {reviewData.reviews.map((r) => (
                  <div key={r.id} className="rounded-[18px] border-[2.5px] border-ink bg-white p-3.5 shadow-pop-xs">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-extrabold">{r.customer_name}</span>
                      <span className="flex items-center gap-0.5">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-sun text-ink" strokeWidth={2} />)}</span>
                    </div>
                    {r.comment && <p className="text-xs font-medium leading-relaxed text-slate-muted">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky CTA — mobile only (sits above the 75px bottom nav); desktop has the inline button above */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-[100] border-t-[3px] border-ink bg-navy px-4 py-3 lg:hidden">
        <Button
          size="xl"
          onClick={handleAddToCart}
          disabled={outOfStock || isUnavailable}
        >
          {ctaLabel}
        </Button>
      </div>

      {location.pathname.startsWith("/p") && <PublicCartButton raised />}

      {/* One cart = one store — confirm before clearing an existing cart */}
      <Modal open={!!storeConflict} onClose={() => setStoreConflict(null)} title="Start a new cart?" size="sm">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-muted">
            Your cart contains items from <span className="font-semibold text-ink">{storeConflict?.otherStoreName || "another store"}</span>.
            Start a new cart to shop from <span className="font-semibold text-ink">{vendor?.business_name}</span> instead?
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setStoreConflict(null)}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={confirmSwitchStore}>Clear &amp; Switch</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
