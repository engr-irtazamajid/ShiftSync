import { Router } from "express";
import { Role } from "@shiftsync/shared";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  acceptSwap,
  approveSwap,
  claimSwap,
  createSwap,
  denySwap,
  listSwaps,
  rejectSwap,
  withdrawSwap,
} from "./controller";

const router = Router();

router.use(authenticate);
router.get("/", asyncHandler(listSwaps));
router.post("/", asyncHandler(createSwap));
router.post("/:id/accept", asyncHandler(acceptSwap));
router.post("/:id/reject", asyncHandler(rejectSwap));
router.post("/:id/claim", asyncHandler(claimSwap));
router.post("/:id/withdraw", asyncHandler(withdrawSwap));
router.post("/:id/approve", authorize(Role.Admin, Role.Manager), asyncHandler(approveSwap));
router.post("/:id/deny", authorize(Role.Admin, Role.Manager), asyncHandler(denySwap));

export default router;
