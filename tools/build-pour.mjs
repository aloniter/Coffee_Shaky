import { build } from 'esbuild';

await build({
  entryPoints: ['src/coffee-pour.tsx'],
  outfile: 'assets/coffee-pour.js',
  bundle: true,
  format: 'iife',
  target: ['safari16', 'chrome110'],
  jsx: 'automatic',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'external',
  logLevel: 'info',
});
