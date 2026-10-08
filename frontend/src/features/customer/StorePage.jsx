import { useState, useEffect } from "react";
import { Store, BadgeCheck, Star, MapPin, Truck, Calendar, PackageCheck, Phone, MessageCircle, ArrowRight, Lock, Clock } from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getVendor } from "@/api/vendors";
import { getVendorReviews, getVendorRatingSummary } from "@/api/reviews";
import { getAvailabilityDisplay, formatDate } from "@/utils";
import { getCategoryIcon } from "@/utils/categoryIcons";
import { setReferredVendor } from "@/utils/referral";
import { tintFor, AVAILABILITY_DOT } from "@/utils/popTint";
import PublicCartButton from "@/components/common/PublicCartButton";
import TopBar from "@/components/layout/TopBar";
import Button from "@/components/common/Button";
import RatingBreakdown from "@/components/common/RatingBreakdown";
import ReviewCard from "@/components/common/ReviewCard";
import ErrorState from "@/components/common/ErrorState";
import Loader, { Skeleton } from "@/components/common/Loader";
import EmptyState from "@/components/common/EmptyState";

const SORTS = [
  { value: "recent", label: "Most Recent" },
  { value: "highest", label: "Highest Rated" },
  { value: "lowest", label: "Lowest Rated" },
];

// The store's landing/profile page — a decorated overview a customer
// lands on after tapping a store card anywhere in the app: photo,
// ratings & reviews, location, contact. Product browsing lives one
// tap away behind "View Products" (StoreProductsPage.jsx), rather
// than being crammed onto this page too.
export default function StorePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Same component renders at /customer/store/:id (logged-in) and
  // /s/:id (public share link) — this just carries the visitor down
  // whichever path they arrived on, instead of forcing a public
  // visitor into a route that requires login one tap later.
  const basePath = location.pathname.startsWith("/s") ? "/s" : "/customer/store";

  // Only record attribution on the public entry point — someone
  // already logged in browsing their own account isn't "referred" by
  // anything, and we don't want an existing customer's normal
  // browsing to overwrite a genuine pending referral.
  useEffect(() => {
    if (basePath === "/s") setReferredVendor(id);
  }, [basePath, id]);

  const [sort, setSort] = useState("recent");
  const [withPhotos, setWithPhotos] = useState(false);
  const [page, setPage] = useState(1);

  const { data: vendorData, isLoading: vendorLoading, error: vendorError, refetch: refetchVendor } = useQuery({
    queryKey: ["store", id],
    queryFn: () => getVendor(id),
  });

  const { data: summaryData } = useQuery({
    queryKey: ["store-rating-summary", id],
    queryFn: () => getVendorRatingSummary(id),
    enabled: !!id,
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["store-reviews", id, sort, withPhotos, page],
    queryFn: () => getVendorReviews(id, { sort, page, limit: 10, with_photos: withPhotos ? "true" : undefined }),
    enabled: !!id,
    keepPreviousData: true,
  });

  if (vendorLoading) return <Loader fullscreen text="Loading store..." />;
  if (vendorError) return <ErrorState message={vendorError.message} onRetry={refetchVendor} />;

  const vendor = vendorData?.vendor;
  const summary = summaryData?.summary;
  const reviews = reviewsData?.reviews || [];
  const pagination = reviewsData?.pagination;
  const avail = getAvailabilityDisplay(vendor?.availability_status);
  const { icon: CatIcon } = getCategoryIcon(vendor?.category);

  return (
    <div data-theme="pop" className="min-h-screen bg-navy pb-32">
      <TopBar title={vendor?.business_name || "Store"} showBack />

      {/* Cover — the vendor's own uploaded image (or a category tile when there is none) */}
      <div className={`relative h-44 overflow-hidden border-b-[2.5px] border-ink md:h-60 ${tintFor(vendor?.id)}`}>
        {vendor?.logo_url ? (
          <img src={vendor.logo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <CatIcon className="h-16 w-16 text-ink" strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-bold text-ink">
          <span className={`h-2 w-2 rounded-full border border-ink ${AVAILABILITY_DOT[vendor?.availability_status] || "bg-slate-soft"}`} />
          {avail.label}
        </span>
      </div>

      {/* Store card */}
      <div className="relative z-10 -mt-8 px-4 md:px-8">
        <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop">
          <div className="flex items-start gap-3">
            <span className="grid h-14 w-14 flex-none place-items-center rounded-2xl border-[2.5px] border-ink bg-peach">
              <CatIcon className="h-7 w-7 text-ink" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight">{vendor?.business_name}</h1>
                {vendor?.is_verified && <BadgeCheck className="h-5 w-5 flex-none text-brand-deep" strokeWidth={2.2} />}
              </div>
              {vendor?.category && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-peach px-2.5 py-0.5 text-xs font-bold capitalize">
                  <CatIcon className="h-3.5 w-3.5" strokeWidth={2.2} /> {vendor.category.replace(/-/g, " ")}
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Star className="h-4 w-4 fill-sun text-ink" strokeWidth={2} />
            <span className="text-sm font-extrabold">{summary?.average || vendor?.rating || "New"}</span>
            <span className="text-xs font-semibold text-slate-muted">({summary?.total_reviews || 0})</span>
          </div>
          {vendor?.closed_by_hours ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-coral px-3 py-1 text-xs font-extrabold">
              <Clock className="h-3.5 w-3.5" strokeWidth={2.4} /> Closed right now{vendor.next_open_label ? ` · ${vendor.next_open_label}` : ""}
            </p>
          ) : vendor?.hours_today_label ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-peach px-3 py-1 text-xs font-extrabold">
              <Clock className="h-3.5 w-3.5" strokeWidth={2.4} /> Today {vendor.hours_today_label}
            </p>
          ) : null}
          {vendor?.description && (
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-muted">{vendor.description}</p>
          )}
        </div>
      </div>

      {/* Quick facts */}
      <div className={`mt-5 grid gap-3 px-4 md:px-8 ${summary?.response_rate !== null && summary?.response_rate !== undefined ? "grid-cols-4" : "grid-cols-3"}`}>
        <div className="rounded-[18px] border-[2.5px] border-ink bg-white p-2.5 text-center shadow-pop-xs">
          <PackageCheck className="mx-auto mb-1 h-4 w-4 text-ink" strokeWidth={2} />
          <p className="font-display text-base font-extrabold leading-tight">{summary?.completed_orders ?? "—"}</p>
          <p className="text-[10px] font-bold text-slate-muted">Orders done</p>
        </div>
        <div className="rounded-[18px] border-[2.5px] border-ink bg-white p-2.5 text-center shadow-pop-xs">
          <Truck className="mx-auto mb-1 h-4 w-4 text-ink" strokeWidth={2} />
          <p className="font-display text-base font-extrabold leading-tight">{vendor?.delivery_radius_km ?? 30}km</p>
          <p className="text-[10px] font-bold text-slate-muted">Delivery radius</p>
        </div>
        <div className="rounded-[18px] border-[2.5px] border-ink bg-white p-2.5 text-center shadow-pop-xs">
          <Calendar className="mx-auto mb-1 h-4 w-4 text-ink" strokeWidth={2} />
          <p className="font-display text-base font-extrabold leading-tight">{vendor?.created_at ? new Date(vendor.created_at).getFullYear() : "—"}</p>
          <p className="text-[10px] font-bold text-slate-muted">On Fidelx since</p>
        </div>
        {summary?.response_rate !== null && summary?.response_rate !== undefined && (
          <div className="rounded-[18px] border-[2.5px] border-ink bg-white p-2.5 text-center shadow-pop-xs">
            <MessageCircle className="mx-auto mb-1 h-4 w-4 text-ink" strokeWidth={2} />
            <p className="font-display text-base font-extrabold leading-tight">{summary.response_rate}%</p>
            <p className="text-[10px] font-bold text-slate-muted">Response rate</p>
          </div>
        )}
      </div>

      {/* Location + contact */}
      <div className="mt-5 space-y-3 px-4 md:px-8">
        {vendor?.location && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-ink" strokeWidth={2.2} />
            <span className="font-semibold text-slate-muted">{vendor.location}</span>
          </div>
        )}
        {vendor?.contact_unlocked ? (
          <div className="flex gap-3">
            {vendor?.phone && (
              <a href={`tel:${vendor.phone}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border-[2.5px] border-ink bg-white py-2.5 text-sm font-extrabold text-ink shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                <Phone className="h-4 w-4" strokeWidth={2.2} /> Call
              </a>
            )}
            {vendor?.whatsapp && (
              <a href={`https://wa.me/${vendor.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border-[2.5px] border-ink bg-white py-2.5 text-sm font-extrabold text-ink shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                <MessageCircle className="h-4 w-4" strokeWidth={2.2} /> WhatsApp
              </a>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-ink/40 bg-navy-mid px-3 py-2.5 text-xs font-semibold text-slate-muted">
            <Lock className="h-4 w-4 shrink-0 text-ink" strokeWidth={2.2} />
            <span>Direct contact unlocks after your first order from this store</span>
          </div>
        )}
      </div>

      {/* Ratings & Reviews */}
      <div className="mt-8 px-4 md:px-8">
        <h2 className="mb-4 font-display text-2xl font-extrabold tracking-tight">Ratings &amp; reviews</h2>
        {summary ? (
          <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop-sm">
            <RatingBreakdown average={summary.average} totalReviews={summary.total_reviews} breakdown={summary.breakdown} />
          </div>
        ) : (
          <Skeleton className="h-28 rounded-[22px]" />
        )}

        <div className="mb-4 mt-6 flex items-center justify-between gap-2">
          <p className="shrink-0 text-xs font-bold text-slate-muted">{pagination?.total || 0} review{pagination?.total !== 1 ? "s" : ""}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={withPhotos}
              onClick={() => { setWithPhotos((w) => !w); setPage(1); }}
              className={`rounded-full border-2 border-ink px-3 py-1.5 text-xs font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${withPhotos ? "bg-ink text-white" : "bg-white text-ink"}`}
            >
              With photos
            </button>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-extrabold text-ink shadow-pop-xs outline-none"
            >
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {reviewsLoading ? (
          <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-[20px]" />)}</div>
        ) : reviews.length === 0 ? (
          <EmptyState icon={Star} title="No reviews yet" description={withPhotos ? "No reviews with photos yet." : "Be the first to order and leave a review."} />
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
          </div>
        )}

        {pagination && (pagination.has_prev || pagination.has_next) && (
          <div className="flex items-center justify-center gap-3 pt-5">
            <button type="button" disabled={!pagination.has_prev} onClick={() => setPage((p) => p - 1)} className="rounded-full border-2 border-ink bg-white px-3.5 py-1.5 text-xs font-extrabold shadow-pop-xs disabled:opacity-40 disabled:shadow-none">Previous</button>
            <span className="text-xs font-bold text-slate-muted">Page {pagination.page} of {pagination.pages}</span>
            <button type="button" disabled={!pagination.has_next} onClick={() => setPage((p) => p + 1)} className="rounded-full border-2 border-ink bg-white px-3.5 py-1.5 text-xs font-extrabold shadow-pop-xs disabled:opacity-40 disabled:shadow-none">Next</button>
          </div>
        )}
      </div>

      {/* View Products CTA — sits above the bottom nav (nav is 75px tall) */}
      <div className="fixed left-0 right-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[100] px-4 md:bottom-4 md:left-1/2 md:mx-auto md:w-full md:max-w-md md:-translate-x-1/2 md:px-8">
        <Button size="xl" onClick={() => navigate(`${basePath}/${id}/products`)}>
          View Products <ArrowRight className="ml-1 inline h-4 w-4" />
        </Button>
      </div>

      {basePath === "/s" && <PublicCartButton raised />}
    </div>
  );
}
