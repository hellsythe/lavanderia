/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export estático — requerido para Capacitor (mobile + Windows) y nginx.
  // Si más adelante se necesita SSR, cambiar a false y ajustar Dockerfile.
  output: 'export',

  // En export estático, las imágenes sin `unoptimized` fallan al construir.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'fonts.googleapis.com' },
      { protocol: 'https', hostname: 'fonts.gstatic.com' },
    ],
  },

  reactStrictMode: true,
  transpilePackages: ['@lavanderpro/ui', '@lavanderpro/shared-types'],

  // Trailing slash es recomendado para hosts estáticos (nginx) — evita
  // problemas con relative paths en sub-rutas.
  trailingSlash: false,
};

export default nextConfig;