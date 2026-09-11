import React, { useState } from 'react';
import { api, token } from './api.js';
import { Btn, Input } from './ui.jsx';

export function Login({ onLogin }) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const d = await api.post('/auth/login', { username: u, password: p }); token.set(d.token); onLogin(d.user); window.location.hash = d.user.role === 'driver' ? '#/driver' : '#/'; }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return <div className="login-bg">
    <form className="login" onSubmit={submit}>
      <div className="login-logo">🐔</div>
      <h1>Tovuq CRM</h1>
      <p className="muted">Distribyutorlik boshqaruv tizimi</p>
      <p className="muted small" style={{ textAlign: 'center', marginTop: -6 }}>Birinchi kirish: <b>admin</b> / <b>admin123</b></p>
      <label className="field"><span className="field-l">Login</span><Input value={u} onChange={(e) => setU(e.target.value)} autoFocus autoCapitalize="none" autoComplete="username" /></label>
      <label className="field"><span className="field-l">Parol</span><Input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></label>
      {err && <div className="errorbox">{err}</div>}
      <Btn type="submit" disabled={busy} className="w100">{busy ? 'Kirilmoqda...' : 'Kirish'}</Btn>
    </form>
  </div>;
}
