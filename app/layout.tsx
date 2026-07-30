import type { Metadata } from 'next';
import { JetBrains_Mono, Press_Start_2P } from 'next/font/google';
import './globals.css';

const pressStart = Press_Start_2P({
  variable: '--font-press-start',
  weight: '400',
  subsets: ['latin'],
  display: 'swap'
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Arcade Vault · Portal Retro',
  description: 'Juega clásicos arcade en el navegador y compite por el récord de cada máquina.'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='es' className={`${pressStart.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className='av-bg' aria-hidden='true' />
        <div className='av-noise' aria-hidden='true' />
        <div className='av-app'>{children}</div>
      </body>
    </html>
  );
}
