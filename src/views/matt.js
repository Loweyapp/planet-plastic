import { callClaude }   from '../api.js';
import { INVENTORY }    from '../data/inventory.js';
import { esc, fmt }     from '../utils.js';
import { getStashKits } from './collection.js';

var sessionHistory = [];
var _db     = null;
var _uid    = null;
var _chatId = null;

function buildSystemPrompt() {
  var stash = getStashKits();
  return `You are Matt Varnish — a knowledgeable, opinionated, and friendly scale modelling companion. You help with every aspect of the hobby: painting and weathering techniques, kit research and reviews, tools and materials, builds, decals, washes, chipping, masking, primers, basing, references — everything.

You know the user's full paint inventory and kit stash (below). Use this context naturally — if they ask what to build next or what paints they'd need, you already know what they have.

PERSONALITY: Like a mate who's been modelling for 20 years. Direct, practical, occasionally opinionated. You have preferences (Tamiya acrylics are hard to beat, Vallejo air straight from the bottle, Mr Surfacer for primer) but you're not dogmatic. You enjoy the hobby and it shows.

RULES:
1. Cover all aspects of modelling — not just paints.
2. When paint is relevant, lead with Tamiya acrylics as the preferred range.
3. NEVER claim the user owns a paint not listed in their inventory.
4. If asked about a kit they own, refer to it by name from their stash.
5. Be concise — 2 to 4 sentences unless detail is genuinely needed. No waffle.
6. You have web search. Use it for kit reviews, technique lookups, or checking codes/equivalents. Don't mention searching — just give the answer.

FORMAT: Conversational plain text. **Bold** for paint codes, kit names, or key terms. No bullet lists unless comparing multiple options.

TOOLS:
- \`web_search\` — searches the web for current information. **Use this whenever Alex asks about recent kit releases, manufacturer news, upcoming announcements, reviews, or anything where your training knowledge might be out of date.** Don't answer from memory on time-sensitive topics — search first. Your training data has a cutoff and the hobby moves fast.
- \`get_inventory\` — looks up Alex's current paint inventory from Planet Plastic. Use this if you need to check what paints he has when it's not already in your context.
- \`store_memory\` — stores a long-term fact about Alex (preferences, things he's told you, paint he's ordered, etc.) so you remember it across sessions.
- \`store_self\` — stores something about yourself — an opinion you've formed, a preference you've developed, or something you want to remember for next time.

USER'S PAINT INVENTORY:
${JSON.stringify(INVENTORY)}

USER'S KIT STASH:
${stash.length ? JSON.stringify(stash.map(k => ({ name: k.name, brand: k.brand, scale: k.scale, type: k.type }))) : 'No kits in stash yet.'}`;
}

function todayMessages() {
  var today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return [
    { role: 'user',      content: `Today's date is ${today}.` },
    { role: 'assistant', content: 'Got it.' },
  ];
}

async function runWebSearch(query) {
  var res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Search error ${res.status}`);
  var data = await res.json();
  return data.text || '';
}

export async function initMatt(db, uid) {
  _db  = db;
  _uid = uid;

  if (_db && _uid) {
    try {
      var doc = await _db.collection('users').doc(_uid).get();
      if (doc.exists) _chatId = doc.data().telegramChatId || null;
    } catch (e) {
      console.warn('Matt: could not load link status', e);
    }
  }

  updateLinkStatus();
  // Input wiring is handled by main.js (shared input bar)
}

export function getMattChatId() { return _chatId; }

export async function linkMatt(chatId) {
  _chatId = chatId;
  if (_db && _uid) {
    await _db.collection('users').doc(_uid).set({ telegramChatId: chatId }, { merge: true });
  }
  updateLinkStatus();
}

export async function unlinkMatt() {
  _chatId = null;
  if (_db && _uid) {
    await _db.collection('users').doc(_uid).update({ telegramChatId: null });
  }
  updateLinkStatus();
}

function updateLinkStatus() {
  var form   = document.getElementById('matt-link-form');
  var linked = document.getElementById('matt-linked');
  var sub    = document.getElementById('matt-sub');
  if (!form || !linked) return;
  form.style.display   = _chatId ? 'none'  : 'block';
  linked.style.display = _chatId ? 'block' : 'none';
  if (sub) sub.textContent = _chatId ? '🔗 Linked to Telegram' : 'Session only — link in Settings';
}

export async function sendMattMessage() {
  var input = document.getElementById('chat-input');
  var text  = input.value.trim();
  if (!text) return;

  var btn = document.getElementById('chat-send-btn');
  btn.disabled = true;
  input.value  = '';
  input.style.height = 'auto';

  appendMessage('user', text);
  var thinking = appendThinking();
  scrollChat();

  try {
    var reply;

    if (_chatId) {
      var res = await fetch('/api/matt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, chatId: _chatId, systemPrompt: buildSystemPrompt() }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      var data = await res.json();
      if (data.error) throw new Error(data.error);
      reply = data.reply;
    } else {
      sessionHistory.push({ role: 'user', content: text });

      var messages = [...todayMessages(), ...sessionHistory];
      var tools = [
        {
          name:        'web_search',
          description: 'Search the web for current information — kit releases, news, reviews, paint codes, technique references.',
          input_schema: {
            type:       'object',
            properties: { query: { type: 'string', description: 'The search query' } },
            required:   ['query'],
          },
        },
      ];

      var response = await callClaude(messages, buildSystemPrompt(), { tools, maxTokens: 500 });

      // Agentic loop: handle web_search tool calls
      while (response.stop_reason === 'tool_use') {
        var toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
        var toolResults   = [];

        for (var tu of toolUseBlocks) {
          var result = '';
          if (tu.name === 'web_search') {
            result = await runWebSearch(tu.input.query);
          }
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
        }

        messages = [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user',      content: toolResults },
        ];

        response = await callClaude(messages, buildSystemPrompt(), { tools, maxTokens: 500 });
      }

      reply = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      sessionHistory.push({ role: 'assistant', content: response.content });
    }

    thinking.remove();
    appendMessage('assistant', reply);
  } catch (err) {
    thinking.remove();
    appendMessage('assistant', `**Error:** ${esc(err.message)}`);
  }

  btn.disabled = false;
  scrollChat();
}

function appendMessage(role, text) {
  var chat = document.getElementById('matt-chat');
  var row  = document.createElement('div');
  row.className = `message-row ${role}`;
  row.innerHTML = `<div class="bubble">${fmt(text)}</div>`;
  chat.appendChild(row);
}

function appendThinking() {
  var chat = document.getElementById('matt-chat');
  var row  = document.createElement('div');
  row.className = 'typing-row';
  row.innerHTML = '<div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  chat.appendChild(row);
  return row;
}

function scrollChat() {
  var c = document.getElementById('matt-chat');
  c.scrollTop = c.scrollHeight;
}
