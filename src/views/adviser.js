import { callClaude } from '../api.js';
import { INVENTORY }  from '../data/inventory.js';
import { esc, fmt }   from '../utils.js';

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
  if (!text) return;

  var btn = document.getElementById('chat-send-btn');
  btn.disabled = true;
  input.value  = '';
  input.style.height = 'auto';

  appendMessage('user', text);
  history.push({ role: 'user', content: text });
  var thinking = appendThinking();
  scrollChat();

  try {
    var data  = await callClaude(history, SYSTEM_PROMPT, {
      tools:     [{ type: 'web_search_20250305', name: 'web_search' }],
      maxTokens: 400,
    });
    var reply = data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
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

function appendMessage(role, text) {
  var chat = document.getElementById('chat-area');
  var row  = document.createElement('div');
  row.className = `message-row ${role}`;
  row.innerHTML = `<div class="bubble">${fmt(text)}</div>`;
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
