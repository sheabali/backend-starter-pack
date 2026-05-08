import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { CoverLetterService } from "./coverLetter.service";

const generateCoverLetter = catchAsync(async (req: Request, res: Response) => {
  const { id: userId } = (req as any).user;
  const { analysisId, tone, length } = req.body;

  const result = await CoverLetterService.generateCoverLetter(
    userId,
    analysisId,
    tone,
    length
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Cover letter generated successfully",
    data: result,
  });
});

export const CoverLetterController = {
  generateCoverLetter,
};
