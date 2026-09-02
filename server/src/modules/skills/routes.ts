import { Router } from "express";
import { Role } from "@shiftsync/shared";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../middleware/asyncHandler";
import { createSkill, listSkills, updateSkill } from "./controller";

const router = Router();

router.use(authenticate);
router.get("/", asyncHandler(listSkills));
router.post("/", authorize(Role.Admin), asyncHandler(createSkill));
router.patch("/:id", authorize(Role.Admin), asyncHandler(updateSkill));

export default router;
