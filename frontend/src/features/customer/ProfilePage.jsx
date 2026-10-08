import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, Package, Receipt, MessageCircle, Gift, ArrowRight, WalletCards } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/authStore";
import { getNotificationPrefs, updateNotificationPrefs } from "@/api/preferences";
import { updateProfile } from "@/api/auth";
import PopHeader from "@/components/common/PopHeader";
import Button from "@/components/common/Button";
import Card from "@/components/common/Card";
import { Skeleton } from "@/components/common/Loader";
import ErrorState from "@/components/common/ErrorState";
import Input from "@/components/common/Input";

const ROW_TINTS = ["bg-sun", "bg-lime", "bg-coral", "bg-lilac", "bg-mint"];

const PREF_LABELS = [
  { key: "email_order_updates",    label: "Order updates (email)" },
  { key: "email_payment_updates",  label: "Payment updates (email)" },
  { key: "push_order_updates",     label: "Order updates (push)" },
  { key: "push_delivery_updates",  label: "Delivery tracking (push)" },
  { key: "email_marketing",        label: "Promotions (email)" },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, setUser } = useAuthStore();
  const qc = useQueryClient();
  const [phone, setPhone] = useState(user?.phone || "");
  const [fullName, setFullName] = useState(user?.full_name || "");

  const { data: prefData, isLoading: prefsLoading, isError: prefsError, refetch: refetchPrefs } =
    useQuery({ queryKey: ["notif-prefs"], queryFn: getNotificationPrefs });
  const prefs = prefData?.preferences || {};

  const prefMutation = useMutation({
    mutationFn: updateNotificationPrefs,
    onSuccess: () => { toast.success("Preferences saved"); qc.invalidateQueries({ queryKey: ["notif-prefs"] }); },
    onError: (err) => toast.error(err.message),
  });

  const togglePref = (key) => {
    prefMutation.mutate({ [key]: !prefs[key] });
  };

  const profileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      setUser(data.user);
      setPhone(data.user?.phone || "");
      setFullName(data.user?.full_name || "");
      toast.success("Profile updated");
    },
    onError: (err) => toast.error(err.message || "Couldn't update your profile."),
  });

  const saveProfile = () => {
    profileMutation.mutate({ full_name: fullName, phone });
  };

  const handleLogout = () => { logout(); navigate("/login", { replace: true }); };

  return (
    <div className="min-h-screen animate-fade-in pb-8">
      <PopHeader title="Profile" />
      <div className="space-y-5 px-5 pt-7">
        {/* User card */}
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 flex-none place-items-center rounded-full border-[2.5px] border-ink bg-sun">
              <User className="h-8 w-8 text-ink" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-extrabold tracking-tight">{user?.full_name}</p>
              <p className="truncate text-sm font-semibold text-slate-muted">{user?.email}</p>
              <p className="mt-1.5 inline-block rounded-full border-2 border-ink bg-peach px-2.5 py-0.5 text-xs font-bold capitalize">{user?.role}</p>
            </div>
          </div>
        </Card>

        {/* Account details */}
        <Card className="p-4">
          <div className="mb-3.5">
            <h3 className="font-display text-lg font-extrabold tracking-tight">Account details</h3>
            <p className="mt-1 text-sm font-semibold text-slate-muted">Keep your phone number up to date. Fidelx uses it for account and wallet services.</p>
          </div>
          <div className="space-y-3.5">
            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            <Input label="Phone number" type="tel" inputMode="tel" placeholder="08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            <Button className="w-full" loading={profileMutation.isPending} onClick={saveProfile} disabled={!fullName.trim() || !phone.trim()}>
              Save account details
            </Button>
          </div>
        </Card>

        {/* Quick actions */}
        <div className="space-y-3.5">
          {[
            { icon: Lock, label: "Change Password",  onClick: () => navigate("/change-password") },
            { icon: Package, label: "My Orders",         onClick: () => navigate("/customer/orders") },
            { icon: WalletCards, label: "Fidelx Wallet",     onClick: () => navigate("/customer/wallet") },
            { icon: Receipt, label: "Receipts",          onClick: () => navigate("/customer/receipts") },
            { icon: Gift, label: "Refer Friends",        onClick: () => navigate("/customer/refer") },
            { icon: MessageCircle, label: "Support",           onClick: () => navigate("/customer/support") },
          ].map(({ icon: Icon, label, onClick }, i) => (
            <button key={label} onClick={onClick}
              className="w-full flex items-center gap-3 rounded-[20px] border-[2.5px] border-ink bg-white p-4 text-left shadow-pop-sm transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]">
              <span className={`grid h-10 w-10 flex-none place-items-center rounded-full border-2 border-ink ${ROW_TINTS[i % ROW_TINTS.length]}`}>
                <Icon className="h-5 w-5 text-ink" strokeWidth={2.2} />
              </span>
              <span className="flex-1 text-sm font-extrabold">{label}</span>
              <ArrowRight className="h-4 w-4 flex-none" strokeWidth={2.4} />
            </button>
          ))}
        </div>

        {/* Notification preferences */}
        <Card className="p-4">
          <h3 className="mb-3.5 font-display text-lg font-extrabold tracking-tight">Notification Preferences</h3>
          {prefsLoading ? (
            <div className="space-y-3.5">
              {PREF_LABELS.map(({ key }) => (
                <div key={key} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-7 w-12 rounded-full" />
                </div>
              ))}
            </div>
          ) : prefsError ? (
            <ErrorState message="Couldn't load your notification preferences." onRetry={refetchPrefs} />
          ) : (
            <div className="space-y-3.5">
              {PREF_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-muted">{label}</span>
                  <button onClick={() => togglePref(key)}
                    role="switch" aria-checked={!!prefs[key]} aria-label={label}
                    className={`relative h-7 w-12 flex-none rounded-full border-[2.5px] border-ink transition-colors ${prefs[key] ? "bg-brand" : "bg-white"}`}>
                    <span className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-ink bg-ink transition-all ${prefs[key] ? "right-1" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Link to="/terms" className="block py-2 text-center text-sm font-extrabold underline decoration-2 underline-offset-4">
          Terms &amp; Conditions
        </Link>

        <Button variant="danger" size="lg" className="w-full" onClick={handleLogout}>
          Log Out
        </Button>
      </div>
    </div>
  );
}
