const utcTimestampPattern =
  /^(?<seconds>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(?<fraction>\d{1,3}))?Z$/u;

const parseUtcTimestamp = (value: unknown): Date | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const match = utcTimestampPattern.exec(value);
  const date = new Date(value);
  if (match?.groups === undefined || Number.isNaN(date.getTime())) {
    return undefined;
  }
  const fraction = match.groups.fraction?.padEnd(3, "0") ?? "000";
  return date.toISOString() === `${match.groups.seconds}.${fraction}Z`
    ? date
    : undefined;
};

/** Keep a time window only when both ends are valid UTC instants in order. */
export const parseTimeWindow = (
  from: unknown,
  through: unknown
): { from: string; through: string } | undefined => {
  const start = parseUtcTimestamp(from);
  const end = parseUtcTimestamp(through);
  if (
    start === undefined ||
    end === undefined ||
    start > end ||
    typeof from !== "string" ||
    typeof through !== "string"
  ) {
    return undefined;
  }
  return { from, through };
};
