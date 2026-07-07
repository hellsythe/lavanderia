import type { Metadata } from 'next';
import { Public_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '~/components/providers';
import { AuthHydrator } from '~/components/auth-hydrator';

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans-google',
});

export const metadata: Metadata = {
  title: 'LavanderPro — Panel',
  description: 'Sistema de gestión para lavanderías comerciales e industriales.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={publicSans.variable}>
      <body className={publicSans.className}>
        <a className="skip-link" href="#main">
          Ir al contenido principal
        </a>
        <Providers>
          <AuthHydrator />
          {children}
        </Providers>
      </body>
    </html>
  );
}