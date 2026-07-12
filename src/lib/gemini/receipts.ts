import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import type { ParsedReceipt } from '@/types/models';
import { todayIsoDate } from '@/lib/dates';

const GEMINI_KEY = 'appcash_gemini_api_key';

export async function getGeminiApiKey(): Promise<string> {
  const stored = await SecureStore.getItemAsync(GEMINI_KEY);
  if (stored) return stored;
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
}

export async function setGeminiApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(GEMINI_KEY, key.trim());
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Gemini response had no JSON object');
  return JSON.parse(raw.slice(start, end + 1));
}

export async function parseReceiptWithGemini(imageUri: string): Promise<ParsedReceipt> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Add your Gemini API key in Settings to scan receipts.');
  }

  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const prompt = `You are extracting data from an Australian supermarket receipt (Woolworths, Aldi, Coles, etc).
Return ONLY valid JSON with this shape:
{
  "store": string,
  "purchased_at": "YYYY-MM-DD",
  "total_aud": number,
  "items": [
    {
      "name": string,
      "qty": number,
      "unit_price_aud": number,
      "line_total_aud": number,
      "category_guess": string
    }
  ]
}
Use AUD amounts. If date unknown use ${todayIsoDate()}. Ignore loyalty points.`;

  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error: ${errText}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? '';
  const parsed = extractJson(text) as ParsedReceipt;

  return {
    store: parsed.store || 'Unknown store',
    purchased_at: parsed.purchased_at || todayIsoDate(),
    total_aud: Number(parsed.total_aud) || 0,
    items: (parsed.items || []).map((item) => ({
      name: item.name || 'Item',
      qty: Number(item.qty) || 1,
      unit_price_aud: Number(item.unit_price_aud) || 0,
      line_total_aud:
        Number(item.line_total_aud) ||
        (Number(item.unit_price_aud) || 0) * (Number(item.qty) || 1),
      category_guess: item.category_guess || 'Groceries',
    })),
  };
}
