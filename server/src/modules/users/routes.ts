import { Router } from "express";
import { Role } from "@shiftsync/shared";
import { authenticate } from "../../middleware/authenticate";
import { authorize, scopeToOwnStaffOrManager } from "../../middleware/authorize";
import { asyncHandler } from "../../middleware/asyncHandler";
import { createUser, getUser, listUsers, updateUser } from "./controller";
import certificationsRouter from "../certifications/routes";
import availabilityRouter from "../availability/routes";

const router = Router();

router.use(authenticate);
router.get("/", authorize(Role.Admin, Role.Manager, Role.Staff), asyncHandler(listUsers));
router.post("/", authorize(Role.Admin), asyncHandler(createUser));
router.get("/:id", asyncHandler(scopeToOwnStaffOrManager), asyncHandler(getUser));
router.patch("/:id", authorize(Role.Admin), asyncHandler(updateUser));

router.use("/:staffId/certifications", certificationsRouter);
router.use("/:staffId/availability", availabilityRouter);

export default router;
