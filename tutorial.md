# AppCash — Tutorial de uso

Guía paso a paso para empezar a usar AppCash en Android (AUD, offline-first, Sheet opcional de compras).

---

## 1. Arrancar la app

```bash
cd appcash
npm install
npx expo run:android
```

O con USB:

```bash
npm run android
```

---

## 2. Primera vez — local o Google

1. Abre AppCash.
2. Pulsa **Continue locally** (recomendado) — no necesitas Google para usar la app.
3. O **Continue with Google** si ya quieres vincular el Sheet de compras.

Todo (gastos, categorías, fijos, ahorros) queda en el teléfono.

---

## 3. (Opcional) Vincular Sheet de compras

El Sheet **no** es la fuente de verdad. Solo espeja **compras** para tu pareja.

1. **More → Account → Purchase sheet** (o el checklist de Home).
2. Inicia sesión con Google si hace falta.
3. **Create purchase spreadsheet** o pega la URL de un Sheet existente.
4. Comparte el archivo con tu pareja. Ellos editan la pestaña **Compras** / Purchases:

| Fecha | Quién | Descripción | Categoría | Monto | id |
|-------|-------|-------------|-----------|-------|-----|

5. Tú pulsas **Sync purchases now**. Orden de sync: primero pull (filas nuevas de ella), luego push (tus compras).

Categorías, fijos y ahorros **nunca** van al Sheet.

---

## 4. Añadir gastos e ingresos

1. Tab **Add**.
2. Elige Expense / Income / Receipt.
3. Si hay 2+ perfiles: opción **Split 50/50 with partner**.
4. Guarda — queda en el teléfono; si hay Sheet vinculado, sync en segundo plano (reintentos limitados).

---

## 5. Escaneo de recibos (IA)

1. Add → Receipt (o cámara).
2. Claves en **Account → Receipt AI**: Gemini → NVIDIA → OpenRouter (y OCR.space opcional).
3. Revisa líneas y confirma. La foto se guarda en el teléfono; si hay Google, puede subir a Drive (suave, sin bloquear).

---

## 6. Presupuestos y Home

- Widget **Period Budget**: toca una categoría para poner tope semanal (solo local).
- Home muestra checklist de primeros pasos y un banner si hay compras pendientes de sync.
- Badge en **More** cuando hay cambios de compras sin subir.

---

## 7. Cerrar sesión / wipe

- **Sign out**: solo desconecta Google; los datos siguen en el teléfono.
- **Wipe phone data** (Profile) o **Unlink & wipe** (Purchase sheet): borra finanzas locales.

---

## Criterio de éxito

- Sin Google/red: añadir gastos, Home, savings, fixed.
- Con Sheet: pareja añade fila en Compras → Sync → aparece en la app.
- Un 401 de Google no rompe la app; solo pide volver a iniciar sesión para sync.
