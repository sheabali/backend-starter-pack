import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { AnalyticsService } from "./analytics.service";

const getAdminDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const result = await AnalyticsService.getAdminDashboardStats();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin dashboard stats retrieved successfully",
    data: result,
  });
});

const getUserStats = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await AnalyticsService.getUserStats(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User stats retrieved successfully",
    data: result,
  });
});

const getUserStatsById = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const result = await AnalyticsService.getUserStats(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User stats retrieved successfully",
    data: result,
  });
});

export const AnalyticsController = {
  getAdminDashboardStats,
  getUserStats,
  getUserStatsById,
};
