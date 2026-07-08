import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '~/components/providers';
import { AuthHydrator } from '~/components/auth-hydrator';
import { ServiceWorkerRegistration } from '~/components/sw-registration';
import { OfflineBanner } from '~/components/offline-banner';

export const metadata: Metadata = {
  title: 'LavanderPro — Panel',
  description: 'Sistema de gestión para lavanderías comerciales e industriales.',
  applicationName: 'LavanderPro',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LavanderPro',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F766E',
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
        {/* PWA iOS meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LavanderPro" />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Ir al contenido principal
        </a>
        <Providers>
          <AuthHydrator />
          <ServiceWorkerRegistration />
          <OfflineBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}