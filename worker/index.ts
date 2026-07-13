/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleEdgeSimulationRequest } from "../lib/edge-simulation-api";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  SIMULATION_API_BASE_URL?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  [
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "media-src 'self'",
    ].join("; "),
  ],
  ["Referrer-Policy", "no-referrer"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  [
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  ],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Strict-Transport-Security", "max-age=31536000"],
  ["X-DNS-Prefetch-Control", "off"],
];

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of SECURITY_HEADERS) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const COMPARISON_PATH = "/api/v1/simulations/compare";
const MAX_REQUEST_BYTES = 65_536;

function proxyError(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ code, message, requestId: crypto.randomUUID() }),
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json; charset=utf-8",
        Pragma: "no-cache",
        "X-Cifra-Engine": "python_api",
      },
    },
  );
}

async function proxySimulationRequest(request: Request, upstreamBase: string): Promise<Response> {
  if (request.method !== "POST") {
    return proxyError(
      "method_not_allowed",
      "Este endpoint solo admite solicitudes POST.",
      405,
    );
  }
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return proxyError(
      "unsupported_media_type",
      "El cuerpo debe enviarse como application/json.",
      415,
    );
  }

  const advertisedSize = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(advertisedSize) && advertisedSize > MAX_REQUEST_BYTES) {
    return proxyError("request_too_large", "La solicitud supera el límite permitido.", 413);
  }
  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return proxyError("invalid_request", "No se pudo leer la solicitud.", 400);
  }
  if (body.byteLength > MAX_REQUEST_BYTES) {
    return proxyError("request_too_large", "La solicitud supera el límite permitido.", 413);
  }

  let target: URL;
  try {
    target = new URL(`${upstreamBase.replace(/\/$/, "")}${COMPARISON_PATH}`);
    if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error();
  } catch {
    return proxyError(
      "api_configuration_error",
      "El motor fiscal no está configurado correctamente.",
      503,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": request.headers.get("Content-Type") ?? "application/json",
      },
      body,
      cache: "no-store",
      credentials: "omit",
      redirect: "manual",
      signal: controller.signal,
    });
    const headers = new Headers({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
      Pragma: "no-cache",
      "X-Cifra-Engine": "python_api",
    });
    const retryAfter = upstream.headers.get("Retry-After");
    if (retryAfter) headers.set("Retry-After", retryAfter);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return proxyError(
      "api_unavailable",
      "El motor fiscal no está disponible en este momento.",
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env | undefined, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === COMPARISON_PATH) {
      const upstreamBase =
        env?.SIMULATION_API_BASE_URL?.trim() ??
        process.env.SIMULATION_API_BASE_URL?.trim();
      const response = upstreamBase
        ? await proxySimulationRequest(request, upstreamBase)
        : await handleEdgeSimulationRequest(request);
      return withSecurityHeaders(response);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const optimized = await handleImageOptimization(request, {
        fetchAsset: (path) => env!.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env!.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withSecurityHeaders(optimized);
    }

    return withSecurityHeaders(await handler.fetch(request, env, ctx));
  },
};

export default worker;
