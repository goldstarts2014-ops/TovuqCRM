// Faylni saqlash / ulashish: Android (Capacitor) yoki brauzer
const toBase64 = (bytes) => { let s = ''; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)); return btoa(s); };
const cap = () => (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? window.Capacitor : null);

export async function saveFile(data, filename, mime) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const C = cap();
  if (C && typeof C.registerPlugin === 'function') {
    // Native plaginlar (Android): @capacitor/filesystem, @capacitor/share — cap sync orqali ro'yxatga olingan
    const Filesystem = C.Plugins?.Filesystem || C.registerPlugin('Filesystem');
    const Share = C.Plugins?.Share || C.registerPlugin('Share');
    const r = await Filesystem.writeFile({ path: filename, data: toBase64(bytes), directory: 'CACHE' });
    if (Share) { try { await Share.share({ title: filename, url: r.uri, dialogTitle: 'Faylni ulashish / saqlash' }); return; } catch (e) { if (String(e?.message || e).includes('cancel')) return; } }
    try { await Filesystem.writeFile({ path: filename, data: toBase64(bytes), directory: 'DOCUMENTS' }); alert('Fayl "Documents" papkasiga saqlandi: ' + filename); } catch { alert('Faylni saqlab bo‘lmadi'); }
    return;
  }
  const blob = new Blob([bytes], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export function pickFile(accept = '.json') {
  return new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });
}
export const readText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });
