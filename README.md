# AppCash

Personal/family finance app for Android (Expo 57 + React Native).

## Features

- **Offline-first** local ledger (SQLite on the phone is the source of truth)
- Weekly AUD dashboard with week navigation
- Fixed income/bills (manual + reminders)
- Sporadic expenses/income quick add
- Receipt scan (Gemini → NVIDIA → OpenRouter)
- Savings goals + simulator
- Market prediction from receipt history
- Optional **purchase sheet** (Google Sheets): one simple Compras tab your partner can edit
- Excel/CSV export from Search

## Run

```bash
npm install
npx expo start
# or USB Android:
npm run android
```

## Get started

1. On login tap **Continue locally** (no Google required), or **Continue with Google**.
2. Add expenses, income, or scan receipts — everything saves on the phone.
3. (Optional) Account → **Purchase sheet** → create/link a spreadsheet and share it with your partner.
4. They edit the Compras tab (Fecha, Quién, Descripción, Categoría, Monto). You tap **Sync purchases**.

Categories, fixed bills, savings and AI keys **never** sync to the sheet.

## Google (optional)

1. OAuth in Google Cloud (Sheets + Drive APIs).
2. `.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (package + SHA-1).
3. Rebuild the native app after changing Client IDs.

## Receipt AI

Add keys in **Account → Receipt AI** (SecureStore on device). Scan uses Gemini first, then NVIDIA, then OpenRouter. OCR.space key is used only for NVIDIA text fallback.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Expo dev server |
| `npm run android` | Native Android run |
| `npm run lint` | Lint |
| `npm run typecheck` | TypeScript |
