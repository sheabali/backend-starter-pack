import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { FeedbackController } from "./feedback.controller";

const router = express.Router();

// Both normal users and admins can submit feedback
router.post(
  "/",
  auth(UserRole.USER, UserRole.ADMIN),
  FeedbackController.createFeedback
);

// Only admins can view all submitted feedback
router.get(
  "/",
  auth(UserRole.ADMIN),
  FeedbackController.getAllFeedback
);

export const FeedbackRoutes = router;
