import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '~/components/providers';
import { AuthHydrator } from '~/components/auth-hydrator';

export const metadata: Metadata = {
  title: 'LavanderPro — Panel',
  description: 'Sistema de gestión para lavanderías comerciales e industriales.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <head>
        {/* Public Sans via Google Fonts — funciona en static export */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
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