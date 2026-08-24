// Anthropic API helper. Key is injected at build time by Vite from
// the VITE_ANTHROPIC_API_KEY environment variable set in Vercel.

var KEY = typeof __ANTHROPIC_KEY__ !== 'undefined' ? __ANTHROPIC_KEY__ : '';

export function hasKey() { return KEY.length > 0; }

export async function callClaude(messages, systemPrompt, opts) {
  if (!KEY) throw new Error('No API key — add VITE_ANTHROPIC_API_KEY to Vercel environment variables.');

  var body = {
    model: 'claude-sonnet-5',
    max_tokens: opts?.maxTokens || 1000,
    messages: messages,
  };
  if (systemPrompt) body.system = systemPrompt;
  if (opts?.tools)  body.tools  = opts.tools;

  // Detect whether any message contains a document block (PDF) — needs beta header
  var hasPdf = messages.some(function (m) {
    var content = Array.isArray(m.content) ? m.content : [];
    return content.some(function (b) { return b.type === 'document'; });
  });

  var headers = {
    'Content-Type': 'application/json',
    'x-api-key': KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (hasPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';

  var resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    var err = await resp.json().catch(function () { return {}; });
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  return resp.json();
}
