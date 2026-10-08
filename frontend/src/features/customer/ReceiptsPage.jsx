import { useQuery } from "@tanstack/react-query";
import { Receipt, Banknote, Undo2, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { getMyReceipts, getReceiptHtml } from "@/api/receipts";
import { formatDate } from "@/utils";
import TopBar from "@/components/layout/TopBar";
import EmptyState from "@/components/common/EmptyState";
import { Skeleton } from "@/components/common/Loader";

const TYPE_ICONS = { ORDER: Receipt, WITHDRAWAL: Banknote, REFUND: Undo2 };
// Visual-only: icon tile colour per receipt type.
const TYPE_TINTS = { ORDER: "bg-sun", WITHDRAWAL: "bg-lime", REFUND: "bg-coral" };

export default function ReceiptsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["receipts"], queryFn: getMyReceipts });
  const receipts = data?.receipts || [];

  // These endpoints are authenticated — a raw window.open(url) never
  // attaches the JWT the client injects, so it would just 401. Open a
  // blank tab synchronously (so popup blockers don't kill it), fetch
  // the HTML through the authenticated axios client, then write it
  // into that tab once it resolves.
  const openReceipt = async (receiptId) => {
    const tab = window.open("", "_blank");
    try {
      // getReceiptHtml already returns the raw HTML string — client.js's
      // response interceptor unwraps response.data globally, so there's
      // no further .data to reach for here. Writing res.data (a string's
      // nonexistent .data property, i.e. undefined) is what was putting
      // the literal word "undefined" on a blank page.
      const html = await getReceiptHtml(receiptId);
      if (tab) {
        tab.document.write(html);
        tab.document.close();
      }
    } catch (err) {
      if (tab) tab.close();
      toast.error(err.message || "Couldn't open receipt");
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar title="Receipts" showBack />
      <div className="mx-auto max-w-md space-y-4 px-4 py-5">
        {isLoading
          ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-[22px]" />)
          : receipts.length === 0
            ? <EmptyState icon={Receipt} title="No receipts yet" description="Your payment receipts will appear here" />
            : receipts.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openReceipt(r.receipt_id)}
                  className="flex w-full items-center gap-3.5 rounded-[22px] border-[2.5px] border-ink bg-white p-4 text-left shadow-pop-sm transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]"
                >
                  <span className={`grid h-12 w-12 flex-none place-items-center rounded-full border-2 border-ink ${TYPE_TINTS[r.type] || "bg-peach"}`}>
                    {(() => { const Ic = TYPE_ICONS[r.type] || FileText; return <Ic className="h-6 w-6 text-ink" strokeWidth={2} />; })()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-extrabold leading-tight tracking-tight">{r.type.replace("_", " ")}</p>
                    <p className="truncate text-xs font-semibold text-slate-muted">{r.receipt_id}</p>
                    <p className="text-xs font-semibold text-slate-muted">{formatDate(r.created_at)}</p>
                  </div>
                  <span className="flex-none text-sm font-extrabold underline decoration-2 underline-offset-4">View →</span>
                </button>
              ))}
      </div>
    </div>
  );
}
