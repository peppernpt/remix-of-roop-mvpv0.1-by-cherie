/**
 * Readable inventory identifiers for ROOP.
 *
 * SKU     = product variation level  -> BRAND-PRODUCT-COLOR-SIZE  (CAL-BALMINI-BLK-M)
 * SerialID= individual physical unit -> SKU-001                   (CAL-BALMINI-BLK-M-001)
 *
 * Pure string helpers only: no booking, pricing, availability or status logic.
 */

const clean = (s: string | null | undefined) =>
  (s ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

const tokens = (s: string | null | undefined) => clean(s).split(" ").filter(Boolean);

/** First 3 letters/digits of the brand name. */
export const brandCode = (brand?: string | null): string => {
  const t = tokens(brand).join("");
  return t ? t.slice(0, 3) : "NA";
};

const COLOR_CODES: Record<string, string> = {
  BLACK: "BLK",
  WHITE: "WHT",
  BLUE: "BLU",
  RED: "RED",
  PINK: "PNK",
  SNOW: "SNO",
  CREAM: "CRM",
  SILVER: "SLV",
  GOLD: "GLD",
  BEIGE: "BEI",
  BROWN: "BRN",
  GREEN: "GRN",
  YELLOW: "YLW",
  PURPLE: "PRP",
  GREY: "GRY",
  GRAY: "GRY",
  ORANGE: "ORG",
  NAVY: "NVY",
  BRONZE: "BRZ",
  PEONY: "PEO",
};

const MAX_COLOR_CODE = 9;

/**
 * Color segment. Multi-word colors keep every word so variations that share a
 * first word ("Matte Blue" vs "Matte Brown") never collide.
 */
export const colorCode = (color?: string | null): string => {
  const t = tokens(color);
  if (!t.length) return "NA";
  const code = t.map((w) => COLOR_CODES[w] ?? w.slice(0, 3)).join("");
  return code.slice(0, MAX_COLOR_CODE);
};


/** Size label cleaned for use in an ID (e.g. "40 ( 25-25.5cm)" -> "40"). */
export const sizeCode = (size?: string | null): string => {
  const t = tokens(size);
  if (!t.length) return "NA";
  return t.join("").slice(0, 8);
};

const GENERIC_WORDS = new Set([
  "DRESS",
  "GOWN",
  "SET",
  "SKIRT",
  "TOP",
  "SHIRT",
  "SUIT",
  "HEELS",
  "SHOES",
  "BAG",
  "JACKET",
  "COAT",
  "COLLECTION",
  "THE",
  "AND",
]);

const MAX_PRODUCT_CODE = 7;

/**
 * Readable shortened product code, with brand / color / size words removed
 * because they already have their own segment in the SKU.
 */
export const productCode = (
  name?: string | null,
  brand?: string | null,
  color?: string | null,
  size?: string | null,
): string => {
  const drop = new Set<string>([...tokens(brand), ...tokens(color), ...tokens(size)]);
  const all = tokens(name).filter((t) => !drop.has(t));
  let words = all.filter((t) => !GENERIC_WORDS.has(t));
  if (!words.length) words = all;
  if (!words.length) words = tokens(name);
  if (!words.length) return "ITEM";

  const parts = words.slice(0, 2);
  // Shrink the longest word until the joined code fits the length budget.
  // Words containing digits are model codes (CC07, ML12) — keep them intact.
  const shrinkable = (w: string) => w.length > 3 && !/\d/.test(w);
  while (parts.join("").length > MAX_PRODUCT_CODE) {
    let idx = -1;
    parts.forEach((w, i) => {
      if (shrinkable(w) && (idx === -1 || w.length > parts[idx].length)) idx = i;
    });
    if (idx === -1) break;
    parts[idx] = parts[idx].slice(0, -1);
  }
  return parts.join("").slice(0, 12) || "ITEM";
};

export interface SkuInput {
  name?: string | null;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
}

/** BRANDCODE-PRODUCTCODE-COLORCODE-SIZE */
export const buildSku = ({ name, brand, color, size }: SkuInput): string =>
  [brandCode(brand), productCode(name, brand, color, size), colorCode(color), sizeCode(size)].join(
    "-",
  );

/**
 * Makes a SKU unique against a set of SKUs already in use by other products.
 * Appends -2, -3, … only when a real collision exists.
 */
export const uniqueSku = (base: string, taken: Iterable<string>): string => {
  const used = new Set(Array.from(taken, (s) => s.toUpperCase()));
  if (!used.has(base.toUpperCase())) return base;
  let n = 2;
  while (used.has(`${base}-${n}`.toUpperCase())) n++;
  return `${base}-${n}`;
};

/** Highest unit number already used for a SKU (0 when none). */
export const highestUnitNumber = (sku: string, serials: Iterable<string>): number => {
  let max = 0;
  const prefix = `${sku.toUpperCase()}-`;
  for (const s of serials) {
    const up = (s ?? "").toUpperCase();
    const suffix = up.startsWith(prefix) ? up.slice(prefix.length) : /-(\d+)$/.exec(up)?.[1];
    const n = suffix ? parseInt(suffix, 10) : NaN;
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
};

export const serialFor = (sku: string, n: number): string =>
  `${sku || "ITEM"}-${String(n).padStart(3, "0")}`;

/** Next serial for a SKU given every serial ever used (incl. archived units). */
export const nextSerial = (sku: string, serials: Iterable<string>): string =>
  serialFor(sku, highestUnitNumber(sku, serials) + 1);

/**
 * Full variation identity for duplicate detection: brand + product name +
 * color + size, normalized. Two products are the same variation only when all
 * four match — a different color or size is a different listing.
 */
export const variationKey = ({ name, brand, color, size }: SkuInput): string =>
  [clean(brand), clean(name), clean(color), clean(size)].join("|");
