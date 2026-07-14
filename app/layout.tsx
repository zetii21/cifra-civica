import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { AppProviders } from "./providers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1e9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1d1c" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = new URL("/og.png", origin).toString();
  const description =
    "Compara cómo distintas políticas fiscales podrían afectar a tu hogar con reglas, fuentes y supuestos transparentes.";
  return {
    metadataBase: new URL(origin),
    title: {
      default: "Cifra Cívica — simulador fiscal transparente",
      template: "%s · Cifra Cívica",
    },
    description,
    icons: { icon: "/icon.svg", shortcut: "/icon.svg" },
    openGraph: {
      type: "website",
      locale: "es_ES",
      title: "Cifra Cívica — tu economía, explicada sin pedirte el voto",
      description,
      images: [{ url: socialImage, width: 1536, height: 1024, alt: "Cifra Cívica, simulador fiscal transparente para España 2027" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Cifra Cívica",
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <AppProviders>
          <SiteHeader />
          <main id="contenido">{children}</main>
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
