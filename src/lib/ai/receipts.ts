import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { Image } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ParsedReceipt } from '@/types/models';
import { normalizeReceiptDate, todayIsoDate } from '@/lib/dates';
import { isReceiptNoiseLine } from '@/lib/purchases/filter';

/** Cascade providers (DeepSeek removed). Order is always Gemini → NVIDIA → OpenRouter. */
export type ReceiptAiProvider = 'gemini' | 'nvidia' | 'openrouter';

export type ReceiptScanProgress = {
  stage: 'prepare' | 'provider' | 'model' | 'fallback' | 'done';
  provider?: ReceiptAiProvider;
  model?: string;
  message: string;
  /** 1-based attempt across the cascade */
  attempt?: number;
  totalAttempts?: number;
};

export type ParseReceiptOptions = {
  onProgress?: (progress: ReceiptScanProgress) => void;
};

type PreparedReceiptImage = {
  uri: string;
  base64: string;
  width: number;
  height: number;
  /** Approximate payload size in KB (base64). */
  sizeKb: number;
};

/** Longest edge after resize — enough for OCR, small enough for fast uploads. */
const RECEIPT_MAX_EDGE = 1280;
const RECEIPT_JPEG_QUALITY = 0.55;

const KEYS = {
  provider: 'appcash_receipt_ai_provider',
  openrouter: 'appcash_openrouter_api_key',
  deepseek: 'appcash_deepseek_api_key',
  gemini: 'appcash_gemini_api_key',
  nvidia: 'appcash_nvidia_api_key',
  ocrSpace: 'appcash_ocrspace_api_key',
} as const;

/** Strip quotes/whitespace users often paste from dashboards. */
function sanitizeApiKey(key: string): string {
  return key.trim().replace(/^["']+|["']+$/g, '').trim();
}

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
Use AUD amounts. If date unknown use ${today}. Ignore loyalty points.
Do NOT include footer lines as items: Total, Subtotal, GST, Tax, Change, Cash, Card, EFTPOS, Rounding, Amount Due, or payment method lines.
Only real products/SKUs belong in "items". The receipt grand total goes ONLY in "total_aud".`;

const PROVIDER_LABEL: Record<ReceiptAiProvider, string> = {
  gemini: 'Gemini',
  nvidia: 'NVIDIA',
  openrouter: 'OpenRouter',
};

/** @deprecated Cascade is fixed; kept for Settings compatibility. */
export async function getReceiptProvider(): Promise<ReceiptAiProvider> {
  const stored = await SecureStore.getItemAsync(KEYS.provider);
  if (stored === 'openrouter' || stored === 'gemini' || stored === 'nvidia') {
    return stored;
  }
  if (await getGeminiApiKey()) return 'gemini';
  if (await getNvidiaApiKey()) return 'nvidia';
  if (await getOpenRouterApiKey()) return 'openrouter';
  return 'gemini';
}

/** @deprecated Cascade is fixed; kept for Settings compatibility. */
export async function setReceiptProvider(provider: ReceiptAiProvider): Promise<void> {
  await SecureStore.setItemAsync(KEYS.provider, provider);
}

export async function getOpenRouterApiKey(): Promise<string> {
  return sanitizeApiKey(
    (await SecureStore.getItemAsync(KEYS.openrouter)) ||
      process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ||
      ''
  );
}

export async function setOpenRouterApiKey(key: string): Promise<void> {
  const clean = sanitizeApiKey(key);
  if (!clean) {
    await SecureStore.deleteItemAsync(KEYS.openrouter);
    return;
  }
  await SecureStore.setItemAsync(KEYS.openrouter, clean);
}

/** @deprecated DeepSeek removed from cascade */
export async function getDeepSeekApiKey(): Promise<string> {
  return sanitizeApiKey(
    (await SecureStore.getItemAsync(KEYS.deepseek)) ||
      process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ||
      ''
  );
}

/** @deprecated DeepSeek removed from cascade */
export async function setDeepSeekApiKey(key: string): Promise<void> {
  const clean = sanitizeApiKey(key);
  if (!clean) {
    await SecureStore.deleteItemAsync(KEYS.deepseek);
    return;
  }
  await SecureStore.setItemAsync(KEYS.deepseek, clean);
}

export async function getGeminiApiKey(): Promise<string> {
  return sanitizeApiKey(
    (await SecureStore.getItemAsync(KEYS.gemini)) || process.env.EXPO_PUBLIC_GEMINI_API_KEY || ''
  );
}

export async function setGeminiApiKey(key: string): Promise<void> {
  const clean = sanitizeApiKey(key);
  if (!clean) {
    await SecureStore.deleteItemAsync(KEYS.gemini);
    return;
  }
  await SecureStore.setItemAsync(KEYS.gemini, clean);
}

export async function getNvidiaApiKey(): Promise<string> {
  return sanitizeApiKey(
    (await SecureStore.getItemAsync(KEYS.nvidia)) || process.env.EXPO_PUBLIC_NVIDIA_API_KEY || ''
  );
}

export async function setNvidiaApiKey(key: string): Promise<void> {
  const clean = sanitizeApiKey(key);
  if (!clean) {
    await SecureStore.deleteItemAsync(KEYS.nvidia);
    return;
  }
  await SecureStore.setItemAsync(KEYS.nvidia, clean);
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

function tryRepairTruncatedJson(slice: string): unknown | null {
  let s = slice.trim();
  let inString = false;
  let escaped = false;
  for (const ch of s) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
  }
  if (inString) s += '"';
  s = s.replace(/,\s*$/, '');
  const stack: string[] = [];
  inString = false;
  escaped = false;
  for (const ch of s) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  if (!stack.length) return null;
  s += stack.reverse().join('');
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  if (!raw) throw new Error('AI returned an empty response');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1) throw new Error('AI response had no JSON object');
  const slice = end > start ? raw.slice(start, end + 1) : raw.slice(start);
  try {
    return JSON.parse(slice);
  } catch {
    const repaired = tryRepairTruncatedJson(slice);
    if (repaired) return repaired;
    throw new Error('AI returned incomplete JSON');
  }
}

function choiceText(choice: {
  message?: { content?: unknown; reasoning_content?: unknown };
}): string {
  const content = choice.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: string }).text ?? '');
        }
        return '';
      })
      .join('\n');
  }
  const reasoning = choice.message?.reasoning_content;
  if (typeof reasoning === 'string') return reasoning;
  return '';
}

async function readJsonBody<T>(res: Response, label: string): Promise<T> {
  const raw = await res.text();
  if (!raw.trim()) {
    throw new Error(`${label}: empty HTTP body (${res.status})`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${label}: invalid JSON (${res.status}): ${raw.slice(0, 180)}`);
  }
}

function normalizeParsed(parsed: ParsedReceipt): ParsedReceipt {
  return {
    store: parsed.store || 'Unknown store',
    purchased_at: normalizeReceiptDate(parsed.purchased_at || ''),
    total_aud: Number(parsed.total_aud) || 0,
    items: (parsed.items || [])
      .filter((item) => !isReceiptNoiseLine(item.name || ''))
      .map((item) => ({
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

async function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error instanceof Error ? error : new Error(String(error)))
    );
  });
}

/**
 * Resize + JPEG-compress before any AI upload.
 * Reused across the whole provider cascade so we don't re-encode per attempt.
 */
async function prepareReceiptImage(
  imageUri: string,
  onProgress?: ProgressFn
): Promise<PreparedReceiptImage> {
  report(onProgress, {
    stage: 'prepare',
    message: 'Optimizing photo (resize + compress)…',
  });

  let width = 0;
  let height = 0;
  try {
    const size = await getImageSize(imageUri);
    width = size.width;
    height = size.height;
  } catch {
    // Still try manipulate — some content:// URIs fail getSize on Android
  }

  const longest = Math.max(width, height);
  const context = ImageManipulator.manipulate(imageUri);
  if (longest > RECEIPT_MAX_EDGE && width > 0 && height > 0) {
    if (width >= height) {
      context.resize({ width: RECEIPT_MAX_EDGE });
    } else {
      context.resize({ height: RECEIPT_MAX_EDGE });
    }
    report(onProgress, {
      stage: 'prepare',
      message: `Resizing ${width}×${height} → max ${RECEIPT_MAX_EDGE}px…`,
    });
  } else if (!width || !height) {
    // Unknown size: force a safe width cap (portrait receipts stay readable)
    context.resize({ width: RECEIPT_MAX_EDGE });
    report(onProgress, {
      stage: 'prepare',
      message: `Resizing photo to max ${RECEIPT_MAX_EDGE}px…`,
    });
  } else {
    report(onProgress, {
      stage: 'prepare',
      message: `Compressing ${width}×${height} JPEG…`,
    });
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: RECEIPT_JPEG_QUALITY,
    base64: true,
  });

  const base64 = saved.base64;
  if (!base64) {
    // Fallback read if native didn't return base64
    const fallback = await FileSystem.readAsStringAsync(saved.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return {
      uri: saved.uri,
      base64: fallback,
      width: saved.width,
      height: saved.height,
      sizeKb: Math.round((fallback.length * 0.75) / 1024),
    };
  }

  const sizeKb = Math.round((base64.length * 0.75) / 1024);
  report(onProgress, {
    stage: 'prepare',
    message: `Photo ready · ${saved.width}×${saved.height} · ~${sizeKb} KB`,
  });

  return {
    uri: saved.uri,
    base64,
    width: saved.width,
    height: saved.height,
    sizeKb,
  };
}

type ProgressFn = ((p: ReceiptScanProgress) => void) | undefined;

function report(
  onProgress: ProgressFn,
  partial: Omit<ReceiptScanProgress, 'message'> & { message: string }
) {
  onProgress?.(partial);
}

function shortModel(model: string): string {
  const parts = model.split('/');
  return parts[parts.length - 1] || model;
}

async function ocrSpaceExtractText(prepared: PreparedReceiptImage): Promise<string> {
  const apiKey = await getOcrSpaceApiKey();
  const body = new URLSearchParams();
  body.append('base64Image', `data:image/jpeg;base64,${prepared.base64}`);
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

async function parseWithOpenRouter(
  prepared: PreparedReceiptImage,
  onProgress?: ProgressFn
): Promise<ParsedReceipt> {
  const apiKey = await getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error('No OpenRouter API key. Add one in Settings → AI.');
  }

  report(onProgress, {
    stage: 'provider',
    provider: 'openrouter',
    message: 'OpenRouter — preparing free vision models…',
  });

  const preferred = process.env.EXPO_PUBLIC_OPENROUTER_MODEL?.trim();
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
            image_url: { url: `data:image/jpeg;base64,${prepared.base64}` },
          },
        ],
      },
    ],
  };

  let lastError = 'No OpenRouter model available';
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    report(onProgress, {
      stage: 'model',
      provider: 'openrouter',
      model,
      attempt: i + 1,
      totalAttempts: models.length,
      message: `OpenRouter · ${shortModel(model)} — sending photo (${i + 1}/${models.length})…`,
    });

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
      report(onProgress, {
        stage: 'fallback',
        provider: 'openrouter',
        model,
        message: `OpenRouter · ${shortModel(model)} failed — trying next model…`,
      });
      continue;
    }

    report(onProgress, {
      stage: 'model',
      provider: 'openrouter',
      model,
      message: `OpenRouter · ${shortModel(model)} — reading response…`,
    });

    try {
      const data = await readJsonBody<{ choices?: Array<{ message?: { content?: unknown } }> }>(
        res,
        `OpenRouter ${model}`
      );
      const text = choiceText(data.choices?.[0] ?? {});
      if (!text.trim()) {
        lastError = `Empty response from ${model}`;
        continue;
      }
      return normalizeParsed(extractJson(text) as ParsedReceipt);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      report(onProgress, {
        stage: 'fallback',
        provider: 'openrouter',
        model,
        message: `OpenRouter · ${shortModel(model)} parse failed — next…`,
      });
    }
  }

  throw new Error(`OpenRouter: no model worked. Last error: ${lastError}`);
}

async function parseWithGemini(
  prepared: PreparedReceiptImage,
  onProgress?: ProgressFn
): Promise<ParsedReceipt> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('No Gemini API key. Add one in Settings → AI (aistudio.google.com/apikey).');
  }

  report(onProgress, {
    stage: 'provider',
    provider: 'gemini',
    message: 'Gemini — preparing models…',
  });

  const preferred = process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim();
  const models = [
    preferred,
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash',
  ].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);

  let lastError = 'No Gemini model available';
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    report(onProgress, {
      stage: 'model',
      provider: 'gemini',
      model,
      attempt: i + 1,
      totalAttempts: models.length,
      message: `Gemini · ${model} — sending photo (${i + 1}/${models.length})…`,
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: RECEIPT_PROMPT(todayIsoDate()) },
              { inline_data: { mime_type: 'image/jpeg', data: prepared.base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.1 },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (/API_KEY_INVALID|API key not valid/i.test(body)) {
        throw new Error(
          'Gemini API key is invalid. Update it in Settings → AI, or the app will try NVIDIA next.'
        );
      }
      lastError = body.slice(0, 200);
      report(onProgress, {
        stage: 'fallback',
        provider: 'gemini',
        model,
        message: `Gemini · ${model} failed — trying next model…`,
      });
      continue;
    }

    report(onProgress, {
      stage: 'model',
      provider: 'gemini',
      model,
      message: `Gemini · ${model} — extracting line items…`,
    });

    try {
      const data = await readJsonBody<{
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      }>(res, 'Gemini');
      const text =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? '';
      if (!text.trim()) {
        lastError = `Empty response from ${model}`;
        continue;
      }
      return normalizeParsed(extractJson(text) as ParsedReceipt);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      report(onProgress, {
        stage: 'fallback',
        provider: 'gemini',
        model,
        message: `Gemini · ${model} parse failed — next…`,
      });
    }
  }

  throw new Error(`Gemini: no model worked. Last error: ${lastError}`);
}

async function parseNvidiaFromOcr(
  apiKey: string,
  prepared: PreparedReceiptImage,
  onProgress?: ProgressFn
): Promise<ParsedReceipt> {
  const model = 'meta/llama-3.1-8b-instruct';
  report(onProgress, {
    stage: 'fallback',
    provider: 'nvidia',
    model,
    message: 'NVIDIA — OCR fallback (reading text from photo)…',
  });
  const ocrText = await ocrSpaceExtractText(prepared);
  report(onProgress, {
    stage: 'model',
    provider: 'nvidia',
    model,
    message: `NVIDIA · ${shortModel(model)} — structuring OCR text…`,
  });

  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 4096,
      stream: false,
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
    throw new Error(`NVIDIA OCR fallback error: ${await res.text()}`);
  }

  const data = await readJsonBody<{
    choices?: Array<{ message?: { content?: unknown } }>;
  }>(res, 'NVIDIA OCR fallback');
  const text = choiceText(data.choices?.[0] ?? {});
  if (!text.trim()) throw new Error('NVIDIA OCR fallback returned empty content');
  return normalizeParsed(extractJson(text) as ParsedReceipt);
}

async function parseWithNvidia(
  prepared: PreparedReceiptImage,
  onProgress?: ProgressFn
): Promise<ParsedReceipt> {
  const apiKey = await getNvidiaApiKey();
  if (!apiKey) {
    throw new Error('No NVIDIA API key. Add one in Settings → AI (build.nvidia.com).');
  }

  report(onProgress, {
    stage: 'provider',
    provider: 'nvidia',
    message: 'NVIDIA NIM — preparing vision models…',
  });

  const preferred = process.env.EXPO_PUBLIC_NVIDIA_MODEL?.trim();
  const models = [
    preferred,
    'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
    'meta/llama-3.2-11b-vision-instruct',
  ].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i);

  const bodyBase = {
    temperature: 0,
    max_tokens: 4096,
    stream: false,
    messages: [
      {
        role: 'user' as const,
        content: [
          {
            type: 'image_url' as const,
            image_url: { url: `data:image/jpeg;base64,${prepared.base64}` },
          },
          { type: 'text' as const, text: RECEIPT_PROMPT(todayIsoDate()) },
        ],
      },
    ],
  };

  let lastError = 'No NVIDIA vision model available';
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    report(onProgress, {
      stage: 'model',
      provider: 'nvidia',
      model,
      attempt: i + 1,
      totalAttempts: models.length,
      message: `NVIDIA · ${shortModel(model)} — sending photo (${i + 1}/${models.length})…`,
    });

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
      report(onProgress, {
        stage: 'fallback',
        provider: 'nvidia',
        model,
        message: `NVIDIA · ${shortModel(model)} failed — trying next…`,
      });
      continue;
    }

    report(onProgress, {
      stage: 'model',
      provider: 'nvidia',
      model,
      message: `NVIDIA · ${shortModel(model)} — extracting line items…`,
    });

    try {
      const data = await readJsonBody<{
        choices?: Array<{ message?: { content?: unknown } }>;
      }>(res, `NVIDIA ${model}`);
      const text = choiceText(data.choices?.[0] ?? {});
      if (!text.trim()) {
        lastError = `Empty response from ${model}`;
        continue;
      }
      return normalizeParsed(extractJson(text) as ParsedReceipt);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      report(onProgress, {
        stage: 'fallback',
        provider: 'nvidia',
        model,
        message: `NVIDIA · ${shortModel(model)} parse failed — next…`,
      });
    }
  }

  try {
    return await parseNvidiaFromOcr(apiKey, prepared, onProgress);
  } catch (e) {
    const ocrErr = e instanceof Error ? e.message : String(e);
    throw new Error(`NVIDIA failed (${lastError}). OCR fallback: ${ocrErr}`);
  }
}

/**
 * Fixed cascade: Gemini → NVIDIA → OpenRouter.
 * Within each provider, failed models fall through to the next model.
 */
export async function parseReceiptImage(
  imageUri: string,
  options?: ParseReceiptOptions
): Promise<ParsedReceipt> {
  const onProgress = options?.onProgress;
  const errors: string[] = [];

  const prepared = await prepareReceiptImage(imageUri, onProgress);

  const cascade: Array<{
    id: ReceiptAiProvider;
    hasKey: () => Promise<string>;
    run: () => Promise<ParsedReceipt>;
  }> = [
    {
      id: 'gemini',
      hasKey: getGeminiApiKey,
      run: () => parseWithGemini(prepared, onProgress),
    },
    {
      id: 'nvidia',
      hasKey: getNvidiaApiKey,
      run: () => parseWithNvidia(prepared, onProgress),
    },
    {
      id: 'openrouter',
      hasKey: getOpenRouterApiKey,
      run: () => parseWithOpenRouter(prepared, onProgress),
    },
  ];

  const available = [];
  for (const step of cascade) {
    if (await step.hasKey()) available.push(step);
  }

  if (!available.length) {
    throw new Error(
      'No AI keys configured. Add Gemini, NVIDIA, or OpenRouter in Settings → AI.'
    );
  }

  for (let i = 0; i < available.length; i++) {
    const step = available[i];
    if (i > 0) {
      report(onProgress, {
        stage: 'fallback',
        provider: step.id,
        message: `${PROVIDER_LABEL[available[i - 1].id]} failed — switching to ${PROVIDER_LABEL[step.id]}…`,
      });
    }

    try {
      const parsed = await step.run();
      report(onProgress, {
        stage: 'done',
        provider: step.id,
        message: `Done with ${PROVIDER_LABEL[step.id]}`,
      });
      return parsed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${PROVIDER_LABEL[step.id]}: ${msg}`);
    }
  }

  throw new Error(
    `All providers failed.\n\n${errors.map((e) => `• ${e}`).join('\n')}\n\nCheck keys in Settings → AI.`
  );
}

/** @deprecated use parseReceiptImage */
export async function parseReceiptWithGemini(imageUri: string): Promise<ParsedReceipt> {
  return parseReceiptImage(imageUri);
}
