import { useEffect } from "react";
import { XCircle, CheckCircle2 } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { verifyPayment } from "@/api/payments";
import Loader from "@/components/common/Loader";
import Button from "@/components/common/Button";

// Visual-only. This route sits outside the app shell, so it carries its own theme scope.
const SHELL = "flex min-h-screen items-center justify-center bg-navy p-6";
const CARD = "w-full max-w-sm rounded-[22px] border-[2.5px] border-ink bg-white p-6 text-center shadow-pop animate-fade-in";

export default function PaymentVerifyPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get("reference");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["verify-payment", reference],
    queryFn: () => verifyPayment(reference),
    enabled: !!reference,
    retry: 2,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data?.success) {
      const timer = setTimeout(() => {
        navigate(`/customer/orders/${data.order_id}`, { replace: true });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (!reference) {
    return (
      <div data-theme="pop" className={SHELL}>
        <div className={CARD}>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-[2.5px] border-ink bg-coral shadow-pop-sm">
            <XCircle className="h-8 w-8 text-ink" strokeWidth={2.2} />
          </span>
          <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight">Invalid payment link</h2>
          <p className="mt-2 text-sm font-semibold text-slate-muted">No payment reference found.</p>
          <Button className="mt-6" onClick={() => navigate("/customer/home")}>Go Home</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div data-theme="pop"><Loader fullscreen text="Verifying your payment..." /></div>;
  }

  if (isError || !data?.success) {
    return (
      <div data-theme="pop" className={SHELL}>
        <div className={CARD}>
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border-[2.5px] border-ink bg-coral shadow-pop-sm">
            <XCircle className="h-8 w-8 text-ink" strokeWidth={2.2} />
          </span>
          <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight">Payment failed</h2>
          <p className="mt-2 text-sm font-semibold text-slate-muted">{error?.message || "Payment was not completed. No money was charged."}</p>
          <Button className="mt-6" onClick={() => navigate("/customer/cart")}>Back to Cart</Button>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="pop" className={SHELL}>
      <div className={CARD}>
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border-[2.5px] border-ink bg-leaf shadow-pop-sm">
          <CheckCircle2 className="h-11 w-11 text-white" strokeWidth={2} />
        </span>
        <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight">Payment successful!</h2>
        <p className="mt-2 text-sm font-semibold text-slate-muted">Your order has been confirmed. Redirecting to order details...</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-sun px-3.5 py-1.5 text-sm font-bold">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
          <span>Redirecting...</span>
        </div>
        <div>
          <Button className="mt-4" variant="secondary" size="md" onClick={() => navigate(`/customer/orders/${data.order_id}`)}>
            View Order Now
          </Button>
        </div>
      </div>
    </div>
  );
}
