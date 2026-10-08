import { useState } from "react";
import { Store, BadgeCheck, Star, Package, SearchX } from "lucide-react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getVendor } from "@/api/vendors";
import { searchProducts, getCategories } from "@/api/search";
import { formatNaira, getAvailabilityDisplay } from "@/utils";
import { getCategoryIcon } from "@/utils/categoryIcons";
import { tintFor, AVAILABILITY_DOT } from "@/utils/popTint";
import PublicCartButton from "@/components/common/PublicCartButton";
import TopBar from "@/components/layout/TopBar";
import Card from "@/components/common/Card";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import Loader, { Skeleton } from "@/components/common/Loader";

const SORTS = [
  { value: "newest",     label: "Newest" },
  { value: "popular",    label: "Popular" },
  { value: "price_asc",  label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
];

// Store-first discovery, step 3: this store's products. Reached via
// the "View Products" button on the store's landing/profile page
// (StorePage.jsx) — products belong to the store the customer
// already chose, so there is no mixed-store product browsing
// anywhere in this flow. Category tabs and sort here filter WITHIN
// this one store only (vendor_id stays fixed on every request).
export default function StoreProductsPage() {
  const { id } = useParams();
  const location = useLocation();
  // Same page renders at /customer/store/:id/products (logged-in) and
  // /s/:id/products (public share link) — keep a public visitor on the
  // public path when they tap into a product, instead of dropping them
  // onto a route that requires login.
  const productBasePath = location.pathname.startsWith("/s") ? "/p" : "/customer/product";
  const [categoryId, setCategoryId] = useState("");
  const [sort, setSort] = useState("newest");

  const { data: vendorData, isLoading: vendorLoading, error: vendorError, refetch: refetchVendor } = useQuery({
    queryKey: ["store", id],
    queryFn: () => getVendor(id),
  });

  const { data: catData } = useQuery({ queryKey: ["categories"], queryFn: getCategories, staleTime: Infinity });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["store-products", id, categoryId, sort],
    queryFn: () => searchProducts({ vendor_id: id, category_id: categoryId || undefined, sort, limit: 50 }),
    enabled: !!id,
    keepPreviousData: true,
  });

  if (vendorLoading) return <Loader fullscreen text="Loading store..." />;
  if (vendorError) return <ErrorState message={vendorError.message} onRetry={refetchVendor} />;

  const vendor = vendorData?.vendor;
  const products = productsData?.products || [];
  const avail = getAvailabilityDisplay(vendor?.availability_status);

  return (
    <div data-theme="pop" className="min-h-screen bg-navy pb-8">
      <TopBar title={vendor?.business_name || "Store"} showBack />

      {/* Store header */}
      <div className="flex items-center gap-3 border-b-[2.5px] border-ink bg-navy-mid px-4 py-4 md:px-8">
        <div className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border-[2.5px] border-ink ${tintFor(vendor?.id)}`}>
          {vendor?.logo_url ? (
            <img src={vendor.logo_url} alt={vendor.business_name} className="h-full w-full object-cover" />
          ) : <Store className="h-7 w-7 text-ink" strokeWidth={1.75} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-display text-lg font-extrabold tracking-tight">{vendor?.business_name}</p>
            {vendor?.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-deep" strokeWidth={2.2} />}
          </div>
          <p className="truncate text-xs font-semibold text-slate-muted">{vendor?.location}</p>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-sun text-ink" strokeWidth={2} />
              <span className="text-xs font-extrabold">{vendor?.rating || "New"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-bold">
              <span className={`h-2 w-2 rounded-full border border-ink ${AVAILABILITY_DOT[vendor?.availability_status] || "bg-slate-soft"}`} />
              {avail.label}
            </span>
          </div>
          {vendor?.closed_by_hours && vendor?.next_open_label && (
            <p className="mt-1 text-[11px] font-bold text-slate-muted">{vendor.next_open_label}</p>
          )}
        </div>
      </div>

      {/* Category tabs — scoped to this store; selecting one just
          narrows vendor_id's own products, never leaves the store. */}
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-2 pt-4 scrollbar-hide md:px-8">
        <button
          onClick={() => setCategoryId("")}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3.5 py-1.5 text-xs font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${!categoryId ? "bg-ink text-white" : "bg-white text-ink"}`}
        >
          All
        </button>
        {catData?.categories?.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3.5 py-1.5 text-xs font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${categoryId === c.id ? "bg-ink text-white" : "bg-white text-ink"}`}
          >
            {(() => {
              const { icon: CatIcon } = getCategoryIcon(c.slug);
              return <CatIcon className="h-3.5 w-3.5" strokeWidth={2.2} />;
            })()}
            {c.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-3 pt-2 scrollbar-hide md:px-8">
        {SORTS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSort(s.value)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3.5 py-1.5 text-xs font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${sort === s.value ? "bg-brand text-ink" : "bg-white text-ink"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Products */}
      <div className="px-4 py-4 md:px-8">
        {productsLoading ? (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-52 rounded-[20px]" />)}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={categoryId ? "Nothing in this category yet" : "No products yet"}
            description={categoryId ? "Try a different category, or check back later." : `${vendor?.business_name || "This store"} hasn't listed any products yet.`}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {products.map((p) => (
              <Link key={p.id} to={`${productBasePath}/${p.id}`}>
                <Card hover className="h-full overflow-hidden">
                  <div className="flex aspect-square items-center justify-center border-b-[2.5px] border-ink bg-peach">
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                      : <Package className="h-10 w-10 text-ink" strokeWidth={1.75} />}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-bold">{p.name}</p>
                    <p className="mt-1.5 font-display text-[1.05rem] font-extrabold tracking-tight">{formatNaira(p.price)}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {location.pathname.startsWith("/s") && <PublicCartButton />}
    </div>
  );
}
