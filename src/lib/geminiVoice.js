export class GeminiVoiceError extends Error {
  constructor(message, code = 'request_failed', status = null) {
    super(message);
    this.name = 'GeminiVoiceError';
    this.code = code;
    this.status = status;
  }
}

function outputText(payload) {
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const content = Array.isArray(steps[index]?.content) ? steps[index].content : [];
    const text = content.filter(item => item?.type === 'text' && typeof item.text === 'string').map(item => item.text).join('');
    if (text) return text;
  }
  return '';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new GeminiVoiceError('The recorded audio could not be read.', 'audio_read_failed'));
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.readAsDataURL(blob);
  });
}

export async function parseVoiceTrip(audioBlob, stationNames) {
  if (!(audioBlob instanceof Blob) || audioBlob.size === 0) throw new GeminiVoiceError('No microphone audio was recorded.', 'empty_audio');
  if (audioBlob.size > 20 * 1024 * 1024) throw new GeminiVoiceError('Voice recording is too large. Try a shorter request.', 'audio_too_large');
  const data = await blobToBase64(audioBlob);
  const rawMime = String(audioBlob.type || 'audio/webm').split(';')[0].toLowerCase();
  let response;
  try {
    response = await fetch('/api/gemini/voice', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, mimeType: rawMime === 'audio/mp4' ? 'audio/m4a' : rawMime }),
    });
  } catch { throw new GeminiVoiceError('Gemini Voice is unavailable. You can still type your trip.', 'backend_unavailable'); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new GeminiVoiceError(payload.message || 'Gemini Voice is unavailable.', response.status === 429 ? 'rate_limited' : 'request_failed', response.status);
  let parsed;
  try { parsed = JSON.parse(outputText(payload)); }
  catch { throw new GeminiVoiceError('Gemini returned an unreadable voice-trip result. Please try again.', 'invalid_json'); }
  const allowed = new Set(stationNames || []);
  return {
    transcript: String(parsed?.transcript || '').trim(),
    origin: allowed.has(parsed?.origin) ? parsed.origin : '',
    destination: allowed.has(parsed?.destination) ? parsed.destination : '',
  };
}
