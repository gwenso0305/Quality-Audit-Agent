import { GoogleGenAI } from '@google/genai';

const MODEL_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

// Track 429 quota exhaustion skips (10 minutes)
const quotaExhaustedUntil = new Map<string, number>();

export function isForceModelFailure(): boolean {
  const envVal = (process.env.FORCE_MODEL_FAILURE || '').trim().toLowerCase();
  return envVal === 'true';
}

export function logStartupModelSwitch(): void {
  if (isForceModelFailure()) {
    console.log('FORCE_MODEL_FAILURE is ON');
  } else {
    console.log('FORCE_MODEL_FAILURE is OFF');
  }
}

interface GenerateParams {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
}

interface GenerateResult {
  text: string;
  modelUsed: string;
}

export async function generateContentWithFallback(params: GenerateParams): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const maxPasses = 3;
  const passDelays = [0, 2000, 5000]; // 0s on pass 1, 2s before pass 2, 5s before pass 3
  const forceFailure = isForceModelFailure();

  for (let pass = 0; pass < maxPasses; pass++) {
    if (passDelays[pass] > 0) {
      console.log(`[fallback] All models exhausted in pass ${pass}. Waiting ${passDelays[pass] / 1000}s before next pass...`);
      await new Promise((resolve) => setTimeout(resolve, passDelays[pass]));
    }

    for (let i = 0; i < MODEL_LADDER.length; i++) {
      const model = MODEL_LADDER[i];

      // Check if model is in 10-minute quota cooldown
      const cooldownUntil = quotaExhaustedUntil.get(model);
      if (cooldownUntil && Date.now() < cooldownUntil) {
        console.log(`[fallback] Skipping ${model} due to active 10-minute 429 quota cooldown.`);
        continue;
      }

      console.log(`[fallback] Attempting model ${model} (pass ${pass + 1}/${maxPasses})...`);

      // Test switch: If FORCE_MODEL_FAILURE is true and this is the primary model, simulate 503
      if (forceFailure && i === 0) {
        console.warn(`[fallback] Simulated 503 error for primary model ${model} (FORCE_MODEL_FAILURE is ON).`);
        continue;
      }

      try {
        // Enforce 45s per-call timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            const err: any = new Error(`Request timed out after 45 seconds for model ${model}`);
            err.status = 504;
            err.code = 'TIMEOUT';
            reject(err);
          }, 45000);
        });

        const config: any = {};
        if (params.systemInstruction) {
          config.systemInstruction = params.systemInstruction;
        }
        if (params.responseMimeType) {
          config.responseMimeType = params.responseMimeType;
        }
        if (params.responseSchema) {
          config.responseSchema = params.responseSchema;
        }

        const callPromise = ai.models.generateContent({
          model,
          contents: params.contents,
          config,
        });

        const response: any = await Promise.race([callPromise, timeoutPromise]);
        const text = response?.text || '';

        return {
          text,
          modelUsed: model,
        };
      } catch (rawError: any) {
        const errorMsg = String(rawError?.message || rawError);
        const status = rawError?.status || rawError?.statusCode || 0;

        // Check for 402 or 403: Never retried
        if (status === 402 || status === 403 || errorMsg.includes('402') || errorMsg.includes('403') || errorMsg.includes('PERMISSION_DENIED') || errorMsg.includes('BILLING_DISABLED')) {
          console.error(`[fallback] Fatal authorization or billing error with model ${model}:`, errorMsg);
          const fatalError: any = new Error('The AI service is unavailable. Please tell the administrator.');
          fatalError.status = status || 403;
          fatalError.code = 'AI_UNAVAILABLE';
          throw fatalError;
        }

        // Check for 429 quota exhaustion: set 10-minute skip
        if (status === 429 || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
          console.warn(`[fallback] 429 Resource Exhausted on ${model}. Cooldown set for 10 minutes.`);
          quotaExhaustedUntil.set(model, Date.now() + 10 * 60 * 1000);
          continue;
        }

        // Recoverable errors: 503, 500, 404, or timeout
        const isRecoverable =
          status === 503 ||
          status === 500 ||
          status === 404 ||
          status === 504 ||
          errorMsg.includes('503') ||
          errorMsg.includes('500') ||
          errorMsg.includes('404') ||
          errorMsg.includes('504') ||
          errorMsg.includes('UNAVAILABLE') ||
          errorMsg.includes('INTERNAL') ||
          errorMsg.includes('NOT_FOUND') ||
          errorMsg.includes('timed out');

        if (isRecoverable) {
          console.warn(`[fallback] Recoverable error with model ${model} (status: ${status}): ${errorMsg}. Continuing down ladder.`);
          continue;
        }

        // Any other non-recoverable error (e.g., 400 Bad Request, schema error) -> fail fast
        console.error(`[fallback] Non-recoverable client error with model ${model}:`, errorMsg);
        throw rawError;
      }
    }
  }

  throw new Error('All AI models in the fallback ladder failed after maximum retry passes.');
}
