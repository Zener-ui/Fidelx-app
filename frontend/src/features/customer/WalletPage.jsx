import { useState } from "react";
import { Link } from "react-router-dom";
import { WalletCards, ArrowDownToLine, ArrowUpFromLine, Clock3, CheckCircle2, HelpCircle, Copy, ShieldCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { formatNaira } from "@/utils";
import { useAuthStore } from "@/store/authStore";
import { getWallet, getWalletFundingAccount, getWalletTransactions, getWalletTopups } from "@/api/wallet";
import PopHeader from "@/components/common/PopHeader";
import Button from "@/components/common/Button";
import Card from "@/components/common/Card";

export default function WalletPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [fundingAccount, setFundingAccount] = useState(null);

  const walletQuery = useQuery({ queryKey: ["customer-wallet"], queryFn: getWallet, refetchInterval: 10000 });
  const txQuery = useQuery({ queryKey: ["customer-wallet-transactions"], queryFn: getWalletTransactions, refetchInterval: 10000 });
  const topupsQuery = useQuery({ queryKey: ["customer-wallet-topups"], queryFn: getWalletTopups, refetchInterval: 10000 });

  const fundingMutation = useMutation({
    mutationFn: getWalletFundingAccount,
    onSuccess: (data) => {
      if (data.funding_account) {
        setFundingAccount(data.funding_account);
        qc.invalidateQueries({ queryKey: ["customer-wallet"] });
      } else {
        toast.success(data.message || "Your funding account is being assigned. Refresh shortly.");
      }
    },
    onError: (err) => toast.error(err.message || "Couldn't activate your wallet funding account."),
  });

  const balance = Number(walletQuery.data?.wallet?.balance || 0);
  const transactions = txQuery.data?.transactions || [];
  const topups = topupsQuery.data?.topups || [];
  const savedFundingAccount = walletQuery.data?.wallet?.funding_account || null;
  const account = fundingAccount || savedFundingAccount;

  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); toast.success("Copied"); } catch { toast.error("Couldn't copy"); }
  };

  return (
    <div className="min-h-screen animate-fade-in pb-8">
      <PopHeader title="Fidelx Wallet" showBack />
      <div className="space-y-5 px-5 pt-7">
        <Card className="overflow-hidden bg-sun p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em]">Available balance</p>
              <p className="mt-1 font-display text-4xl font-extrabold tracking-tight">{formatNaira(balance)}</p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-full border-[2.5px] border-ink bg-white shadow-pop-xs">
              <WalletCards className="h-6 w-6" strokeWidth={2.3} />
            </span>
          </div>
          <p className="mt-4 text-sm font-bold">Your wallet is the fastest way to pay on Fidelx. Eligible refunds sent here are available immediately for your next order.</p>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-mint"><ShieldCheck className="h-5 w-5" /></span>
            <div><p className="font-display text-lg font-extrabold">Fund your wallet</p><p className="text-sm font-semibold text-slate-muted">Get a personal Fidelx bank account. Every transfer to it is automatically matched to your wallet.</p></div>
          </div>

          {!account ? (
            !user?.phone ? (
              <div className="rounded-2xl border-[2.5px] border-ink bg-peach p-4">
                <p className="font-extrabold">Add your phone number first</p>
                <p className="mt-1 text-sm font-semibold text-slate-muted">Paystack requires your phone number to create your personal funding account.</p>
                <Link to="/customer/profile" className="mt-3 inline-flex w-full items-center justify-center rounded-[16px] border-[2.5px] border-ink bg-sun px-4 py-3 text-sm font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  Update profile
                </Link>
              </div>
            ) : (
              <Button className="w-full" loading={fundingMutation.isPending} onClick={() => fundingMutation.mutate()}>
                Get my funding account
              </Button>
            )
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border-[2.5px] border-ink bg-peach p-3.5">
                <p className="text-xs font-bold text-slate-muted">Bank</p>
                <p className="font-extrabold">{account.bank_name || "Paystack-Titan"}</p>
                <div className="mt-3 flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-slate-muted">Account name</p><p className="font-extrabold">{account.account_name || "Fidelx"}</p></div><button onClick={() => copy(account.account_name || "Fidelx")} className="grid h-10 w-10 place-items-center rounded-xl border-2 border-ink bg-sun"><Copy className="h-4 w-4" /></button></div>
                <div className="mt-3 flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-slate-muted">Account number</p><p className="font-display text-2xl font-extrabold tracking-tight">{account.account_number}</p></div><button onClick={() => copy(account.account_number)} className="grid h-10 w-10 place-items-center rounded-xl border-2 border-ink bg-sun"><Copy className="h-4 w-4" /></button></div>
              </div>
              <div className="rounded-2xl border-2 border-ink bg-white p-3 text-sm font-semibold"><strong>How it works:</strong> transfer any amount you want to this account. Paystack notifies Fidelx when the transfer is received, and your wallet is credited automatically. You do not need to tap “I have sent it”.</div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2"><HelpCircle className="h-5 w-5" /><h2 className="font-display text-lg font-extrabold">Why use Fidelx Wallet?</h2></div>
          <div className="mt-3 space-y-3 text-sm font-semibold">
            <div><p className="font-extrabold">Why is Wallet the recommended payment method?</p><p className="text-slate-muted">Wallet payments stay inside Fidelx. That means no new external checkout step when you reorder, and eligible wallet refunds can be used immediately.</p></div>
            <div><p className="font-extrabold">Are wallet refunds faster?</p><p className="text-slate-muted">Yes. When a refund is sent to your Fidelx Wallet, the value is available immediately instead of waiting for an external refund to reach your bank or card.</p></div>
            <div><p className="font-extrabold">How fast are bank-transfer top-ups?</p><p className="text-slate-muted">Your funding account is dedicated to you. Once Paystack receives the transfer and sends the confirmation webhook, Fidelx credits the wallet automatically. Paystack says this normally happens within a few minutes, with a requery path for delayed notifications.</p></div>
            <div><p className="font-extrabold">Can I withdraw wallet money?</p><p className="text-slate-muted">No. Fidelx Wallet is a closed-loop balance for Fidelx purchases and eligible refunds.</p></div>
            <div><p className="font-extrabold">What if I don't have enough wallet balance?</p><p className="text-slate-muted">You can still use Paystack checkout. Wallet is simply the faster, more convenient option when you have enough balance.</p></div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2"><Clock3 className="h-5 w-5" /><h2 className="font-display text-lg font-extrabold">Recent wallet activity</h2></div>
          <div className="mt-3 space-y-2.5">
            {transactions.length === 0 ? <p className="text-sm font-semibold text-slate-muted">No wallet activity yet.</p> : transactions.map((tx) => {
              const positive = Number(tx.amount) > 0;
              return <div key={tx.id} className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3"><span className={`grid h-9 w-9 place-items-center rounded-full border-2 border-ink ${positive ? "bg-lime" : "bg-coral"}`}>{positive ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{tx.description}</p><p className="text-xs font-semibold text-slate-muted">{new Date(tx.created_at).toLocaleString()}</p></div><p className={`font-extrabold ${positive ? "text-leaf" : "text-bad"}`}>{positive ? "+" : ""}{formatNaira(tx.amount)}</p></div>;
            })}
          </div>
        </Card>

        {topups.length > 0 && <Card className="p-4"><h2 className="font-display text-lg font-extrabold">Top-up status</h2><div className="mt-3 space-y-2">{topups.slice(0,5).map((t)=><div key={t.id} className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3"><CheckCircle2 className={`h-5 w-5 ${t.status === "CONFIRMED" ? "text-leaf" : "text-slate-muted"}`} /><div className="flex-1"><p className="font-extrabold">{formatNaira(t.amount)}</p><p className="text-xs font-semibold text-slate-muted">{t.status === "CONFIRMED" ? "Wallet credited automatically" : "Awaiting transfer confirmation"}</p></div></div>)}</div></Card>}
      </div>
    </div>
  );
}
