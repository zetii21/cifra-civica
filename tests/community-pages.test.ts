import { describe, expect, it } from "vitest";
import { COMMUNITIES } from "../lib/fiscal-lab";
import {
  allCommunitySlugs,
  communityBySlug,
  COMMUNITY_SLUGS,
  slugOf,
} from "../lib/fiscal-lab/community-pages";

describe("community page slugs", () => {
  it("defines one URL-safe slug per community with no duplicates", () => {
    const slugs = allCommunitySlugs();
    expect(slugs).toHaveLength(COMMUNITIES.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("round-trips every community through slug lookup", () => {
    for (const community of COMMUNITIES) {
      const slug = slugOf(community.code);
      expect(COMMUNITY_SLUGS[community.code]).toBe(slug);
      expect(communityBySlug(slug)?.code).toBe(community.code);
    }
    expect(communityBySlug("no-existe")).toBeUndefined();
  });

  it("never collides with the laboratory's static sub-routes", () => {
    for (const reserved of ["comparador", "directo"]) {
      expect(communityBySlug(reserved)).toBeUndefined();
    }
  });
});
