// Umumiy UI komponentlar
import React, { useEffect, useState, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { fmt } from './api.js';

// ---- Toast ----
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = (msg, type = 'ok') => { const id = Date.now() + Math.random(); setList((l) => [...l, { id, msg, type }]); setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3500); };
  return <ToastCtx.Provider value={push}>{children}<div className="toasts">{list.map((t) => <div key={t.id} className={'toast ' + t.type}>{t.msg}</div>)}</div></ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

// ---- Ma'lumot yuklash ----
export function useLoad(fn, deps = []) {
  const [state, set] = useState({ data: null, loading: true, error: null });
  const reload = () => { set((s) => ({ ...s, loading: true })); return fn().then((data) => set({ data, loading: false, error: null })).catch((e) => set({ data: null, loading: false, error: e.message })); };
  useEffect(() => { reload(); }, deps);
  return { ...state, reload };
}

export const Spinner = () => <div className="spinner"><div /></div>;
export const Empty = ({ text = 'Ma’lumot yo‘q' }) => <div className="empty">{text}</div>;
// Xato xabari: chiqqanda o'ziga aylantiriladi (tugmalar tepada, xato pastda qolib ketmasin)
export function ErrorBox({ text }) {
  const ref = useRef(null);
  useEffect(() => { try { if (ref.current && text) ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }, [text]);
  return <div ref={ref} className="errorbox">{text}</div>;
}

export function Card({ title, right, children, className = '', pad = true }) {
  return <section className={'card ' + className}>{(title || right) && <header className="card-h"><h3>{title}</h3>{right}</header>}<div className={pad ? 'card-b' : ''}>{children}</div></section>;
}

export function Stat({ label, value, sub, color = '', icon, onClick, big }) {
  return <div className={'stat ' + color + (onClick ? ' clickable' : '') + (big ? ' big' : '')} onClick={onClick}>
    <div className="stat-l">{icon && <span className="stat-i">{icon}</span>}{label}</div>
    <div className="stat-v">{typeof value === 'number' ? fmt(value) : value}</div>
    {sub && <div className="stat-s">{sub}</div>}
  </div>;
}

export const Badge = ({ cls = 'gray', children }) => <span className={'badge ' + cls}>{children}</span>;

export function Btn({ children, variant = 'primary', size, onClick, type = 'button', disabled, icon, className = '', title }) {
  return <button type={type} title={title} className={`btn ${variant} ${size || ''} ${className}`} onClick={onClick} disabled={disabled}>{icon}{children}</button>;
}

export function Modal({ open, onClose, title, children, wide, footer }) {
  useEffect(() => { if (!open) return; const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); window.__modalCount = (window.__modalCount || 0) + 1; document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', k); window.__modalCount = Math.max(0, (window.__modalCount || 1) - 1); if (!window.__modalCount) document.body.style.overflow = ''; }; }, [open]);
  if (!open) return null;
  // Oyna document.body ga chiziladi: ichma-ich oynalar (Buyurtma → Chek) eski WebView'da ham to'g'ri ko'rinadi
  return createPortal(<div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={'modal ' + (wide ? 'wide' : '')}>
      <header className="modal-h"><h3>{title}</h3>{footer && <div className="modal-h-actions">{footer}</div>}<button className="x" onClick={onClose} aria-label="Yopish">×</button></header>
      <div className="modal-b"><ErrorBoundary>{children}</ErrorBoundary></div>
    </div>
  </div>, document.body);
}

export const Field = ({ label, children, hint, span }) => <label className={'field ' + (span ? 'span' : '')}><span className="field-l">{label}</span>{children}{hint && <span className="hint">{hint}</span>}</label>;
export const Input = React.forwardRef((props, ref) => <input ref={ref} className={'input ' + (props.className || '')} {...props} />);
export const Select = ({ options, value, onChange, placeholder, ...rest }) => <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>{placeholder !== undefined && <option value="">{placeholder}</option>}{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
export const Textarea = (props) => <textarea className="input" rows={2} {...props} />;

export function NumberInput({ value, onChange, min = 0, step = 1, suffix, ...rest }) {
  return <div className="numinput"><input className="input" type="number" inputMode="decimal" min={min} step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />{suffix && <span className="suffix">{suffix}</span>}</div>;
}

export function SearchBox({ value, onChange, placeholder = 'Qidirish...' }) {
  return <div className="search"><span>⌕</span><input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></div>;
}

export function DateRange({ from, to, onChange }) {
  const set = (f, t) => onChange({ from: f, to: t });
  const t = new Date(); const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayS = iso(t);
  const presets = [
    ['Bugun', () => set(todayS, todayS)],
    ['Kecha', () => { const d = new Date(t); d.setDate(d.getDate() - 1); set(iso(d), iso(d)); }],
    ['7 kun', () => { const d = new Date(t); d.setDate(d.getDate() - 6); set(iso(d), todayS); }],
    ['Bu oy', () => set(todayS.slice(0, 8) + '01', todayS)],
    ['O‘tgan oy', () => { const d = new Date(t.getFullYear(), t.getMonth() - 1, 1); const e = new Date(t.getFullYear(), t.getMonth(), 0); set(iso(d), iso(e)); }],
  ];
  return <div className="daterange">
    <input className="input" type="date" value={from} onChange={(e) => set(e.target.value, to)} />
    <span>—</span>
    <input className="input" type="date" value={to} onChange={(e) => set(from, e.target.value)} />
    <div className="presets">{presets.map(([l, f]) => <button key={l} type="button" className="chip" onClick={f}>{l}</button>)}</div>
  </div>;
}

export function Table({ columns, rows, keyField = 'id', onRow, empty, footer }) {
  if (!rows?.length) return <Empty text={empty} />;
  return <div className="tbl-wrap"><table className="tbl">
    <thead><tr>{columns.map((c) => <th key={c.key} className={c.num ? 'num' : ''} style={c.w ? { width: c.w } : undefined}>{c.h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r[keyField] ?? i} className={onRow ? 'clickable' : ''} onClick={onRow ? () => onRow(r) : undefined}>{columns.map((c) => <td key={c.key} className={c.num ? 'num' : ''} data-label={c.h}>{c.render ? c.render(r) : c.num ? fmt(r[c.key]) : r[c.key]}</td>)}</tr>)}</tbody>
    {footer && <tfoot><tr>{columns.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{footer[c.key] != null ? (typeof footer[c.key] === 'number' ? fmt(footer[c.key]) : footer[c.key]) : ''}</td>)}</tr></tfoot>}
  </table></div>;
}

export function Tabs({ tabs, value, onChange }) {
  return <div className="tabs">{tabs.map((t) => <button key={t.value} className={'tab ' + (t.value === value ? 'active' : '')} onClick={() => onChange(t.value)}>{t.label}</button>)}</div>;
}

export function Confirm({ open, onClose, onOk, title = 'Tasdiqlaysizmi?', text, okText = 'Ha', danger }) {
  return <Modal open={open} onClose={onClose} title={title} footer={<><Btn variant="ghost" onClick={onClose}>Bekor</Btn><Btn variant={danger ? 'danger' : 'primary'} onClick={onOk}>{okText}</Btn></>}>{text}</Modal>;
}

// ---- Grafik (SVG ustunli/chiziqli) ----
export function BarChart({ data, series, height = 220, money = true }) {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => { const ro = new ResizeObserver((e) => setW(e[0].contentRect.width)); if (ref.current) ro.observe(ref.current); return () => ro.disconnect(); }, []);
  const [hover, setHover] = useState(null);
  const padL = 44, padB = 26, padT = 12, padR = 8;
  const max = Math.max(1, ...data.reduce((a, d) => a.concat(series.map((s) => Math.abs(Number(d[s.key]) || 0))), []));
  const nice = niceMax(max);
  const cw = w - padL - padR, ch = height - padB - padT;
  const gw = cw / Math.max(1, data.length);
  const bw = Math.min(28, (gw * 0.7) / series.length);
  const y = (v) => padT + ch - (Math.max(0, v) / nice) * ch;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * nice);
  const short = (v) => (v >= 1e9 ? (v / 1e9).toFixed(1) + ' mlrd' : v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + ' mln' : v >= 1e3 ? (v / 1e3).toFixed(0) + ' ming' : String(Math.round(v)));
  return <div ref={ref} className="chart">
    <svg width={w} height={height}>
      {ticks.map((t) => <g key={t}><line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} className="grid" /><text x={padL - 6} y={y(t) + 4} className="axis" textAnchor="end">{short(t)}</text></g>)}
      {data.map((d, i) => <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}>
        <rect x={padL + i * gw} y={padT} width={gw} height={ch} fill="transparent" />
        {series.map((s, si) => { const v = Number(d[s.key]) || 0; const x = padL + i * gw + gw / 2 - (bw * series.length) / 2 + si * bw; return <rect key={s.key} x={x} y={v < 0 ? y(0) : y(v)} width={bw - 2} height={Math.max(0, Math.abs(y(v) - y(0)))} rx={3} fill={v < 0 ? '#dc2626' : s.color} opacity={hover === null || hover === i ? 1 : 0.45} />; })}
        {(data.length <= 16 || i % Math.ceil(data.length / 16) === 0) && <text x={padL + i * gw + gw / 2} y={height - 8} className="axis" textAnchor="middle">{d.label}</text>}
      </g>)}
    </svg>
    <div className="legend">{series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    {hover !== null && data[hover] && <div className="tip">{data[hover].label}: {series.map((s) => <div key={s.key}><i style={{ background: s.color }} />{s.label}: <b>{fmt(data[hover][s.key])}{money ? ' so‘m' : ''}</b></div>)}</div>}
  </div>;
}
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10; return n * p; }

export const ProductImg = ({ src, alt, className = '' }) => <img className={'pimg ' + className} src={src ? src.replace(/^\//, '') : 'img/products/default.svg'} alt={alt || ''} loading="lazy" onError={(e) => { e.currentTarget.src = 'img/products/default.svg'; }} />;

// Xato ushlagich: biror qism buzilsa butun ekran oqarib qolmaydi — xabar va "qayta urinish" chiqadi
export class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { try { console.error(err); } catch (e) {} }
  render() {
    if (!this.state.err) return this.props.children;
    return <div className="errorbox" style={{ margin: 16 }}><b>Xatolik yuz berdi.</b><div className="small" style={{ margin: '6px 0 10px' }}>{String((this.state.err && this.state.err.message) || this.state.err)}</div><button className="btn ghost sm" onClick={() => this.setState({ err: null })}>Qayta urinish</button> <button className="btn ghost sm" onClick={() => window.location.reload()}>Ilovani qayta yuklash</button></div>;
  }
}
