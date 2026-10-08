import { ScrollText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPolicyByType } from "@/api/policies";
import TopBar from "@/components/layout/TopBar";
import Loader from "@/components/common/Loader";
import ErrorState from "@/components/common/ErrorState";

// Public, standalone Terms & Conditions page — reachable without
// being logged in, unlike the vendor/rider onboarding acceptance
// step, which is the same content but embedded in a signup flow.
export default function TermsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["policy", "terms_of_service"],
    queryFn: () => getPolicyByType("terms_of_service"),
  });

  if (isLoading) return <Loader fullscreen />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const policy = data?.policy;

  return (
    <div className="animate-fade-in">
      <div className="-mx-5 -mt-6 mb-6">
        <TopBar title="Terms & Conditions" showBack />
      </div>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full border-[2.5px] border-ink bg-peach">
          <ScrollText className="h-5 w-5 text-ink" strokeWidth={2.2} />
        </span>
        <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight">{policy?.title || "Terms & Conditions"}</h1>
      </div>
      <div className="whitespace-pre-wrap rounded-[22px] border-[2.5px] border-ink bg-white p-4 text-sm font-medium leading-relaxed text-slate-muted shadow-pop-sm">
        {policy?.content}
      </div>
      {policy?.version && (
        <p className="mt-5 inline-block rounded-full border-2 border-ink bg-peach px-3 py-1 text-xs font-bold">Version {policy.version}</p>
      )}
    </div>
  );
}
