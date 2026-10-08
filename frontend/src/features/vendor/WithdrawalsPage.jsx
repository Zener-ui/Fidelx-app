import { useState } from "react";
import { Banknote } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getMyWithdrawals, requestVendorWithdrawal, getFeePreview, getPinStatus } from "@/api/withdrawals";
import { getVendorEarnings } from "@/api/vendors";
import { formatNaira, formatDate } from "@/utils";
import PopHeader from "@/components/common/PopHeader";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Modal from "@/components/common/Modal";
import EmptyState from "@/components/common/EmptyState";
import BankAccountFields from "@/components/common/BankAccountFields";
import WithdrawalPinModal from "@/components/common/WithdrawalPinModal";

const STATUS_COLORS = { PENDING:"text-yellow-400", APPROVED:"text-teal", PROCESSING:"text-yellow-400", COMPLETED:"text-teal", REJECTED:"text-red-400", FAILED:"text-red-400", REVERSED:"text-red-400" };

export default function VendorWithdrawalsPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", bank_account: "", bank_code: "", bank_name: "", account_name: "" });
  const [verifiedAccount, setVerifiedAccount] = useState(null);
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null);

  const { data: earningsData } = useQuery({ queryKey: ["vendor-earnings"], queryFn: getVendorEarnings });
  const { data: withdrawalData, isLoading } = useQuery({ queryKey: ["my-withdrawals"], queryFn: getMyWithdrawals });
  const { data: pinStatusData } = useQuery({ queryKey: ["withdrawal-pin-status"], queryFn: getPinStatus });
  const available = earningsData?.available_balance || 0;
  const withdrawals = withdrawalData?.withdrawals || [];
  const hasPin = !!pinStatusData?.pin_set;

  const previewMutation = useMutation({
    mutationFn: (amount) => getFeePreview(amount),
    onSuccess: (d) => setPreview(d.breakdown),
    onError: () => setPreview(null),
  });

  const withdrawMutation = useMutation({
    mutationFn: requestVendorWithdrawal,
    onSuccess: () => {
      toast.success("Withdrawal request submitted");
      qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["vendor-earnings"] });
      setModalOpen(false);
      setPinModalOpen(false);
      setForm({ amount: "", bank_account: "", bank_code: "", bank_name: "", account_name: "" });
      setVerifiedAccount(null);
      setPreview(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const validate = () => {
    const e = {};
    if (!form.amount || Number(form.amount) <= 0) e.amount = "Enter a valid amount";
    if (Number(form.amount) > available) e.amount = `Exceeds available balance of ${formatNaira(available)}`;
    if (!verifiedAccount) e.bank_account = "Verify your bank account before submitting";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleAmountBlur = () => {
    if (form.amount && Number(form.amount) > 0) previewMutation.mutate(Number(form.amount));
  };

  // Validate the request details first, then gate the actual submission
  // behind the withdrawal PIN — entered fresh on every withdrawal.
  const handleSubmit = () => {
    if (!validate()) return;
    setPinModalOpen(true);
  };

  const handlePinVerified = (pin) => {
    withdrawMutation.mutate({ ...form, amount: Number(form.amount), pin });
  };

  return (
    <div className="min-h-screen pb-8">
      <PopHeader title="Withdrawals" subtitle="Move your available earnings to your verified bank account." />
      <div className="space-y-5 px-4 py-5">
        <div className="rounded-[22px] border-[2.5px] border-ink bg-sun p-5 shadow-pop">
          <p className="text-xs font-bold text-ink/70">Available balance</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <p className="font-display text-3xl font-extrabold text-ink">{formatNaira(available)}</p>
            <Button size="sm" onClick={() => setModalOpen(true)} disabled={available <= 0}>Withdraw</Button>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between">
            <h3 className="font-display text-xl font-extrabold text-ink">Withdrawal history</h3>
            <Banknote className="h-5 w-5 text-ink" />
          </div>
          {isLoading ? null : withdrawals.length === 0 ? (
            <EmptyState icon={Banknote} title="No withdrawals yet" />
          ) : (
            withdrawals.map((w) => (
              <div key={w.id} className="mb-3 rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-extrabold text-ink">{formatNaira(w.net_payout)}</p>
                    <p className="mt-1 text-xs font-semibold text-ink/60">Fee: {formatNaira(w.withdrawal_fee)} {w.fee_was_capped ? "(capped)" : ""}</p>
                    <p className="mt-1 text-[10px] font-semibold text-ink/55">{formatDate(w.requested_at)}</p>
                  </div>
                  <span className={`rounded-full border-2 border-ink px-2.5 py-1 text-xs font-extrabold text-ink ${
                    ["COMPLETED","APPROVED"].includes(w.status) ? "bg-lime" :
                    ["REJECTED","FAILED","REVERSED"].includes(w.status) ? "bg-coral" : "bg-sun"
                  }`}>{w.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Request withdrawal">
        <div className="space-y-4">
          <div className="rounded-[18px] border-[2.5px] border-ink bg-lime p-3 shadow-pop-xs">
            <p className="text-xs font-extrabold text-ink">Available: {formatNaira(available)}</p>
          </div>
          <Input label="Amount (₦)" type="number" min="1" max={available}
            value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            onBlur={handleAmountBlur} error={errors.amount} />

          {preview && (
            <div className="rounded-[18px] border-[2.5px] border-ink bg-peach p-3 text-sm">
              <div className="flex justify-between py-1"><span className="font-semibold text-ink/65">Gross</span><span className="font-bold text-ink">{formatNaira(preview.gross_amount)}</span></div>
              <div className="flex justify-between py-1"><span className="font-semibold text-ink/65">Fee (1%{preview.fee_was_capped ? " capped" : ""})</span><span className="font-bold text-bad">-{formatNaira(preview.withdrawal_fee)}</span></div>
              <div className="mt-1 flex justify-between border-t-[2.5px] border-ink pt-2 font-extrabold"><span>You receive</span><span className="text-brand-deep">{formatNaira(preview.net_payout)}</span></div>
            </div>
          )}

          <BankAccountFields form={form} setForm={setForm} errors={errors} verifiedAccount={verifiedAccount} setVerifiedAccount={setVerifiedAccount} />
          <Button size="xl" onClick={handleSubmit} loading={withdrawMutation.isPending}>Submit request</Button>
        </div>
      </Modal>

      <WithdrawalPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        hasPin={hasPin}
        onVerified={handlePinVerified}
        verifying={withdrawMutation.isPending}
      />
    </div>
  );
}
