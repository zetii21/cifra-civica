import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const axeSource = readFileSync(
  path.join(process.cwd(), "node_modules/axe-core/axe.min.js"),
  "utf8",
);

for (const [name, route] of [
  ["home", "/"],
  ["calculator", "/calculator"],
  ["household form", "/calculator/household"],
  ["privacy", "/privacy"],
] as const) {
  test(`${name} has no automated WCAG A/AA violations`, async ({ page }) => {
    await page.goto(route);
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () =>
      // axe is injected above to audit the hydrated document, not bundled with the app.
      (window as unknown as {
        axe: {
          run: (
            root: Document,
            options: object,
          ) => Promise<{
            violations: Array<{
              id: string;
              impact: string | null;
              nodes: Array<{ target: string[] }>;
            }>;
          }>;
        };
      }).axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      }),
    );

    expect(
      result.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        targets: nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}

test("keyboard users can reveal and use the skip link", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page).toHaveURL(/#contenido$/);
});
