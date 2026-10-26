export const getSevenDayWindow = (generatedAt: Date) => ({
  from: new Date(generatedAt.getTime() - 7 * 24 * 60 * 60 * 1000),
  through: generatedAt,
});
