import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { loginHandler, logoutHandler, refreshHandler } from "./controller";

const router = Router();

router.post("/login", asyncHandler(loginHandler));
router.post("/refresh", asyncHandler(refreshHandler));
router.post("/logout", authenticate, asyncHandler(logoutHandler));

export default router;
