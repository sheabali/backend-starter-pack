import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { AnalyticsController } from "./analytics.controller";

const router = express.Router();

router.get(
  "/dashboard",
  auth(UserRole.ADMIN),
  AnalyticsController.getAdminDashboardStats
);

router.get(
  "/me",
  auth(UserRole.USER, UserRole.ADMIN),
  AnalyticsController.getUserStats
);

router.get(
  "/user/:userId",
  auth(UserRole.ADMIN),
  AnalyticsController.getUserStatsById
);

export const AnalyticsRoutes = router;
