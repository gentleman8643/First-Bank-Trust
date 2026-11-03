import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'First Bank & Trust | Digital Banking',
  description: 'A clearer view of your financial life.',
  themeColor: '#00543d',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'First Bank & Trust' },
  formatDetection: { telephone: false },
  openGraph: {
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
