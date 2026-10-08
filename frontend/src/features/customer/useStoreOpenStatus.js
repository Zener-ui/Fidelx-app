import { useQuery } from "@tanstack/react-query";
import { getVendor } from "@/api/vendors";

const BLOCKED = ["CLOSED", "TEMPORARILY_UNAVAILABLE"];

/**
 * Is the store in the cart taking orders right now? Read-only, for a friendly message
 * and a disabled button. The server independently refuses orders to a closed store
 * (manual Closed / Temporarily unavailable, or outside the vendor's opening hours),
 * so this is never the only line of defence.
 *
 * Uses the same query key as the Store page (["store", id]); re-checks every minute so a
 * cart left open notices when the store closes.
 */
export function useStoreOpenStatus(vendorId, vendorName) {
  const { data } = useQuery({
    queryKey: ["store", vendorId],
    queryFn: () => getVendor(vendorId),
    enabled: !!vendorId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const vendor = data?.vendor;
  const blocked = !!vendor && BLOCKED.includes(vendor.availability_status);
  const name = vendorName || vendor?.business_name || "This store";

  let message = "";
  if (blocked) {
    message = vendor.closed_by_hours
      ? `${name} is closed right now.${vendor.next_open_label ? ` ${vendor.next_open_label}.` : ""}`
      : `${name} isn't taking orders right now.`;
  }
  return { blocked, message };
}
