import { useEffect, useRef, useState } from "react";
import { Package, ImagePlus, X, Copy } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getMyProducts, createProduct, updateProduct, deleteProduct } from "@/api/products";
import { getMyVendorProfile } from "@/api/vendors";
import { getCategories } from "@/api/search";
import { uploadProductImages } from "@/api/uploads";
import { formatNaira } from "@/utils";
import PopHeader from "@/components/common/PopHeader";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Modal from "@/components/common/Modal";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import { Skeleton } from "@/components/common/Loader";
import { v4 as uuidv4 } from "uuid";

const BLANK = { name: "", description: "", price: "", category_id: "", stock_quantity: "", images: [] };

export default function VendorProductsPage() {
  const qc = useQueryClient();
  const { data: categoryData } = useQuery({ queryKey: ["categories"], queryFn: getCategories, staleTime: Infinity });
  const categories = categoryData?.categories || [];
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [imageFiles, setImageFiles] = useState([]);
  const [imageUploading, setImageUploading] = useState(false);
  const createIdempotencyKeyRef = useRef(uuidv4());

  useEffect(() => () => {
    imageFiles.forEach((file) => {
      if (file.preview) URL.revokeObjectURL(file.preview);
    });
  }, [imageFiles]);

  const { data: profileData } = useQuery({ queryKey: ["vendor-profile"], queryFn: getMyVendorProfile });
  const vendorId = profileData?.vendor?.id;

  // Full catalog — including out-of-stock/paused items, which the
  // public search endpoint used here previously would silently hide
  // from the vendor managing their own products.
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["vendor-products", vendorId],
    queryFn: () => getMyProducts(),
    enabled: !!vendorId,
  });

  const products = data?.products || [];

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.price || isNaN(form.price) || Number(form.price) <= 0) e.price = "Enter a valid price";
    if (!form.category_id) e.category_id = "Required";
    if (!form.stock_quantity || isNaN(form.stock_quantity)) e.stock_quantity = "Required";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const copyProductLink = async (productId) => {
    const link = `${window.location.origin}/p/${productId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Product link copied!");
    } catch {
      toast.error("Couldn't copy product link.");
    }
  };

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => { toast.success("Product removed"); qc.invalidateQueries({ queryKey: ["vendor-products"] }); },
    onError: (err) => toast.error(err.message),
  });

  const clearSelectedImages = () => {
    imageFiles.forEach((file) => URL.revokeObjectURL(file.preview));
    setImageFiles([]);
  };

  const openCreate = () => {
    createIdempotencyKeyRef.current = uuidv4();
    setEditing(null);
    setForm(BLANK);
    clearSelectedImages();
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || "", price: String(p.price), category_id: p.category_id || "", stock_quantity: String(p.stock_quantity), images: p.images || [] });
    clearSelectedImages();
    setErrors({});
    setModalOpen(true);
  };

  const handleImageSelection = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const valid = selected.filter((file) => {
      if (!allowed.includes(file.type)) {
        toast.error(`${file.name}: JPG, PNG or WebP only.`);
        return false;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name}: maximum size is 8 MB.`);
        return false;
      }
      return true;
    });

    const remaining = 6 - form.images.length - imageFiles.length;
    if (valid.length > remaining) {
      toast.error(`You can have a maximum of 6 product images.`);
    }

    const files = valid.slice(0, Math.max(0, remaining)).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImageFiles((current) => [...current, ...files]);
    e.target.value = "";
  };

  const removeSelectedImage = (index) => {
    const item = imageFiles[index];
    if (item?.preview) URL.revokeObjectURL(item.preview);
    setImageFiles((current) => current.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index) => {
    setForm((current) => ({
      ...current,
      images: current.images.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!validate()) return;
    setImageUploading(true);
    let createdProductId = null;
    try {
      const saved = await (editing
        ? updateProduct(editing.id, { ...form, price: Number(form.price), stock_quantity: Number(form.stock_quantity) })
        : createProduct({
            ...form,
            price: Number(form.price),
            stock_quantity: Number(form.stock_quantity),
            idempotency_key: createIdempotencyKeyRef.current,
          }));

      const product = saved?.product;
      if (!product?.id) throw new Error("Product was saved but no product ID was returned.");
      if (!editing) createdProductId = product.id;

      if (imageFiles.length) {
        const uploaded = await uploadProductImages(imageFiles.map((item) => item.file));
        const newUrls = uploaded?.urls || [];
        if (!newUrls.length) throw new Error("Images could not be uploaded.");
        await updateProduct(product.id, { ...form, images: [...(form.images || []), ...newUrls], price: Number(form.price), stock_quantity: Number(form.stock_quantity) });
      }

      toast.success(editing ? "Product updated" : "Product created");
      qc.invalidateQueries({ queryKey: ["vendor-products"] });
      setModalOpen(false);
      setEditing(null);
      setForm(BLANK);
      clearSelectedImages();
      createIdempotencyKeyRef.current = uuidv4();
    } catch (err) {
      if (createdProductId) {
        try {
          await deleteProduct(createdProductId);
          // The backend clears the creation key when the product is soft-deleted,
          // so the next attempt can safely use a fresh key.
          createIdempotencyKeyRef.current = uuidv4();
          qc.invalidateQueries({ queryKey: ["vendor-products"] });
        } catch {
          // Keep the same key if cleanup failed. A retry can then resolve to the
          // already-created product instead of inserting another duplicate.
        }
      }
      toast.error(err.message || "Couldn't save product.");
    } finally {
      setImageUploading(false);
    }
  };

  return (
    <div className="min-h-screen pb-8">
      <PopHeader title="Products" subtitle="Manage what customers can order.">
        <Button size="sm" onClick={openCreate} className="bg-white text-ink">
          <Package className="h-4 w-4" /> Add product
        </Button>
      </PopHeader>

      <div className="px-4 py-5 md:px-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-64 rounded-[22px]" />)}
          </div>
        ) : isError ? (
          <ErrorState message={error?.message} onRetry={refetch} />
        ) : products.length === 0 ? (
          <EmptyState icon={Package} title="No products yet" description="Add your first product to start selling" action={openCreate} actionLabel="Add product" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-[22px] border-[2.5px] border-ink bg-white shadow-pop">
                <div className="aspect-[1.15/1] bg-peach flex items-center justify-center border-b-[2.5px] border-ink overflow-hidden">
                  {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-10 w-10 text-ink/40" strokeWidth={1.8} />}
                </div>
                <div className="flex flex-col p-4">
                  <p className="truncate font-display text-base font-extrabold text-ink">{p.name}</p>
                  <p className="mt-1 font-display text-lg font-extrabold text-brand-deep">{formatNaira(p.price)}</p>
                  <span className={`mt-2 inline-flex w-fit items-center rounded-full border-2 border-ink px-2.5 py-1 text-xs font-bold ${p.stock_quantity > 0 ? "bg-lime text-ink" : "bg-coral text-ink"}`}>
                    {p.stock_quantity > 0 ? `${p.stock_quantity} in stock` : "Out of stock"}
                  </span>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t-[2.5px] border-dashed border-peach pt-3">
                    <button onClick={() => openEdit(p)} className="rounded-full border-2 border-ink bg-white px-2 py-2 text-xs font-extrabold text-ink shadow-pop-xs active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">Edit</button>
                    <button onClick={() => copyProductLink(p.id)} className="flex items-center justify-center gap-1 rounded-full border-2 border-ink bg-white px-2 py-2 text-xs font-extrabold text-ink shadow-pop-xs active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"><Copy className="h-3.5 w-3.5" /> Link</button>
                    <button onClick={() => { if (window.confirm("Remove this product?")) deleteMutation.mutate(p.id); }} className="rounded-full border-2 border-ink bg-coral px-2 py-2 text-xs font-extrabold text-ink shadow-pop-xs active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Product" : "New Product"}>
        <div className="space-y-4">
          <Input label="Product name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} />
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink">Category</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              className="w-full rounded-2xl border-[2.5px] border-ink bg-white px-4 py-3.5 text-sm font-semibold text-ink outline-none focus:shadow-pop-sm"
            >
              <option value="">Select a category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
            </select>
            {errors.category_id && <p className="mt-1 text-xs font-bold text-bad">{errors.category_id}</p>}
          </div>
          <Input label="Price (₦)" type="number" min="1" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} error={errors.price} />
          <Input label="Stock quantity" type="number" min="0" value={form.stock_quantity} onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))} error={errors.stock_quantity} />
          <div>
            <label className="mb-1.5 block text-sm font-bold text-ink">Description (optional)</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe your product..." className="w-full resize-none rounded-2xl border-[2.5px] border-ink bg-white px-4 py-3.5 text-sm font-semibold text-ink placeholder:text-slate-soft outline-none focus:shadow-pop-sm" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-ink">Product photos</label>
            <div className="mb-2 grid grid-cols-3 gap-2">
              {(form.images || []).map((url, i) => (
                <div key={url} className="relative aspect-square overflow-hidden rounded-2xl border-2 border-ink bg-peach">
                  <img src={url} alt={`Product ${i + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeExistingImage(i)} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-white shadow-pop-xs" aria-label="Remove image"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {imageFiles.map((item, i) => (
                <div key={item.preview} className="relative aspect-square overflow-hidden rounded-2xl border-2 border-ink bg-peach">
                  <img src={item.preview} alt={`New product ${i + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeSelectedImage(i)} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-white shadow-pop-xs" aria-label="Remove selected image"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            {(form.images?.length || 0) + imageFiles.length < 6 && (
              <label className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-2xl border-[2.5px] border-dashed border-ink bg-peach text-sm font-extrabold text-ink">
                <ImagePlus className="h-5 w-5" /> Add product photos
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleImageSelection} />
              </label>
            )}
            <p className="mt-1.5 text-xs font-semibold text-ink/60">Up to 6 photos. JPG, PNG or WebP, max 8 MB each. Images must be at least 500×500px.</p>
          </div>

          <Button size="xl" onClick={handleSave} loading={imageUploading}>{editing ? "Save Changes" : "Create Product"}</Button>
        </div>
      </Modal>
    </div>
  );
}
