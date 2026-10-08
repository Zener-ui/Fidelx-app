import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getOnboardingStatus, markStepComplete, reapplyVendor } from "@/api/onboarding";
import { registerVendor, getMyVendorProfile } from "@/api/vendors";
import { getCategories } from "@/api/search";
import { useAuthStore } from "@/store/authStore";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Loader from "@/components/common/Loader";
import PopHeader from "@/components/common/PopHeader";
import GpsLocationCapture from "@/components/common/GpsLocationCapture";
import TermsAcceptanceStep from "@/components/common/TermsAcceptanceStep";
import VerificationStatusCard from "@/components/common/VerificationStatusCard";

const STEPS = [
  { key: "terms_accepted",             label: "Terms & Conditions", desc: "Read and accept the Fidelx terms" },
  { key: "business_profile_completed", label: "Business Profile",   desc: "Tell us about your business" },
  { key: "verification_submitted",     label: "Await Verification", desc: "We'll review within 24h" },
];

export default function VendorOnboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [form, setForm] = useState({ business_name: "", category: "", location: "", address: "", phone: user?.phone || "", whatsapp: "", location_lat: null, location_lng: null });
  const { data: categoryData } = useQuery({ queryKey: ["vendor-categories"], queryFn: getCategories, staleTime: Infinity });
  const [errors, setErrors] = useState({});

  const { data, isLoading } = useQuery({ queryKey: ["onboarding"], queryFn: getOnboardingStatus });
  const progress = data?.onboarding;

  // Source of truth for approval state — NOT onboarding_progress,
  // which only tracks wizard steps and doesn't reflect admin
  // approve/reject decisions (a rejected vendor can still have
  // verification_submitted=true from their original application).
  const { data: vendorData, isLoading: vendorLoading } = useQuery({
    queryKey: ["vendor-profile"],
    queryFn: getMyVendorProfile,
    enabled: !!progress?.verification_submitted,
    retry: false,
  });
  const vendor = vendorData?.vendor;

  const registerMutation = useMutation({
    mutationFn: registerVendor,
    onSuccess: async () => {
      await markStepComplete("business_profile_completed");
      await markStepComplete("verification_submitted");
      toast.success("Business registered! Awaiting admin approval.");
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      qc.invalidateQueries({ queryKey: ["vendor-profile"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const reapplyMutation = useMutation({
    mutationFn: reapplyVendor,
    onSuccess: () => {
      toast.success("Reapplication submitted.");
      qc.invalidateQueries({ queryKey: ["vendor-profile"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const validate = () => {
    const e = {};
    if (!form.business_name.trim()) e.business_name = "Required";
    if (!form.category.trim()) e.category = "Required";
    if (!form.location.trim()) e.location = "Required";
    if (!form.address.trim()) e.address = "Search for your shop's address above";
    if (!form.phone.trim()) e.phone = "Required";
    if (!form.location_lat || !form.location_lng) e.location_pin = "Search for your shop's address or drop a pin to set its location";
    setErrors(e);
    return !Object.keys(e).length;
  };

  if (isLoading) return <Loader fullscreen />;

  // Approval status — not wizard-step completion — decides dashboard access.
  if (vendor?.status === "approved") { navigate("/vendor/dashboard", { replace: true }); return null; }

  const completedCount = [termsAccepted || progress?.business_profile_completed, progress?.business_profile_completed, progress?.verification_submitted].filter(Boolean).length;

  return (
    <div className="min-h-screen animate-fade-in pb-10">
      <PopHeader title="Set up your store" subtitle={`${completedCount} of ${STEPS.length} steps completed`}>
        <div
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={completedCount}
          className="h-4 overflow-hidden rounded-full border-[2.5px] border-ink bg-white"
        >
          <div className="h-full rounded-r-full bg-ink transition-all duration-500" style={{ width: `${(completedCount / STEPS.length) * 100}%` }} />
        </div>
      </PopHeader>

      <div className="mx-auto max-w-md space-y-6 px-5 pt-7">
        <div className="space-y-3.5">
          {STEPS.map((step, i) => {
            const done = i === 0 ? termsAccepted || progress?.business_profile_completed : progress?.[step.key];
            const active = i === completedCount;
            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 rounded-[20px] border-[2.5px] border-ink p-3.5 transition-all ${
                  done ? "bg-white shadow-pop-xs" : active ? "bg-sun shadow-pop-sm" : "bg-white opacity-60"
                }`}
              >
                <div className={`grid h-9 w-9 flex-none place-items-center rounded-full border-2 border-ink text-sm font-extrabold ${done ? "bg-leaf text-white" : "bg-white text-ink"}`}>
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">{step.label}</p>
                  <p className="text-xs font-semibold text-slate-muted">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step 0 — Terms & Conditions, must be accepted before the form shows */}
        {!progress?.business_profile_completed && !termsAccepted && (
          <TermsAcceptanceStep onAccepted={() => setTermsAccepted(true)} />
        )}

        {/* Step 1 — Business profile form */}
        {!progress?.business_profile_completed && termsAccepted && (
          <form onSubmit={(e) => { e.preventDefault(); if (validate()) registerMutation.mutate(form); }} className="space-y-5">
            <Input label="Business name" value={form.business_name} onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))} error={errors.business_name} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="onboarding-category" className="text-sm font-bold text-ink">Category</label>
              <select
                id="onboarding-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-2xl border-[2.5px] border-ink bg-white px-4 py-3.5 text-sm font-semibold text-ink shadow-pop-sm outline-none transition-all duration-150 focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-pop"
              >
                <option value="">Select a category</option>
                {categoryData?.categories?.map((cat) => (
                  <option key={cat.id} value={cat.slug}>{cat.name}</option>
                ))}
              </select>
              {errors.category && <p className="text-sm font-semibold text-red-400">{errors.category}</p>}
            </div>
            <Input label="Location / Area" placeholder="e.g. Otukpo Central Market" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} error={errors.location} />
            <div>
              <GpsLocationCapture
                buttonLabel="Set Shop Location"
                onChange={({ lat, lng, description }) => setForm((f) => ({ ...f, address: description, location_lat: lat, location_lng: lng }))}
              />
              {errors.address && <p className="mt-2 text-sm font-semibold text-red-400">{errors.address}</p>}
              {errors.location_pin && <p className="mt-2 text-sm font-semibold text-red-400">{errors.location_pin}</p>}
            </div>
            <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} error={errors.phone} />
            <Input label="WhatsApp (optional)" type="tel" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} />
            <Button type="submit" size="xl" loading={registerMutation.isPending}>Register business</Button>
          </form>
        )}

        {/* Step 2 — Pending / rejected, based on actual admin decision */}
        {progress?.verification_submitted && vendor && vendor.status !== "approved" && (
          vendorLoading ? <Loader /> : (
            <VerificationStatusCard
              role="vendor"
              status={vendor.status}
              name={form.business_name || user?.full_name}
              applicationId={vendor.id}
              reason={vendor.rejection_reason}
              onReapply={() => reapplyMutation.mutate()}
              reapplying={reapplyMutation.isPending}
            />
          )
        )}
      </div>
    </div>
  );
}
