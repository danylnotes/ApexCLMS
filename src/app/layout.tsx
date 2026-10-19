import type { Metadata, Viewport } from "next";
import { Inter, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { getSettings } from "@/server/settings";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap", weight: ["500", "600", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSettings();
  return { title: { default: branding.productName, template: `%s · ${branding.productName}` }, description: branding.descriptor };
}

export const viewport: Viewport = { themeColor: "#162644", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${sourceSans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
