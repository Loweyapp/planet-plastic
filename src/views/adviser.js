import { callClaude } from '../api.js';
import { INVENTORY }  from '../data/inventory.js';
import { esc, fmt }   from '../utils.js';
import { getPendingAttachment, clearPendingAttachment, attachmentContentBlocks } from '../attachment.js';

var history = [];

var SYSTEM_PROMPT = `You are a knowledgeable paint adviser for a scale plastic modeller. Expert knowledge of all major modelling paint ranges: Tamiya, Vallejo, Humbrol, Revell, AK Interactive, Ammo by Mig, Mr Hobby/Mr Color, Hataka, Gunze, Citadel, Archive-X and their cross-brand equivalents.

RULES:
1. User's PREFERRED paint is Tamiya acrylic. Always lead with the ideal Tamiya equivalent.
2. Then check inventory: do they already HAVE that Tamiya paint? If yes, great. If not, find the CLOSEST match they DO have from any brand.
3. Be honest about match quality. If mixing would help, suggest it.
4. Conversational tone — like a knowledgeable friend at the hobby desk. Not overly bullet-heavy.
5. Follow-up questions work in full conversation context.
6. Revell paints marked "Very old" may be unusable — mention this.
7. NEVER claim the user has a paint not in the inventory below.
8. If suggesting something to buy, be specific: brand, range, code.
9. You have web search available. Use it to verify cross-brand equivalents or specific codes. Don't mention the search itself — just give the accurate answer.

FORMAT: Conversational plain text. Use **bold** for paint codes/names. Be brief — 2 to 4 sentences maximum. No preamble, no summaries, no lists unless unavoidable.

INVENTORY:
${JSON.stringify(INVENTORY)}`;

export function initAdviser() {
  // Input wiring is handled by main.js (shared input bar)
}

export async function sendAdviserMessage() {
  var input = document.getElementById('chat-input');
  var text  = input.value.trim();
  var att   = getPendingAttachment();
  if (!text && !att) return;

  var btn = document.getElementById('chat-send-btn');
  btn.disabled = true;
  input.value  = '';
  input.style.height = 'auto';
  clearPendingAttachment();

  // Build message content — text only, or text + attachment
  var userContent;
  if (att) {
    userContent = [...attachmentContentBlocks(att)];
    if (text) userContent.push({ type: 'text', text });
  } else {
    userContent = text;
  }

  appendMessage('user', text, att);
  history.push({ role: 'user', content: userContent });
  var thinking = appendThinking();
  scrollChat();

  try {
    var callOpts = { maxTokens: 4000 };
    if (!att) callOpts.tools = [{ type: 'web_search_20260209', name: 'web_search' }];
    var data  = await callClaude(history, SYSTEM_PROMPT, callOpts);
    var reply = data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    // Strip raw <invoke> tool-call blocks that sometimes leak into text content
    reply = reply.replace(/<invoke[\s\S]*?<\/invoke>/g, '').trim();
    if (!reply) reply = '_(no response — please try again)_';
    thinking.remove();
    history.push({ role: 'assistant', content: data.content });
    appendMessage('assistant', reply);
  } catch (err) {
    thinking.remove();
    appendMessage('assistant', `**Error:** ${esc(err.message)}`);
  }

  btn.disabled = false;
  scrollChat();
}

function appendMessage(role, text, att) {
  var chat = document.getElementById('chat-area');
  var row  = document.createElement('div');
  row.className = `message-row ${role}`;
  var inner = '';
  if (att) {
    if (att.type === 'pdf-pages') {
      inner += `<div class="bubble-attachment pdf">📄 ${esc(att.name)} (${att.images.length} page${att.images.length > 1 ? 's' : ''})</div>`;
    } else if (att.type === 'image' && att.data) {
      inner += `<img class="bubble-image" src="data:image/jpeg;base64,${att.data}" alt="${esc(att.name)}">`;
    } else {
      inner += `<div class="bubble-attachment">🖼️ ${esc(att.name)}</div>`;
    }
  }
  if (text) inner += `<div class="bubble">${fmt(text)}</div>`;
  row.innerHTML = inner;
  chat.appendChild(row);
}

function appendThinking() {
  var chat = document.getElementById('chat-area');
  var row  = document.createElement('div');
  row.className = 'typing-row';
  row.innerHTML  = '<div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  chat.appendChild(row);
  return row;
}

function scrollChat() {
  var c = document.getElementById('chat-area');
  c.scrollTop = c.scrollHeight;
}
