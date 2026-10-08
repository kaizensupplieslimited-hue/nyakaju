import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Script from "next/script";
import "@/styles/globals.css";

const siteIcon = "/gallery/IMG_4258.PNG?v=nyakaju-hat";

export const metadata: Metadata = {
  title: "NYAKAJU",
  icons: {
    icon: [{ url: siteIcon, type: "image/png", sizes: "any" }],
    shortcut: siteIcon,
  },
  verification: {
    google: "kumDt19gQ0Pz08W9d6E4wFRmr6X_TFl-0hvKObrKaRY",
  },
};

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`scroll-smooth ${montserrat.variable}`} lang="en">
      <body id="top">
        <Script src="/home-nav-scroll.js" strategy="beforeInteractive" />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-4HCEQHS6FK"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-4HCEQHS6FK');
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
