import { Clock, XCircle, MessageCircle } from "lucide-react";
import Button from "@/components/common/Button";
import { buildVerificationWhatsAppLink, VERIFICATION_WHATSAPP_NUMBERS } from "@/utils/whatsapp";

// Button isn't polymorphic (always renders a <button>), so the
// WhatsApp CTAs — which need to be real links for target="_blank" —
// are styled to match Button's outlined look instead of reusing it.
const whatsAppLinkClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-full border-[2.5px] border-ink bg-white px-4 py-3 text-sm font-extrabold text-ink shadow-pop-sm " +
  "transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]";

const formatDisplayNumber = (n) => `+${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`;

function WhatsAppButtons({ role, name, applicationId }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {VERIFICATION_WHATSAPP_NUMBERS.map((_, i) => {
        const waLink = buildVerificationWhatsAppLink({ role, name, applicationId, numberIndex: i });
        return (
          <a key={i} href={waLink} target="_blank" rel="noopener noreferrer" className={whatsAppLinkClass}>
            <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={2.4} /> {formatDisplayNumber(VERIFICATION_WHATSAPP_NUMBERS[i])}
          </a>
        );
      })}
    </div>
  );
}

/**
 * Pending or rejected verification status card, shared by vendor and
 * rider onboarding. `status` is "pending" | "rejected".
 */
export default function VerificationStatusCard({ role, status, name, applicationId, reason, onReapply, reapplying }) {
  if (status === "rejected") {
    return (
      <div className="space-y-5">
        <div className="rounded-[22px] border-[2.5px] border-ink bg-coral p-6 text-center shadow-pop">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border-[2.5px] border-ink bg-white shadow-pop-sm">
            <XCircle className="h-7 w-7 text-ink" strokeWidth={2.2} />
          </span>
          <p className="mt-4 font-display text-xl font-extrabold tracking-tight">Application not approved</p>
          {reason && <p className="mt-2 text-sm font-semibold leading-relaxed">{reason}</p>}
        </div>
        {onReapply && (
          <Button size="xl" loading={reapplying} onClick={onReapply}>
            Resubmit application
          </Button>
        )}
        <div>
          <p className="mb-3 text-sm font-bold">Need help? Verify via WhatsApp:</p>
          <WhatsAppButtons role={role} name={name} applicationId={applicationId} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[22px] border-[2.5px] border-ink bg-sun p-6 text-center shadow-pop">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border-[2.5px] border-ink bg-white shadow-pop-sm">
          <Clock className="h-7 w-7 text-ink" strokeWidth={2.2} />
        </span>
        <p className="mt-4 font-display text-xl font-extrabold tracking-tight">Your {role} application is under review.</p>
        <p className="mt-2 text-sm font-semibold leading-relaxed">We'll notify you as soon as it's approved. Usually within 24 hours.</p>
      </div>
      <div>
        <p className="mb-3 text-sm font-bold">Verify faster via WhatsApp:</p>
        <WhatsAppButtons role={role} name={name} applicationId={applicationId} />
      </div>
    </div>
  );
}
