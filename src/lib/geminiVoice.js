const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const GEMINI_VOICE_MODEL = 'gemini-3.5-flash-lite';

export class GeminiVoiceError extends Error {
  constructor(message, code = 'request_failed', status = null) {
    super(message);
    this.name = 'GeminiVoiceError';
    this.code = code;
    this.status = status;
  }
}

function cleanKey(value) {
  const key = String(value || '').trim();
  if (!key) throw new GeminiVoiceError('Gemini API key is not configured. Add it in Settings.', 'not_configured');
  return key;
}

function outputText(payload) {
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const content = Array.isArray(steps[index]?.content) ? steps[index].content : [];
    const text = content
      .filter(item => item?.type === 'text' && typeof item.text === 'string')
      .map(item => item.text)
      .join('');
    if (text) return text;
  }
  return '';
}

async function callGemini(apiKey, body) {
  let response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey(apiKey),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new GeminiVoiceError('Gemini could not be reached from this browser or network.', 'network_error');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || `Gemini returned HTTP ${response.status}.`;
    const code = response.status === 400 || response.status === 401 || response.status === 403
      ? 'invalid_key_or_request'
      : response.status === 429
        ? 'rate_limited'
        : 'request_failed';
    throw new GeminiVoiceError(detail, code, response.status);
  }

  return payload;
}

export async function testGeminiApiKey(apiKey) {
  const payload = await callGemini(apiKey, {
    model: GEMINI_VOICE_MODEL,
    input: 'Return exactly the word OK.',
    generation_config: {
      temperature: 0,
      max_output_tokens: 8,
    },
  });
  if (!/\bOK\b/i.test(outputText(payload))) {
    throw new GeminiVoiceError('Gemini responded, but the connection test did not return the expected response.', 'unexpected_response');
  }
  return { ok: true, model: GEMINI_VOICE_MODEL };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new GeminiVoiceError('The recorded audio could not be read.', 'audio_read_failed'));
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.readAsDataURL(blob);
  });
}

function normaliseMimeType(value) {
  const raw = String(value || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (raw === 'audio/mp4') return 'audio/m4a';
  return raw || 'audio/webm';
}

export async function parseVoiceTrip(audioBlob, apiKey, stationNames) {
  if (!(audioBlob instanceof Blob) || audioBlob.size === 0) {
    throw new GeminiVoiceError('No microphone audio was recorded.', 'empty_audio');
  }
  if (audioBlob.size > 20 * 1024 * 1024) {
    throw new GeminiVoiceError('Voice recording is too large. Try a shorter request.', 'audio_too_large');
  }

  const stations = [...new Set((stationNames || []).map(name => String(name || '').trim()).filter(Boolean))];
  if (!stations.length) throw new GeminiVoiceError('PulseRoute station data is unavailable.', 'station_data_missing');

  const data = await blobToBase64(audioBlob);
  const prompt = [
    'You are the voice trip parser for PulseRoute, a Singapore public-transport journey planner.',
    'Listen to the commuter request and identify the origin MRT station and destination MRT station.',
    'Return station names exactly as written in the allowed list. Correct natural speech variants and spacing such as "Buonavista" to "Buona Vista".',
    'If an origin or destination cannot be determined confidently, return an empty string for that field. Do not invent a station.',
    'Also return a short verbatim-style transcript of the spoken request.',
    '',
    `Allowed operational MRT stations: ${stations.join(', ')}`,
  ].join('\n');

  const payload = await callGemini(apiKey, {
    model: GEMINI_VOICE_MODEL,
    input: [
      { type: 'text', text: prompt },
      {
        type: 'audio',
        data,
        mime_type: normaliseMimeType(audioBlob.type),
      },
    ],
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: {
        type: 'object',
        properties: {
          transcript: { type: 'string' },
          origin: { type: 'string' },
          destination: { type: 'string' },
        },
        required: ['transcript', 'origin', 'destination'],
        additionalProperties: false,
      },
    },
    generation_config: {
      temperature: 0,
      max_output_tokens: 160,
    },
  });

  const text = outputText(payload);
  if (!text) throw new GeminiVoiceError('Gemini returned no voice-trip result.', 'empty_response');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiVoiceError('Gemini returned an unreadable voice-trip result. Please try again.', 'invalid_json');
  }

  return {
    transcript: String(parsed?.transcript || '').trim(),
    origin: String(parsed?.origin || '').trim(),
    destination: String(parsed?.destination || '').trim(),
    model: GEMINI_VOICE_MODEL,
  };
}
