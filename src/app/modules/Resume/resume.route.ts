import express from "express";
import auth from "../../middlewares/auth";
import { resumeUploader } from "../../../helpers/file_uploader/resumeUploader";
import { ResumeController } from "./resume.controller";

const router = express.Router();

router.post(
  "/upload",
  auth("USER", "ADMIN"),
  resumeUploader.single("file"),
  ResumeController.uploadAndParseResume
);

router.post(
  "/analyze",
  auth("USER", "ADMIN"),
  ResumeController.analyzeResume
);

export const ResumeRoutes = router;
