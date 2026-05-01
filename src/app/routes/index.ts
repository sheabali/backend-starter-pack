import express from "express";
import { AuthRoutes } from "../modules/Auth/auth.route";
import { ResumeRoutes } from "../modules/Resume/resume.route";

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
];

moduleRoutes.forEach((r) => router.use(r.path, r.route));

export default router;
