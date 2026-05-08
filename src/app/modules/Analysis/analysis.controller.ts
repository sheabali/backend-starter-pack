import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { AnalysisService } from "./analysis.service";

const getHistory = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const result = await AnalysisService.getHistory(userId, { page, limit });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Analysis history retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const AnalysisController = {
  getHistory,
};
