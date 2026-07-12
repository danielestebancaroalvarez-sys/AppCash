# AppCash — Tutorial de uso

Guía paso a paso para empezar a usar AppCash en Android (AUD, Google Sheets, recibos con Gemini).

---

## 1. Arrancar la app

```bash
cd appcash
npm install
npx expo run:android
```

O con USB:

```bash
npm run dev:android
```

---

## 2. Primera vez — Google

1. Abre AppCash.
2. Pulsa **Continue with Google**.
3. Elige tu cuenta Gmail.
4. Acepta permisos de Sheets / Drive (si aparecen).

Si ves aviso “unsafe / no verificada”: es normal en Testing/Production sin verificación. Usa **Avanzado → Continuar** o deja la app en **Testing** con tu email como Test user.

---

## 3. Crear o vincular el Google Sheet

El Sheet es la fuente de verdad de tus datos.

1. Ve a **Settings** (engranaje).
2. Pulsa **Create AppCash spreadsheet**  
   → crea un libro en tu Drive con las hojas (`transactions`, `fixed_items`, etc.).
3. O pega un **Spreadsheet ID** existente y pulsa **Link spreadsheet ID**.
4. Pulsa **Sync now**.

Abre el Sheet en Google Drive para ver los datos en vivo.

---

## 4. Perfiles (tú + pareja)

1. Arriba a la derecha → icono de perfil.
2. Elige el perfil activo (**Daniel** / **Partner**).
3. Todo lo que registres se guarda con ese `user_id`.
4. Renombra “Partner” más adelante desde datos/Sheet o creando categorías/usuarios según uses la app.

---

## 5. Gastos e ingresos fijos

Renta, sueldos, gym, suscripciones…

1. **Settings → Manage fixed income & bills**.
2. **Add fixed item**.
3. Completa:
   - Nombre (ej. Rent)
   - Monto AUD
   - Income / Expense
   - Periodo (weekly / fortnightly / monthly / yearly)
   - Persona
   - Categoría
   - **Auto debit** ON si se cobra solo  
     OFF si es manual → configura **Notify days before**
4. Guarda.

Para avisos locales: **Settings → Schedule payment notifications**.

---

## 6. Registrar un gasto o ingreso rápido

1. Tab **+ (Add)**.
2. Elige **Expense** o **Income**.
3. Monto, comercio, nota, categoría y quién.
4. **Save entry**.

Aparece en **Search** y en el Dashboard de esa semana.

---

## 7. Escanear un recibo (Woolworths / Aldi)

DeepSeek **no ve fotos** (solo texto). En AppCash puedes usar:

| Proveedor | Cómo | Key gratis |
|-----------|------|------------|
| **OpenRouter** (recomendado) | Lee la foto directo con modelo free | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **DeepSeek** | OCR.space (gratis) + DeepSeek estructura JSON | [platform.deepseek.com](https://platform.deepseek.com) + [ocr.space](https://ocr.space/ocrapi) |
| Gemini | Si tu cuota aún funciona | Google AI Studio |

1. **Settings → Receipt AI** → elige proveedor y pega la API key → **Save**.
2. Tab **+ → Receipt scan**.
3. Foto o galería → revisa ítems → **Confirm & save**.

Modelo OpenRouter por defecto: `openrouter/free` (elige solo un modelo gratis que soporte visión). Si falla, la app prueba otros free automáticamente.

---

## 8. Dashboard semanal

1. Tab **Dashboard**.
2. Flechas ‹ › para cambiar de semana.
3. Verás:
   - Fixed in / Sporadic in
   - Fixed out / Variable out
   - Neto
   - Mix por categoría
   - Gasto día a día
   - Por persona

Pull-to-refresh sincroniza con Sheets.

---

## 9. Ahorros

1. Tab **Savings**.
2. Crea una meta (nombre + target AUD).
3. Registra aportes.
4. Usa el **simulador** (“si ahorro $X/semana…”).

---

## 10. Predicción de mercado

Cuando tengas varios recibos:

1. **Settings → Recompute & open insights**.
2. Verás productos que suelen comprarse cada N días y precio medio.

---

## 11. Buscar y notificaciones

- **Search**: filtra por texto y por persona.
- Campana (arriba): bandeja de recordatorios (pagos manuales, etc.).

---

## 12. Importar / exportar Excel

1. **Settings → Import Excel / CSV** — migra tu cuadrito antiguo.
2. **Export Excel** — comparte un snapshot.

Columnas útiles al importar: `date`, `amount_aud`, `category`, `user`, `merchant`, `note`, `type`.

---

## 13. Cerrar sesión

1. Perfil → **Sign out**.
2. Confirma en el modal.
3. La caché local permanece en el teléfono hasta que borres datos de la app.

---

## Checklist “ya estoy operando”

- [ ] Login Google OK  
- [ ] Spreadsheet creado/vinculado  
- [ ] Perfiles revisados  
- [ ] Al menos 1 fijo (renta o sueldo)  
- [ ] 1 gasto variable de prueba  
- [ ] (Opcional) Gemini key + 1 recibo  
- [ ] Sync now sin error  

---

## Problemas frecuentes

| Síntoma | Qué hacer |
|---------|-----------|
| `DEVELOPER_ERROR` | SHA-1 del cliente Android = `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` (keystore `android/app/debug.keystore`) |
| `access_denied` / Testing | Añade tu Gmail en Test users |
| Aviso unsafe | Normal sin verificación; Testing + test users es lo ideal en uso personal |
| Recibo no lee | Revisa Gemini API key en Settings |
| Tabs tapados por Android | Actualiza la app (safe area en tab bar); reinstala si hace falta |

---

## Dónde está cada cosa

| Quiero… | Dónde |
|---------|--------|
| Ver la semana | Dashboard |
| Buscar movimientos | Search |
| Añadir / escanear | + |
| Metas | Savings |
| Fijos, sync, Gemini, Excel | Settings |
| Cuenta / sign out | Perfil (arriba derecha) |
| Recordatorios | Campana |
