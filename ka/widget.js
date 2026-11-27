/**
 * KA Site Widget — KARIA Gestão
 * Incluir em todas as páginas do site antes de </body>
 * <script src="/ka/widget.js"></script>
 */

(function () {
  'use strict';

  // Gera UUID v4 sem dependências
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // Sessão por aba: zera quando o visitante fecha e reabre o navegador
  function getSessionId() {
    var sid = sessionStorage.getItem('ka_session_id');
    if (!sid) {
      sid = uuidv4();
      sessionStorage.setItem('ka_session_id', sid);
      sessionStorage.setItem('ka_turn', '0');
    }
    return sid;
  }

  function nextTurn() {
    var t = parseInt(sessionStorage.getItem('ka_turn') || '0', 10) + 1;
    sessionStorage.setItem('ka_turn', String(t));
    return t;
  }

  const KA = {
    workerUrl: 'https://ka-site.kariagestao25.workers.dev',
    avatarUrl: '/ka/avatar.jpeg',
    history: [],
    isOpen: false,
    isTyping: false,
    personalWarnings: 0,
  };

  // ─── HTML ──────────────────────────────────────────────────────────────────

  function buildHTML() {
    return `
<div id="ka-bubble" aria-label="Falar com a KA" role="button" tabindex="0" title="KA — Assistente KARIA Gestão">
  <img src="${KA.avatarUrl}" alt="KA" id="ka-bubble-img" />
</div>

<div id="ka-panel" role="dialog" aria-modal="true" aria-label="Chat KA — KARIA Gestão" hidden>
  <div id="ka-header">
    <div id="ka-header-info">
      <img src="${KA.avatarUrl}" alt="KA" id="ka-header-avatar" />
      <div>
        <span id="ka-header-name">KA</span>
        <span id="ka-header-sub">Assistente KARIA Gestão</span>
      </div>
    </div>
    <button id="ka-close" aria-label="Fechar chat" title="Fechar">&#x2715;</button>
  </div>

  <div id="ka-messages" role="log" aria-live="polite" aria-label="Mensagens">
    <!-- mensagens injetadas via JS -->
  </div>

  <div id="ka-input-area">
    <textarea
      id="ka-input"
      placeholder="Digite sua mensagem..."
      rows="1"
      maxlength="2000"
      aria-label="Sua mensagem"
    ></textarea>
    <button id="ka-send" aria-label="Enviar mensagem" title="Enviar">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    </button>
  </div>
</div>`;
  }

  // ─── MENSAGEM BOAS-VINDAS ──────────────────────────────────────────────────

  function getWelcomeMessage() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    return `${greeting}! Sou a KA, assistente da KARIA Gestão. Posso tirar dúvidas sobre Controladoria Jurídica, nossos serviços e como a gestão estratégica pode transformar o seu escritório. Como posso ajudar?`;
  }

  // ─── MENSAGENS ─────────────────────────────────────────────────────────────

  function formatMessage(text) {
    // Escapa HTML para segurança
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // Converte URLs em links clicáveis + botão especial para cal.com
    return escaped.replace(/(https?:\/\/[^\s]+)/g, function (url) {
      const isCal = url.includes('cal.com/kariagestao');
      if (isCal) {
        return `<a href="${url}" target="_blank" rel="noopener" class="ka-link-btn">📅 Agendar conversa gratuita</a>`;
      }
      return `<a href="${url}" target="_blank" rel="noopener" class="ka-link">${url}</a>`;
    });
  }

  function appendMessage(role, text) {
    const container = document.getElementById('ka-messages');
    const wrap = document.createElement('div');
    wrap.className = `ka-msg ka-msg-${role}`;

    if (role === 'assistant') {
      const avatar = document.createElement('img');
      avatar.src = KA.avatarUrl;
      avatar.alt = 'KA';
      avatar.className = 'ka-msg-avatar';
      wrap.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = 'ka-bubble-text';
    bubble.innerHTML = formatMessage(text);
    wrap.appendChild(bubble);

    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
    return wrap;
  }

  function showTyping() {
    const container = document.getElementById('ka-messages');
    const wrap = document.createElement('div');
    wrap.className = 'ka-msg ka-msg-assistant ka-typing-wrap';
    wrap.id = 'ka-typing';

    const avatar = document.createElement('img');
    avatar.src = KA.avatarUrl;
    avatar.alt = 'KA';
    avatar.className = 'ka-msg-avatar';
    wrap.appendChild(avatar);

    const dots = document.createElement('div');
    dots.className = 'ka-bubble-text ka-typing';
    dots.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(dots);

    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('ka-typing');
    if (el) el.remove();
  }

  // ─── ENVIO ─────────────────────────────────────────────────────────────────

  function isPersonalMessage(text) {
    const keywords = [
      'minha vida', 'meu relacionamento', 'minha família', 'meu filho', 'minha filha',
      'meu marido', 'minha esposa', 'meu namorado', 'minha namorada', 'problema pessoal',
      'assunto pessoal', 'minha saúde', 'estou triste', 'estou sozinho',
    ];
    const t = text.toLowerCase();
    return keywords.some((k) => t.includes(k));
  }

  async function sendMessage() {
    if (KA.isTyping) return;

    const input = document.getElementById('ka-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';

    // Verificar assunto pessoal
    if (isPersonalMessage(text)) {
      KA.personalWarnings++;
      if (KA.personalWarnings >= 3) {
        appendMessage('user', text);
        appendMessage('assistant', 'Como mencionei, não consigo ajudar com assuntos pessoais. Estou encerrando este atendimento. Para falar sobre gestão do seu escritório, estou à disposição.');
        disableInput();
        return;
      } else {
        appendMessage('user', text);
        appendMessage('assistant', 'Sou a KA, assistente da KARIA Gestão, e não consigo ajudar com assuntos pessoais. Mas se tiver dúvidas sobre gestão jurídica ou nossos serviços, estou aqui!');
        return;
      }
    }

    appendMessage('user', text);
    KA.isTyping = true;
    setSendState(false);
    showTyping();

    KA.history.push({ role: 'user', content: text });

    try {
      const res = await fetch(KA.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:     text,
          history:     KA.history.slice(-6),
          session_id:  getSessionId(),
          turn_number: nextTurn(),
        }),
      });

      const data = await res.json();
      hideTyping();

      const reply = data.reply || 'Desculpe, não consegui processar sua mensagem. Tente novamente.';
      appendMessage('assistant', reply);
      KA.history.push({ role: 'assistant', content: reply });

      // Manter histórico limitado
      if (KA.history.length > 20) {
        KA.history = KA.history.slice(-20);
      }
    } catch {
      hideTyping();
      appendMessage('assistant', 'Não consegui me conectar agora. Tente novamente em instantes.');
    } finally {
      KA.isTyping = false;
      setSendState(true);
      document.getElementById('ka-input').focus();
    }
  }

  function setSendState(enabled) {
    const btn = document.getElementById('ka-send');
    if (btn) btn.disabled = !enabled;
  }

  function disableInput() {
    const input = document.getElementById('ka-input');
    const btn = document.getElementById('ka-send');
    if (input) input.disabled = true;
    if (btn) btn.disabled = true;
  }

  // ─── PAINEL ────────────────────────────────────────────────────────────────

  function openPanel() {
    if (KA.isOpen) return;
    KA.isOpen = true;

    const panel = document.getElementById('ka-panel');
    panel.hidden = false;
    panel.classList.add('ka-panel-open');

    // Primeira abertura: mostrar boas-vindas
    const messages = document.getElementById('ka-messages');
    if (!messages.children.length) {
      appendMessage('assistant', getWelcomeMessage());
    }

    setTimeout(() => document.getElementById('ka-input')?.focus(), 100);
  }

  function closePanel() {
    KA.isOpen = false;
    const panel = document.getElementById('ka-panel');
    panel.classList.remove('ka-panel-open');
    setTimeout(() => {
      panel.hidden = true;
    }, 250);
  }

  // ─── AUTO-RESIZE TEXTAREA ──────────────────────────────────────────────────

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────

  function init() {
    // Injetar CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/ka/widget.css?v=' + Date.now();
    document.head.appendChild(link);

    // Injetar HTML
    const container = document.createElement('div');
    container.id = 'ka-widget-root';
    container.innerHTML = buildHTML();
    document.body.appendChild(container);

    // Eventos
    document.getElementById('ka-bubble').addEventListener('click', openPanel);
    document.getElementById('ka-bubble').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') openPanel();
    });

    document.getElementById('ka-close').addEventListener('click', closePanel);

    document.getElementById('ka-send').addEventListener('click', sendMessage);

    const input = document.getElementById('ka-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    input.addEventListener('input', () => autoResize(input));

    // Fechar com Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && KA.isOpen) closePanel();
    });

    // Pulse + tooltip após 4s
    let tooltipEl = null;
    function removeTooltip() {
      if (!tooltipEl) return;
      tooltipEl.classList.add('ka-tooltip-out');
      setTimeout(() => { if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; } }, 300);
    }

    setTimeout(() => {
      if (KA.isOpen) return;
      const bubble = document.getElementById('ka-bubble');
      if (bubble) bubble.classList.add('ka-pulse');

      tooltipEl = document.createElement('div');
      tooltipEl.id = 'ka-tooltip';
      tooltipEl.textContent = 'Tire suas dúvidas com a KA ✨';
      tooltipEl.addEventListener('click', () => { removeTooltip(); openPanel(); });
      document.getElementById('ka-widget-root').appendChild(tooltipEl);

      setTimeout(removeTooltip, 8000);
    }, 4000);

    // Remover tooltip ao abrir o painel manualmente
    const _origOpen = openPanel;
    // já capturado via closure acima
    document.getElementById('ka-bubble').addEventListener('click', removeTooltip, { once: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
