// Anthropic API helper. Key is injected at build time by Vite from
// the VITE_ANTHROPIC_API_KEY environment variable set in Vercel.

var KEY = typeof __ANTHROPIC_KEY__ !== 'undefined' ? __ANTHROPIC_KEY__ : '';

export function hasKey() { return KEY.length > 0; }

export async function callClaude(messages, systemPrompt, opts) {
  if (!KEY) throw new Error('No API key — add VITE_ANTHROPIC_API_KEY to Vercel environment variables.');

  // Detect attachment types — fileId = Files API reference, data = inline base64
  var hasAttachment = messages.some(function (m) {
    var content = Array.isArray(m.content) ? m.content : [];
    return content.some(function (b) { return b.type === 'document' || b.type === 'image'; });
  });

  var hasPdf = messages.some(function (m) {
    var content = Array.isArray(m.content) ? m.content : [];
    return content.some(function (b) { return b.type === 'document'; });
  });

  var hasFileId = messages.some(function (m) {
    var content = Array.isArray(m.content) ? m.content : [];
    return content.some(function (b) {
      return (b.type === 'document' || b.type === 'image') && b.source?.type === 'file';
    });
  });

  // Route through serverless proxy when attachments are present.
  // Files API references (fileId) need both pdfs and files beta headers.
  // Inline base64 also goes through proxy to avoid CORS with beta headers.
  if (hasAttachment) {
    var betaHeaders = [];
    if (hasPdf)     betaHeaders.push('pdfs-2024-09-25');
    if (hasFileId)  betaHeaders.push('files-api-2025-04-14');

    var proxyBody = {
      messages,
      maxTokens: opts?.maxTokens || 1000,
    };
    if (systemPrompt)          proxyBody.systemPrompt = systemPrompt;
    if (opts?.tools)           proxyBody.tools        = opts.tools;
    if (betaHeaders.length)    proxyBody.beta         = betaHeaders.join(',');

    var proxyResp = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxyBody),
    });
    var proxyData = await proxyResp.json().catch(function () { return { error: 'Server returned invalid response' }; });
    if (!proxyResp.ok) throw new Error(proxyData.error || `Server error ${proxyResp.status}`);
    return proxyData;
  }

  // Direct browser call for ordinary text messages (no attachment)
  var body = {
    model: 'claude-sonnet-5',
    max_tokens: opts?.maxTokens || 1000,
    messages,
  };
  if (systemPrompt) body.system = systemPrompt;
  if (opts?.tools)  body.tools  = opts.tools;

  var resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    var err = await resp.json().catch(function () { return {}; });
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  return resp.json();
}
