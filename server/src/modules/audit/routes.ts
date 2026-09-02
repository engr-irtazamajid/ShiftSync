import { Router } from "express";
import { Role } from "@shiftsync/shared";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../middleware/asyncHandler";
import { exportAuditLogs, listAuditLogs } from "./controller";

const router = Router();

router.use(authenticate);
router.get("/export", authorize(Role.Admin), asyncHandler(exportAuditLogs));
router.get("/", authorize(Role.Admin, Role.Manager), asyncHandler(listAuditLogs));

export default router;
