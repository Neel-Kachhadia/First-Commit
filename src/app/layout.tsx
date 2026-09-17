import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

const admin = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "KavachPay — Authority, bounded",
  description: "Agentic money control for mandates, delegation, budgets, approvals, revocation and replay.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${admin.variable} ${mono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var w=console.warn;console.warn=function(){if(arguments[0]&&typeof arguments[0]==='string'&&arguments[0].indexOf('THREE.Clock: This module has been deprecated')!==-1)return;w.apply(console,arguments);};})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
