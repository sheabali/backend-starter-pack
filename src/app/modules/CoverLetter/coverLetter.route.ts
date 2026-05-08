import express from "express";
import { CoverLetterController } from "./coverLetter.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

router.post(
  "/generate",
  auth(), // JWT required
  CoverLetterController.generateCoverLetter
);

export const CoverLetterRoutes = router;
