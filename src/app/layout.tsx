import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from 'next/script';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MySuper.gr | Σύγκριση Τιμών Σούπερ Μάρκετ",
  description: "Βρείτε τις καλύτερες τιμές στα ελληνικά σούπερ μάρκετ. Υπολογίστε το φθηνότερο καλάθι αγορών (Single Store Run) ή βελτιστοποιήστε τις αγορές σας σε πολλά καταστήματα (Split-Trip).",
  keywords: "supermarket, prices, greece, MySuper.gr, σούπερ μάρκετ, τιμές, καλάθι, σύγκριση",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="el"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-loader"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('posokanei_theme')==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(_){}"
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
