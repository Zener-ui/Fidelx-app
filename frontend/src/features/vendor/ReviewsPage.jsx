import { useState } from "react";
import { Star, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getMyVendorReviews, replyToReview } from "@/api/reviews";
import { getMyVendorProfile } from "@/api/vendors";
import PopHeader from "@/components/common/PopHeader";
import RatingStars from "@/components/common/RatingStars";
import Button from "@/components/common/Button";
import EmptyState from "@/components/common/EmptyState";
import { Skeleton } from "@/components/common/Loader";
import { formatDate } from "@/utils";

const SORTS = [
  { value: "recent", label: "Most Recent" },
  { value: "highest", label: "Highest Rated" },
  { value: "lowest", label: "Lowest Rated" },
];

function ReplyBox({ reviewId, onDone }) {
  const [reply, setReply] = useState("");
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => replyToReview(reviewId, reply),
    onSuccess: () => {
      toast.success("Reply posted");
      qc.invalidateQueries({ queryKey: ["my-vendor-reviews"] });
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="mt-2 space-y-2">
      <textarea
        rows={2}
        placeholder="Write a reply to this customer..."
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        className="w-full bg-navy rounded-xl border border-surface-border text-ink text-sm py-2 px-3 outline-none focus:border-teal resize-none"
      />
      <Button size="sm" loading={mutation.isPending} onClick={() => reply.trim() && mutation.mutate()}>
        Post Reply
      </Button>
    </div>
  );
}

export default function VendorReviewsPage() {
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [replyingId, setReplyingId] = useState(null);

  const { data: vendorData } = useQuery({ queryKey: ["vendor-profile"], queryFn: getMyVendorProfile });
  const vendor = vendorData?.vendor;

  const { data, isLoading } = useQuery({
    queryKey: ["my-vendor-reviews", sort, page],
    queryFn: () => getMyVendorReviews({ sort, page, limit: 15 }),
    keepPreviousData: true,
  });

  const reviews = data?.reviews || [];
  const pagination = data?.pagination;

  // Vendors never edit or remove a customer's rating/comment — the
  // backend enforces this too (replyToReview only ever touches the
  // vendor_reply column). Replying is the only action available here.

  return (
    <div className="min-h-screen pb-8">
      <PopHeader title="Reviews" subtitle="See what customers are saying about your store." />
      <div className="space-y-5 px-4 py-5">
        <div className="rounded-[22px] border-[2.5px] border-ink bg-sun p-5 shadow-pop">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full border-[2.5px] border-ink bg-white shadow-pop-xs">
              <Star className="h-6 w-6 fill-sun text-ink" />
            </div>
            <div>
              <p className="font-display text-3xl font-extrabold text-ink">{vendor?.rating || "0.0"}</p>
              <p className="text-xs font-bold text-ink/65">Overall rating</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-ink/65">{pagination?.total || 0} review{pagination?.total !== 1 ? "s" : ""}</p>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="rounded-full border-[2.5px] border-ink bg-white px-3 py-2 text-xs font-extrabold text-ink shadow-pop-xs outline-none"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-[22px]" />)}</div>
        ) : reviews.length === 0 ? (
          <EmptyState icon={Star} title="No reviews yet" description="Reviews from customers will show up here." />
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-extrabold text-ink">{r.customer_name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <RatingStars rating={r.rating} size="xs" />
                      <span className="text-xs font-semibold text-ink/55">{formatDate(r.created_at)}</span>
                    </div>
                  </div>
                  <span className="rounded-full border-2 border-ink bg-peach px-2 py-1 text-[10px] font-bold text-ink">Customer review</span>
                </div>
                {r.title && <p className="mt-3 font-display text-sm font-extrabold text-ink">{r.title}</p>}
                {r.comment && <p className="mt-2 text-sm font-semibold leading-relaxed text-ink/70">{r.comment}</p>}
                {r.photo_urls?.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {r.photo_urls.map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-ink shadow-pop-xs">
                        <img src={url} alt={`Review photo ${i + 1}`} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}

                {r.vendor_reply ? (
                  <div className="mt-4 rounded-[18px] border-[2.5px] border-ink bg-peach p-3">
                    <p className="text-xs font-extrabold text-brand-deep">Your reply</p>
                    <p className="mt-1 text-xs font-semibold text-ink/70">{r.vendor_reply}</p>
                  </div>
                ) : replyingId === r.id ? (
                  <ReplyBox reviewId={r.id} onDone={() => setReplyingId(null)} />
                ) : (
                  <button onClick={() => setReplyingId(r.id)} className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-2 text-xs font-extrabold text-ink shadow-pop-xs active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                    <MessageSquare className="h-3.5 w-3.5" /> Reply
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {pagination && (pagination.has_prev || pagination.has_next) && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button disabled={!pagination.has_prev} onClick={() => setPage((p) => p - 1)} className="rounded-full border-2 border-ink bg-white px-3 py-2 text-xs font-extrabold shadow-pop-xs disabled:opacity-30">Previous</button>
            <span className="text-xs font-bold text-ink/60">Page {pagination.page} of {pagination.pages}</span>
            <button disabled={!pagination.has_next} onClick={() => setPage((p) => p + 1)} className="rounded-full border-2 border-ink bg-white px-3 py-2 text-xs font-extrabold shadow-pop-xs disabled:opacity-30">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
