import { useState, useEffect } from "react";
import { SearchX, Search, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchProducts, getCategories } from "@/api/search";
import { formatNaira } from "@/utils";
import { getCategoryIcon } from "@/utils/categoryIcons";
import TopBar from "@/components/layout/TopBar";
import Input from "@/components/common/Input";
import Card from "@/components/common/Card";
import EmptyState from "@/components/common/EmptyState";
import { Skeleton } from "@/components/common/Loader";

const SORTS = [
  { value: "newest",     label: "Newest" },
  { value: "popular",    label: "Popular" },
  { value: "price_asc",  label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get("q") || "");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const category_id = params.get("category_id");
  const vendor_id = params.get("vendor_id");

  const { data: catData } = useQuery({ queryKey: ["categories"], queryFn: getCategories, staleTime: Infinity });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search-products", { q, category_id, vendor_id, sort, page }],
    queryFn: () => searchProducts({ q: q || undefined, category_id: category_id || undefined, vendor_id: vendor_id || undefined, sort, page, limit: 20 }),
    keepPreviousData: true,
  });

  const products = data?.products || [];
  const pagination = data?.pagination;

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setParams(q ? { q } : {});
  };

  return (
    <div className="min-h-screen animate-fade-in pb-8">
      <TopBar title="Search" showBack />

      <div className="space-y-4 px-4 py-4 md:px-8">
        {/* Search input */}
        <form onSubmit={handleSearch}>
          <Input
            placeholder="Search products..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </form>

        {/* Categories horizontal scroll */}
        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-hide">
          <button
            onClick={() => { setParams({}); setPage(1); }}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3.5 py-1.5 text-xs font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${!category_id ? "bg-ink text-white" : "bg-white text-ink"}`}
          >
            All
          </button>
          {catData?.categories?.map((c) => (
            <button
              key={c.id}
              onClick={() => { setParams({ category_id: c.id }); setPage(1); }}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3.5 py-1.5 text-xs font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${category_id === c.id ? "bg-ink text-white" : "bg-white text-ink"}`}
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
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => { setSort(s.value); setPage(1); }}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3.5 py-1.5 text-xs font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${sort === s.value ? "bg-brand text-ink" : "bg-white text-ink"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Results count */}
        {!isLoading && (
          <p className="text-xs font-bold text-slate-muted">
            {pagination?.total || 0} product{pagination?.total !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Results grid */}
        {isLoading || isFetching ? (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {Array(10).fill(0).map((_, i) => <Skeleton key={i} className="h-52 rounded-[20px]" />)}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No products found"
            description={data?.empty_state || "Try different keywords or browse categories."}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((p) => (
                <Card key={p.id} hover className="overflow-hidden" onClick={() => navigate(`/customer/product/${p.id}`)}>
                  <div className="flex aspect-square items-center justify-center border-b-[2.5px] border-ink bg-peach">
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                      : <Package className="h-10 w-10 text-ink" strokeWidth={1.75} />}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-bold">{p.name}</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(`/customer/store/${p.vendors?.id}`); }}
                      className="mt-0.5 block w-full truncate text-left text-xs font-semibold text-slate-muted underline decoration-2 underline-offset-2"
                    >
                      {p.vendors?.business_name}
                    </button>
                    <p className="mt-1.5 font-display text-[1.05rem] font-extrabold tracking-tight">{formatNaira(p.price)}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {pagination && (pagination.has_prev || pagination.has_next) && (
              <div className="flex items-center justify-between pt-3">
                <button
                  disabled={!pagination.has_prev}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2.4} /> Previous
                </button>
                <span className="text-xs font-bold text-slate-muted">
                  Page {pagination.page} of {pagination.pages}
                </span>
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
