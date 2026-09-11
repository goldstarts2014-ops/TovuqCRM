// API mijozi (mahalliy baza ustida) va yordamchi funksiyalar
export const token = { get: () => localStorage.getItem('tovuq_token'), set: (t) => (t ? localStorage.setItem('tovuq_token', t) : localStorage.removeItem('tovuq_token')) };

import { localApi } from './localapi.js';
export async function api(path, { method = 'GET', body, form } = {}) {
  try { return await localApi(path, { method, body, form }); }
  catch (e) {
    if (e.status === 401) { token.set(null); window.dispatchEvent(new Event('tovuq:logout')); }
    if (e.status) throw new Error(e.message);
    console.error(e); throw new Error(e.message || 'Xatolik');
  }
}
api.post = (p, body) => api(p, { method: 'POST', body });
api.put = (p, body) => api(p, { method: 'PUT', body });
api.del = (p, body) => api(p, { method: 'DELETE', body: body || {} });

export const fmt = (n, d = 0) => (Number(n) || 0).toLocaleString('ru-RU', { maximumFractionDigits: d }).replace(/ /g, ' ');
export const money = (n) => fmt(n) + ' so‘m';
export const qty = (n, unit = '') => fmt(n, 2) + (unit ? ' ' + unit : '');
export const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const addDays = (date, n) => { const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const monthStart = (date = today()) => date.slice(0, 8) + '01';
export const fmtDate = (s) => (s ? String(s).slice(0, 10).split('-').reverse().join('.') : '—');
export const fmtDateTime = (s) => { if (!s) return '—'; const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z'); return isNaN(d) ? s : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };

export const L = {
  pay: { cash: 'Naqd', card: 'Karta', bank: 'Bank', debt: 'Qarzdorlik' },
  status: { new: 'Yangi', on_way: 'Yo‘lda', delivered: 'Yetkazildi', cancelled: 'Bekor qilindi' },
  settlement: { pending: 'Kutilmoqda', paid: 'To‘lov olindi', debt: 'Qarzga berildi', partial: 'Qisman to‘landi' },
  ctype: { dokon: 'Do‘kon', supermarket: 'Supermarket', oshxona: 'Oshxona', restoran: 'Restoran', boshqa: 'Boshqa' },
  role: { admin: 'Admin', manager: 'Menejer', driver: 'Haydovchi' },
  unit: { kg: 'kg', dona: 'dona', quti: 'quti' },
};
// Buyurtmaning umumiy holati (haydovchi oqimi + hisob-kitob)
export const orderState = (o) => (o.status === 'cancelled' ? { text: 'Bekor', cls: 'gray' } : o.settlement === 'paid' ? { text: 'To‘lov olindi', cls: 'green' } : o.settlement === 'debt' ? { text: 'Qarzga berildi', cls: 'red' } : o.settlement === 'partial' ? { text: 'Qisman to‘landi', cls: 'orange' } : o.status === 'delivered' ? { text: 'Yetkazildi', cls: 'blue' } : o.status === 'on_way' ? { text: 'Yo‘lda', cls: 'orange' } : { text: 'Yangi', cls: 'gray' });
export const navUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
export const yandexUrl = (lat, lng) => `https://yandex.uz/maps/?rtext=~${lat},${lng}&rtt=auto`;
