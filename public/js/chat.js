/**
 * chat.js — NexoBot · Asesor IA de Criptomonedas
 * NexoBank TFG · Integración con Groq API (llama-3.3-70b)
 *
 * Accede a PORTFOLIO y preciosActuales definidos en inversiones.js
 * para enviar contexto real del portfolio en cada petición.
 */

'use strict';

// ── Estado ───────────────────────────────────────────────────
const CHAT_STORAGE_KEY = 'nexobot_session';
const MAX_API_MESSAGES = 20;

let chatHistory = [];   // [{ role: 'user'|'assistant', content: string }]
let isThinking  = false;

// ── Referencia corta al DOM ──────────────────────────────────
const $id = id => document.getElementById(id);

// ══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const toggle = $id('nexobot-toggle');
    const panel  = $id('nexobot-panel');

    if (!toggle || !panel) return;

    // Restaurar historial de sesión si existe
    restoreSession();

    // Eventos de apertura / cierre
    toggle.addEventListener('click', togglePanel);
    $id('nexobot-close').addEventListener('click', closePanel);
    $id('nexobot-clear').addEventListener('click', clearHistory);

    // Input: Enter envía, Shift+Enter nueva línea
    const input = $id('nexobot-input');
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Auto-resize del textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 96) + 'px';
    });

    $id('nexobot-send').addEventListener('click', handleSend);
});

// ══════════════════════════════════════════════════════════════
// PANEL — ABRIR / CERRAR
// ══════════════════════════════════════════════════════════════

function togglePanel() {
    const panel = $id('nexobot-panel');
    if (panel.classList.contains('is-visible')) {
        closePanel();
    } else {
        openPanel();
    }
}

function openPanel() {
    const panel  = $id('nexobot-panel');
    const toggle = $id('nexobot-toggle');
    const badge  = $id('nexobot-badge');

    panel.classList.add('is-visible');
    toggle.classList.add('is-open');
    if (badge) badge.style.display = 'none';

    // Mensaje de bienvenida si el historial está vacío
    if (chatHistory.length === 0) {
        setTimeout(showWelcomeMessage, 320);
    }

    setTimeout(scrollToBottom, 80);
}

function closePanel() {
    $id('nexobot-panel').classList.remove('is-visible');
    $id('nexobot-toggle').classList.remove('is-open');
}

// ══════════════════════════════════════════════════════════════
// BIENVENIDA
// ══════════════════════════════════════════════════════════════

function showWelcomeMessage() {
    const nombre   = getUserFirstName();
    const saludo   = nombre ? `, **${nombre}**` : '';
    const hasData  = typeof preciosActuales !== 'undefined'
                     && Object.keys(preciosActuales).length > 0;

    const contextLine = hasData
        ? 'He cargado los **datos en tiempo real** de tu portfolio desde CoinGecko. Puedo analizarlos al detalle.'
        : 'Los datos de mercado todavía se están cargando. Puedo responder preguntas generales mientras tanto.';

    const welcome = `¡Hola${saludo}! 👋 Soy **NexoBot**, tu asesor de criptomonedas de NexoBank.

${contextLine}

Estoy aquí para ayudarte con:
- Análisis de tu portfolio y rendimiento
- Evaluación de riesgos y diversificación
- Estrategias y tendencias del mercado crypto
- Cualquier duda sobre Bitcoin, Ethereum y más

¿Por dónde empezamos?`;

    appendMessage('bot', welcome);
}

// ══════════════════════════════════════════════════════════════
// ENVÍO DE MENSAJES
// ══════════════════════════════════════════════════════════════

async function handleSend() {
    const input = $id('nexobot-input');
    const text  = input.value.trim();

    if (!text || isThinking) return;

    // Limpiar input
    input.value       = '';
    input.style.height = 'auto';

    // Ocultar chips de sugerencias tras el primer mensaje
    hideSuggestions();

    // Renderizar mensaje del usuario
    appendMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    // Mostrar indicador de escritura
    showTypingIndicator();
    setUIBusy(true);

    try {
        const body = {
            messages:         chatHistory.slice(-MAX_API_MESSAGES),
            portfolioContext: buildPortfolioContext(),
        };

        const res  = await fetch('/api/chat', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });

        const data  = await res.json();
        const reply = res.ok
            ? data.reply
            : (data.error || 'Ha ocurrido un error inesperado.');

        hideTypingIndicator();
        appendMessage('bot', reply);
        chatHistory.push({ role: 'assistant', content: reply });
        saveSession();

    } catch {
        hideTypingIndicator();
        appendMessage('bot', '❌ **Error de conexión.** Comprueba tu red e inténtalo de nuevo.');
    } finally {
        setUIBusy(false);
        $id('nexobot-input')?.focus();
    }
}

// Llamada desde onclick de las sugerencias (función global)
function sendSuggestion(text) {
    const input = $id('nexobot-input');
    if (!input || isThinking) return;
    input.value = text;
    handleSend();
}

// ══════════════════════════════════════════════════════════════
// CONTEXTO DEL PORTFOLIO (datos en tiempo real de inversiones.js)
// ══════════════════════════════════════════════════════════════

function buildPortfolioContext() {
    // Estas variables son top-level en inversiones.js (mismo scope global)
    if (typeof PORTFOLIO === 'undefined' || typeof preciosActuales === 'undefined') return null;
    if (Object.keys(preciosActuales).length === 0) return null;

    let totalValor     = 0;
    let totalInvertido = 0;

    const lineas = PORTFOLIO.map(pos => {
        const precio   = preciosActuales[pos.id] ?? pos.precioCompra;
        const valorAct = precio * pos.cantidadHeld;
        const valorInv = pos.precioCompra * pos.cantidadHeld;
        const pnl      = valorAct - valorInv;
        const pnlPct   = ((precio - pos.precioCompra) / pos.precioCompra) * 100;

        totalValor     += valorAct;
        totalInvertido += valorInv;

        const signo = pnlPct >= 0 ? '+' : '';
        return `- ${pos.nombre} (${pos.symbol}): ${pos.cantidadHeld} unidades`
             + ` | Precio: €${precio.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`
             + ` | Valor actual: €${valorAct.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`
             + ` | P&L: ${signo}${pnlPct.toFixed(2)}% (${signo}€${pnl.toLocaleString('es-ES', { maximumFractionDigits: 2 })})`;
    });

    const pnlTotal    = totalValor - totalInvertido;
    const pnlTotalPct = (pnlTotal / totalInvertido) * 100;
    const signoT      = pnlTotalPct >= 0 ? '+' : '';

    return [
        `Portfolio de ${getUserFirstName() || 'el cliente'} (precios en tiempo real · CoinGecko):`,
        ...lineas,
        '',
        `RESUMEN GLOBAL:`,
        `- Valor total del portfolio: €${totalValor.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`,
        `- Capital invertido:         €${totalInvertido.toLocaleString('es-ES', { maximumFractionDigits: 2 })}`,
        `- P&L total:                 ${signoT}${pnlTotalPct.toFixed(2)}% (${signoT}€${pnlTotal.toLocaleString('es-ES', { maximumFractionDigits: 2 })})`,
    ].join('\n');
}

// ══════════════════════════════════════════════════════════════
// RENDERIZADO DE MENSAJES
// ══════════════════════════════════════════════════════════════

function appendMessage(role, content) {
    const container = $id('nexobot-messages');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = `chat-msg ${role}`;

    const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    if (role === 'bot') {
        wrapper.innerHTML = `
          <div class="msg-bot-avatar">
            <span class="material-symbols-outlined">smart_toy</span>
          </div>
          <div>
            <div class="msg-bubble">${renderMarkdown(content)}</div>
            <div class="msg-time">${hora}</div>
          </div>`;
    } else {
        wrapper.innerHTML = `
          <div>
            <div class="msg-bubble">${escapeHtml(content)}</div>
            <div class="msg-time">${hora}</div>
          </div>`;
    }

    container.appendChild(wrapper);
    scrollToBottom();
}

// ══════════════════════════════════════════════════════════════
// MARKDOWN LIGERO → HTML
// ══════════════════════════════════════════════════════════════

function renderMarkdown(text) {
    return text
        // 1. Escapar HTML primero
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // 2. Negrita **texto**
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // 3. Cursiva *texto*
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // 4. Líneas de disclaimer (⚠️ ...)
        .replace(/(⚠️[^\n]+)/g, '<span class="msg-disclaimer">$1</span>')
        // 5. Saltos de línea
        .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}

// ══════════════════════════════════════════════════════════════
// TYPING INDICATOR
// ══════════════════════════════════════════════════════════════

function showTypingIndicator() {
    const container = $id('nexobot-messages');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'chat-typing';
    el.id        = 'nexobot-typing';
    el.innerHTML = `
      <div class="msg-bot-avatar">
        <span class="material-symbols-outlined">smart_toy</span>
      </div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>`;
    container.appendChild(el);
    scrollToBottom();
}

function hideTypingIndicator() {
    $id('nexobot-typing')?.remove();
}

// ══════════════════════════════════════════════════════════════
// SUGERENCIAS
// ══════════════════════════════════════════════════════════════

function hideSuggestions() {
    const el = $id('nexobot-suggestions');
    if (el && el.style.display !== 'none') {
        el.style.transition = 'opacity 0.2s ease';
        el.style.opacity    = '0';
        setTimeout(() => { el.style.display = 'none'; }, 200);
    }
}

// ══════════════════════════════════════════════════════════════
// LIMPIAR HISTORIAL
// ══════════════════════════════════════════════════════════════

function clearHistory() {
    chatHistory = [];
    sessionStorage.removeItem(CHAT_STORAGE_KEY);

    const container = $id('nexobot-messages');
    if (container) container.innerHTML = '';

    const suggestions = $id('nexobot-suggestions');
    if (suggestions) {
        suggestions.style.display = '';
        suggestions.style.opacity = '1';
    }

    setTimeout(showWelcomeMessage, 150);
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function scrollToBottom() {
    const el = $id('nexobot-messages');
    if (el) el.scrollTop = el.scrollHeight;
}

function setUIBusy(busy) {
    isThinking = busy;
    const input   = $id('nexobot-input');
    const sendBtn = $id('nexobot-send');
    if (input)   input.disabled   = busy;
    if (sendBtn) sendBtn.disabled = busy;
}

function getUserFirstName() {
    try {
        const raw = localStorage.getItem('usuario_nexo')
                 || sessionStorage.getItem('usuario_nexo');
        if (raw) {
            const usr = JSON.parse(raw);
            return usr.nombre ? usr.nombre.split(' ')[0] : '';
        }
    } catch { /* sin sesión */ }
    return '';
}

// ── Persistencia de sesión ───────────────────────────────────
function saveSession() {
    try {
        sessionStorage.setItem(
            CHAT_STORAGE_KEY,
            JSON.stringify(chatHistory.slice(-MAX_API_MESSAGES))
        );
    } catch { /* storage lleno */ }
}

function restoreSession() {
    try {
        const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!Array.isArray(saved) || saved.length === 0) return;

        chatHistory = saved;
        saved.forEach(msg => {
            appendMessage(msg.role === 'user' ? 'user' : 'bot', msg.content);
        });
        hideSuggestions();
    } catch {
        chatHistory = [];
    }
}
