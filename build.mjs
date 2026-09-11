// Yig'ish: node build.mjs → dist/   (hamma fayl bitta papkada — GitHub'ga yuklash oson bo'lishi uchun)
import { build, context } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const watch = process.argv.includes('--watch');
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist/img/products', { recursive: true });
fs.mkdirSync('dist/vendor/leaflet', { recursive: true });
fs.mkdirSync('assets', { recursive: true });
const PRODUCT_IMGS = ['bedro', 'boyin', 'butun', 'default', 'file', 'jigar', 'kokrak', 'oshqozon', 'oyoqcha', 'qanot', 'son', 'tuxum', 'yurak'];
for (const f of ['index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'icon.svg']) fs.copyFileSync(f, path.join('dist', f));
for (const n of PRODUCT_IMGS) if (fs.existsSync(n + '.svg')) fs.copyFileSync(n + '.svg', `dist/img/products/${n}.svg`);
for (const f of ['icon-only.png', 'icon-foreground.png', 'icon-background.png', 'splash.png', 'splash-dark.png']) if (fs.existsSync(f)) fs.copyFileSync(f, path.join('assets', f)); // @capacitor/assets uchun
const lf = 'node_modules/leaflet/dist';
if (fs.existsSync(lf)) { for (const f of ['leaflet.js', 'leaflet.css']) fs.copyFileSync(path.join(lf, f), path.join('dist/vendor/leaflet', f)); if (fs.existsSync(lf + '/images')) fs.cpSync(lf + '/images', 'dist/vendor/leaflet/images', { recursive: true }); }
else { fs.writeFileSync('dist/vendor/leaflet/leaflet.js', '// leaflet o‘rnatilmagan (npm install)'); fs.writeFileSync('dist/vendor/leaflet/leaflet.css', ''); console.warn('! leaflet topilmadi — xarita ishlamaydi. `npm install` bajaring.'); }
const opts = { entryPoints: ['main.jsx'], bundle: true, outfile: 'dist/app.js', jsx: 'automatic', minify: !watch, sourcemap: watch, target: ['es2020'], format: 'iife', define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' }, logLevel: 'info' };
if (watch) { const ctx = await context(opts); await ctx.watch(); console.log('Kuzatilmoqda...'); } else await build(opts);
