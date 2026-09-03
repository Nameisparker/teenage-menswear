import { describe, expect, it } from "vitest";
import {
  DEFAULT_DIAL_CODE,
  digitsOnly,
  formatPhoneForDisplay,
  isValidNationalNumber,
  toE164,
} from "./phone";

describe("digitsOnly", () => {
  it("strips whatever a paste-in brings with it", () => {
    expect(digitsOnly("93846 26894")).toBe("9384626894");
    expect(digitsOnly("(938) 462-6894")).toBe("9384626894");
    expect(digitsOnly("+91 93846-26894")).toBe("919384626894");
  });
});

describe("toE164", () => {
  it("joins the dial code to the digits with nothing in between", () => {
    expect(toE164("+91", "93846 26894")).toBe("+919384626894");
  });
});

describe("isValidNationalNumber", () => {
  it("requires a ten-digit Indian mobile starting 6-9", () => {
    expect(isValidNationalNumber("+91", "9384626894")).toBe(true);
    expect(isValidNationalNumber("+91", "6384626894")).toBe(true);
    // Landline and reserved ranges do not receive OTPs.
    expect(isValidNationalNumber("+91", "5384626894")).toBe(false);
    expect(isValidNationalNumber("+91", "938462689")).toBe(false);
    expect(isValidNationalNumber("+91", "93846268941")).toBe(false);
  });

  it("accepts the formatting a customer actually types", () => {
    expect(isValidNationalNumber(DEFAULT_DIAL_CODE, "93846 26894")).toBe(true);
  });

  it("is lenient about length elsewhere", () => {
    expect(isValidNationalNumber("+1", "4155550123")).toBe(true);
    expect(isValidNationalNumber("+1", "12345")).toBe(false);
  });
});

describe("formatPhoneForDisplay", () => {
  it("groups an Indian number", () => {
    expect(formatPhoneForDisplay("+919384626894")).toBe("+91 93846 26894");
  });

  it("returns anything else unchanged rather than mangling it", () => {
    expect(formatPhoneForDisplay("+14155550123")).toBe("+14155550123");
    expect(formatPhoneForDisplay("")).toBe("");
  });
});
