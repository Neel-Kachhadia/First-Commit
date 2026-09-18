import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans, Barlow_Condensed, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import "../styles.css";
import { configureAmplify } from "@/lib/auth/amplify-config";
import { AuthProvider } from "@/lib/auth/auth-context";

// Configure Amplify once at module load time (runs on server + client).
configureAmplify();

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${admin.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
