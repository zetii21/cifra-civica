import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTONOMOUS_COMMUNITIES } from "../lib/domain";

const projectRoot = path.resolve(import.meta.dirname, "..");
const asset = JSON.parse(
  readFileSync(
    path.join(projectRoot, "data/fixtures/geography/spain-ccaa-svg.json"),
    "utf8",
  ),
) as {
  version: string;
  width: number;
  height: number;
  source: { attribution: string; inputSha256: string };
  canariasInset: { x: number; y: number; width: number; height: number };
  communities: Array<{
    code: string;
    nutsId: string;
    name: string;
    inset: boolean;
    path: string;
    labelX: number;
    labelY: number;
  }>;
};

describe("pre-projected CCAA map asset", () => {
  it("contains exactly the nineteen communities of the domain catalogue", () => {
    const assetCodes = asset.communities.map((community) => community.code).sort();
    const domainCodes = AUTONOMOUS_COMMUNITIES.map((community) => community.code).sort();
    expect(assetCodes).toEqual(domainCodes);
  });

  it("keeps every geometry inside the declared frame", () => {
    expect(asset.width).toBeGreaterThan(0);
    expect(asset.height).toBeGreaterThan(0);
    for (const community of asset.communities) {
      expect(community.path.length).toBeGreaterThan(20);
      expect(community.path.startsWith("M")).toBe(true);
      expect(community.path.endsWith("Z")).toBe(true);
      const numbers = community.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      for (let index = 0; index < numbers.length; index += 2) {
        expect(numbers[index]).toBeGreaterThanOrEqual(-1);
        expect(numbers[index]).toBeLessThanOrEqual(asset.width + 1);
        expect(numbers[index + 1]).toBeGreaterThanOrEqual(-1);
        expect(numbers[index + 1]).toBeLessThanOrEqual(asset.height + 1);
      }
    }
  });

  it("places the Canary Islands inside their inset frame only", () => {
    const inset = asset.canariasInset;
    for (const community of asset.communities) {
      if (community.code !== "05") {
        expect(community.inset).toBe(false);
        continue;
      }
      expect(community.inset).toBe(true);
      const numbers = community.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      for (let index = 0; index < numbers.length; index += 2) {
        expect(numbers[index]).toBeGreaterThanOrEqual(inset.x);
        expect(numbers[index]).toBeLessThanOrEqual(inset.x + inset.width);
        expect(numbers[index + 1]).toBeGreaterThanOrEqual(inset.y);
        expect(numbers[index + 1]).toBeLessThanOrEqual(inset.y + inset.height);
      }
    }
  });

  it("declares the mandatory EuroGeographics attribution and input digest", () => {
    expect(asset.source.attribution).toMatch(/EuroGeographics/);
    expect(asset.source.inputSha256).toMatch(/^[0-9a-f]{64}$/);
    const raw = readFileSync(
      path.join(projectRoot, "data/fixtures/geography/nuts2-es-2024.geojson"),
    );
    expect(createHash("sha256").update(raw).digest("hex")).toBe(asset.source.inputSha256);
  });
});
