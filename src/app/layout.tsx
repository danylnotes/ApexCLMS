import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { getSettings } from "@/server/settings";
import { getLocale } from "@/i18n/server";
import { LOCALE_META } from "@/i18n/config";
import { clientDictionary } from "@/i18n/catalog";
import { I18nProvider } from "@/i18n/client";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap", weight: ["400", "500", "600", "700", "800"] });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic", display: "swap", weight: ["400", "500", "600", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getSettings();
  return { title: { default: branding.productName, template: `%s · ${branding.productName}` }, description: branding.descriptor };
}

export const viewport: Viewport = { themeColor: "#181A1F", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolving the language first makes it available to every server component rendered below.
  const locale = await getLocale();
  return (
    <html lang={locale} dir={LOCALE_META[locale].dir} className={`${jakarta.variable} ${arabic.variable}`}>
      <body>
        <I18nProvider locale={locale} dict={clientDictionary(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
