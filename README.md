# 🐔 Tovuq CRM — planshet uchun offline ilova (APK)

Barcha fayllar **bitta papkada** — GitHub'ga fayllarni sudrab tashlab yuklash uchun (papkalar kerak emas).

## GitHub orqali APK olish

**1. Fayllarni yuklash.** GitHub'da repozitoriy oching → "uploading an existing file" → shu papkadagi **hamma fayllarni** (`.jsx`, `.js`, `.svg`, `.png`, `.json`, `.html`, `.css`, `.mjs`, `.yml`, `.md`) belgilab sudrab tashlang → **Commit changes**.
`.github` papkasi yuklanmasa ham mayli — u keyingi qadamda qo'lda yaratiladi. `node_modules`, `dist`, `assets` papkalari kerak emas.

**2. Yig'uvchi faylni yaratish (eng muhim qadam).** Repozitoriy sahifasida **Add file → Create new file** → nom maydoniga aynan shunday yozing:

```
.github/workflows/android.yml
```

(GitHub `/` belgisidan keyin papkalarni o'zi yaratadi). Pastdagi matn maydoniga shu papkadagi `android.yml` faylining ichidagi matnni to'liq nusxalab qo'ying (Bloknotda ochib, Ctrl+A, Ctrl+C) → **Commit changes**.

**3. Kutish.** Yuqoridagi **Actions** bo'limida "Android APK" jarayoni ishga tushadi (5–10 daqiqa). "Enable workflows" so'rasa — ruxsat bering va **Run workflow** ni bosing.

**4. APK.** Yashil ✔ chiqqach: repozitoriy bosh sahifasi → o'ngda **Releases → latest** → `tovuq-crm.apk`. Planshetda oching → o'rnating. Login `admin`, parol `admin123`.

**5. Har kuni zaxira nusxa oling:** Sozlamalar → "Zaxira faylni yuklab olish" → Telegram/Drive'ga saqlang. Ma'lumot faqat planshetda saqlanadi!

## Dasturchilar uchun
`npm install && npm run build` → `dist/`. `npx cap add android && npx cap sync android` → Android loyihasi.
Fayllar: `main.jsx` (kirish), `api.js` → `localapi.js` (mahalliy API) → `localdb.js` (IndexedDB), `services.js` (biznes mantiq), `reports.js`, `xlsx.js`, `pdf.js`, `files.js`; sahifalar: `Dashboard.jsx`, `Orders.jsx`, `Customers.jsx`, `Catalog.jsx`, `Finance.jsx`, `Reports.jsx`, `Driver.jsx`, `Admin.jsx`, `Login.jsx`; `ui.jsx`, `icons.jsx`; `index.html`, `styles.css`, `sw.js`; mahsulot rasmlari `*.svg`; ilova ikonkalari `icon-*.png`, `splash*.png`.
