import NodeCache from "node-cache";
import prisma from "../../../lib/prisma";

const statsCache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache

const getStats = async (userId: string) => {
  const cacheKey = `dashboard_stats_${userId}`;
  const cachedData = statsCache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const [totalAnalyses, bestAtsScore, totalCoverLetters, user] = await Promise.all([
    prisma.analysis.count({
      where: { userId },
    }),
    prisma.analysis.aggregate({
      where: { userId },
      _max: {
        atsScore: true,
      },
    }),
    prisma.coverLetter.count({
      where: { userId },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        creditsRemaining: true,
      },
    }),
  ]);

  const stats = {
    totalAnalyses,
    bestAtsScore: bestAtsScore._max.atsScore || 0,
    totalCoverLetters,
    currentPlan: user?.plan || "FREE",
    creditsRemaining: user?.creditsRemaining ?? 0,
  };

  statsCache.set(cacheKey, stats);
  return stats;
};

// Function to invalidate cache when a new analysis is performed
const invalidateStatsCache = (userId: string) => {
  statsCache.del(`dashboard_stats_${userId}`);
};

export const DashboardService = {
  getStats,
  invalidateStatsCache,
};
