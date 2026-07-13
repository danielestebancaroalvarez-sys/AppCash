import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import type { ParsedReceipt } from '@/types/models';
import { todayIsoDate } from '@/lib/dates';

export type ReceiptAiProvider = 'openrouter' | 'deepseek' | 'gemini' | 'nvidia';

const KEYS = {
  provider: 'appcash_receipt_ai_provider',
  openrouter: 'appcash_openrouter_api_key',
  deepseek: 'appcash_deepseek_api_key',
  gemini: 'appcash_gemini_api_key',
  nvidia: 'appcash_nvidia_api_key',
  ocrSpace: 'appcash_ocrspace_api_key',
} as const;

const RECEIPT_PROMPT = (today: string) =>
  `You are extracting data from an Australian supermarket receipt (Woolworths, Aldi, Coles, etc).
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
Use AUD amounts. If date unknown use ${today}. Ignore loyalty points.`;

export async function getReceiptProvider(): Promise<ReceiptAiProvider> {
  const stored = await SecureStore.getItemAsync(KEYS.provider);
  if (
    stored === 'openrouter' ||
    stored === 'deepseek' ||
    stored === 'gemini' ||
    stored === 'nvidia'
  ) {
    return stored;
  }
  // Prefer whatever key is available
  if (await getOpenRouterApiKey()) return 'openrouter';
  if (await getDeepSeekApiKey()) return 'deepseek';
  if (await getGeminiApiKey()) return 'gemini';
  if (await getNvidiaApiKey()) return 'nvidia';
  return 'openrouter';
}

export async function setReceiptProvider(provider: ReceiptAiProvider): Promise<void> {
  await SecureStore.setItemAsync(KEYS.provider, provider);
}

export async function getOpenRouterApiKey(): Promise<string> {
  return (
    (await SecureStore.getItemAsync(KEYS.openrouter)) ||
    process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ||
    ''
  );
}

export async function setOpenRouterApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.openrouter, key.trim());
}

export async function getDeepSeekApiKey(): Promise<string> {
  return (
    (await SecureStore.getItemAsync(KEYS.deepseek)) ||
    process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ||
    ''
  );
}

export async function setDeepSeekApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.deepseek, key.trim());
}

export async function getGeminiApiKey(): Promise<string> {
  return (
    (await SecureStore.getItemAsync(KEYS.gemini)) ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    ''
  );
}

export async function setGeminiApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.gemini, key.trim());
}

export async function getNvidiaApiKey(): Promise<string> {
  return (
    (await SecureStore.getItemAsync(KEYS.nvidia)) ||
    process.env.EXPO_PUBLIC_NVIDIA_API_KEY ||
    ''
  );
}

export async function setNvidiaApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.nvidia, key.trim());
}

export async function getOcrSpaceApiKey(): Promise<string> {
  return (
    (await SecureStore.getItemAsync(KEYS.ocrSpace)) ||
    process.env.EXPO_PUBLIC_OCRSPACE_API_KEY ||
    'helloworld'
  );
}

export async function setOcrSpaceApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.ocrSpace, key.trim());
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI response had no JSON object');
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeParsed(parsed: ParsedReceipt): ParsedReceipt {
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

async function readImageBase64(imageUri: string): Promise<string> {
  return FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/** Free OCR for DeepSeek path (text-only models). Get a free key at https://ocr.space/ocrapi */
async function ocrSpaceExtractText(imageUri: string): Promise<string> {
  const apiKey = await getOcrSpaceApiKey();
  const base64 = await readImageBase64(imageUri);
  const body = new URLSearchParams();
  body.append('base64Image', `data:image/jpeg;base64,${base64}`);
  body.append('language', 'eng');
  body.append('isOverlayRequired', 'false');
  body.append('OCREngine', '2');
  body.append('scale', 'true');

  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`OCR.space error: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[];
    ParsedResults?: Array<{ ParsedText?: string }>;
  };

  if (data.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join(' ')
      : data.ErrorMessage || 'OCR failed';
    throw new Error(`OCR.space: ${msg}`);
  }

  const text = data.ParsedResults?.map((r) => r.ParsedText ?? '').join('\n').trim();
  if (!text) throw new Error('OCR.space returned empty text. Try a clearer photo.');
  return text;
}

async function parseWithOpenRouter(imageUri: string): Promise<ParsedReceipt> {
  const apiKey = await getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error(
      'Add an OpenRouter API key in Settings (free at openrouter.ai — use a free vision model).'
    );
  }

  const base64 = await readImageBase64(imageUri);
  const preferred = process.env.EXPO_PUBLIC_OPENROUTER_MODEL?.trim();
  // openrouter/free auto-picks a free model that supports the request features (incl. vision)
  const models = [
    preferred,
    'openrouter/free',
    'qwen/qwen2.5-vl-72b-instruct:free',
    'meta-llama/llama-3.2-11b-vision-instruct:free',
    'google/gemma-3-27b-it:free',
  ].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);

  const bodyBase = {
    temperature: 0.1,
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: RECEIPT_PROMPT(todayIsoDate()) },
          {
            type: 'image_url' as const,
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          },
        ],
      },
    ],
  };

  let lastError = 'No OpenRouter model available';
  for (const model of models) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://appcash.local',
        'X-Title': 'AppCash',
      },
      body: JSON.stringify({ ...bodyBase, model }),
    });

    if (!res.ok) {
      lastError = await res.text();
      // try next model if this endpoint is gone / rate-limited
      if (res.status === 404 || res.status === 429 || res.status === 503) continue;
      throw new Error(`OpenRouter error: ${lastError}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) {
      lastError = `Empty response from ${model}`;
      continue;
    }
    return normalizeParsed(extractJson(text) as ParsedReceipt);
  }

  throw new Error(
    `OpenRouter: no free vision model worked. Last error: ${lastError}\n\n` +
      'Set EXPO_PUBLIC_OPENROUTER_MODEL to a current free vision model from openrouter.ai/models, or use DeepSeek + OCR in Settings.'
  );
}

async function parseWithDeepSeek(imageUri: string): Promise<ParsedReceipt> {
  const apiKey = await getDeepSeekApiKey();
  if (!apiKey) {
    throw new Error('Add a DeepSeek API key in Settings (platform.deepseek.com).');
  }

  // DeepSeek chat is text-only → OCR first, then structure
  const ocrText = await ocrSpaceExtractText(imageUri);

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: `${RECEIPT_PROMPT(todayIsoDate())}

OCR text from the receipt photo:
---
${ocrText}
---`,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek error: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  return normalizeParsed(extractJson(text) as ParsedReceipt);
}

async function parseWithGemini(imageUri: string): Promise<ParsedReceipt> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Add your Gemini API key in Settings.');
  }

  const base64 = await readImageBase64(imageUri);
  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: RECEIPT_PROMPT(todayIsoDate()) },
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini error: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? '';
  return normalizeParsed(extractJson(text) as ParsedReceipt);
}

/** NVIDIA NIM hosted API (build.nvidia.com) — OpenAI-compatible vision models. */
async function parseWithNvidia(imageUri: string): Promise<ParsedReceipt> {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) {
    throw new Error(
      'Add an NVIDIA API key in Settings (free at build.nvidia.com — Get API Key).'
    );
  }

  const base64 = await readImageBase64(imageUri);
  const preferred = process.env.EXPO_PUBLIC_NVIDIA_MODEL?.trim();
  const models = [
    preferred,
    'meta/llama-3.2-11b-vision-instruct',
    'microsoft/phi-3.5-vision-instruct',
  ].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);

  const bodyBase = {
    temperature: 0.1,
    max_tokens: 2048,
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: RECEIPT_PROMPT(todayIsoDate()) },
          {
            type: 'image_url' as const,
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          },
        ],
      },
    ],
  };

  let lastError = 'No NVIDIA vision model available';
  for (const model of models) {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ...bodyBase, model }),
    });

    if (!res.ok) {
      lastError = await res.text();
      if (res.status === 404 || res.status === 429 || res.status === 503) continue;
      throw new Error(`NVIDIA NIM error: ${lastError}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) {
      lastError = `Empty response from ${model}`;
      continue;
    }
    return normalizeParsed(extractJson(text) as ParsedReceipt);
  }

  throw new Error(
    `NVIDIA NIM: no vision model worked. Last error: ${lastError}\n\n` +
      'Get a free key at build.nvidia.com, or set EXPO_PUBLIC_NVIDIA_MODEL to a vision model from the catalog.'
  );
}

/** Main entry — uses the provider selected in Settings. */
export async function parseReceiptImage(imageUri: string): Promise<ParsedReceipt> {
  const provider = await getReceiptProvider();
  switch (provider) {
    case 'deepseek':
      return parseWithDeepSeek(imageUri);
    case 'gemini':
      return parseWithGemini(imageUri);
    case 'nvidia':
      return parseWithNvidia(imageUri);
    case 'openrouter':
    default:
      return parseWithOpenRouter(imageUri);
  }
}

/** @deprecated use parseReceiptImage */
export async function parseReceiptWithGemini(imageUri: string): Promise<ParsedReceipt> {
  return parseReceiptImage(imageUri);
}
