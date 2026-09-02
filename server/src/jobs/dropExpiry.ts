import { NotificationType, SwapStatus, SwapType } from "@shiftsync/shared";
import { SwapRequestModel } from "../models/SwapRequest";
import { createNotification } from "../modules/notifications/service";
import { toSwapRequestDTO } from "../modules/swaps/mapper";
import { emitSwapResolved } from "../sockets/emitters";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Correctness never depends on this firing — every drop-list read calls it
 * synchronously first. This interval only improves UX promptness between reads
 * and is not guaranteed on hosts without a persistent background worker.
 *
 * Only PendingClaim drops expire here — the 24h-before-shift deadline applies to
 * unclaimed drops. A drop already claimed and awaiting manager approval must not
 * be auto-expired out from under the manager mid-review; approveSwap/denySwap are
 * the only paths that can resolve it once claimed.
 */
export async function sweepExpiredDrops(): Promise<number> {
  const expired = await SwapRequestModel.find({
    type: SwapType.Drop,
    status: SwapStatus.PendingClaim,
    expiresAt: { $lte: new Date() },
  });

  if (expired.length === 0) return 0;

  await SwapRequestModel.updateMany(
    { _id: { $in: expired.map((s) => s._id) } },
    { $set: { status: SwapStatus.Expired } }
  );

  for (const swap of expired) {
    swap.status = SwapStatus.Expired;
    emitSwapResolved([swap.requestedBy.toString()], {
      swapRequest: toSwapRequestDTO(swap),
      resolution: "expired",
    });
    await createNotification({
      userId: swap.requestedBy.toString(),
      type: NotificationType.SwapResolved,
      title: "Drop request expired",
      body: "Your dropped shift went unclaimed and the drop request has expired.",
      relatedEntityType: "swap_request",
      relatedEntityId: swap.id.toString(),
    });
  }

  return expired.length;
}

export function startDropExpiryJob(): NodeJS.Timeout {
  return setInterval(() => {
    sweepExpiredDrops().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("drop expiry sweep failed", err);
    });
  }, SWEEP_INTERVAL_MS);
}
