import httpStatus from "http-status";
import ApiError from "../../../errors/apiError";
import prisma from "../../../lib/prisma";
import { AIService } from "../../../services/ai.service";

const generateCoverLetter = async (
  userId: string,
  analysisId: string,
  tone: "PROFESSIONAL" | "CONFIDENT" | "FRIENDLY" | "CREATIVE",
  length: "SHORT" | "MEDIUM" | "LONG"
) => {
  // 1. Fetch Analysis record
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
  });

  if (!analysis) {
    throw new ApiError(httpStatus.NOT_FOUND, "Analysis not found");
  }

  // 2. Validate analysis belongs to user
  if (analysis.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "You do not own this analysis");
  }

  if (!analysis.jobDescription) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Job description is required to generate a cover letter. Please re-analyze with a job description."
    );
  }

  // 3. Call AI Service
  const content = await AIService.generateCoverLetter({
    resumeText: analysis.resumeText,
    jobDescription: analysis.jobDescription,
    jobTitle: analysis.jobTitle,
    companyName: analysis.targetCompany,
    tone,
    length,
  });

  // 4. Save CoverLetter record
  const coverLetter = await prisma.coverLetter.create({
    data: {
      userId,
      analysisId,
      content,
      tone,
      length,
      generatedBy: "groq-3-5-sonnet",
    },
  });

  // 5. Invalidate dashboard stats cache
  const { DashboardService } = require("../Dashboard/dashboard.service");
  DashboardService.invalidateStatsCache(userId);

  // Log activity
  const { AnalyticsService } = require("../../../services/analytics.service");
  AnalyticsService.logActivity(userId, "COVER_LETTER_GENERATED", `Generated ${tone} cover letter`, {
    analysisId,
    tone,
    length,
  });

  return coverLetter;
};

export const CoverLetterService = {
  generateCoverLetter,
};
