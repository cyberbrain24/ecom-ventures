/** Formats a price with the store's currency code, for example "BDT 1,250.00". */
export function formatMoney(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Describes a thrown value in plain words for an error banner. */
export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
