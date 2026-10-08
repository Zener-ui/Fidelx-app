import { useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MapPin, FileText, Download, AlertTriangle, Bike, Store, HelpCircle, CreditCard, Star, Pencil, Phone, KeyRound } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getOrderWithSubOrders, cancelSubOrder } from "@/api/orders";
import { createDispute, getMyDisputes } from "@/api/disputes";
import { formatNaira, formatDateTime, getStatusDisplay } from "@/utils";
import TopBar from "@/components/layout/TopBar";
import Button from "@/components/common/Button";
import Loader from "@/components/common/Loader";
import ErrorState from "@/components/common/ErrorState";
import OrderProgress from "@/components/common/OrderProgress";
import RiderTrackingCard from "./tracking/RiderTrackingCard";
import RatingStars from "@/components/common/RatingStars";
import ReviewForm from "@/components/common/ReviewForm";
import { getReceiptHtml, getReceiptPdf, getReceiptByReference } from "@/api/receipts";
import { uploadDisputeEvidence } from "@/api/uploads";

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [reviewingSubId, setReviewingSubId] = useState(null);

  // The receipt's real receipt_id isn't the same as the order's id —
  // resolve it via reference lookup before the receipt buttons work.
  const { data: receiptRef } = useQuery({
    queryKey: ["receipt-ref", id],
    queryFn: () => getReceiptByReference(id),
    enabled: !!id,
    retry: false,
  });
  const receiptId = receiptRef?.receipt?.receipt_id;

  const handleViewReceipt = async () => {
    if (!receiptId) return;
    const receiptWindow = window.open("about:blank", "_blank");
    try {
      if (!receiptWindow) {
        toast.error("Please allow pop-ups to view your receipt.");
        return;
      }
      const html = await getReceiptHtml(receiptId);
      const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      receiptWindow.location.href = blobUrl;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      receiptWindow?.close();
      toast.error(err.message || "Couldn't open the receipt.");
    }
  };

  const handleDownloadReceipt = async () => {
    if (!receiptId) return;
    try {
      const blob = await getReceiptPdf(receiptId);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `fidelx-receipt-${receiptId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      toast.error(err.message || "Couldn't download the receipt.");
    }
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["order-detail", id],
    queryFn: () => getOrderWithSubOrders(id),
    // React Query v5 hands this callback the query object, not the data.
    refetchInterval: (query) => {
      const inProgress = ["PAYMENT_CONFIRMED","PREPARING","WAITING_RIDER","RIDER_ASSIGNED","PICKED_UP","DELIVERING"].includes(query.state.data?.order?.status);
      return inProgress ? 15000 : false;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelSubOrder,
    onSuccess: () => { toast.success("Sub-order cancelled"); qc.invalidateQueries({ queryKey: ["order-detail", id] }); },
    onError: (err) => toast.error(err.message),
  });

  // Existing disputes for THIS order — fetches all of the customer's
  // disputes and filters client-side since there's no single-order
  // lookup endpoint; fine at this scale (a customer's total dispute
  // count is always small).
  const { data: disputesData } = useQuery({
    queryKey: ["my-disputes"],
    queryFn: getMyDisputes,
  });
  const existingDispute = disputesData?.disputes?.find((d) => d.order_id === id || d.orders?.id === id);

  const [disputeForm, setDisputeForm] = useState({ reason: "" });
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  const disputeMutation = useMutation({
    mutationFn: createDispute,
    onSuccess: () => {
      toast.success("Dispute submitted. An admin will review it.");
    },
    onError: (err) => toast.error(err.message || "Couldn't submit dispute."),
  });

  const handleEvidenceSelection = (e) => {
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
    const remaining = 5 - evidenceFiles.length;
    if (valid.length > remaining) toast.error("You can upload a maximum of 5 evidence photos.");
    setEvidenceFiles((current) => [...current, ...valid.slice(0, Math.max(0, remaining)).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    e.target.value = "";
  };

  const removeEvidenceFile = (index) => {
    setEvidenceFiles((current) => {
      const removed = current[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return current.filter((_, i) => i !== index);
    });
  };

  const disputeSubmitLock = useRef(false);

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    // Lock immediately, before evidence upload, so rapid taps cannot start
    // multiple uploads/submissions before the mutation reaches the API.
    if (disputeSubmitLock.current || disputeMutation.isPending) return;
    if (!disputeForm.reason.trim()) return toast.error("Please describe the problem.");
    if (!evidenceFiles.length) return toast.error("At least one evidence photo is required.");

    disputeSubmitLock.current = true;

    try {
      const uploaded = await uploadDisputeEvidence(evidenceFiles.map((item) => item.file));
      const paths = uploaded?.paths || [];
      if (!paths.length) throw new Error("Evidence upload failed.");

      await disputeMutation.mutateAsync({
        order_id: id,
        reason: disputeForm.reason.trim(),
        evidence_urls: paths,
      });

      setShowDisputeForm(false);
      setDisputeForm({ reason: "" });
      evidenceFiles.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
      setEvidenceFiles([]);
      qc.invalidateQueries({ queryKey: ["my-disputes"] });
    } catch (err) {
      toast.error(err.message || "Couldn't submit dispute.");
    } finally {
      disputeSubmitLock.current = false;
    }
  };

  if (isLoading) return <Loader fullscreen text="Loading order..." />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const order = data?.order;
  const orderStatusDisplay = getStatusDisplay(order?.status);
  const paymentStatusDisplay = {
    successful: { label: "Paid", color: "text-teal" },
    pending:    { label: "Payment Pending", color: "text-yellow-400" },
    failed:     { label: "Payment Failed", color: "text-red-400" },
    refunded:   { label: "Refunded", color: "text-slate-muted" },
  }[order?.payment_status] || { label: order?.payment_status, color: "text-slate-muted" };

  return (
    <div className="min-h-screen pb-8">
      <TopBar title="Order Details" showBack />
      <div className="space-y-5 px-4 py-4 md:grid md:grid-cols-3 md:items-start md:gap-6 md:space-y-0 md:px-8">
        <div className="space-y-5 md:col-span-2">
          {/* Order header */}
          <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-xl font-extrabold tracking-tight">Order #{order?.id.slice(0, 8).toUpperCase()}</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-muted">{formatDateTime(order?.created_at)}</p>
              </div>
              <span className="inline-flex flex-none items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-1 text-xs font-bold text-ink">
                <span className={`h-2 w-2 rounded-full bg-current ${orderStatusDisplay.color}`} />
                {orderStatusDisplay.label}
              </span>
            </div>
            <div className="mt-3.5 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-navy-mid px-3 py-1 text-xs font-bold text-ink">
              <CreditCard className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span className={`h-2 w-2 rounded-full bg-current ${paymentStatusDisplay.color}`} />
              <span>{paymentStatusDisplay.label}</span>
            </div>
          </div>

          {/* Sub-orders with progress tracker */}
          {order?.sub_orders?.map((sub) => {
            const subStatus = getStatusDisplay(sub.status);
            // Matches the backend's actual cancellation rule (see
            // orderStateMachine.js / subOrderController.cancelSubOrder):
            // cancellable only before the vendor starts preparing.
            // Showing this button for a later status would just produce
            // a failed request — better not to offer what won't work.
            const cancellable = sub.status === "PAYMENT_CONFIRMED";
            const rider = sub.riders?.users;
            return (
              <div key={sub.id} className="space-y-4 rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop">
                <div className="flex items-center justify-between gap-3">
                  <Link to={`/customer/store/${sub.vendor_id}`} className="flex min-w-0 items-center gap-2 font-display text-lg font-extrabold tracking-tight underline decoration-2 underline-offset-4">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-full border-2 border-ink bg-peach">
                      <Store className="h-4 w-4 text-ink" strokeWidth={2.2} />
                    </span>
                    <span className="truncate">{sub.vendors?.business_name}</span>
                  </Link>
                  <span className="flex-none rounded-full border-2 border-ink bg-peach px-2.5 py-0.5 text-xs font-bold capitalize">{sub.delivery_type}</span>
                </div>

                <OrderProgress status={sub.status} deliveryType={sub.delivery_type} statusDisplay={subStatus} />

                {/* Live rider tracking: only while a delivery is in the rider phase. Read-only. */}
                {sub.delivery_type === "delivery" && ["RIDER_ASSIGNED", "PICKED_UP", "DELIVERING"].includes(sub.status) && (
                  <RiderTrackingCard subOrderId={sub.id} />
                )}

                <div>
                  {sub.items?.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3 border-b-2 border-dashed border-peach py-2 text-sm last:border-0">
                      <span className="font-semibold text-slate-muted">
                        {item.products?.name}
                        {item.product_variants && <span className="text-slate-soft"> ({item.product_variants.value})</span>}
                        {" × "}{item.quantity}
                      </span>
                      <span className="flex-shrink-0 font-extrabold">{formatNaira(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                {/* Delivery info */}
                {sub.delivery_type === "delivery" && sub.delivery_address && (
                  <p className="flex items-start gap-1.5 text-xs font-semibold text-slate-muted"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" strokeWidth={2.2} /> {sub.delivery_address}</p>
                )}

                {/* Rider info — only relevant once one's assigned to a delivery order */}
                {sub.delivery_type === "delivery" && rider && (
                  <div className="space-y-3 rounded-2xl border-2 border-ink bg-navy-mid p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-white">
                        <Bike className="h-5 w-5 text-ink" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">{rider.full_name}</p>
                        {rider.phone ? (
                          <a href={`tel:${rider.phone}`} className="inline-flex items-center gap-1 text-xs font-bold underline decoration-2 underline-offset-2">
                            <Phone className="h-3 w-3" strokeWidth={2.4} /> {rider.phone}
                          </a>
                        ) : (
                          <p className="text-xs font-semibold text-slate-muted">{rider.phone}</p>
                        )}
                      </div>
                    </div>
                    {sub.delivery_code && sub.status !== "DELIVERED" && sub.status !== "CANCELLED" && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border-[2.5px] border-ink bg-sun px-3.5 py-3 shadow-pop-xs">
                        <p className="flex items-center gap-1.5 text-xs font-bold">
                          <KeyRound className="h-4 w-4 flex-none" strokeWidth={2.2} /> Give this code to your rider on delivery
                        </p>
                        <p className="font-display text-2xl font-extrabold tracking-[0.25em]">{sub.delivery_code}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Pickup info — vendor location/contact, for self-pickup orders */}
                {sub.delivery_type === "pickup" && (
                  <div className="space-y-1.5 rounded-2xl border-2 border-ink bg-navy-mid p-3.5">
                    <p className="text-sm font-extrabold">
                      Pickup from <Link to={`/customer/store/${sub.vendor_id}`} className="underline decoration-2 underline-offset-2">{sub.vendors?.business_name}</Link>
                    </p>
                    {sub.vendors?.address && <p className="flex items-start gap-1.5 text-xs font-semibold text-slate-muted"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" strokeWidth={2.2} /> {sub.vendors.address}</p>}
                    {sub.vendors?.phone && <p className="text-xs font-semibold text-slate-muted">{sub.vendors.phone}</p>}
                  </div>
                )}

                {cancellable && (
                  <Button variant="danger" size="sm" onClick={() => cancelMutation.mutate(sub.id)} loading={cancelMutation.isPending}>
                    Cancel this item
                  </Button>
                )}

                {/* Rate & review — only once this store's part of the order
                    has actually been delivered; one review per sub-order,
                    enforced server-side too. */}
                {sub.status === "DELIVERED" && (() => {
                  const existingReview = Array.isArray(sub.reviews) ? sub.reviews[0] : sub.reviews;
                  if (reviewingSubId === sub.id) {
                    return (
                      <ReviewForm
                        subOrderId={sub.id}
                        hasRider={!!rider}
                        vendorName={sub.vendors?.business_name}
                        existingReview={existingReview}
                        onDone={() => setReviewingSubId(null)}
                      />
                    );
                  }
                  if (existingReview) {
                    return (
                      <div className="flex items-start justify-between gap-2 rounded-2xl border-2 border-ink bg-navy-mid p-3.5">
                        <div>
                          <p className="mb-1 text-xs font-bold text-slate-muted">Your review</p>
                          <RatingStars rating={existingReview.vendor_rating} size="xs" />
                          {existingReview.comment && <p className="mt-1 text-xs font-medium text-slate-muted">{existingReview.comment}</p>}
                          {existingReview.photo_urls?.length > 0 && (
                            <div className="mt-2 flex gap-1.5">
                              {existingReview.photo_urls.map((url, i) => (
                                <img key={url} src={url} alt={`Your review photo ${i + 1}`} className="h-10 w-10 rounded-lg border-2 border-ink object-cover" />
                              ))}
                            </div>
                          )}
                        </div>
                        <button onClick={() => setReviewingSubId(sub.id)} className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-extrabold shadow-pop-xs transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                          <Pencil className="h-3 w-3" strokeWidth={2.4} /> Edit
                        </button>
                      </div>
                    );
                  }
                  return (
                    <Button variant="secondary" size="sm" onClick={() => setReviewingSubId(sub.id)}>
                      <Star className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={2.4} />Rate &amp; Review
                    </Button>
                  );
                })()}
              </div>
            );
          })}
        </div>

        <div className="space-y-5 md:sticky md:top-20">
          {/* Price summary */}
          <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop">
            <p className="mb-2 font-display text-lg font-extrabold tracking-tight">Summary</p>
            <div className="flex justify-between py-1 text-sm font-semibold"><span className="text-slate-muted">Subtotal</span><span>{formatNaira(order?.subtotal)}</span></div>
            {order?.delivery_fee > 0 && (
              <div className="flex justify-between py-1 text-sm font-semibold"><span className="text-slate-muted">Delivery</span><span>{formatNaira(order?.delivery_fee)}</span></div>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t-[2.5px] border-ink pt-3">
              <span className="font-display text-lg font-extrabold tracking-tight">Total paid</span>
              <span className="font-display text-[1.35rem] font-extrabold tracking-tight">{formatNaira(order?.total)}</span>
            </div>
          </div>

          {/* Receipt buttons */}
          {order?.status === "DELIVERED" && receiptId && (
            <div className="flex gap-3">
              <Button variant="secondary" size="lg" className="flex-1"
                onClick={handleViewReceipt}>
                <FileText className="mr-1.5 inline h-4 w-4" strokeWidth={2.4} />View Receipt
              </Button>
              <Button variant="secondary" size="lg" className="flex-1"
                onClick={handleDownloadReceipt}>
                <Download className="mr-1.5 inline h-4 w-4" strokeWidth={2.4} />PDF
              </Button>
            </div>
          )}

          {/* Support contact — available regardless of order status */}
          <Button variant="secondary" size="lg" onClick={() => navigate("/customer/support")}>
            <HelpCircle className="mr-1.5 inline h-4 w-4" strokeWidth={2.4} />Contact Support
          </Button>

          {/* Report a problem / dispute */}
          {order?.status === "DELIVERED" && (
            <div className="space-y-3.5 rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop">
              {existingDispute ? (
                <>
                  <p className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
                    <AlertTriangle className="h-5 w-5 text-ink" strokeWidth={2.2} /> Dispute filed
                  </p>
                  <p className="text-xs font-semibold text-slate-muted">
                    Status: <span className="font-extrabold text-ink">{existingDispute.status}</span>
                  </p>
                  {existingDispute.resolution_note && (
                    <p className="text-xs font-medium text-slate-muted">{existingDispute.resolution_note}</p>
                  )}
                </>
              ) : showDisputeForm ? (
                <form onSubmit={handleDisputeSubmit} className="space-y-4">
                  <p className="font-display text-lg font-extrabold tracking-tight">Report a problem</p>
                  <textarea
                    rows={3}
                    placeholder="What went wrong with this order?"
                    value={disputeForm.reason}
                    onChange={(e) => setDisputeForm((f) => ({ ...f, reason: e.target.value }))}
                    className="w-full resize-none rounded-2xl border-[2.5px] border-ink bg-white px-3.5 py-3 text-sm font-semibold text-ink shadow-pop-sm outline-none transition-all duration-150 placeholder:text-slate-soft focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-pop"
                  />
                  <div>
                    <label className="mb-1.5 block text-sm font-bold">Evidence photos</label>
                    <div className="mb-2 grid grid-cols-3 gap-2">
                      {evidenceFiles.map((file, i) => (
                        <div key={`${file.name}-${i}`} className="relative aspect-square overflow-hidden rounded-xl border-2 border-ink bg-peach">
                          <img src={file.preview} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover" />
                          <button type="button" onClick={() => removeEvidenceFile(i)}
                            className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-ink text-white" aria-label="Remove evidence">
                            <span className="text-xs leading-none">×</span>
                          </button>
                        </div>
                      ))}
                    </div>
                    {evidenceFiles.length < 5 && (
                      <label className="flex h-20 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-ink bg-white px-3 text-center text-sm font-bold">
                        Add photos of the damaged/incorrect product
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleEvidenceSelection} />
                      </label>
                    )}
                    <p className="mt-1.5 text-xs font-medium text-slate-muted">
                      Up to 5 photos. JPG, PNG or WebP, max 8 MB each. Images must be at least 500×500px.
                    </p>
                  </div>
                  <p className="text-xs font-medium text-slate-muted">
                    Disputes must be filed within 24 hours of delivery. At least one photo is required as evidence.
                  </p>
                  <div className="flex gap-3">
                    <Button type="submit" size="md" className="flex-1" loading={disputeMutation.isPending}>
                      Submit dispute
                    </Button>
                    <Button type="button" variant="secondary" size="md" onClick={() => setShowDisputeForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button variant="secondary" size="md" onClick={() => setShowDisputeForm(true)}>
                  <AlertTriangle className="mr-1.5 inline h-4 w-4" strokeWidth={2.4} />Report a Problem
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
