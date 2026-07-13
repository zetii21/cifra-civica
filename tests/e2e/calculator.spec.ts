import { expect, test, type Page } from "@playwright/test";

async function waitForCalculatorHydration(page: Page) {
  const community = page.getByLabel("Comunidad autónoma");
  await expect(community).toBeVisible();
  await expect
    .poll(() =>
      community.evaluate((element) =>
        Object.keys(element).some((key) => key.startsWith("__reactProps$")),
      ),
    )
    .toBe(true);
}

test("completes the four-step calculator and keeps household data out of the URL", async ({
  page,
}) => {
  await page.goto("/calculator");
  await page.getByRole("link", { name: /^Empezar/ }).click();

  await expect(page).toHaveURL(/\/calculator\/household$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("¿Quién forma tu hogar?");
  await waitForCalculatorHydration(page);
  await page.getByRole("button", { name: "Añadir persona dependiente" }).click();
  await page.getByRole("link", { name: /^Continuar/ }).click();

  await expect(page).toHaveURL(/\/calculator\/income$/);
  await page.getByLabel("Salario bruto").fill("42000");
  expect(new URL(page.url()).search).toBe("");
  await page.getByRole("link", { name: /^Continuar/ }).click();

  await expect(page).toHaveURL(/\/calculator\/housing-benefits$/);
  await page.getByLabel("Alquiler pagado").fill("12000");
  await page.getByLabel("Ayudas no incluidas antes").fill("1000");
  expect(new URL(page.url()).search).toBe("");
  await page.getByRole("link", { name: /^Continuar/ }).click();

  await expect(page).toHaveURL(/\/calculator\/scenarios$/);
  await expect(
    page.getByText("Referencia normativa revisada — traslado técnico a 2027", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Calcular comparación/ }).click();

  await expect(page).toHaveURL(/\/results$/);
  expect(new URL(page.url()).search).toBe("");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "El resultado, con todas sus piezas.",
  );
  await expect(page.locator(".result-scenario-card")).toHaveCount(3);
  await expect(page.locator(".result-meta-grid span").filter({ hasText: "Motor" })).toContainText(
    "API fiscal Python",
  );
  await expect(page.locator(".result-meta-grid span").filter({ hasText: "Retención" })).toContainText(
    "No almacenado",
  );
  await expect(page.getByRole("button", { name: "Descargar JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar CSV" })).toBeVisible();
  await expect(page.getByText("La misma entrada produce el mismo resultado.")).toBeVisible();
});

test("blocks common-regime calculation for an unsupported foral territory", async ({ page }) => {
  await page.goto("/calculator/household");
  await waitForCalculatorHydration(page);
  await page.getByLabel("Comunidad autónoma").selectOption("15");

  await expect(page.getByRole("alert")).toContainText("Territorio aún no compatible");
  await expect(page.getByRole("link", { name: /^Continuar/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Ver cobertura territorial/ })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Progreso de la calculadora" })
    .getByRole("link", { name: /Comparar$/ })
    .click();
  await page.getByRole("button", { name: /^Calcular comparación/ }).click();
  await expect(page).toHaveURL(/\/calculator\/scenarios$/);
  await expect(page.getByRole("alert").filter({ hasText: "No se pudo calcular" })).toContainText(
    "no cuenta con un modelo fiscal completo",
  );
});

test("hydrates the household form without server/client identity drift", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/calculator/household");
  await waitForCalculatorHydration(page);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

  expect(errors.join("\n")).not.toMatch(/tree hydrated.+didn't match|hydration mismatch/i);
});
