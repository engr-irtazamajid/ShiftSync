import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { scopeToOwnStaffOrManager } from "../../middleware/authorize";
import {
  addAvailabilityException,
  listAvailability,
  replaceRecurringAvailability,
} from "./controller";

const router = Router({ mergeParams: true });

router.use(asyncHandler(scopeToOwnStaffOrManager));
router.get("/", asyncHandler(listAvailability));
router.put("/", asyncHandler(replaceRecurringAvailability));
router.post("/exceptions", asyncHandler(addAvailabilityException));

export default router;
