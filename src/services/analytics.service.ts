import { ActivityAction } from "@prisma/client";
import prisma from "../lib/prisma";

const logActivity = async (
  userId: string,
  action: ActivityAction,
  description?: string,
  metadata?: any,
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        description: description ?? null,
        metadata: metadata || {},
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });
  } catch (error) {
    // We log to console but don't throw to avoid breaking the main user flow
    console.error(`[Analytics Error] Failed to log activity ${action} for user ${userId}:`, error);
  }
};

export const AnalyticsService = {
  logActivity,
};
