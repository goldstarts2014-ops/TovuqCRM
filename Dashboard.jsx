import React, { useState } from 'react';
import { api, fmt, money } from './api.js';
import { useLoad, Spinner, ErrorBox, Stat, Card, BarChart, Tabs, Badge } from './ui.jsx';
import { I } from './icons.jsx';

export function Dashboard() {
  const { data, loading, error, reload } = useLoad(() => api('/dashboard'));
  const [period, setPeriod] = useState('daily');
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  const t = data.today;
  const go = (p) => () => (window.location.hash = p);
  return <div className="page">
    <div className="page-h"><div><h1>Bugun</h1><p className="muted">{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><button className="btn ghost sm" onClick={reload}>{I.refresh} Yangilash</button></div>
    <div className="stats">
      <Stat big label="Bugungi savdo" value={t.sales} sub={`${t.orders} ta buyurtma`} icon={I.cart} onClick={go('/orders')} />
      <Stat big label="Bugungi tushgan pul" value={t.collected} color="green" sub={`Naqd ${fmt(t.cash)} · Karta ${fmt(t.card)} · Bank ${fmt(t.bank)}`} icon={I.cash} onClick={go('/payments')} />
      <Stat big label="Sof foyda" value={t.net_profit} color={t.net_profit >= 0 ? 'green' : 'red'} sub={`Yalpi ${fmt(t.gross_profit)} − xarajat ${fmt(t.expenses)}`} icon={I.trend} onClick={go('/day-end')} />
      <Stat big label="Qarzdorlikka berildi" value={t.new_debt} color="red" sub={`Qarz to‘lovlari: ${fmt(t.debt_payments)}`} icon={I.debt} onClick={go('/debts')} />
      <Stat label="Mijozlardan naqd pul" value={t.cash} color="green" icon={I.wallet} />
      <Stat label="Bugungi xarajat" value={t.expenses} color="red" icon={I.receipt} onClick={go('/expenses')} />
      <Stat label="Zavoddan olingan" value={t.purchases} icon={I.factory} onClick={go('/purchases')} />
      <Stat label="Yetkazilgan buyurtmalar" value={`${t.delivered} / ${t.orders}`} sub={t.pending ? `${t.pending} ta hisob-kitob kutilmoqda` : 'Hammasi yakunlangan'} icon={I.truck} onClick={go('/orders?settlement=pending')} />
      <Stat label="Qarzdor mijozlar" value={data.debtors.count} color="red" sub={`Jami qarz: ${money(data.debtors.total)}`} icon={I.users} onClick={go('/debts')} />
      <Stat label="Topshirilmagan pul" value={data.unhanded.total} color={data.unhanded.total > 0 ? 'orange' : ''} sub={`${data.unhanded.count} ta to‘lov`} icon={I.wallet} onClick={go('/handover')} />
    </div>
    <div className="grid2">
      <Card title="Statistika" right={<Tabs value={period} onChange={setPeriod} tabs={[{ value: 'daily', label: 'Kunlik' }, { value: 'weekly', label: 'Haftalik' }, { value: 'monthly', label: 'Oylik' }]} />}>
        <BarChart data={data.charts[period]} series={[{ key: 'sales', label: 'Savdo', color: '#374151' }, { key: 'collected', label: 'Tushum', color: '#16a34a' }, { key: 'profit', label: 'Sof foyda', color: '#dc2626' }]} />
        <div className="mini-stats">
          <div><span>Bu hafta savdo</span><b>{fmt(data.week.sales)}</b></div><div><span>Bu hafta foyda</span><b className="green">{fmt(data.week.net_profit)}</b></div>
          <div><span>Bu oy savdo</span><b>{fmt(data.month.sales)}</b></div><div><span>Bu oy foyda</span><b className="green">{fmt(data.month.net_profit)}</b></div>
        </div>
      </Card>
      <Card title="Ombor ogohlantirishi" right={<a href="#/inventory" className="link">Ombor →</a>}>
        {data.low_stock.length === 0 ? <div className="empty">Barcha mahsulotlar yetarli</div> : <ul className="warn-list">{data.low_stock.map((p) => <li key={p.id}><span>{I.alert}</span><b>{p.name}</b><Badge cls={p.quantity <= 0 ? 'red' : 'orange'}>{fmt(p.quantity, 1)} {p.unit}</Badge><small>min {fmt(p.min_stock)}</small></li>)}</ul>}
        <div className="muted small" style={{ marginTop: 12 }}>Ombordagi mahsulot qiymati: <b>{money(data.stock_value)}</b></div>
      </Card>
    </div>
  </div>;
}
