import { useQuery } from "@tanstack/react-query";
import { Bell, ShoppingCart, Store, Package, Search, Star, ArrowRight, WalletCards } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getHomepageData } from "@/api/search";
import { getWallet } from "@/api/wallet";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { formatNaira, getAvailabilityDisplay } from "@/utils";
import { getCategoryIcon } from "@/utils/categoryIcons";
import { Skeleton } from "@/components/common/Loader";
import ErrorState from "@/components/common/ErrorState";
import Card from "@/components/common/Card";
import ActiveOrdersStrip from "./home/ActiveOrdersStrip";
import OrderAgainSection from "./home/OrderAgainSection";

// Cosmetic-only distance/time for now. Stable per vendor so it does not
// jump around on every render or page refresh. This is deliberately not
// used for delivery pricing, routing, eligibility, or any backend logic.
function getCosmeticDeliveryMeta(vendorId) {
  const seed = String(vendorId || "").split("").reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0
  );
  const distance = (0.7 + (seed % 15) / 10).toFixed(1);
  const minutes = 10 + (seed % 21);
  return { distance, minutes };
}

// ---- visual-only helpers (no data, routing or pricing logic) ----

// Status dot colour for the availability chip on a store card.
const AVAILABILITY_DOT = {
  OPEN: "bg-leaf",
  BUSY: "bg-sun",
  CLOSED: "bg-bad",
  TEMPORARILY_UNAVAILABLE: "bg-bad",
};

// Soft backdrop behind a store photo / placeholder, picked per store so a
// row of stores without logos doesn't read as one flat block.
const TILE_TINTS = ["bg-sun", "bg-lime", "bg-coral", "bg-lilac", "bg-mint"];
function tintFor(id) {
  const seed = String(id || "").split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return TILE_TINTS[seed % TILE_TINTS.length];
}

const ROUND_BTN =
  "relative grid h-11 w-11 flex-none place-items-center rounded-full border-[2.5px] border-ink bg-white shadow-pop-sm transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]";

const CHIP =
  "inline-flex items-center rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-bold whitespace-nowrap";

export default function HomePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const totalItems = useCartStore((s) => s.totalItems());
  const { data: walletData } = useQuery({ queryKey: ["customer-wallet"], queryFn: getWallet, staleTime: 30 * 1000 });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["homepage"],
    queryFn: getHomepageData,
  });

  const firstName = user?.full_name?.split(" ")[0] || "there";

  if (isError) {
    return (
      <div className="px-4 pt-6">
        <ErrorState message={error?.message} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-8">
      {/* Header */}
      <header className="relative overflow-hidden rounded-b-[34px] border-b-[2.5px] border-ink bg-brand px-5 pb-16 pt-[max(18px,env(safe-area-inset-top))] md:pt-8">
        <span aria-hidden="true" className="pointer-events-none absolute -right-[90px] -top-[110px] h-[260px] w-[260px] rounded-full bg-[#FF8340]" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-[90px] -left-[70px] h-[170px] w-[170px] rounded-full bg-[#FF7A2E]" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 font-display text-[1.6rem] font-extrabold tracking-[-0.04em] text-ink">
            <span aria-hidden="true" className="relative h-[34px] w-[34px] rounded-[11px] border-[2.5px] border-ink bg-paper shadow-pop-xs">
              <span className="absolute left-[9px] top-[9px] h-2.5 w-2.5 rounded-full bg-brand" />
            </span>
            fidelx
          </div>
          <div className="flex items-center gap-3">
            <Link to="/customer/notifications" aria-label="Notifications" className={ROUND_BTN}>
              <Bell className="h-5 w-5 text-ink" strokeWidth={2.2} />
            </Link>
            {totalItems > 0 && (
              <Link to="/customer/cart" aria-label={`Cart, ${totalItems} item${totalItems === 1 ? "" : "s"}`} className={ROUND_BTN}>
                <ShoppingCart className="h-5 w-5 text-ink" strokeWidth={2.2} />
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full border-2 border-white bg-ink px-1 text-[0.72rem] font-extrabold text-white">
                  {totalItems}
                </span>
              </Link>
            )}
          </div>
        </div>

        <h1 className="relative mt-5 font-display text-[2.2rem] font-extrabold leading-[0.95] tracking-[-0.045em] text-ink">
          <span className="block">Good day, {firstName}</span>
          <span className="block">what do you need?</span>
        </h1>
      </header>

      {/* Search (opens the existing search page) */}
      <div className="relative z-10 -mt-7 px-5">
        <button
          type="button"
          onClick={() => navigate("/customer/search")}
          className="flex w-full items-center gap-2.5 rounded-full border-[3px] border-ink bg-white py-3.5 pl-[18px] pr-5 text-left font-semibold text-slate-muted shadow-pop transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-pop-xs"
        >
          <Search className="h-[22px] w-[22px] flex-none text-brand-deep" strokeWidth={2.2} />
          <span className="truncate">Search stores or products</span>
        </button>
      </div>

      {/* In-progress orders (renders nothing when there are none) */}
      <ActiveOrdersStrip />

      {/* Wallet nudge — encourages the faster closed-loop payment path without removing Paystack. */}
      <div className="px-5 pt-5">
        <Link to="/customer/wallet" className="block rounded-[22px] border-[2.5px] border-ink bg-sun p-4 shadow-pop-sm transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-pop-xs">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-full border-2 border-ink bg-white"><WalletCards className="h-5 w-5" strokeWidth={2.2} /></span>
            <div className="min-w-0 flex-1"><p className="font-display text-base font-extrabold">Use Fidelx Wallet for faster orders</p><p className="mt-0.5 text-xs font-bold">Refunds can return here instantly, so you can reorder without waiting for an external refund.</p></div>
            <ArrowRight className="h-5 w-5 flex-none" strokeWidth={2.4} />
          </div>
          <p className="mt-2 text-xs font-extrabold">Balance: {formatNaira(walletData?.wallet?.balance || 0)}</p>
        </Link>
      </div>

      {/* Categories */}
      <nav aria-label="Categories">
        <div className="flex gap-3.5 overflow-x-auto px-5 pb-1.5 pt-5 scrollbar-hide md:grid md:grid-cols-6 md:overflow-visible lg:grid-cols-8">
          {isLoading
            ? Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-14 w-14 flex-shrink-0 rounded-full md:h-16 md:w-16" />
              ))
            : data?.categories?.map((cat) => {
                const { icon: CatIcon } = getCategoryIcon(cat.slug);
                return (
                  <Link
                    key={cat.id}
                    to={`/customer/stores?category=${cat.slug}`}
                    className="group flex w-[68px] flex-shrink-0 flex-col items-center gap-2 text-center md:w-auto md:flex-shrink"
                  >
                    <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-ink bg-white transition-colors group-active:bg-peach">
                      <CatIcon className="h-6 w-6 text-ink" strokeWidth={2} />
                    </span>
                    <span className="w-full truncate text-[0.8rem] font-bold leading-tight">{cat.name.split(" ")[0]}</span>
                  </Link>
                );
              })}
        </div>
      </nav>

      {/* Stores by category — top-rated first per category, with new
          (still-unrated) stores surfacing by recency instead of never
          appearing at all. Categories with zero approved vendors yet
          are simply skipped rather than shown empty. */}
      <section>
        <h2 className="px-5 pb-1 pt-8 font-display text-2xl font-extrabold tracking-tight">Stores near you</h2>

        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto px-5 pb-3 pt-3 scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-4">
            {Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-60 w-[272px] flex-shrink-0 rounded-[22px] md:w-full" />
            ))}
          </div>
        ) : data?.categories?.some((c) => c.vendors?.length > 0) ? (
          data.categories
            .filter((c) => c.vendors?.length > 0)
            .map((cat) => {
              const { icon: CatIcon } = getCategoryIcon(cat.slug);
              return (
                <div key={cat.id} className="mt-5">
                  <div className="mb-3 flex items-center gap-2.5 px-5">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full border-2 border-ink bg-peach">
                      <CatIcon className="h-[18px] w-[18px] text-ink" strokeWidth={2} />
                    </span>
                    <h3 className="font-display text-lg font-extrabold tracking-tight">{cat.name}</h3>
                  </div>

                  <div className="flex gap-4 overflow-x-auto px-5 pb-3 pt-1 scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-4">
                    {cat.vendors.map((v) => {
                      const avail = getAvailabilityDisplay(v.availability_status);
                      const deliveryMeta = getCosmeticDeliveryMeta(v.id);
                      const reviewCount =
                        v.review_count ??
                        v.total_reviews ??
                        v.reviews_count ??
                        v.reviewCount ??
                        null;
                      const rating = Number(v.rating);

                      return (
                        <Link
                          key={v.id}
                          to={`/customer/store/${v.id}`}
                          className="block w-[272px] flex-shrink-0 md:w-full"
                        >
                          <Card hover className="overflow-hidden">
                            {/* The vendor's existing uploaded logo is the store
                                representation on the card — no second upload field. */}
                            <div className={`relative aspect-[16/10] overflow-hidden border-b-[2.5px] border-ink ${tintFor(v.id)}`}>
                              {v.logo_url ? (
                                <img
                                  src={v.logo_url}
                                  alt={v.business_name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="grid h-full w-full place-items-center">
                                  <Store className="h-10 w-10 text-ink" strokeWidth={1.75} />
                                </div>
                              )}

                              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-bold text-ink">
                                <span className={`h-2 w-2 rounded-full border border-ink ${AVAILABILITY_DOT[v.availability_status] || "bg-slate-soft"}`} />
                                {avail.label}
                              </span>
                            </div>

                            <div className="p-4">
                              <p className="truncate font-display text-xl font-extrabold tracking-tight">{v.business_name}</p>
                              <p className="mt-0.5 truncate text-sm font-semibold text-slate-muted">{v.category}</p>

                              <div className="mt-2.5 flex items-center gap-1.5">
                                <Star className="h-4 w-4 fill-sun text-ink" strokeWidth={2} />
                                <span className="text-sm font-extrabold">
                                  {Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "New"}
                                </span>
                                {reviewCount !== null && (
                                  <span className="text-xs font-semibold text-slate-muted">
                                    ({reviewCount} review{reviewCount === 1 ? "" : "s"})
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <span className={CHIP}>{deliveryMeta.distance} km</span>
                                <span className={CHIP}>{deliveryMeta.minutes} min</span>
                                <span className="ml-auto inline-flex items-center gap-1 text-sm font-extrabold">
                                  View store <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                                </span>
                              </div>
                            </div>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })
        ) : (
          <div className="mx-5 mt-4">
            <Card className="px-5 py-8 text-center">
              <Store className="mx-auto mb-2 h-8 w-8 text-ink" strokeWidth={1.75} />
              <p className="font-display text-lg font-extrabold tracking-tight">Stores are joining Otukpo's Fidelx soon</p>
              <p className="mt-1 text-sm font-medium text-slate-muted">Check back shortly, or be the first. Vendors sign up free.</p>
            </Card>
          </div>
        )}
      </section>

      {/* Featured Products */}
      <section className="mt-2">
        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-8">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Featured products</h2>
          <Link to="/customer/search" className="flex-shrink-0 text-sm font-extrabold underline decoration-2 underline-offset-4">
            See all
          </Link>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3.5 px-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-52 rounded-[20px]" />)}
          </div>
        ) : data?.featured_products?.length > 0 ? (
          <div className="grid grid-cols-2 gap-3.5 px-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {data.featured_products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <div className="mx-5">
            <Card className="px-5 py-10 text-center">
              <Package className="mx-auto mb-2 h-8 w-8 text-ink" strokeWidth={1.75} />
              <p className="font-display text-lg font-extrabold tracking-tight">No products yet</p>
              <p className="mt-1 text-sm font-medium text-slate-muted">Once vendors start listing, you'll see their products here first.</p>
            </Card>
          </div>
        )}
      </section>

      {/* Order again (renders nothing when there are no delivered orders) */}
      <OrderAgainSection />
    </div>
  );
}

function ProductCard({ product }) {
  return (
    <Link to={`/customer/product/${product.id}`} className="block">
      <Card hover className="h-full overflow-hidden">
        <div className="flex aspect-square items-center justify-center border-b-[2.5px] border-ink bg-peach">
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <Package className="h-10 w-10 text-ink" strokeWidth={1.75} />
          )}
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-bold">{product.name}</p>
          <p className="truncate text-xs font-semibold text-slate-muted">{product.vendors?.business_name}</p>
          <p className="mt-1.5 font-display text-[1.05rem] font-extrabold tracking-tight">{formatNaira(product.price)}</p>
        </div>
      </Card>
    </Link>
  );
}
