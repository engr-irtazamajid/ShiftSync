import { Router } from "express";
import { Role } from "@shiftsync/shared";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../middleware/asyncHandler";
import { createLocation, listLocations, updateLocation } from "./controller";

const router = Router();

router.use(authenticate);
router.get("/", asyncHandler(listLocations));
router.post("/", authorize(Role.Admin), asyncHandler(createLocation));
router.patch("/:id", authorize(Role.Admin), asyncHandler(updateLocation));

export default router;
