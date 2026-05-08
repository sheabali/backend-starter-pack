import { FeedbackCategory } from "@prisma/client";
import prisma from "../../../lib/prisma";

const createFeedback = async (payload: {
  email: string;
  name?: string;
  message: string;
  rating?: number;
  category: FeedbackCategory;
}) => {
  const feedback = await prisma.feedback.create({
    data: payload,
  });
  return feedback;
};

const getAllFeedback = async () => {
  const feedbacks = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
  });
  return feedbacks;
};

export const FeedbackService = {
  createFeedback,
  getAllFeedback,
};
