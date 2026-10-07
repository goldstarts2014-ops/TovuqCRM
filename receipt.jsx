// Chek: mini termoprinter (HPRT M1, 203 dpi) uchun oq-qora rasm (PNG).
// Rasm "Ulashish" orqali HereLabel ilovasiga yuboriladi yoki galereyaga saqlanib, HereLabel → Rasm orqali chop etiladi.
import React, { useEffect, useRef, useState } from 'react';
import { api, fmt, L } from './api.js';
import { Modal, Btn, Field, Input, Spinner, ErrorBox, useToast } from './ui.jsx';
import { saveFile } from './files.js';
import { I } from './icons.jsx';

const KEY = 'tovuq_receipt';
const PAPER = { 40: 320, 50: 384 }; // mm → piksel (203 dpi, 8 nuqta/mm)
export const receiptSettings = {
  get: () => { try { return { shop: 'Tovuq CRM', phone: '', width: 50, footer: 'Xaridingiz uchun rahmat!', ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { shop: 'Tovuq CRM', phone: '', width: 50, footer: 'Xaridingiz uchun rahmat!' }; } },
  set: (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
};

const FONT = 'Arial, Helvetica, sans-serif';
const fdate = (s) => { if (!s) return ''; const d = String(s).slice(0, 10).split('-').reverse().join('.'); return d; };
const now = () => { const d = new Date(); return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

/** Chekni canvas'ga chizadi. */
export function drawReceipt(o, cfg) {
  const W = PAPER[cfg.width] || 384;
  const pad = 6;
  const s = W / 384; // 40 mm uchun shriftlar mutanosib kichrayadi
  const sz = { title: Math.round(34 * s), big: Math.round(30 * s), text: Math.round(24 * s), small: Math.round(21 * s) };
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const ops = [];
  let y = pad;
  const font = (size, bold) => `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  const wrap = (text, size, bold, maxW) => {
    ctx.font = font(size, bold);
    const words = String(text ?? '').split(/\s+/); const out = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !line) line = t; else { out.push(line); line = w; } }
    if (line) out.push(line);
    return out;
  };
  const text = (t, { size = sz.text, bold = false, align = 'left' } = {}) => { for (const ln of wrap(t, size, bold, W - pad * 2)) { ops.push({ k: 't', t: ln, x: align === 'center' ? W / 2 : pad, y, size, bold, align }); y += Math.round(size * 1.25); } };
  const lr = (l, r, { size = sz.text, bold = false } = {}) => { ctx.font = font(size, bold); const rw = ctx.measureText(r).width; for (const [i, ln] of wrap(l, size, bold, W - pad * 2 - rw - 10).entries()) { ops.push({ k: 't', t: ln, x: pad, y, size, bold }); if (i === 0) ops.push({ k: 't', t: r, x: W - pad, y, size, bold, align: 'right' }); y += Math.round(size * 1.25); } };
  const line = (dash = true) => { y += 4; ops.push({ k: 'l', y, dash }); y += 8; };
  const gap = (n = 6) => { y += n; };

  text(cfg.shop || 'Tovuq CRM', { size: sz.title, bold: true, align: 'center' });
  if (cfg.phone) text('Tel: ' + cfg.phone, { size: sz.small, align: 'center' });
  line(false);
  lr('Chek #' + o.id, fdate(o.order_date), { bold: true });
  text('Mijoz: ' + o.customer_name + (o.business_name ? ' (' + o.business_name + ')' : ''), { size: sz.small });
  if (o.customer_phone) text('Tel: ' + o.customer_phone, { size: sz.small });
  if (o.driver_name) text('Haydovchi: ' + o.driver_name, { size: sz.small });
  line();
  for (const it of o.items || []) {
    text(it.name, { bold: true });
    lr(`${fmt(it.quantity, 2)} ${it.unit} x ${fmt(it.price)}`, fmt(it.total ?? it.quantity * it.price), { size: sz.small });
    gap(2);
  }
  line();
  if (o.discount > 0) { lr('Jami', fmt(o.subtotal)); lr('Chegirma', '-' + fmt(o.discount)); }
  lr('JAMI:', fmt(o.total) + " so'm", { size: sz.big, bold: true });
  gap(4);
  if (o.settlement && o.settlement !== 'pending') {
    if (o.paid_amount > 0) lr("To'landi", fmt(o.paid_amount), { size: sz.small });
    if (o.debt_amount > 0) lr('Qarzga', fmt(o.debt_amount), { size: sz.small, bold: true });
  } else if (o.payment_type) lr("To'lov turi", L.pay[o.payment_type] || o.payment_type, { size: sz.small });
  if (o.customer_debt > 0) lr('Umumiy qarz', fmt(o.customer_debt), { size: sz.small, bold: true });
  line(false);
  if (cfg.footer) text(cfg.footer, { size: sz.small, align: 'center', bold: true });
  text(now(), { size: sz.small, align: 'center' });
  y += pad + 10;

  c.width = W; c.height = y;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, y);
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; ctx.textBaseline = 'top';
  for (const op of ops) {
    if (op.k === 't') { ctx.font = font(op.size, op.bold); ctx.textAlign = op.align || 'left'; ctx.fillText(op.t, op.x, op.y); }
    else { ctx.lineWidth = 2; ctx.setLineDash(op.dash ? [6, 4] : []); ctx.beginPath(); ctx.moveTo(pad, op.y); ctx.lineTo(W - pad, op.y); ctx.stroke(); }
  }
  // Termoprinter uchun aniq oq-qora (kulrang chetlarsiz)
  const img = ctx.getImageData(0, 0, W, y); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 < 150 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Eski Android WebView'larda ham ishlaydi (eski WebView uchun toDataURL orqali)
const toBytes = (canvas) => { const b = atob(canvas.toDataURL('image/png').split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return Promise.resolve(u); };
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const native = () => (window.Capacitor?.isNativePlatform?.() ? window.Capacitor : null);
const plugin = (C, n) => C.Plugins?.[n] || C.registerPlugin(n);

/** Chekni telefon xotirasiga saqlaydi (bir nechta joyni sinab ko'radi). Qaytaradi: saqlangan joy */
async function saveToGallery(bytes, name) {
  const C = native(); if (!C) return null;
  const Filesystem = plugin(C, 'Filesystem');
  try { const p = await Filesystem.checkPermissions?.(); if (p && p.publicStorage !== 'granted') await Filesystem.requestPermissions?.(); } catch {}
  const tries = [
    { path: `Pictures/TovuqCRM/${name}`, directory: 'EXTERNAL_STORAGE', where: 'Galereya → Pictures → TovuqCRM' },
    { path: `TovuqCRM/${name}`, directory: 'DOCUMENTS', where: 'Fayllar → Documents → TovuqCRM' },
    { path: `TovuqCRM/${name}`, directory: 'EXTERNAL', where: 'Fayllar → Android/data/uz.tovuq.crm/files/TovuqCRM' },
  ];
  let lastErr;
  for (const t of tries) {
    try { await Filesystem.writeFile({ path: t.path, data: b64(bytes), directory: t.directory, recursive: true }); return t.where; }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Saqlab bo‘lmadi');
}
/** Android "Ulashish" oynasi orqali yuborish. true — ulashildi, false — bekor/ishlamadi */
async function shareImage(bytes, name) {
  const C = native(); if (!C) return false;
  const Filesystem = plugin(C, 'Filesystem'); const Share = plugin(C, 'Share');
  const r = await Filesystem.writeFile({ path: name, data: b64(bytes), directory: 'CACHE' });
  try { await Share.share({ files: [r.uri], dialogTitle: 'HereLabel ni tanlang' }); return true; } catch { return false; }
}

export function ReceiptModal({ id, onClose }) {
  const [o, setO] = useState(null); const [err, setErr] = useState('');
  const [cfg, setCfg] = useState(receiptSettings.get());
  const [edit, setEdit] = useState(false); const [busy, setBusy] = useState(false);
  const canvas = useRef(null); const [preview, setPreview] = useState('');
  const toast = useToast();
  useEffect(() => { api(`/orders/${id}`).then(setO).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => {
    if (!o) return;
    try { const c = drawReceipt(o, cfg); canvas.current = c; setPreview(c.toDataURL('image/png')); }
    catch (e) { setErr('Chekni chizib bo‘lmadi: ' + (e?.message || e)); }
  }, [o, cfg]);
  const upd = (k) => (v) => { const n = { ...cfg, [k]: v }; setCfg(n); receiptSettings.set(n); };
  const name = () => `chek-${o.id}-${Date.now() % 100000}.png`;
  const bytes = () => toBytes(canvas.current);
  const gallery = async () => {
    if (!canvas.current) return;
    setBusy(true);
    try {
      const bs = await bytes();
      if (!native()) { await saveFile(bs, name(), 'image/png'); return; }
      const where = await saveToGallery(bs, name());
      alert(`Chek rasmi saqlandi: ${where}.\n\nEndi HereLabel ilovasini oching → "Rasm" (Image) → shu chekni tanlang → Chop etish.`);
    } catch (e) { alert('Saqlab bo‘lmadi: ' + (e?.message || e)); } finally { setBusy(false); }
  };
  const share = async () => {
    if (!canvas.current) return;
    setBusy(true);
    try {
      const bs = await bytes();
      if (!native()) { await saveFile(bs, name(), 'image/png'); return; }
      const ok = await shareImage(bs, name());
      if (!ok) { const where = await saveToGallery(bs, name()).catch(() => null); alert('Ulashish oynasi ochilmadi.' + (where ? `\n\nChek rasmi saqlandi: ${where}.\nHereLabel → "Rasm" → shu chekni tanlab chop eting.` : '')); }
    } catch (e) { alert('Xatolik: ' + (e?.message || e)); } finally { setBusy(false); }
  };
  return <Modal open onClose={onClose} title={`Chek #${id}`} footer={<><Btn variant="ghost" onClick={() => setEdit(!edit)} icon={I.gear}>Sozlash</Btn><Btn variant="ghost" onClick={share} disabled={!o || busy}>Ulashish</Btn><Btn onClick={gallery} disabled={!o || busy} icon={I.download}>{busy ? 'Tayyorlanmoqda...' : 'Galereyaga saqlash'}</Btn></>}>
    {err && <ErrorBox text={err} />}
    {edit && <div className="form receipt-cfg">
      <Field label="Do‘kon nomi"><Input value={cfg.shop} onChange={(e) => upd('shop')(e.target.value)} /></Field>
      <Field label="Telefon"><Input value={cfg.phone} onChange={(e) => upd('phone')(e.target.value)} placeholder="+998 ..." /></Field>
      <Field label="Pastki yozuv" span><Input value={cfg.footer} onChange={(e) => upd('footer')(e.target.value)} /></Field>
      <Field label="Qog‘oz kengligi" span><div className="chips">{[40, 50].map((w) => <button key={w} type="button" className={'chip ' + (Number(cfg.width) === w ? 'on' : '')} onClick={() => upd('width')(w)}>{w} mm</button>)}</div></Field>
    </div>}
    {!o && !err ? <Spinner /> : preview ? <div className="receipt-prev"><img src={preview} alt={`Chek #${id}`} style={{ width: '100%', maxWidth: (canvas.current?.width || 384) + 'px', height: 'auto', display: 'block', margin: '0 auto' }} /></div> : null}
    <p className="muted small"><b>Chop etish:</b> "Galereyaga saqlash" ni bosing → <b>HereLabel</b> ilovasini oching → <b>Rasm</b> bo‘limi → shu chekni tanlang → chop eting. "Ulashish" orqali ham HereLabel'ga yuborib ko‘rish mumkin.</p>
  </Modal>;
}
