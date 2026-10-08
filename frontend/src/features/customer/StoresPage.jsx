import { useState } from "react";
import { Star, SearchX, ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchVendors, getCategories } from "@/api/search";
import { getAvailabilityDisplay } from "@/utils";
import { getCategoryIcon } from "@/utils/categoryIcons";
import { tintFor, AVAILABILITY_DOT } from "@/utils/popTint";
import TopBar from "@/components/layout/TopBar";
import Card from "@/components/common/Card";
import EmptyState from "@/components/common/EmptyState";
import { Skeleton } from "@/components/common/Loader";

// Store-first discovery, step 2: customer picked a category on the
// home page, now sees the STORES in that category — not a mixed
// product catalog. Tapping a store goes to StorePage, which is where
// products finally appear (see StorePage.jsx).
export default function StoresPage() {
  const [params] = useSearchParams();
  const [page, setPage] = useState(1);
  const category = params.get("category");

  const { data: catData } = useQuery({ queryKey: ["categories"], queryFn: getCategories, staleTime: Infinity });
  const activeCategory = catData?.categories?.find((c) => c.slug === category);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search-vendors", { category, page }],
    queryFn: () => searchVendors({ category: category || undefined, page, limit: 20 }),
    keepPreviousData: true,
  });

  const vendors = data?.vendors || [];
  const pagination = data?.pagination;

  return (
    <div className="min-h-screen animate-fade-in pb-8">
      <TopBar title={activeCategory ? activeCategory.name : "Stores"} showBack />

      <div className="space-y-4 px-4 py-4 md:px-8">
        {!isLoading && (
          <p className="text-xs font-bold text-slate-muted">
            {pagination?.total || vendors.length} store{(pagination?.total ?? vendors.length) !== 1 ? "s" : ""}
            {activeCategory ? ` in ${activeCategory.name}` : ""}
          </p>
        )}

        {isLoading || isFetching ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-[22px]" />)}
          </div>
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No stores yet"
            description={activeCategory ? `No stores have joined ${activeCategory.name} yet — check back soon.` : "Stores are joining Fidelx soon."}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
              {vendors.map((v) => {
                const avail = getAvailabilityDisplay(v.availability_status);
                const { icon: CatIcon } = getCategoryIcon(activeCategory?.slug || "other");
                return (
                  <Link key={v.id} to={`/customer/store/${v.id}`}>
                    <Card hover className="flex items-center gap-3.5 p-4">
                      <div className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border-[2.5px] border-ink ${tintFor(v.id)}`}>
                        {v.logo_url ? (
                          <img src={v.logo_url} alt={v.business_name} className="h-full w-full object-cover" />
                        ) : <CatIcon className="h-6 w-6 text-ink" strokeWidth={1.75} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg font-extrabold tracking-tight">{v.business_name}</p>
                        <p className="truncate text-xs font-semibold text-slate-muted">{v.location}</p>
                        <div className="mt-1.5 flex items-center gap-2.5">
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-sun text-ink" strokeWidth={2} />
                            <span className="text-xs font-extrabold">{v.rating || "New"}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-bold">
                            <span className={`h-2 w-2 rounded-full border border-ink ${AVAILABILITY_DOT[v.availability_status] || "bg-slate-soft"}`} />
                            {avail.label}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {pagination && (pagination.has_prev || pagination.has_next) && (
              <div className="flex items-center justify-between pt-3">
                <button
                  disabled={!pagination.has_prev}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2.4} /> Previous
                </button>
                <span className="text-xs font-bold text-slate-muted">Page {pagination.page} of {pagination.pages}</span>
                <button
                  disabled={!pagination.has_next}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  Next <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
