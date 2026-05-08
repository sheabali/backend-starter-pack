import express from "express";
import auth from "../../middlewares/auth";
import rateLimit from "../../middlewares/rateLimit";
import { resumeUploader } from "../../../helpers/file_uploader/resumeUploader";
import { ResumeController } from "./resume.controller";

const router = express.Router();

router.post(
  "/upload",
  auth("USER", "ADMIN"),
  rateLimit,
  resumeUploader.single("file"),
  ResumeController.uploadAndParseResume
);

router.post(
  "/analyze",
  auth("USER", "ADMIN"),
  ResumeController.analyzeResume
);

router.get(
  "/analyze/:analysisId",
  auth("USER", "ADMIN"),
  ResumeController.getAnalysis
);

router.post(
  "/cover-letter",
  auth("USER", "ADMIN"),
  ResumeController.generateCoverLetter
);

export const ResumeRoutes = router;
