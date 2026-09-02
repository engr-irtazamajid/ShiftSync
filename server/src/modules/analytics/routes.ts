import { Router } from "express";
import { Role } from "@shiftsync/shared";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  fairness,
  hoursDistribution,
  onDutyNow,
  otDashboard,
  underOverScheduled,
} from "./controller";

const router = Router();

router.use(authenticate, authorize(Role.Admin, Role.Manager));
router.get("/hours-distribution", asyncHandler(hoursDistribution));
router.get("/fairness", asyncHandler(fairness));
router.get("/under-over-scheduled", asyncHandler(underOverScheduled));
router.get("/ot-dashboard", asyncHandler(otDashboard));
router.get("/on-duty-now", asyncHandler(onDutyNow));

export default router;
