# AppCash

Personal/family finance app for Android (Expo 57 + React Native).

## Features

- Weekly AUD dashboard with dynamic week navigation
- Fixed income/bills (auto-debit vs manual + notifications)
- Sporadic expenses/income quick add
- Receipt scan via Gemini (Woolworths/Aldi line items)
- Savings goals + weekly simulator
- Market prediction from receipt history
- Google Sign-In + Google Sheets sync (source of truth)
- Local SQLite cache / demo mode
- Excel import/export

## Run

```bash
npm install
npx expo start
# or USB Android:
npm run android
# scripts/android-usb.ps1 forwards Metro then starts Expo
```

## Demo mode

On the login screen tap **Enter local demo** to explore with seeded sample data (no Google required).

## Google Sheets

1. Create OAuth credentials in Google Cloud (enable Sheets + Drive APIs).
2. Put the Web client ID in `.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
3. Sign in → Settings → **Create AppCash spreadsheet** (or paste an existing spreadsheet ID).

## Gemini receipts

Add your Gemini API key in **Settings** (stored in SecureStore), then use **Add → Receipt scan**.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Expo dev server |
| `npm run android` | Native Android run |
| `npm run lint` | Lint |
