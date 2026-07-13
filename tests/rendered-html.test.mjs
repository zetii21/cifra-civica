import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workerPromise = import(
  new URL(`../dist/server/index.js?test=${process.pid}-${Date.now()}`, import.meta.url).href
).then(({ default: worker }) => worker);

const runtime = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

async function render(route) {
  const worker = await workerPromise;
  return worker.fetch(
    new Request(new URL(route, "http://localhost:3000"), {
      headers: { accept: "text/html" },
    }),
    runtime,
    executionContext,
  );
}

function textContent(fragment) {
  return fragment
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function validSimulationPayload() {
  return {
    taxYear: 2027,
    locale: "es-ES",
    household: {
      residence: {
        autonomousCommunityCode: "13",
        municipalityCode: null,
        fiscalRegime: "common",
      },
      filingPreference: "calculate_best",
      maritalStatus: "single",
      singleParentHousehold: false,
      adults: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          age: 35,
          relationshipToHousehold: "primary",
          employmentStatus: "employee",
          annualGrossEmploymentIncome: 3_000_000,
          annualSelfEmploymentNetIncome: 0,
          annualUnemploymentBenefits: 0,
          annualPensionIncome: 0,
          annualOtherTaxableBenefits: 0,
          annualExemptIncome: 0,
          disabilityBand: "none",
          socialSecurityCategory: "general_employee",
          monthsWorked: 12,
          multipleJobs: false,
          contributionBaseOverride: null,
          dataQuality: "exact",
        },
      ],
      dependants: [],
      housing: {
        tenure: "renter",
        annualRent: null,
        mortgageExists: false,
        mortgageStartYear: null,
        primaryResidence: true,
        protectedHousing: null,
      },
      householdBenefits: [],
      broadCapitalIncome: {
        annualInterest: 0,
        annualDividends: 0,
        annualPropertyIncome: 0,
        annualCapitalGains: 0,
        annualCapitalLosses: 0,
        valuesAreEstimated: false,
      },
      userConfirmedAssumptions: [],
    },
    scenarioIds: [
      "baseline-2027-common-reference",
      "demo-family-tax-relief-2027",
      "demo-child-transfer-2027",
    ],
    includeTrace: false,
  };
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(absolute);
      return /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [absolute] : [];
    }),
  );
  return nested.flat();
}

test("server-renders the public product routes with the Spanish civic shell", async () => {
  const routes = [
    ["/", "Cifra Cívica — simulador fiscal transparente", "Tu economía, explicada sin pedirte el voto."],
    ["/calculator", "Calculadora fiscal · Cifra Cívica", "Una estimación que enseña sus cuentas."],
    ["/laboratorio", "Laboratorio fiscal de España · Cifra Cívica", "El presupuesto de España, en tus manos."],
    ["/privacy", "Privacidad · Cifra Cívica", "Tus circunstancias no son un perfil político."],
    ["/scenarios", "Cifra Cívica — simulador fiscal transparente", "Políticas que se pueden inspeccionar."],
    [
      "/scenarios/demo-rebaja-estatal-familiar-2027",
      "DEMO — reducción sintética del tramo estatal · Cifra Cívica",
      "DEMO — reducción sintética del tramo estatal",
    ],
    ["/results", "Cifra Cívica — simulador fiscal transparente", "Todavía no hay un resultado."],
  ];

  for (const [route, title, heading] of routes) {
    const response = await render(route);
    assert.equal(response.status, 200, `${route} should render successfully`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.equal(response.headers.get("set-cookie"), null, `${route} must not create a session`);
    assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000");

    const html = await response.text();
    assert.match(html, /^<!DOCTYPE html><html lang="es">/i);
    assert.ok(html.includes(`<title>${title}</title>`), `${route} should expose its title`);
    const h1 = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0] ?? "";
    assert.equal(textContent(h1), heading);
    assert.match(html, /href="#contenido"[^>]*>\s*Saltar al contenido/i);
    assert.match(html, /aria-label="Navegación principal"/i);
  }
});

test("production build does not expose the internal diagnostics route", async () => {
  const response = await render("/internal/model-diagnostics");
  assert.equal(response.status, 404);
});

test("privacy route describes ephemeral processing and explicit local opt-in", async () => {
  const response = await render("/privacy");
  const html = await response.text();
  const readable = textContent(html);

  assert.match(readable, /sin cuenta/i);
  assert.match(readable, /solicitud efímera/i);
  assert.match(readable, /no se registra/i);
  assert.match(readable, /Guardar en este dispositivo/i);
  assert.match(readable, /IndexedDB/i);
  assert.match(readable, /Solicitud personal: cero días/i);
  assert.match(readable, /no inferimos opinión política/i);
});

test("rendered pages do not set cookies or load third-party script trackers", async () => {
  for (const route of ["/", "/calculator", "/calculator/household", "/privacy"]) {
    const response = await render(route);
    assert.equal(response.headers.get("set-cookie"), null);
    const html = await response.text();
    const scriptSources = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(
      (match) => match[1],
    );
    assert.ok(
      scriptSources.every((source) => source.startsWith("/")),
      `${route} must only load same-origin scripts: ${scriptSources.join(", ")}`,
    );
    assert.doesNotMatch(
      html,
      /googletagmanager|google-analytics|connect\.facebook\.net|cdn\.segment\.com|api\.mixpanel\.com|plausible\.io\/js|posthog/i,
    );
  }
});

test("calculator implementation never serialises household inputs into a URL", async () => {
  const roots = ["app", "components", "lib"].map((name) => path.join(projectRoot, name));
  const files = (await Promise.all(roots.map(sourceFiles))).flat();
  const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const source = contents.join("\n");

  assert.doesNotMatch(source, /\buseSearchParams\b|\bURLSearchParams\b/);
  assert.doesNotMatch(source, /\blocation\.(?:search|href)\s*=/);
  assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage)\b/);
  assert.doesNotMatch(
    source,
    /googletagmanager|google-analytics|\bgtag\s*\(|\bmixpanel\b|\bamplitude\b|\bposthog\b|\bsegment\.track\b/i,
  );

  const householdPage = await readFile(
    path.join(projectRoot, "app/calculator/household/page.tsx"),
    "utf8",
  );
  const incomePage = await readFile(
    path.join(projectRoot, "app/calculator/income/page.tsx"),
    "utf8",
  );
  assert.doesNotMatch(householdPage + incomePage, /<form[^>]+method=["']get["']/i);
  assert.doesNotMatch(householdPage + incomePage, /<input[^>]+name=/i);

  const localStore = await readFile(path.join(projectRoot, "lib/local-store.ts"), "utf8");
  assert.match(localStore, /indexedDB\.open/);
  assert.match(localStore, /objectStore\(STORE_NAME\)\.put\(household, KEY\)/);
});

test("the browser bundle contains no fiscal rules or local calculation fallback", async () => {
  const apiClient = await readFile(path.join(projectRoot, "lib/api-client.ts"), "utf8");
  assert.doesNotMatch(apiClient, /from\s+["']\.\/simulator["']/);
  assert.doesNotMatch(apiClient, /NEXT_PUBLIC_API_BASE_URL/);

  const assetDirectory = path.join(projectRoot, "dist/client/assets");
  const assetNames = (await readdir(assetDirectory)).filter((name) => name.endsWith(".js"));
  const clientAssets = (
    await Promise.all(
      assetNames.map((name) => readFile(path.join(assetDirectory, name), "utf8")),
    )
  ).join("\n");

  assert.doesNotMatch(clientAssets, /STATE_GENERAL_BANDS/);
  assert.doesNotMatch(clientAssets, /CONTRIBUTION_MAX_ANNUAL_CENTS/);
  assert.doesNotMatch(clientAssets, /cifra-civica-edge-reference/);
});

test("a Worker deployment without a Python binding uses the labelled edge API", async () => {
  const worker = await workerPromise;
  const response = await worker.fetch(
    new Request("http://localhost:3000/api/v1/simulations/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validSimulationPayload()),
    }),
    { ...runtime, SIMULATION_API_BASE_URL: "" },
    executionContext,
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-cifra-engine"), "edge_api");
  assert.equal(body.modelVersion, "cifra-civica-edge-reference-0.1.0");
  assert.match(body.globalWarnings.join(" "), /Motor edge de contingencia/);
});

test("a configured but unavailable Python backend fails closed without edge fallback", async () => {
  const worker = await workerPromise;
  const response = await worker.fetch(
    new Request("http://localhost:3000/api/v1/simulations/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validSimulationPayload()),
    }),
    { ...runtime, SIMULATION_API_BASE_URL: "http://127.0.0.1:1" },
    executionContext,
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("x-cifra-engine"), "python_api");
  assert.equal(body.code, "api_unavailable");
  assert.equal(body.modelVersion, undefined);
});

test("the Vinext Node runtime resolves its Python upstream from process env", async () => {
  const upstream = http.createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      response.writeHead(418, { "content-type": "application/json" });
      response.end(JSON.stringify({ code: "runtime_proxy_reached" }));
    });
  });
  await new Promise((resolve, reject) => {
    upstream.listen(0, "127.0.0.1", (error) => (error ? reject(error) : resolve()));
  });
  const address = upstream.address();
  assert.ok(address && typeof address === "object");
  const previous = process.env.SIMULATION_API_BASE_URL;
  process.env.SIMULATION_API_BASE_URL = `http://127.0.0.1:${address.port}`;

  try {
    const worker = await workerPromise;
    const response = await worker.fetch(
      new Request("http://localhost:3000/api/v1/simulations/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      undefined,
      executionContext,
    );
    const body = await response.json();

    assert.equal(response.status, 418);
    assert.equal(response.headers.get("x-cifra-engine"), "python_api");
    assert.equal(body.code, "runtime_proxy_reached");
  } finally {
    if (previous === undefined) delete process.env.SIMULATION_API_BASE_URL;
    else process.env.SIMULATION_API_BASE_URL = previous;
    await new Promise((resolve) => upstream.close(resolve));
  }
});
