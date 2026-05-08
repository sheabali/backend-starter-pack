import { Plan, SubscriptionStatus } from "@prisma/client";
import prisma from "../../../lib/prisma";

const getAdminDashboardStats = async () => {
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );

  const [
    totalUsers,
    totalAnalyses,
    totalPaidUsers,
    totalCoverLetters,
    allAnalyses,
    newUsersThisMonth,
    topActions,
    activeSubscriptions,
    recentActivity,
    analysesThisMonth,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.analysis.count(),
    prisma.user.count({ where: { plan: Plan.PRO } }),
    prisma.coverLetter.count(),
    prisma.analysis.findMany({ select: { atsScore: true } }),
    prisma.user.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
    prisma.activityLog.groupBy({
      by: ["action"],
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
      take: 10,
    }),
    // Count active PRO subscriptions for accurate MRR
    prisma.subscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
        planType: Plan.PRO,
      },
    }),
    // Last 20 activity log entries for feed
    prisma.activityLog.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
    // Analyses this month
    prisma.analysis.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
  ]);

  const averageAtsScore =
    allAnalyses.length > 0
      ? allAnalyses.reduce((acc, curr) => acc + curr.atsScore, 0) /
        allAnalyses.length
      : 0;

  const conversionRate =
    totalUsers > 0 ? (totalPaidUsers / totalUsers) * 100 : 0;

  // MRR: $5/month per active PRO subscription
  const monthlyRecurringRevenue = activeSubscriptions * 5;

  return {
    totalUsers,
    totalAnalyses,
    totalPaidUsers,
    totalCoverLetters,
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    monthlyRecurringRevenue,
    averageAtsScore: Math.round(averageAtsScore),
    newUsersThisMonth,
    analysesThisMonth,
    activeSubscriptions,
    topActions: topActions.map((a) => ({
      action: a.action,
      count: a._count.action,
    })),
    recentActivity: recentActivity.map((log) => ({
      id: log.id,
      action: log.action,
      description: log.description,
      userName: log.user?.name || log.user?.email || "Unknown",
      createdAt: log.createdAt,
    })),
  };
};

const getUserStats = async (userId: string) => {
  const [totalAnalyses, bestScore, totalCoverLetters, user, recentActions] =
    await Promise.all([
      prisma.analysis.count({ where: { userId } }),
      prisma.analysis.aggregate({
        where: { userId },
        _max: { atsScore: true },
      }),
      prisma.coverLetter.count({ where: { userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          plan: true,
          creditsRemaining: true,
          analysisCount: true,
          createdAt: true,
        },
      }),
      prisma.activityLog.findMany({
        where: { userId },
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          action: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

  return {
    totalAnalyses,
    bestScore: bestScore._max.atsScore || 0,
    totalCoverLetters,
    currentPlan: user?.plan || Plan.FREE,
    creditsRemaining: user?.creditsRemaining || 0,
    memberSince: user?.createdAt,
    recentActivity: recentActions,
  };
};

export const AnalyticsService = {
  getAdminDashboardStats,
  getUserStats,
};
