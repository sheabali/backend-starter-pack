import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import ApiError from "../../../errors/apiError";
import { ResumeService } from "./resume.service";

const uploadAndParseResume = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const file = req.file;

  if (!file) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Please upload a resume PDF file");
  }

  const { jobTitle, targetCompany } = req.body;

  const result = await ResumeService.uploadAndParseResume(
    userId,
    file,
    jobTitle,
    targetCompany
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Resume uploaded and parsed successfully",
    data: result,
  });
});

const analyzeResume = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { analysisId } = req.body;

  if (!analysisId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "analysisId is required");
  }

  const result = await ResumeService.analyzeResume(analysisId, userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Resume analyzed successfully",
    data: result,
  });
});

export const ResumeController = {
  uploadAndParseResume,
  analyzeResume,
};
