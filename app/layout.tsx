import type { Metadata } from 'next';
import { JetBrains_Mono, Press_Start_2P } from 'next/font/google';
import Nav from './components/nav';
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

const RootLayout = ({
  children
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html lang='es' className={`${pressStart.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className='av-bg' aria-hidden='true' />
        <div className='av-noise' aria-hidden='true' />
        <div className='av-app'>
          <Nav />
          <main className='av-main'>{children}</main>
          <footer className='av-footer'>
            © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
          </footer>
        </div>
      </body>
    </html>
  );
};

export default RootLayout;
