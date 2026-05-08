import prisma from "../../../lib/prisma";

const getHistory = async (userId: string, options: { page: number; limit: number }) => {
  const { page, limit } = options;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.analysis.findMany({
      where: { userId },
      select: {
        id: true,
        jobTitle: true,
        targetCompany: true,
        atsScore: true,
        createdAt: true,
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.analysis.count({
      where: { userId },
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
    },
    data,
  };
};

export const AnalysisService = {
  getHistory,
};
