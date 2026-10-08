import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getVendorEarnings } from "@/api/vendors";
import { formatNaira, formatDate, getStatusDisplay } from "@/utils";
import PopHeader from "@/components/common/PopHeader";
import Button from "@/components/common/Button";
import { Skeleton } from "@/components/common/Loader";

export default function VendorEarningsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["vendor-earnings"], queryFn: getVendorEarnings });

  return (
    <div className="min-h-screen pb-8">
      <PopHeader title="Earnings" subtitle="Track what your store has earned and what is ready to withdraw." />
      <div className="space-y-5 px-4 py-5">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Available", value: data?.available_balance, bg: "bg-sun", desc: "Ready to withdraw" },
            { label: "Pending", value: data?.pending_balance, bg: "bg-peach", desc: "Releases after delivery" },
            { label: "Total earned", value: data?.total_earned, bg: "bg-lime", desc: "All time" },
            { label: "Withdrawn", value: data?.total_withdrawn, bg: "bg-lilac", desc: "All time" },
          ].map(({ label, value, bg, desc }) => (
            <div key={label} className={`rounded-[22px] border-[2.5px] border-ink p-4 shadow-pop ${bg}`}>
              <p className="text-xs font-bold text-ink/70">{label}</p>
              {isLoading ? <Skeleton className="mt-2 h-7 w-20 rounded-lg" /> : <p className="mt-1 font-display text-xl font-extrabold tracking-tight text-ink">{formatNaira(value)}</p>}
              <p className="mt-1 text-[10px] font-semibold text-ink/65">{desc}</p>
            </div>
          ))}
        </div>

        {!isLoading && Number(data?.outstanding_refund_liability || 0) > 0 && (
          <div className="rounded-[22px] border-[2.5px] border-ink bg-coral p-4 shadow-pop">
            <p className="text-sm font-extrabold text-ink">Outstanding refund liability</p>
            <p className="mt-1 font-display text-xl font-extrabold text-ink">{formatNaira(data.outstanding_refund_liability)}</p>
            <p className="mt-1 text-[11px] font-semibold text-ink/70">Future eligible earnings will be applied toward this amount.</p>
          </div>
        )}

        <Button size="lg" className="w-full" onClick={() => navigate("/vendor/withdrawals")}>Request withdrawal</Button>

        <div>
          <div className="mb-3 flex items-end justify-between">
            <h3 className="font-display text-xl font-extrabold text-ink">Recent sales</h3>
            <span className="text-xs font-bold text-ink/60">Latest 20</span>
          </div>
          {isLoading
            ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="mb-3 h-20 rounded-[22px]" />)
            : data?.sub_orders?.slice(0, 20).map((o) => {
                const s = getStatusDisplay(o.status);
                const locked = o.status !== "DELIVERED";
                return (
                  <div key={o.id} className="mb-3 rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-display text-sm font-extrabold text-ink">#{o.id.slice(0,8).toUpperCase()}</p>
                        <p className="mt-1 text-[10px] font-semibold text-ink/60">{formatDate(o.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-display text-sm font-extrabold ${locked ? "text-ink/45" : "text-brand-deep"}`}>{formatNaira(o.vendor_payout)}</p>
                        <span className={`mt-1 inline-block rounded-full border-2 border-ink px-2 py-0.5 text-[10px] font-bold ${locked ? "bg-peach text-ink" : "bg-lime text-ink"}`}>
                          {locked ? "Locked" : "Released"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 border-t-2 border-dashed border-peach pt-2 text-xs font-bold text-ink/65">{locked ? "Locked" : "Released"}</div>
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}
