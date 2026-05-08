import { PrismaClient } from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../../errors/apiError";
import prisma from "../../../lib/prisma";
import { AIService } from "../../../services/ai.service";
import fs from "fs";
const pdfParse = require("pdf-parse");

const uploadAndParseResume = async (
  userId: string,
  file: Express.Multer.File,
  jobTitle?: string,
  targetCompany?: string
) => {
  // 1. Fetch user to check credits
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  // if (user.plan === "FREE" && user.creditsRemaining <= 0) {
  //   throw new ApiError(
  //     httpStatus.TOO_MANY_REQUESTS,
  //     "Upgrade to Pro for unlimited analyses"
  //   );
  // }

  // 2. Parse PDF to text
  let parsedData: any;
  try {
    const fileBuffer = fs.readFileSync(file.path);
    parsedData = await pdfParse(fileBuffer);
  } catch (err: any) {
    console.error("PDF Parse Error:", err?.message || err);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to parse PDF file: ${err?.message || "Unknown error"}`
    );
  }

  // Clean up whitespace and special characters
  const resumeText = parsedData?.text?.replace(/\s+/g, " ").trim() || "";

  // 3. Set local URL
  const resumeUrl = `/uploads/resumes/${file.filename}`;

  // 4. Create dummy KeywordAnalysis since it's required by the schema for Analysis
  const keywordAnalysis = await prisma.keywordAnalysis.create({
    data: {
      foundKeywords: [],
      foundCount: 0,
      missingKeywords: [],
      missingCount: 0,
      keywordFrequency: {},
    },
  });

  // 5. Save to MongoDB & update user usage
  const result = await prisma.$transaction(async (tx) => {
    // Decrement credits if FREE
    if (user.plan === "FREE") {
      await tx.user.update({
        where: { id: userId },
        data: {
          creditsRemaining: { decrement: 1 },
          analysisCount: { increment: 1 },
        },
      });
    } else {
      await tx.user.update({
        where: { id: userId },
        data: {
          analysisCount: { increment: 1 },
        },
      });
    }

    // Create Analysis Record
    const analysis = await tx.analysis.create({
      data: {
        userId,
        resumeFileName: file.originalname,
        resumeUrl,
        resumeText,
        jobTitle: jobTitle || null,
        targetCompany: targetCompany || null,
        atsScore: 0,
        formattingScore: 0,
        keywordScore: 0,
        keywordAnalysisId: keywordAnalysis.id,
      },
    });

    return analysis;
  });

  const response = {
    analysisId: result.id,
    resumeText: result.resumeText,
    resumeUrl: result.resumeUrl,
  };

  // Invalidate dashboard stats cache
  const { DashboardService } = require("../Dashboard/dashboard.service");
  DashboardService.invalidateStatsCache(userId);

  // Log activity
  const { AnalyticsService } = require("../../../services/analytics.service");
  AnalyticsService.logActivity(userId, "RESUME_UPLOADED", `Uploaded resume: ${file.originalname}`, {
    analysisId: result.id,
    jobTitle,
    targetCompany,
  });

  return response;
};

const analyzeResume = async (analysisId: string, userId: string, jobDescription?: string) => {
  // 1. Fetch the existing analysis
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
  });

  if (!analysis) {
    throw new ApiError(httpStatus.NOT_FOUND, "Analysis not found");
  }

  if (analysis.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "You do not own this analysis");
  }

  if (!analysis.resumeText) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No resume text found. Please re-upload the PDF."
    );
  }

  // 2. Call groq API for ATS analysis
  let aiResult;
  try {
    aiResult = await AIService.analyzeResume(analysis.resumeText, jobDescription, analysis.jobTitle || undefined);
  } catch (err: any) {
    console.error("groq API Error:", err?.status, err?.message, err?.error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `AI analysis failed: ${err?.message || "Unknown error"}`
    );
  }

  // 3. Update KeywordAnalysis record
  await prisma.keywordAnalysis.update({
    where: { id: analysis.keywordAnalysisId },
    data: {
      foundKeywords: aiResult.foundKeywords,
      foundCount: aiResult.foundKeywords.length,
      missingKeywords: aiResult.missingKeywords,
      missingCount: aiResult.missingKeywords.length,
      keywordFrequency: aiResult.keywordFrequency,
    },
  });

  // 4. Create Suggestion records
  if (aiResult.suggestions.length > 0) {
    await prisma.suggestion.createMany({
      data: aiResult.suggestions.map((s) => ({
        analysisId: analysis.id,
        title: s.title,
        description: s.description,
        priority: s.priority,
        category: s.category,
      })),
    });
  }

  // 5. Update the Analysis with scores
  const updatedAnalysis = await prisma.analysis.update({
    where: { id: analysisId },
    data: {
      atsScore: aiResult.atsScore,
      formattingScore: aiResult.formattingScore,
      keywordScore: aiResult.keywordScore,
      jobDescription: jobDescription || null,
      jobMatchPercentage: aiResult.jobMatchPercentage || null,
    },
    include: {
      keywords: true,
      suggestions: true,
    },
  });

  // 6. Invalidate dashboard stats cache
  const { DashboardService } = require("../Dashboard/dashboard.service");
  DashboardService.invalidateStatsCache(userId);

  // Log activity
  const { AnalyticsService } = require("../../../services/analytics.service");
  AnalyticsService.logActivity(userId, "RESUME_ANALYZED", `Analyzed resume for ${updatedAnalysis.jobTitle}`, {
    analysisId,
    atsScore: updatedAnalysis.atsScore,
    jobMatchPercentage: updatedAnalysis.jobMatchPercentage,
  });

  return updatedAnalysis;
};

const getAnalysis = async (analysisId: string, userId: string) => {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: {
      keywords: true,
      suggestions: true,
    },
  });

  if (!analysis) {
    throw new ApiError(httpStatus.NOT_FOUND, "Analysis not found");
  }

  if (analysis.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "You do not own this analysis");
  }

  return analysis;
};

const generateCoverLetter = async (analysisId: string, userId: string) => {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
  });

  if (!analysis) {
    throw new ApiError(httpStatus.NOT_FOUND, "Analysis not found");
  }

  if (analysis.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "You do not own this analysis");
  }

  if (!analysis.jobDescription) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Job description is required to generate a cover letter. Please re-analyze with a job description."
    );
  }

  const coverLetter = await AIService.generateCoverLetter({
    resumeText: analysis.resumeText as string,
    jobDescription: analysis.jobDescription,
    jobTitle: analysis.jobTitle || undefined,
    companyName: analysis.targetCompany || undefined,
  });

  return { coverLetter };
};

export const ResumeService = {
  uploadAndParseResume,
  analyzeResume,
  getAnalysis,
  generateCoverLetter,
};
