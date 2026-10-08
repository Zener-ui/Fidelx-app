import { Gift, Share2, Users, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/authStore";
import { getMyReferralStats } from "@/api/referrals";
import TopBar from "@/components/layout/TopBar";
import Card from "@/components/common/Card";
import { Skeleton } from "@/components/common/Loader";

export default function ReferFriendsPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({ queryKey: ["my-referral-stats"], queryFn: getMyReferralStats });

  const referralLink = user?.id ? `${window.location.origin}/register?ref=${user.id}` : "";

  const handleShare = async () => {
    const shareText = "Come shop on Fidelx with me — fast local delivery, real vendors near you. Sign up with my link:";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on Fidelx", text: shareText, url: referralLink });
        return;
      } catch {
        // Cancelled the native share sheet — clipboard fallback below still works.
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${referralLink}`);
      toast.success("Link copied!");
    } catch {
      toast.error("Couldn't copy the link — try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <TopBar showBack title="Refer Friends" />
        <div className="space-y-5 px-4 py-5">
          <Skeleton className="h-44 rounded-[22px]" />
          <Skeleton className="h-28 rounded-[22px]" />
        </div>
      </div>
    );
  }

  const remaining = data ? data.threshold - data.progress_toward_next : 0;
  const progressPct = data ? (data.progress_toward_next / data.threshold) * 100 : 0;

  return (
    <div className="min-h-screen">
      <TopBar showBack title="Refer Friends" />
      <div className="mx-auto max-w-md space-y-5 px-4 py-5">
        <div className="rounded-[22px] border-[2.5px] border-ink bg-sun p-5 text-center shadow-pop">
          <span className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full border-[2.5px] border-ink bg-white shadow-pop-sm">
            <Gift className="h-8 w-8 text-ink" strokeWidth={2} />
          </span>
          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight">Bring your friends, get rewarded</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed">
            Share your link below. Once your friends join and place their first order, they count toward your reward — the more you bring in, the more you earn.
          </p>
        </div>

        {!data?.rewards_enabled && (
          <div className="rounded-[22px] border-[2.5px] border-ink bg-coral p-4 shadow-pop-sm">
            <p className="text-sm font-extrabold">Rewards are paused right now</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed">
              You can still share your link and bring friends in — we're just not sending new rewards at the moment. Nothing you've already earned is affected.
            </p>
          </div>
        )}

        <Card className="p-4">
          <p className="mb-2 text-xs font-bold text-slate-muted">Your referral link</p>
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1 rounded-2xl border-2 border-ink bg-navy-mid px-3.5 py-2.5">
              <p className="truncate text-xs font-semibold text-ink">{referralLink}</p>
            </div>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border-[2.5px] border-ink bg-brand px-4 py-2.5 text-sm font-extrabold text-ink shadow-pop-sm transition-all duration-150 active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]"
            >
              <Share2 className="h-4 w-4" strokeWidth={2.4} />
              Share
            </button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-peach">
                <Users className="h-4 w-4 text-ink" strokeWidth={2.2} />
              </span>
              <p className="font-display text-lg font-extrabold tracking-tight">Your progress</p>
            </div>
            <p className="rounded-full border-2 border-ink bg-peach px-2.5 py-0.5 text-xs font-extrabold">{data?.total_credited || 0} referred</p>
          </div>

          {data?.rewards_enabled && (
            <>
              <div className="h-4 w-full overflow-hidden rounded-full border-[2.5px] border-ink bg-white">
                <div className="h-full rounded-r-full bg-brand transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-2.5 text-xs font-bold text-slate-muted">
                {remaining} more {remaining === 1 ? "friend" : "friends"} until your next reward
              </p>
            </>
          )}

          {data?.total_pending > 0 && (
            <p className="mt-3.5 flex items-start gap-1.5 text-xs font-semibold text-slate-muted">
              <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ink" strokeWidth={2.2} />
              {data.total_pending} more {data.total_pending === 1 ? "friend has" : "friends have"} joined through your link and are yet to place their first order
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
