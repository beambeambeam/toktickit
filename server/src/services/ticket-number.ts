const TICKET_NUMBER_SUFFIX_LENGTH = 6;
const TICKET_NUMBER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const randomSuffix = (): string => {
  let suffix = "";

  for (let index = 0; index < TICKET_NUMBER_SUFFIX_LENGTH; index += 1) {
    const randomIndex = Math.floor(
      Math.random() * TICKET_NUMBER_ALPHABET.length
    );
    suffix += TICKET_NUMBER_ALPHABET[randomIndex];
  }

  return suffix;
};

export const createTicketNumber = (
  ticketDate: Date,
  suffix = randomSuffix()
): string => {
  const year = ticketDate.getUTCFullYear().toString().padStart(4, "0");
  const month = (ticketDate.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = ticketDate.getUTCDate().toString().padStart(2, "0");

  if (!/^[A-Z0-9]{6}$/u.test(suffix)) {
    throw new TypeError(
      "Ticket number suffix must contain six uppercase characters"
    );
  }

  return `TKT-${year}${month}${day}-${suffix}`;
};
