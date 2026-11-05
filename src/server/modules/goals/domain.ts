export const goalPeriodRank = { year: 0, month: 1, week: 2, day: 3 } as const

export function isGoalChildCompatible(
  parent: { periodType: keyof typeof goalPeriodRank; startDate: string; targetDate: string },
  child: { periodType: keyof typeof goalPeriodRank; startDate: string; targetDate: string },
) {
  return goalPeriodRank[child.periodType] === goalPeriodRank[parent.periodType] + 1
    && child.startDate >= parent.startDate
    && child.targetDate <= parent.targetDate
}
