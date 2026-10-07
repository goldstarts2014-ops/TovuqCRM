import React, { useEffect, useState, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { api, token } from './api.js';
import { ToastProvider, Spinner, ErrorBoundary } from './ui.jsx';
import { Login } from './Login.jsx';
import { Dashboard } from './Dashboard.jsx';
import { Products, Inventory, Purchases } from './Catalog.jsx';
import { Customers, CustomerDetail, MapPage } from './Customers.jsx';
import { NewOrder, Orders } from './Orders.jsx';
import { Debts, Payments, Handover, Expenses, DayEnd } from './Finance.jsx';
import { Reports } from './Reports.jsx';
import { Users, Settings } from './Admin.jsx';
import { DriverHome } from './Driver.jsx';
import { I } from './icons.jsx';

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// ---- Hash-router ----
export function useRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => { const f = () => setHash(window.location.hash || '#/'); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const [pathPart, qs] = hash.slice(1).split('?');
  const parts = pathPart.split('/').filter(Boolean);
  return { path: '/' + parts.join('/'), parts, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export const go = (p) => { window.location.hash = p; };

const NAV = [
  { p: '/', l: 'Bosh sahifa', i: I.home, roles: ['admin', 'manager'] },
  { p: '/driver', l: 'Bugungi ish', i: I.truck, roles: ['driver'] },
  { p: '/orders/new', l: 'Yangi buyurtma', i: I.plus, roles: ['admin', 'manager', 'driver'], accent: true },
  { p: '/orders', l: 'Buyurtmalar', i: I.list, roles: ['admin', 'manager', 'driver'] },
  { p: '/customers', l: 'Mijozlar', i: I.users, roles: ['admin', 'manager', 'driver'] },
  { p: '/map', l: 'Xarita', i: I.map, roles: ['admin', 'manager', 'driver'] },
  { p: '/products', l: 'Mahsulotlar', i: I.box, roles: ['admin', 'manager', 'driver'] },
  { p: '/debts', l: 'Qarzlar', i: I.debt, roles: ['admin', 'manager', 'driver'] },
  { p: '/payments', l: 'To‘lovlar', i: I.cash, roles: ['admin', 'manager', 'driver'] },
  { p: '/handover', l: 'Pul topshirish', i: I.wallet, roles: ['admin', 'manager', 'driver'] },
  { p: '/expenses', l: 'Xarajatlar', i: I.receipt, roles: ['admin', 'manager', 'driver'] },
  { p: '/purchases', l: 'Zavoddan olish', i: I.factory, roles: ['admin', 'manager'] },
  { p: '/inventory', l: 'Ombor', i: I.warehouse, roles: ['admin', 'manager', 'driver'] },
  { p: '/day-end', l: 'Kun yakuni', i: I.moon, roles: ['admin', 'manager', 'driver'] },
  { p: '/reports', l: 'Hisobotlar', i: I.chart, roles: ['admin', 'manager', 'driver'] },
  { p: '/users', l: 'Foydalanuvchilar', i: I.shield, roles: ['admin'] },
  { p: '/settings', l: 'Sozlamalar', i: I.gear, roles: ['admin', 'manager', 'driver'] },
];
const MOBILE = { admin: ['/', '/orders/new', '/customers', '/map', '/day-end'], manager: ['/', '/orders/new', '/customers', '/map', '/day-end'], driver: ['/driver', '/orders/new', '/map', '/handover', '/debts'] };

function Router() {
  const { parts, query } = useRoute();
  const { user } = useAuth();
  const [a, b] = parts;
  if (!a) return user.role === 'driver' ? <DriverHome /> : <Dashboard />;
  if (a === 'driver') return <DriverHome />;
  if (a === 'orders' && b === 'new') return <NewOrder query={query} />;
  if (a === 'orders') return <Orders query={query} openId={b} />;
  if (a === 'customers' && b) return <CustomerDetail id={b} />;
  if (a === 'customers') return <Customers query={query} />;
  if (a === 'map') return <MapPage query={query} />;
  if (a === 'products') return <Products />;
  if (a === 'inventory') return <Inventory />;
  if (a === 'purchases') return <Purchases />;
  if (a === 'debts') return <Debts />;
  if (a === 'payments') return <Payments query={query} />;
  if (a === 'handover') return <Handover />;
  if (a === 'expenses') return <Expenses />;
  if (a === 'day-end') return <DayEnd />;
  if (a === 'reports') return <Reports query={query} />;
  if (a === 'users') return <Users />;
  if (a === 'settings') return <Settings />;
  return <div className="page"><h1>Sahifa topilmadi</h1></div>;
}

function Layout() {
  const { user, logout } = useAuth();
  const { path } = useRoute();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => n.roles.includes(user.role));
  const mobile = items.filter((n) => MOBILE[user.role].includes(n.p));
  const isActive = (p) => (p === '/' ? path === '/' : path === p || (path.startsWith(p + '/') && p !== '/orders') || (p === '/orders' && /^\/orders\/\d+$/.test(path)));
  useEffect(() => setOpen(false), [path]);
  return <div className="app">
    <aside className={'sidebar ' + (open ? 'open' : '')}>
      <div className="brand"><span className="logo">🐔</span><div><b>Tovuq CRM</b><small>Distribyutor · v1.4</small></div></div>
      <nav>{items.map((n) => <a key={n.p} href={'#' + n.p} className={(isActive(n.p) ? 'active ' : '') + (n.accent ? 'accent' : '')}>{n.i}<span>{n.l}</span></a>)}</nav>
      <div className="sb-user"><div className="avatar">{user.name[0]}</div><div><b>{user.name}</b><small>{{ admin: 'Admin', manager: 'Menejer', driver: 'Haydovchi' }[user.role]}</small></div><button onClick={logout} title="Chiqish">{I.logout}</button></div>
    </aside>
    {open && <div className="sb-bg" onClick={() => setOpen(false)} />}
    <main className="main">
      <header className="topbar"><button className="burger" onClick={() => setOpen(true)}>{I.menu}</button><span className="topbar-t">{items.find((n) => isActive(n.p))?.l || 'Tovuq CRM'}</span><a href="#/orders/new" className="btn primary sm">{I.plus} Buyurtma</a></header>
      <Router />
    </main>
    <nav className="bottomnav">{mobile.map((n) => <a key={n.p} href={'#' + n.p} className={isActive(n.p) ? 'active' : ''}>{n.i}<span>{n.l.split(' ')[0]}</span></a>)}<button onClick={() => setOpen(true)}>{I.menu}<span>Menyu</span></button></nav>
  </div>;
}

function App() {
  const [user, setUser] = useState(undefined);
  const logout = () => { token.set(null); setUser(null); };
  useEffect(() => {
    if (!token.get()) return setUser(null);
    api('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null));
    const f = () => setUser(null); window.addEventListener('tovuq:logout', f); return () => window.removeEventListener('tovuq:logout', f);
  }, []);
  if (user === undefined) return <div className="fullcenter"><Spinner /></div>;
  return <AuthCtx.Provider value={{ user, setUser, logout }}>{user ? <Layout /> : <Login onLogin={setUser} />}</AuthCtx.Provider>;
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><ToastProvider><App /></ToastProvider></ErrorBoundary>);
