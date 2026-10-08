import { useQuery } from "@tanstack/react-query";
import { WalletCards, CheckCircle2, ShieldCheck } from "lucide-react";
import { getAdminWalletTopups } from "@/api/admin";
import { formatNaira, formatDateTime } from "@/utils";
import Card from "@/components/common/Card";
import EmptyState from "@/components/common/EmptyState";
import { Skeleton } from "@/components/common/Loader";

export default function WalletTopupsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-wallet-topups"], queryFn: () => getAdminWalletTopups("CONFIRMED"), refetchInterval: 30000 });
  const rows = data?.topups || [];
  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex items-start justify-between gap-3"><div><h1 className="font-display text-2xl font-extrabold text-ink">Wallet top-ups</h1><p className="mt-1 text-sm font-semibold text-slate-muted">Recent wallet funding confirmed automatically through customer-specific Paystack accounts.</p></div><span className="grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-sun"><WalletCards className="h-5 w-5" /></span></div>
      <Card className="mb-5 bg-peach p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-extrabold">Automatic confirmation is active</p><p className="mt-1 text-xs font-semibold">Each customer has a dedicated Paystack-Titan funding account. Paystack sends Fidelx a signed webhook when money arrives, and the wallet ledger is credited idempotently. Legacy PT Account top-ups remain separate and should only be confirmed after manual reconciliation.</p></div></div></Card>
      {error ? <Card className="p-4 text-sm font-semibold text-bad">{error.message}</Card> : isLoading ? <div className="space-y-3"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div> : rows.length === 0 ? <EmptyState icon={WalletCards} title="No confirmed wallet top-ups yet" /> : <div className="space-y-3">{rows.map((t)=><Card key={t.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-display text-lg font-extrabold">{formatNaira(t.amount)}</p><p className="text-sm font-semibold">{t.users?.full_name || "Customer"}</p><p className="text-xs font-semibold text-slate-muted">{t.users?.email || t.users?.phone || ""}</p><p className="mt-1 text-xs font-semibold text-slate-muted">{formatDateTime(t.confirmed_at || t.created_at)}</p><p className="mt-1 break-all text-[11px] font-bold text-slate-muted">{t.method === "paystack_dva" ? "Paystack DVA" : "Legacy PT Account"} · {t.external_reference || t.reference}</p></div><span className="flex items-center gap-1 rounded-full border-2 border-ink bg-lime px-2.5 py-1 text-xs font-extrabold"><CheckCircle2 className="h-4 w-4" /> Credited</span></div></Card>)}</div>}
    </div>
  );
}
