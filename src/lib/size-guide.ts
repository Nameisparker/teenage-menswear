/**
 * Size charts, derived from the sizes a product actually stocks.
 *
 * Keyed on the shape of the size labels rather than the category, so a new
 * category added in the admin gets the right chart without a code change:
 * letter sizes (S–XXL) are body measurements for a top, plain numbers are
 * waist sizes for a bottom, and anything else (e.g. "One Size") has no chart.
 *
 * PLACEHOLDER MEASUREMENTS. These are the industry-typical values for Indian
 * menswear, not measurements taken off our own garments — replace the tables
 * below with the real spec sheet before launch, or shoppers will size on
 * numbers that do not match what arrives.
 */

export type SizeGuide = {
  title: string;
  /** Column headers, first one being the size itself. */
  columns: string[];
  /** One row per size: [size, ...measurements]. */
  rows: string[][];
  note: string;
};

/** Chest / shoulder / length in inches, for letter-sized tops. */
const TOP_MEASUREMENTS: Record<string, [string, string, string]> = {
  XS: ['36"', '16"', '26"'],
  S: ['38"', '17"', '27"'],
  M: ['40"', '18"', '28"'],
  L: ['42"', '19"', '29"'],
  XL: ['44"', '20"', '30"'],
  XXL: ['46"', '21"', '31"'],
  "3XL": ['48"', '22"', '32"'],
};

/** Waist / hip / inseam in inches, for numbered bottoms. */
function bottomRow(waist: number): [string, string, string] {
  // Hip runs about 10" over the waist and the inseam grows an inch every two
  // sizes across this range — a formula rather than a table, because waist
  // sizes are open-ended in a way letter sizes are not.
  return [`${waist}"`, `${waist + 10}"`, `${30 + Math.floor((waist - 30) / 2)}"`];
}

const LETTER_SIZES = new Set(Object.keys(TOP_MEASUREMENTS));

/**
 * Returns null when the product's sizes have no meaningful chart — a chain
 * sold in "One Size" should not show an empty table.
 */
export function getSizeGuide(sizes: string[]): SizeGuide | null {
  const normalized = sizes.map((size) => size.trim().toUpperCase());

  const letters = normalized.filter((size) => LETTER_SIZES.has(size));
  if (letters.length > 0) {
    return {
      title: "Body measurements (inches)",
      columns: ["Size", "Chest", "Shoulder", "Length"],
      rows: letters.map((size) => [size, ...TOP_MEASUREMENTS[size]]),
      note: "Measure around the fullest part of your chest, keeping the tape level. Between two sizes? Take the larger one for a relaxed fit.",
    };
  }

  const waists = normalized
    .map((size) => Number(size))
    .filter((size) => Number.isFinite(size) && size > 0);
  if (waists.length > 0) {
    return {
      title: "Waist measurements (inches)",
      columns: ["Size", "Waist", "Hip", "Inseam"],
      rows: waists.map((waist) => [String(waist), ...bottomRow(waist)]),
      note: "Sizes are the waist measurement in inches. Measure over the shirt, not the trousers you are already wearing.",
    };
  }

  return null;
}
