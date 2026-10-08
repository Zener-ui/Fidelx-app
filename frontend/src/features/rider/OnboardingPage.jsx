import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { registerRider, retryNinVerification, getMyRiderProfile } from "@/api/riders";
import { getOnboardingStatus, markStepComplete, reapplyRider } from "@/api/onboarding";
import { useAuthStore } from "@/store/authStore";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Loader from "@/components/common/Loader";
import PopHeader from "@/components/common/PopHeader";
import TermsAcceptanceStep from "@/components/common/TermsAcceptanceStep";
import VerificationStatusCard from "@/components/common/VerificationStatusCard";

export default function RiderOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [form, setForm] = useState({ nin: "", phone: user?.phone || "", vehicle_type: "motorcycle" });
  const [errors, setErrors] = useState({});
  const [retryNin, setRetryNin] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["onboarding"], queryFn: getOnboardingStatus });
  const progress = data?.onboarding;

  // Once identity has been submitted, poll the rider profile so we can
  // show the real verification outcome (verified / failed / pending /
  // admin-rejected) rather than a generic "submitted" message.
  const { data: riderData, isLoading: riderLoading } = useQuery({
    queryKey: ["my-rider-profile"],
    queryFn: getMyRiderProfile,
    // A rider row is the source of truth for whether an application exists.
    // Do not gate this query on onboarding_progress: the rider row can be
    // created before the progress flag is written (for example if NIN
    // verification fails or the network drops after registration).
    enabled: true,
  });
  const rider = riderData?.rider;

  const mutation = useMutation({
    mutationFn: registerRider,
    onSuccess: async (res) => {
      await markStepComplete("identity_submitted");
      if (res.verification?.verified) {
        toast.success("Identity verified! Your rider account is approved.");
      } else {
        toast.error(res.verification?.message || "Verification did not pass — you can retry below.");
      }
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      qc.invalidateQueries({ queryKey: ["my-rider-profile"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const retryMutation = useMutation({
    mutationFn: () => retryNinVerification(retryNin || undefined),
    onSuccess: (res) => {
      if (res.verification?.verified) {
        toast.success("Identity verified! Your rider account is approved.");
      } else {
        toast.error(res.verification?.message || "Verification still didn't pass.");
      }
      qc.invalidateQueries({ queryKey: ["my-rider-profile"] });
      setRetryNin("");
    },
    onError: (err) => toast.error(err.message),
  });

  const reapplyMutation = useMutation({
    mutationFn: reapplyRider,
    onSuccess: () => {
      toast.success("Reapplication submitted.");
      qc.invalidateQueries({ queryKey: ["my-rider-profile"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const validate = () => {
    const e = {};
    if (!form.nin.trim() || form.nin.length < 11) e.nin = "Enter a valid 11-digit NIN";
    if (!form.phone.trim()) e.phone = "Required";
    setErrors(e);
    return !Object.keys(e).length;
  };

  if (isLoading || riderLoading) return <Loader fullscreen />;
  if (rider?.status === "approved") { navigate("/rider/dashboard", { replace: true }); return null; }

  const hasRiderApplication = !!rider;

  return (
    <div className="min-h-screen animate-fade-in pb-10">
      <PopHeader title="Become a rider" subtitle="Submit your details for verification" />

      <div className="mx-auto max-w-md px-5 pt-7">
        {!hasRiderApplication && !termsAccepted ? (
          <TermsAcceptanceStep onAccepted={() => setTermsAccepted(true)} />
        ) : !hasRiderApplication ? (
          <form onSubmit={(e) => { e.preventDefault(); if (validate()) mutation.mutate(form); }} className="space-y-5">
            <Input label="NIN (National ID Number)" placeholder="11-digit NIN" value={form.nin}
              onChange={(e) => setForm((f) => ({ ...f, nin: e.target.value.replace(/\D/g, "").slice(0, 11) }))}
              error={errors.nin} helper="Your NIN will be verified via NIMC" />
            <Input label="Phone number" type="tel" value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} error={errors.phone} />
            <div>
              <span id="vehicle-label" className="mb-2 block text-sm font-bold text-ink">Vehicle type</span>
              <div role="radiogroup" aria-labelledby="vehicle-label" className="grid grid-cols-2 gap-2.5">
                {[{ v: "motorcycle", label: "Motorcycle" }, { v: "bicycle", label: "Bicycle" }].map(({ v, label }) => (
                  <button key={v} type="button" role="radio" aria-checked={form.vehicle_type === v}
                    onClick={() => setForm((f) => ({ ...f, vehicle_type: v }))}
                    className={`rounded-2xl border-[2.5px] border-ink p-3 text-sm font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                      form.vehicle_type === v ? "bg-ink text-white" : "bg-white text-ink"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" size="xl" loading={mutation.isPending}>Submit for verification</Button>
          </form>
        ) : rider?.status === "rejected" ? (
          <VerificationStatusCard
            role="rider"
            status="rejected"
            name={user?.full_name}
            applicationId={rider?.id}
            reason={rider?.rejection_reason}
            onReapply={() => reapplyMutation.mutate()}
            reapplying={reapplyMutation.isPending}
          />
        ) : rider?.nin_verified ? (
          <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-6 text-center shadow-pop">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-[2.5px] border-ink bg-leaf shadow-pop-sm">
              <CheckCircle2 className="h-8 w-8 text-white" strokeWidth={2} />
            </span>
            <p className="mt-4 font-display text-xl font-extrabold tracking-tight">Identity verified</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-muted">Your NIN has been verified and your rider account is approved.</p>
            <Button className="mt-5" onClick={() => navigate("/rider/dashboard")}>Go to dashboard</Button>
          </div>
        ) : rider?.nin_verification_status === "failed" ? (
          <div className="space-y-5">
            <div className="rounded-[22px] border-[2.5px] border-ink bg-coral p-6 text-center shadow-pop">
              <p className="font-display text-xl font-extrabold tracking-tight">Verification failed</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed">
                {rider?.nin_verification_message || "We couldn't verify your NIN."}
              </p>
            </div>
            <div className="space-y-3">
              <Input
                label="Re-enter NIN (optional — leave blank to retry the same one)"
                placeholder="11-digit NIN"
                value={retryNin}
                onChange={(e) => setRetryNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
              />
              <Button size="xl" loading={retryMutation.isPending} onClick={() => retryMutation.mutate()}>
                Retry verification
              </Button>
            </div>
          </div>
        ) : (
          <VerificationStatusCard role="rider" status="pending" name={user?.full_name} applicationId={rider?.id} />
        )}
      </div>
    </div>
  );
}
