import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ScrollText, Check } from "lucide-react";
import toast from "react-hot-toast";
import { getPolicyByType, getPolicyAcceptanceStatus, acceptPolicy } from "@/api/policies";
import Button from "@/components/common/Button";
import Loader from "@/components/common/Loader";

/**
 * Shown as the first onboarding step for both vendors and riders.
 * Submission of the application form is blocked until the checkbox
 * is checked and the acceptance call succeeds — the backend also
 * enforces this independently (see checkTermsAccepted.js), so this
 * is a UX gate, not the only line of defense.
 *
 * Registration itself now also requires accepting the same terms
 * (see RegisterPage.jsx), so most people arriving here have already
 * accepted — this checks that first and skips straight through
 * instead of asking again.
 */
export default function TermsAcceptanceStep({ onAccepted }) {
  const [checked, setChecked] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["policy", "terms_of_service"],
    queryFn: () => getPolicyByType("terms_of_service"),
  });
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ["policy-status", "terms_of_service"],
    queryFn: () => getPolicyAcceptanceStatus("terms_of_service"),
  });
  const policy = data?.policy;
  const alreadyAccepted = !!statusData?.accepted;

  useEffect(() => {
    if (alreadyAccepted) onAccepted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyAccepted]);

  const mutation = useMutation({
    mutationFn: () => acceptPolicy({ policy_id: policy.id, policy_version: policy.version }),
    onSuccess: () => onAccepted(),
    onError: (err) => toast.error(err.message),
  });

  if (isLoading || statusLoading || alreadyAccepted) return <Loader />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full border-[2.5px] border-ink bg-peach">
          <ScrollText className="h-5 w-5 text-ink" strokeWidth={2.2} />
        </span>
        <h2 className="font-display text-xl font-extrabold tracking-tight">{policy?.title || "Terms & Conditions"}</h2>
      </div>

      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-2xl border-[2.5px] border-ink bg-white p-4 text-sm font-medium leading-relaxed text-slate-muted">
        {policy?.content}
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm font-medium leading-snug text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="mt-0.5 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg border-[2.5px] border-ink bg-white text-transparent shadow-pop-xs peer-checked:bg-brand peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
        >
          <Check className="h-4 w-4" strokeWidth={3.2} />
        </span>
        <span>I have read and agree to the Fidelx Terms &amp; Conditions.</span>
      </label>

      <Button size="xl" disabled={!checked} loading={mutation.isPending} onClick={() => mutation.mutate()}>
        Continue
      </Button>
    </div>
  );
}
