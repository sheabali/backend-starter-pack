import express from "express";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { AnalysisController } from "./analysis.controller";

const router = express.Router();

router.get(
  "/history",
  auth(UserRole.USER),
  AnalysisController.getHistory
);

export const AnalysisRoutes = router;
