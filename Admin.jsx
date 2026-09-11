import React, { useState } from 'react';
import { api, fmtDate, L } from './api.js';
import { useLoad, Spinner, ErrorBox, Card, Btn, Modal, Field, Input, Select, Table, Badge, useToast, Confirm } from './ui.jsx';
import { saveFile, pickFile, readText } from './files.js';
import { useAuth } from './main.jsx';
import { I } from './icons.jsx';

export function Users() {
  const { data, loading, error, reload } = useLoad(() => api('/users'));
  const [edit, setEdit] = useState(null);
  const toast = useToast();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox text={error} />;
  return <div className="page">
    <div className="page-h"><h1>Foydalanuvchilar va haydovchilar</h1><Btn onClick={() => setEdit({})} icon={I.plus}>Yangi foydalanuvchi</Btn></div>
    <Card><Table columns={[{ key: 'name', h: 'Ism', render: (u) => <b>{u.name}</b> }, { key: 'username', h: 'Login' }, { key: 'role', h: 'Rol', render: (u) => <Badge cls={u.role === 'admin' ? 'red' : u.role === 'manager' ? 'blue' : 'green'}>{L.role[u.role]}</Badge> }, { key: 'phone', h: 'Telefon' }, { key: 'active', h: 'Holat', render: (u) => u.active ? <Badge cls="green">Faol</Badge> : <Badge cls="gray">O‘chirilgan</Badge> }, { key: 'created_at', h: 'Yaratilgan', render: (u) => fmtDate(u.created_at) }]} rows={data} onRow={(u) => setEdit(u)} /></Card>
    <div className="muted small" style={{ marginTop: 10 }}>Rollar: <b>Admin</b> — hamma narsa; <b>Menejer</b> — mahsulot, mijoz, buyurtma, to‘lov, xarajat, hisobotlar (foydalanuvchilarni boshqara olmaydi); <b>Haydovchi</b> — faqat o‘z buyurtmalari, mijozlari, yig‘gan pullari va xarajatlari.</div>
    {edit && <UserModal user={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); toast('Saqlandi'); }} />}
  </div>;
}
function UserModal({ user, onClose, onSaved }) {
  const isNew = !user.id;
  const [f, setF] = useState({ name: '', username: '', password: '', role: 'driver', phone: '', vehicle: '', active: true, ...user });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }));
  const save = async () => { setBusy(true); setErr(''); try { if (isNew) await api.post('/users', f); else await api.put(`/users/${user.id}`, f); onSaved(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return <Modal open onClose={onClose} title={isNew ? 'Yangi foydalanuvchi' : user.name} footer={<><Btn variant="ghost" onClick={onClose}>Bekor</Btn><Btn onClick={save} disabled={busy}>Saqlash</Btn></>}>
    <div className="form">
      <Field label="Ism familiya" span><Input value={f.name} onChange={set('name')} autoFocus /></Field>
      <Field label="Login"><Input value={f.username} onChange={set('username')} disabled={!isNew} autoCapitalize="none" /></Field>
      <Field label={isNew ? 'Parol' : 'Yangi parol (bo‘sh = o‘zgarmaydi)'}><Input value={f.password || ''} onChange={set('password')} type="text" /></Field>
      <Field label="Rol"><Select value={f.role} onChange={set('role')} options={[{ value: 'admin', label: 'Admin' }, { value: 'manager', label: 'Menejer' }, { value: 'driver', label: 'Haydovchi' }]} /></Field>
      <Field label="Telefon"><Input value={f.phone || ''} onChange={set('phone')} /></Field>
      {f.role === 'driver' && <Field label="Mashina" span><Input value={f.vehicle || ''} onChange={set('vehicle')} placeholder="Damas 01 A 123 AB" /></Field>}
      {!isNew && <label className="checkbox span"><input type="checkbox" checked={!!f.active} onChange={set('active')} /> Faol (tizimga kira oladi)</label>}
    </div>
    {err && <ErrorBox text={err} />}
  </Modal>;
}

export function Settings() {
  const { user, logout } = useAuth();
  const [o, setO] = useState(''); const [n, setN] = useState(''); const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(null);
  const { data: info, reload } = useLoad(() => api('/backup/info'));
  const toast = useToast();
  const save = async () => { try { await api.post('/auth/password', { old_password: o, new_password: n }); setO(''); setN(''); toast('Parol o‘zgartirildi'); } catch (e) { setMsg(e.message); } };
  const exportBackup = async () => { setBusy(true); try { const d = await api('/backup/export'); const name = `tovuq-zaxira-${new Date().toISOString().slice(0, 10)}.json`; await saveFile(JSON.stringify(d), name, 'application/json'); toast('Zaxira fayli tayyor'); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const importBackup = async () => { const f = await pickFile('.json,application/json'); if (!f) return; setBusy(true); try { const d = JSON.parse(await readText(f)); const r = await api.post('/backup/import', d); toast(`Tiklandi: ${r.tables.orders} buyurtma, ${r.tables.customers} mijoz`); setTimeout(() => window.location.reload(), 800); } catch (e) { toast('Xato: ' + e.message, 'err'); } finally { setBusy(false); } };
  const reset = async (mode) => { setBusy(true); try { await api.post('/backup/reset', { mode }); setConfirm(null); toast('Bajarildi'); setTimeout(() => window.location.reload(), 600); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  return <div className="page">
    <div className="page-h"><h1>Sozlamalar</h1></div>
    <div className="grid2">
      <Card title="Profil"><div className="form"><Field label="Ism"><Input value={user.name} disabled /></Field><Field label="Login"><Input value={user.username} disabled /></Field><Field label="Rol"><Input value={L.role[user.role]} disabled /></Field><Field label="Telefon"><Input value={user.phone || ''} disabled /></Field></div><Btn variant="ghost" onClick={logout} icon={I.logout} className="mt">Tizimdan chiqish</Btn></Card>
      <Card title="Parolni o‘zgartirish"><div className="form"><Field label="Eski parol" span><Input type="password" value={o} onChange={(e) => setO(e.target.value)} /></Field><Field label="Yangi parol" span><Input type="password" value={n} onChange={(e) => setN(e.target.value)} /></Field></div>{msg && <ErrorBox text={msg} />}<Btn onClick={save} disabled={!o || n.length < 4} className="mt">Saqlash</Btn></Card>
      {user.role === 'admin' && <Card title="Zaxira nusxa (juda muhim!)">
        <p className="muted small">Barcha ma’lumotlar faqat shu qurilmada saqlanadi. Qurilma buzilsa yoki ilova o‘chirilsa — ma’lumot yo‘qoladi. <b>Har kuni</b> zaxira faylni yuklab, Telegram/Google Drive’ga saqlab qo‘ying.</p>
        {info && <div className="info-line small" style={{ margin: '10px 0' }}>Bazada: {info.tables.customers} mijoz · {info.tables.orders} buyurtma · {info.tables.payments} to‘lov · {info.images} rasm · {info.size_kb} KB</div>}
        <div className="row-c wrap"><Btn variant="green" onClick={exportBackup} disabled={busy} icon={I.download}>Zaxira faylni yuklab olish</Btn><Btn variant="ghost" onClick={importBackup} disabled={busy} icon={I.refresh}>Zaxiradan tiklash</Btn></div>
      </Card>}
      {user.role === 'admin' && <Card title="Ma’lumotlarni tozalash">
        <p className="muted small">Ehtiyot bo‘ling: bu amallar qaytarilmaydi. Avval zaxira nusxa oling.</p>
        <div className="row-c wrap"><Btn variant="ghost" onClick={() => setConfirm('sample')}>Namunaviy ma’lumotlar bilan boshlash</Btn><Btn variant="ghost" onClick={() => setConfirm('catalog')}>Faqat katalog qoldirish (bo‘sh baza)</Btn><Btn variant="danger" onClick={() => setConfirm('empty')} icon={I.trash}>Hammasini o‘chirish</Btn></div>
      </Card>}
      <Card title="Ilova haqida"><p className="muted">Tovuq CRM v1.0 (offline) — tovuq mahsulotlari distribyutori uchun boshqaruv tizimi. Internet faqat xarita ko‘chalarini ko‘rsatish uchun kerak; qolgan hamma narsa qurilma ichida ishlaydi.</p></Card>
    </div>
    <Confirm open={!!confirm} onClose={() => setConfirm(null)} danger okText="Ha, bajarish" title="Ma’lumotlar o‘chiriladi" text={confirm === 'sample' ? 'Hozirgi barcha ma’lumotlar o‘chirilib, namunaviy ma’lumotlar yoziladi.' : confirm === 'catalog' ? 'Barcha mijoz, buyurtma, to‘lovlar o‘chiriladi; mahsulot katalogi va admin qoladi.' : 'Hamma narsa o‘chiriladi. Faqat admin (admin/admin123) qoladi.'} onOk={() => reset(confirm)} />
  </div>;
}
