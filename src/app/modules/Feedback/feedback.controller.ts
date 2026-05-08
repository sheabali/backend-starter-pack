import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { FeedbackService } from "./feedback.service";

const createFeedback = catchAsync(async (req: Request, res: Response) => {
  const payload = { ...req.body };
  
  // Try to use authenticated user details if they didn't manually provide them
  if (req.user) {
    payload.email = payload.email || req.user.email;
    if (req.user.name) {
      payload.name = payload.name || req.user.name;
    }
  }

  const result = await FeedbackService.createFeedback(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Feedback submitted successfully!",
    data: result,
  });
});

const getAllFeedback = catchAsync(async (req: Request, res: Response) => {
  const result = await FeedbackService.getAllFeedback();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feedback list retrieved successfully",
    data: result,
  });
});

export const FeedbackController = {
  createFeedback,
  getAllFeedback,
};
