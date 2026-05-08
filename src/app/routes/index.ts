import express from "express";
import { AuthRoutes } from "../modules/Auth/auth.route";
import { ResumeRoutes } from "../modules/Resume/resume.route";
import { CoverLetterRoutes } from "../modules/CoverLetter/coverLetter.route";
import { DashboardRoutes } from "../modules/Dashboard/dashboard.route";
import { AnalysisRoutes } from "../modules/Analysis/analysis.route";
import { PaymentRoutes } from "../modules/Payment/payment.route";
import { AnalyticsRoutes } from "../modules/Analytics/analytics.route";
import { FeedbackRoutes } from "../modules/Feedback/feedback.route";

const router = express.Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/resume",
    route: ResumeRoutes,
  },
  {
    path: "/cover-letter",
    route: CoverLetterRoutes,
  },
  {
    path: "/dashboard",
    route: DashboardRoutes,
  },
  {
    path: "/analyses",
    route: AnalysisRoutes,
  },
  {
    path: "/payment",
    route: PaymentRoutes,
  },
  {
    path: "/analytics",
    route: AnalyticsRoutes,
  },
  {
    path: "/feedback",
    route: FeedbackRoutes,
  },
];

moduleRoutes.forEach((r) => router.use(r.path, r.route));

export default router;
