import { Router } from "express";
import { Role } from "@shiftsync/shared";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../middleware/asyncHandler";
import { listAssignments, unassignStaff } from "./controller";

const router = Router();

router.use(authenticate);
router.get("/", asyncHandler(listAssignments));
router.delete("/:id", authorize(Role.Admin, Role.Manager), asyncHandler(unassignStaff));

export default router;
