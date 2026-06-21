import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MySuper.gr | Σύγκριση Τιμών Σούπερ Μάρκετ',
    short_name: 'MySuper.gr',
    description: 'Βρείτε τις καλύτερες τιμές στα ελληνικά σούπερ μάρκετ. Υπολογίστε το φθηνότερο καλάθι αγορών ή βελτιστοποιήστε τις αγορές σας σε πολλά καταστήματα.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#4f46e5',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192 512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '192x192 512x512',
        type: 'image/png',
        purpose: 'maskable',
      }
    ],
  };
}
