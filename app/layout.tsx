import type { Metadata, Viewport } from 'next';
import { Fraunces, Kalam, Noto_Sans, Noto_Sans_Devanagari, Tiro_Devanagari_Hindi } from 'next/font/google';
import './globals.css';

const display = Fraunces({ variable: '--font-display', subsets: ['latin'], axes: ['SOFT', 'WONK', 'opsz'] });
const sans = Noto_Sans({ variable: '--font-ui', subsets: ['latin'] });
const deva = Noto_Sans_Devanagari({ variable: '--font-deva', subsets: ['devanagari'], weight: ['400', '500', '600', '700'] });
const devaDisplay = Tiro_Devanagari_Hindi({ variable: '--font-deva-display', subsets: ['devanagari'], weight: '400' });
// handwriting for the scrapbook notes (Latin and Devanagari)
const hand = Kalam({ variable: '--font-hand', subsets: ['latin', 'devanagari'], weight: ['400', '700'] });

export const metadata: Metadata = {
  title: 'Raynet — Nami, a gentle companion who gets things done',
  description: 'Nami is an AI otter companion for older adults living apart from family. She talks in Hindi or English, phones the clinic with approval, and makes sure a real person follows up.',
};

export const viewport: Viewport = { themeColor: '#173D38' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${deva.variable} ${devaDisplay.variable} ${hand.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
