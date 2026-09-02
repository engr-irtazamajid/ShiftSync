import { Router } from "express";
import { Role } from "@shiftsync/shared";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../middleware/asyncHandler";
import { createCertification, listCertifications, revokeCertification } from "./controller";

const router = Router({ mergeParams: true });

router.get("/", asyncHandler(listCertifications));
router.post("/", authorize(Role.Admin, Role.Manager), asyncHandler(createCertification));
router.delete("/:certId", authorize(Role.Admin, Role.Manager), asyncHandler(revokeCertification));

export default router;
