import { Router } from "express";
import { Role } from "@shiftsync/shared";
import { authenticate } from "../../middleware/authenticate";
import { authorize, scopeToManagedLocation } from "../../middleware/authorize";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  cancelShift,
  createShift,
  getShift,
  getShiftHistory,
  listShifts,
  publishShifts,
  unpublishShifts,
  updateShift,
} from "./controller";
import { assignStaff, previewAssignment } from "../assignments/controller";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(listShifts));
router.post(
  "/",
  authorize(Role.Admin, Role.Manager),
  scopeToManagedLocation,
  asyncHandler(createShift)
);
router.post(
  "/publish",
  authorize(Role.Admin, Role.Manager),
  scopeToManagedLocation,
  asyncHandler(publishShifts)
);
router.post(
  "/unpublish",
  authorize(Role.Admin, Role.Manager),
  scopeToManagedLocation,
  asyncHandler(unpublishShifts)
);

router.get("/:id", asyncHandler(getShift));
router.patch("/:id", authorize(Role.Admin, Role.Manager), asyncHandler(updateShift));
router.delete("/:id", authorize(Role.Admin, Role.Manager), asyncHandler(cancelShift));
router.get("/:id/history", authorize(Role.Admin, Role.Manager), asyncHandler(getShiftHistory));

router.post("/:shiftId/assign", authorize(Role.Admin, Role.Manager), asyncHandler(assignStaff));
router.post(
  "/:shiftId/preview-assignment",
  authorize(Role.Admin, Role.Manager),
  asyncHandler(previewAssignment)
);

export default router;
