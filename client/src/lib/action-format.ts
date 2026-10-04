export const formatBangkokDate = (value: string | null): string => {
  if (value === null) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "Unknown time";
  }

  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date)} (Asia/Bangkok)`;
};

export const formatUser = (
  user: { displayName: string; role: string } | null,
  empty = "—"
): string => (user === null ? empty : `${user.displayName} · ${user.role}`);
