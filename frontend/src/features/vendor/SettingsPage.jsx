import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Camera, Store } from "lucide-react";
import { getMyVendorProfile, updateVendorProfile } from "@/api/vendors";
import { getCategories } from "@/api/search";
import { uploadVendorLogo } from "@/api/uploads";
import { useAuthStore } from "@/store/authStore";
import PopHeader from "@/components/common/PopHeader";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import GpsLocationCapture from "@/components/common/GpsLocationCapture";
import ChangePinSection from "@/components/common/ChangePinSection";
import OpeningHoursCard from "./OpeningHoursCard";
import { Skeleton } from "@/components/common/Loader";

export default function VendorSettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { data, isLoading } = useQuery({ queryKey: ["vendor-profile"], queryFn: getMyVendorProfile });
  const { data: categoryData } = useQuery({ queryKey: ["vendor-categories"], queryFn: getCategories, staleTime: Infinity });
  const [form, setForm] = useState(null);

  if (!isLoading && data?.vendor && !form) {
    const v = data.vendor;
    setForm({
      business_name: v.business_name, category: v.category, location: v.location,
      address: v.address, phone: v.phone, whatsapp: v.whatsapp || "", description: v.description || "",
      location_lat: v.location_lat, location_lng: v.location_lng,
      delivery_radius_km: v.delivery_radius_km ?? "",
    });
  }

  const mutation = useMutation({
    mutationFn: updateVendorProfile,
    onSuccess: () => { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["vendor-profile"] }); },
    onError: (err) => toast.error(err.message),
  });

  const logoMutation = useMutation({
    mutationFn: uploadVendorLogo,
    onSuccess: () => { toast.success("Store photo updated"); qc.invalidateQueries({ queryKey: ["vendor-profile"] }); },
    onError: (err) => toast.error(err.message),
  });

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPEG, PNG, or WebP image.");
      return;
    }
    logoMutation.mutate(file);
  };

  const handleLogout = () => { logout(); navigate("/login", { replace: true }); };

  return (
    <div className="min-h-screen pb-8">
      <PopHeader title="Store settings" subtitle="Keep your storefront, location and security details up to date." />
      <div className="space-y-5 px-4 py-5">
        {!isLoading && data?.vendor && (
          <div className="flex flex-col items-center rounded-[22px] border-[2.5px] border-ink bg-sun p-5 shadow-pop">
            <div className="relative">
              <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-[28px] border-[2.5px] border-ink bg-white shadow-pop-sm">
                {logoMutation.isPending ? (
                  <Skeleton className="h-full w-full" />
                ) : data.vendor.logo_url ? (
                  <img src={data.vendor.logo_url} alt="Store" className="h-full w-full object-cover" />
                ) : (
                  <Store className="h-12 w-12 text-ink/50" strokeWidth={1.5} />
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 grid h-10 w-10 cursor-pointer place-items-center rounded-full border-[2.5px] border-ink bg-brand shadow-pop-xs">
                <Camera className="h-5 w-5 text-ink" strokeWidth={2.5} />
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoSelect} />
              </label>
            </div>
            <p className="mt-3 text-center text-xs font-bold text-ink/65">Tap the camera to change your store photo</p>
          </div>
        )}

        {isLoading || !form ? (
          Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-[22px]" />)
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="space-y-4">
            <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop-sm space-y-4">
              <h2 className="font-display text-xl font-extrabold text-ink">Business details</h2>
              <Input label="Business name" value={form.business_name} onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))} />
              <div>
                <label htmlFor="settings-category" className="mb-1.5 block text-sm font-bold text-ink">Category</label>
                <select id="settings-category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-2xl border-[2.5px] border-ink bg-white px-4 py-3.5 text-sm font-semibold text-ink outline-none focus:shadow-pop-sm">
                  <option value="">Select a category</option>
                  {categoryData?.categories?.map((cat) => <option key={cat.id} value={cat.slug}>{cat.name}</option>)}
                </select>
              </div>
              <Input label="Location / area" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              <div>
                <GpsLocationCapture buttonLabel="Set shop location" onChange={({ lat, lng, description }) => setForm((f) => ({ ...f, address: description || f.address, location_lat: lat, location_lng: lng }))} />
                {!form.location_lat && <p className="mt-2 rounded-full border-2 border-ink bg-sun px-3 py-2 text-xs font-bold text-ink">Your store location isn't set yet — customers won't be able to get accurate delivery pricing until you set it.</p>}
              </div>
              <Input label="Phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <Input label="WhatsApp" type="tel" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} />
              <div>
                <label htmlFor="settings-radius" className="mb-1.5 block text-sm font-bold text-ink">Delivery radius (km)</label>
                <input id="settings-radius" type="number" min="1" step="1" placeholder="Platform default (30km)" value={form.delivery_radius_km} onChange={(e) => setForm((f) => ({ ...f, delivery_radius_km: e.target.value }))} className="w-full rounded-2xl border-[2.5px] border-ink bg-white px-4 py-3.5 text-sm font-semibold text-ink outline-none focus:shadow-pop-sm" />
                <p className="mt-1 text-xs font-semibold text-ink/60">Leave blank to use the platform default. You can set a smaller radius if you can't cover the full distance — you can't set it larger than the platform allows.</p>
              </div>
              <div>
                <label htmlFor="settings-description" className="mb-1.5 block text-sm font-bold text-ink">Store description</label>
                <textarea id="settings-description" rows={3} placeholder="Tell customers what your store is about — shown on your store page." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full resize-none rounded-2xl border-[2.5px] border-ink bg-white px-4 py-3.5 text-sm font-semibold text-ink placeholder:text-ink/45 outline-none focus:shadow-pop-sm" />
              </div>
              <Button type="submit" size="xl" loading={mutation.isPending}>Save changes</Button>
            </div>
          </form>
        )}

        {!isLoading && data?.vendor && <OpeningHoursCard vendor={data.vendor} />}
        <ChangePinSection />

        <Link to="/terms" className="block rounded-full border-2 border-ink bg-white px-4 py-3 text-center text-sm font-extrabold text-ink shadow-pop-xs">
          Terms &amp; Conditions
        </Link>

        <Button variant="danger" size="lg" className="w-full" onClick={handleLogout}>Log out</Button>
      </div>
    </div>
  );
}
