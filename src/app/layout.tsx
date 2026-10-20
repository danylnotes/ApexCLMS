import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getSettings } from "@/server/settings";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap", weight: ["400", "500", "600", "700", "800"] });

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSettings();
  return { title: { default: branding.productName, template: `%s · ${branding.productName}` }, description: branding.descriptor };
}

export const viewport: Viewport = { themeColor: "#181A1F", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
