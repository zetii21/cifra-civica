/**
 * URL slugs and page metadata for the per-community laboratory pages.
 * Deliberately outside the study-signed engine inputs and the barrel export.
 */
import { COMMUNITIES, type CommunityProfile } from "./demography";
import type { CommunityCode } from "./types";

export const COMMUNITY_SLUGS: Record<CommunityCode, string> = {
  "01": "andalucia",
  "02": "aragon",
  "03": "asturias",
  "04": "illes-balears",
  "05": "canarias",
  "06": "cantabria",
  "07": "castilla-y-leon",
  "08": "castilla-la-mancha",
  "09": "cataluna",
  "10": "comunitat-valenciana",
  "11": "extremadura",
  "12": "galicia",
  "13": "madrid",
  "14": "murcia",
  "15": "navarra",
  "16": "pais-vasco",
  "17": "la-rioja",
  "18": "ceuta",
  "19": "melilla",
};

const CODE_BY_SLUG = new Map<string, CommunityCode>(
  Object.entries(COMMUNITY_SLUGS).map(([code, slug]) => [slug, code as CommunityCode]),
);

export function communityBySlug(slug: string): CommunityProfile | undefined {
  const code = CODE_BY_SLUG.get(slug);
  return code ? COMMUNITIES.find((community) => community.code === code) : undefined;
}

export function allCommunitySlugs(): string[] {
  return COMMUNITIES.map((community) => COMMUNITY_SLUGS[community.code]);
}

export function slugOf(code: CommunityCode): string {
  return COMMUNITY_SLUGS[code];
}
