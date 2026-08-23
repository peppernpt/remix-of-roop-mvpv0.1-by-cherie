import { describe, expect, it } from "vitest";
import { buildSku, nextSerial, uniqueSku, variationKey } from "./sku";

describe("buildSku", () => {
  it("builds readable variation-level SKUs", () => {
    expect(
      buildSku({ name: "Ballon Mini Dress Black - M", brand: "Calico Official", color: "Black", size: "M" }),
    ).toBe("CAL-BALMINI-BLK-M");
    expect(
      buildSku({ name: "Ballon Mini Dress Black - S", brand: "Calico Official", color: "Black", size: "S" }),
    ).toBe("CAL-BALMINI-BLK-S");
    expect(buildSku({ name: "Tulip Dress", brand: "Brielle.BKK", color: "Snow", size: "M" })).toBe(
      "BRI-TULIP-SNO-M",
    );
  });

  it("falls back to NA for missing color/size", () => {
    expect(buildSku({ name: "Tulip Dress", brand: "Brielle.BKK" })).toBe("BRI-TULIP-NA-NA");
  });
});

describe("uniqueSku", () => {
  it("only suffixes on real collisions", () => {
    expect(uniqueSku("CAL-BALMINI-BLK-M", [])).toBe("CAL-BALMINI-BLK-M");
    expect(uniqueSku("CAL-BALMINI-BLK-M", ["CAL-BALMINI-BLK-M"])).toBe("CAL-BALMINI-BLK-M-2");
  });
});

describe("nextSerial", () => {
  it("continues numbering and never restarts", () => {
    const sku = "CAL-BALMINI-BLK-M";
    expect(nextSerial(sku, [])).toBe("CAL-BALMINI-BLK-M-001");
    expect(nextSerial(sku, [`${sku}-001`, `${sku}-002`])).toBe("CAL-BALMINI-BLK-M-003");
    expect(nextSerial(sku, ["BALLON-004"])).toBe("CAL-BALMINI-BLK-M-005");
  });
});

describe("multi-word colors", () => {
  it("keeps every color word so variations never collide", () => {
    const base = { name: "Chiara Maxi Glitter Dress", brand: "HalfDayOffCo", size: "S" };
    const blue = buildSku({ ...base, color: "Matte Blue" });
    const brown = buildSku({ ...base, color: "Matte Brown" });
    expect(blue).not.toBe(brown);
    expect(blue).toBe("HAL-CHIMAXI-MATBLU-S");
    expect(brown).toBe("HAL-CHIMAXI-MATBRN-S");
  });
});

describe("variationKey", () => {
  it("only matches identical brand/name/color/size", () => {
    const a = { name: "Chiara Maxi", brand: "HalfDayOffCo", color: "Matte Blue", size: "S" };
    expect(variationKey(a)).toBe(variationKey({ ...a, name: "chiara  maxi" }));
    expect(variationKey(a)).not.toBe(variationKey({ ...a, color: "Matte Brown" }));
    expect(variationKey(a)).not.toBe(variationKey({ ...a, size: "M" }));
  });
});
