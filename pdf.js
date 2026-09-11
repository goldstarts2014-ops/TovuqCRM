// PDF hisobot: pdf-lib (ixtiyoriy). Kutubxona o'rnatilmagan bo'lsa chop etish uchun HTML qaytariladi.
import * as pdfLib from 'pdf-lib';
export const hasPdf = true;

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 }).replace(/ /g, ' ');
// Helvetica (WinAnsi) uchun matnni tozalash
const clean = (s) => String(s ?? '').replace(/№/g, '#').replace(/[ʻʼ‘]/g, '’').replace(/[^\x20-\x7E -ÿ–—’“”•€]/g, '?');

/** sheet: { title, subtitle, columns:[{header,key,type,width}], rows, totals } */
export async function buildPdf(sheet) {
  const { PDFDocument, StandardFonts, rgb } = pdfLib;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const landscape = sheet.columns.length > 6;
  const [W, H] = landscape ? [841.89, 595.28] : [595.28, 841.89];
  const margin = 36;
  const cols = sheet.columns;
  const totalW = cols.reduce((s, c) => s + (c.width || 18), 0);
  const widths = cols.map((c) => ((c.width || 18) / totalW) * (W - margin * 2));
  const rowH = 16, fs = 8.5;
  let page, y;
  const newPage = () => { page = doc.addPage([W, H]); y = H - margin; };
  const drawText = (t, x, yy, size, f, color) => page.drawText(clean(t), { x, y: yy, size, font: f, color: color || rgb(0.12, 0.12, 0.12) });
  const header = () => {
    page.drawRectangle({ x: margin, y: y - rowH + 3, width: W - margin * 2, height: rowH, color: rgb(0.95, 0.95, 0.96) });
    let x = margin + 3;
    cols.forEach((c, i) => { drawText(c.header, x, y - rowH + 7, fs, bold); x += widths[i]; });
    y -= rowH;
  };
  const trunc = (t, w, f, size) => { let s = clean(t); while (s.length > 1 && f.widthOfTextAtSize(s, size) > w - 6) s = s.slice(0, -1); return s; };
  const drawRow = (row, f, isTotal) => {
    if (y - rowH < margin) { newPage(); header(); }
    if (isTotal) page.drawRectangle({ x: margin, y: y - rowH + 3, width: W - margin * 2, height: rowH, color: rgb(0.93, 0.98, 0.94) });
    let x = margin + 3;
    cols.forEach((c, i) => {
      const v = row[c.key];
      const isNum = typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v)));
      const txt = c.type === 'number' ? (v == null || v === '' ? '' : isNum ? fmt(Number(v)) : v) : (v ?? '');
      const s = trunc(txt, widths[i], f, fs);
      const tw = f.widthOfTextAtSize(s, fs);
      drawText(s, c.type === 'number' ? x + widths[i] - tw - 6 : x, y - rowH + 7, fs, f);
      x += widths[i];
    });
    page.drawLine({ start: { x: margin, y: y - rowH + 2 }, end: { x: W - margin, y: y - rowH + 2 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });
    y -= rowH;
  };
  newPage();
  drawText(sheet.title || 'Hisobot', margin, y - 14, 16, bold, rgb(0.75, 0.1, 0.1));
  y -= 22;
  if (sheet.subtitle) { drawText(sheet.subtitle, margin, y - 10, 9, font, rgb(0.4, 0.4, 0.4)); y -= 16; }
  y -= 6;
  header();
  for (const r of sheet.rows) drawRow(r, font, false);
  if (sheet.totals) drawRow(sheet.totals, bold, true);
  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(clean(`Tovuq CRM · ${new Date().toLocaleDateString('ru-RU')} · ${i + 1}/${pages.length}`), { x: margin, y: 18, size: 7, font, color: rgb(0.5, 0.5, 0.5) }));
  return await doc.save(); // Uint8Array
}

export function buildPrintHtml(sheet) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>${esc(sheet.title)}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#222}h1{color:#b91c1c;font-size:20px;margin:0 0 4px}p{color:#666;margin:0 0 16px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f3f4f6}td.n,th.n{text-align:right}tr.t td{font-weight:bold;background:#ecfdf5}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Chop etish / PDF saqlash</button><h1>${esc(sheet.title)}</h1><p>${esc(sheet.subtitle || '')}</p><table><thead><tr>${sheet.columns.map((c) => `<th class="${c.type === 'number' ? 'n' : ''}">${esc(c.header)}</th>`).join('')}</tr></thead><tbody>${sheet.rows.map((r) => `<tr>${sheet.columns.map((c) => `<td class="${c.type === 'number' ? 'n' : ''}">${c.type === 'number' ? fmt(r[c.key]) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')}${sheet.totals ? `<tr class="t">${sheet.columns.map((c) => `<td class="${c.type === 'number' ? 'n' : ''}">${c.type === 'number' ? (sheet.totals[c.key] == null ? '' : fmt(sheet.totals[c.key])) : esc(sheet.totals[c.key])}</td>`).join('')}</tr>` : ''}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
}
