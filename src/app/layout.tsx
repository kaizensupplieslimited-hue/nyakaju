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
      <head>
        <Script id="google-tag-manager" strategy="beforeInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-N67KMX95');
          `}
        </Script>
      </head>
      <body id="top">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-N67KMX95"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
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
