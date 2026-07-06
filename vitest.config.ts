import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Valeurs factices : les tests sont de la logique pure et n'appellent jamais
    // Supabase, mais src/lib/supabase.ts lève une erreur à l'import si ces
    // variables manquent. Rend la suite hermétique (CI sans secret, dev sans .env).
    env: {
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'placeholder-anon-key',
      VITE_VAPID_PUBLIC_KEY: 'placeholder-vapid-key',
    },
  },
});
