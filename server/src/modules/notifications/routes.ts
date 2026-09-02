import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  getPreferences,
  listNotifications,
  markAllRead,
  markRead,
  updatePreferences,
} from "./controller";

const router = Router();

router.use(authenticate);
router.get("/notifications", asyncHandler(listNotifications));
router.patch("/notifications/:id/read", asyncHandler(markRead));
router.patch("/notifications/read-all", asyncHandler(markAllRead));
router.get("/notification-preferences", asyncHandler(getPreferences));
router.put("/notification-preferences", asyncHandler(updatePreferences));

export default router;
