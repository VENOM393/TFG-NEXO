/**
 * inversiones.js — NexoBank · Módulo de Inversiones
 * ─────────────────────────────────────────────────
 * Datos de mercado en tiempo real: CoinGecko Public API (sin API key)
 * Gráfico de evolución: datos reales API o simulación realista como fallback
 * Documentación API: https://www.coingecko.com/en/api/documentation
 */

'use strict';

// ── Configuración ──────────────────────────────────────────
const COINGECKO   = 'https://api.coingecko.com/api/v3';
const REFRESCO_MS = 60_000; // Actualizar precios cada 60 s

// ── Portfolio simulado (Alex Morgan) ───────────────────────
// cantidadHeld → unidades que posee Alex
// precioCompra → precio de compra en EUR (base para calcular P&L)
const PORTFOLIO = [
    { id: 'bitcoin',  symbol: 'BTC', nombre: 'Bitcoin',  cantidadHeld: 0.15,  precioCompra: 42000 },
    { id: 'ethereum', symbol: 'ETH', nombre: 'Ethereum', cantidadHeld: 2.50,  precioCompra: 2100  },
    { id: 'solana',   symbol: 'SOL', nombre: 'Solana',   cantidadHeld: 50,    precioCompra: 95    },
    { id: 'cardano',  symbol: 'ADA', nombre: 'Cardano',  cantidadHeld: 2000,  precioCompra: 0.42  },
    { id: 'ripple',   symbol: 'XRP', nombre: 'XRP',      cantidadHeld: 1500,  precioCompra: 0.55  },
];

// IDs para la API de CoinGecko
const IDS_API = PORTFOLIO.map(p => p.id).join(',');

// Colores por posición (mismo orden que PORTFOLIO)
const COLORES = ['#ff6b00', '#3b82f6', '#10b981', '#a855f7', '#f59e0b'];

// Estado interno
let preciosActuales = {};
let chartPortfolio  = null;
let chartDist       = null;
let periodoActual   = '7';


// ──────────────────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────────────────

/** Formatea número en euros */
function fmt(n) {
    return Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formatea porcentaje con signo */
function fmtPct(n) {
    return (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
}

/** Pausa asíncrona */
function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch con timeout manual (compatible con todos los navegadores)
 * @param {string} url
 * @param {number} ms - Timeout en milisegundos
 */
async function fetchConTimeout(url, ms = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

/** Muestra el toast de notificación */
function showToast(tipo, titulo, msj) {
    const t    = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const tEl  = document.getElementById('toast-title');
    const mEl  = document.getElementById('toast-message');

    if (tEl) tEl.innerText = titulo;
    if (mEl) mEl.innerText = msj;

    const mapa = {
        success: { i: 'check_circle', cls: 'material-symbols-outlined text-nexo-green'  },
        error:   { i: 'error',        cls: 'material-symbols-outlined text-nexo-red'    },
        info:    { i: 'info',         cls: 'material-symbols-outlined text-nexo-orange' },
    };
    const cfg = mapa[tipo] || mapa.info;
    if (icon) { icon.innerText = cfg.i; icon.className = cfg.cls; }

    if (t) {
        t.classList.remove('opacity-0', 'translate-y-toast');
        t.classList.add('opacity-100');
        setTimeout(() => {
            t.classList.add('opacity-0', 'translate-y-toast');
            t.classList.remove('opacity-100');
        }, 4500);
    }
}


// ──────────────────────────────────────────────────────────
// LLAMADAS A LA API
// ──────────────────────────────────────────────────────────

/**
 * Precios de mercado actuales + variación 24h
 * Endpoint: /coins/markets
 */
async function fetchMercado() {
    try {
        const url = `${COINGECKO}/coins/markets`
            + `?vs_currency=eur`
            + `&ids=${IDS_API}`
            + `&order=market_cap_desc`
            + `&per_page=10&page=1`
            + `&sparkline=false`
            + `&price_change_percentage=24h`;

        const res = await fetchConTimeout(url, 12000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn('[NexoBank] fetchMercado:', e.message);
        return null;
    }
}

/**
 * Historial de precios de una moneda
 * Endpoint: /coins/{id}/market_chart
 * @returns {Array|null} - [[timestamp, precio], ...]
 */
async function fetchHistorial(coinId, dias) {
    try {
        // Para 7 días CoinGecko devuelve datos horarios automáticamente
        // Para más días devuelve datos diarios
        const url = `${COINGECKO}/coins/${coinId}/market_chart`
            + `?vs_currency=eur`
            + `&days=${dias}`;

        const res = await fetchConTimeout(url, 15000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.prices || null;
    } catch (e) {
        console.warn('[NexoBank] fetchHistorial:', e.message);
        return null;
    }
}


// ──────────────────────────────────────────────────────────
// GENERADOR DE DATOS SIMULADOS (fallback realista)
// Se usa cuando CoinGecko aplica rate-limiting (HTTP 429)
// ──────────────────────────────────────────────────────────

/**
 * Genera una serie temporal de precios con paseo aleatorio (random walk)
 * basado en el precio actual real para que sea verosímil
 * @param {number} dias
 * @param {number} precioBase - Precio actual real en EUR
 * @param {number} volatilidadDiaria - Volatilidad (fracción, ej: 0.03 = 3%)
 */
function generarHistorialSimulado(dias, precioBase, volatilidadDiaria = 0.025) {
    const ahora   = Date.now();
    const numDias = Number(dias);

    // Número de puntos: horario para 7 días, diario para más
    const puntos      = numDias <= 7 ? numDias * 24 : numDias;
    const intervaloMs = (numDias * 24 * 60 * 60 * 1000) / puntos;

    // Reconstruimos hacia atrás: empezamos desde un precio pasado  
    // coherente con el precio actual y la volatilidad del período
    const volPorPunto = volatilidadDiaria / (numDias <= 7 ? 24 : 1);

    // Generamos la serie de atrás hacia adelante (para que acabe en precioBase)
    const serie = [precioBase];
    for (let i = 1; i < puntos; i++) {
        const anterior = serie[0];
        // Paseo aleatorio con ligera reversión a la media
        const variacion = (Math.random() - 0.49) * volPorPunto;
        serie.unshift(anterior * (1 - variacion));
    }

    // Convertir a formato [[timestamp, precio]]
    return serie.map((precio, i) => {
        const ts = ahora - (puntos - 1 - i) * intervaloMs;
        return [ts, precio];
    });
}


// ──────────────────────────────────────────────────────────
// RENDERIZADO — MERCADO EN VIVO
// ──────────────────────────────────────────────────────────

function renderMercado(datos) {
    const container = document.getElementById('market-list');
    const loading   = document.getElementById('market-loading');

    if (!datos || datos.length === 0) {
        if (loading) loading.innerHTML =
            '<p class="text-danger small text-center py-3">⚠ No se pudieron cargar datos de mercado.</p>';
        return;
    }

    if (loading) loading.classList.add('d-none');
    if (container) { container.classList.remove('d-none'); container.innerHTML = ''; }

    datos.forEach(coin => {
        const cambio24h = coin.price_change_percentage_24h || 0;
        const sube      = cambio24h >= 0;
        const clrText   = sube ? 'text-nexo-green' : 'text-nexo-red';
        const bgBadge   = sube ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';
        const icono     = sube ? 'arrow_upward' : 'arrow_downward';

        // Guardar precio actual para cálculos del portfolio
        if (PORTFOLIO.some(p => p.id === coin.id)) {
            preciosActuales[coin.id] = coin.current_price;
        }

        const item = document.createElement('div');
        item.className = 'market-coin-item d-flex align-items-center justify-content-between p-2 rounded-3';
        item.innerHTML = `
          <div class="d-flex align-items-center gap-3">
            <img src="${coin.image}" alt="${coin.name}" width="36" height="36"
              class="rounded-circle" loading="lazy" />
            <div>
              <div class="fw-semibold text-white" style="font-size:0.88rem">${coin.name}</div>
              <div class="text-white-40" style="font-size:0.73rem">${coin.symbol.toUpperCase()}</div>
            </div>
          </div>
          <div class="text-end">
            <div class="fw-bold text-white font-monospace" style="font-size:0.88rem">
              €${fmt(coin.current_price)}
            </div>
            <div class="d-inline-flex align-items-center gap-1 px-2 rounded-pill mt-1"
              style="background:${bgBadge}">
              <span class="material-symbols-outlined ${clrText}" style="font-size:0.72rem">${icono}</span>
              <span class="${clrText} fw-semibold" style="font-size:0.72rem">${fmtPct(cambio24h)}</span>
            </div>
          </div>`;
        container.appendChild(item);
    });
}


// ──────────────────────────────────────────────────────────
// RENDERIZADO — MIS POSICIONES + STATS GLOBALES
// ──────────────────────────────────────────────────────────

function renderPosiciones() {
    if (Object.keys(preciosActuales).length === 0) return;

    const posLoading = document.getElementById('posiciones-loading');
    const posList    = document.getElementById('posiciones-list');
    if (!posList) return;

    posList.innerHTML = '';

    let totalValor     = 0;
    let totalInvertido = 0;
    let mejorPct       = -Infinity;
    let mejorSym       = '';

    PORTFOLIO.forEach((pos, idx) => {
        const precioAct  = preciosActuales[pos.id] ?? pos.precioCompra;
        const valorAct   = precioAct * pos.cantidadHeld;
        const valorInv   = pos.precioCompra * pos.cantidadHeld;
        const pnl        = valorAct - valorInv;
        const pnlPct     = ((precioAct - pos.precioCompra) / pos.precioCompra) * 100;
        const sube       = pnl >= 0;

        totalValor     += valorAct;
        totalInvertido += valorInv;

        if (pnlPct > mejorPct) { mejorPct = pnlPct; mejorSym = pos.symbol; }

        const item = document.createElement('div');
        item.className = 'posicion-item d-flex align-items-center justify-content-between p-3 rounded-3 mb-2 posicion-appear';
        item.style.animationDelay = `${idx * 0.07}s`;
        item.innerHTML = `
          <div class="d-flex align-items-center gap-3">
            <div class="coin-badge"
              style="background:${COLORES[idx]}22;color:${COLORES[idx]};border:1px solid ${COLORES[idx]}44">
              ${pos.symbol}
            </div>
            <div>
              <div class="fw-semibold text-white" style="font-size:0.88rem">${pos.nombre}</div>
              <div class="text-white-40" style="font-size:0.72rem">${pos.cantidadHeld} ${pos.symbol}</div>
            </div>
          </div>
          <div class="text-end">
            <div class="fw-bold text-white" style="font-size:0.9rem">€${fmt(valorAct)}</div>
            <div class="${sube ? 'text-nexo-green' : 'text-nexo-red'}" style="font-size:0.72rem;font-weight:600">
              ${sube ? '+' : ''}€${fmt(pnl)} &nbsp;(${fmtPct(pnlPct)})
            </div>
          </div>`;
        posList.appendChild(item);
    });

    // Mostrar lista, ocultar skeleton
    if (posLoading) posLoading.classList.add('d-none');
    posList.classList.remove('d-none');

    // Habilitar botón de compra
    const btnComprar = document.getElementById('btn-comprar');
    if (btnComprar) btnComprar.disabled = false;

    // ── Actualizar stats del header ──
    const pnlTotal    = totalValor - totalInvertido;
    const pnlPctTotal = (pnlTotal / totalInvertido) * 100;
    const g           = id => document.getElementById(id);

    if (g('portfolio-value')) g('portfolio-value').innerText = fmt(totalValor);
    if (g('stat-invested'))   g('stat-invested').innerText   = '€ ' + fmt(totalInvertido);

    if (g('stat-pnl')) {
        g('stat-pnl').innerText   = (pnlTotal >= 0 ? '+€' : '-€') + fmt(Math.abs(pnlTotal));
        g('stat-pnl').className   = 'fs-6 fw-bold mb-0 ' + (pnlTotal >= 0 ? 'text-nexo-green' : 'text-nexo-red');
    }
    if (g('portfolio-change')) {
        g('portfolio-change').innerText  = fmtPct(pnlPctTotal);
        g('portfolio-change').className  = 'small fw-semibold ' + (pnlPctTotal >= 0 ? 'text-nexo-green' : 'text-nexo-red');
    }
    if (g('portfolio-change-icon')) {
        g('portfolio-change-icon').innerText   = pnlPctTotal >= 0 ? 'trending_up' : 'trending_down';
        g('portfolio-change-icon').className   = 'material-symbols-outlined ' + (pnlPctTotal >= 0 ? 'text-nexo-green' : 'text-nexo-red');
        g('portfolio-change-icon').style.fontSize = '1rem';
    }
    if (g('stat-best')) {
        g('stat-best').innerText  = `${mejorSym}  ${fmtPct(mejorPct)}`;
        g('stat-best').className  = 'fs-6 fw-bold mb-0 ' + (mejorPct >= 0 ? 'text-nexo-green' : 'text-nexo-red');
    }

    // Redibujar donut de distribución
    renderDistChart();
}


// ──────────────────────────────────────────────────────────
// CHART — EVOLUCIÓN DEL PORTFOLIO (línea)
// ──────────────────────────────────────────────────────────

async function renderPortfolioChart(dias) {
    const loadingEl = document.getElementById('chart-loading');
    const canvas    = document.getElementById('portfolio-chart');
    if (!canvas) return;

    // Mostrar estado de carga
    if (loadingEl) {
        loadingEl.style.display = 'flex';
        loadingEl.innerHTML = `
          <div class="spinner-border text-nexo-orange spinner-border-sm me-2" role="status"></div>
          <span class="text-white-60 small">Cargando datos de mercado…</span>`;
    }

    // Destruir chart anterior si existe
    if (chartPortfolio) { chartPortfolio.destroy(); chartPortfolio = null; }

    // ── Intentar obtener historial real de la API ──
    let historial    = await fetchHistorial('bitcoin', dias);
    let esFallback   = false;

    if (!historial || historial.length < 2) {
        // Rate-limited o error de red: usar datos simulados realistas
        esFallback = true;
        const precioBTC = preciosActuales['bitcoin'] || 55000; // fallback razonable
        historial = generarHistorialSimulado(dias, precioBTC, 0.022);
        console.info('[NexoBank] Usando datos simulados para el gráfico.');
    }

    // Ocultar spinner
    if (loadingEl) loadingEl.style.display = 'none';

    // ── Calcular evolución escalada al portfolio ──
    const totalInvertido = PORTFOLIO.reduce((acc, p) => acc + p.precioCompra * p.cantidadHeld, 0);
    const precioInicio   = historial[0][1];
    const valorEscalado  = historial.map(([, precio]) =>
        ((precio / precioInicio) * totalInvertido).toFixed(2)
    );

    // ── Etiquetas del eje X ──
    const numDias   = Number(dias);
    const etiquetas = historial.map(([ts]) => {
        const d = new Date(ts);
        if (numDias <= 7)  return d.toLocaleDateString('es-ES', { weekday: 'short' }) + ' '
                                 + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        if (numDias <= 30) return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    });

    // ── Color según tendencia ──
    const ultimo   = Number(valorEscalado[valorEscalado.length - 1]);
    const primero  = Number(valorEscalado[0]);
    const sube     = ultimo >= primero;
    const lineaCol = sube ? '#10b981' : '#ef4444';

    // ── Gradiente de relleno ──
    const ctx  = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, sube ? 'rgba(16,185,129,0.28)' : 'rgba(239,68,68,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    // ── Crear chart ──
    chartPortfolio = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [{
                label:                      'Portfolio (€)',
                data:                       valorEscalado,
                borderColor:                lineaCol,
                backgroundColor:            grad,
                borderWidth:                2,
                fill:                       true,
                tension:                    0.42,
                pointRadius:                0,
                pointHoverRadius:           5,
                pointHoverBackgroundColor:  lineaCol,
                pointHoverBorderColor:      '#fff',
                pointHoverBorderWidth:      2,
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15,15,15,0.95)',
                    borderColor:     'rgba(255,255,255,0.08)',
                    borderWidth:     1,
                    titleColor:      'rgba(255,255,255,0.5)',
                    bodyColor:       '#fff',
                    padding:         10,
                    callbacks: {
                        label: ctx => '  € ' + fmt(ctx.raw)
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid:    { color: 'rgba(255,255,255,0.04)' },
                    border:  { color: 'rgba(255,255,255,0.06)' },
                    ticks:   { color: 'rgba(255,255,255,0.35)', maxTicksLimit: 7, font: { size: 10 } }
                },
                y: {
                    display: true,
                    grid:    { color: 'rgba(255,255,255,0.04)' },
                    border:  { color: 'rgba(255,255,255,0.06)' },
                    ticks:   { color: 'rgba(255,255,255,0.35)', callback: v => '€' + fmt(v), font: { size: 10 } }
                }
            },
            interaction: { mode: 'index', intersect: false },
            animation:   { duration: 700, easing: 'easeInOutQuart' }
        }
    });

    // Anotar si es fallback
    if (esFallback) {
        const aviso = document.getElementById('chart-fallback-note');
        if (aviso) aviso.style.display = 'flex';
    }
}


// ──────────────────────────────────────────────────────────
// CHART — DISTRIBUCIÓN DONUT
// ──────────────────────────────────────────────────────────

function renderDistChart() {
    const canvas = document.getElementById('dist-chart');
    const legend = document.getElementById('dist-legend');
    if (!canvas) return;

    const labels  = PORTFOLIO.map(p => p.symbol);
    const valores = PORTFOLIO.map(p => {
        const precio = preciosActuales[p.id] ?? p.precioCompra;
        return (precio * p.cantidadHeld).toFixed(2);
    });
    const total = valores.reduce((a, b) => a + Number(b), 0);

    if (chartDist) { chartDist.destroy(); chartDist = null; }

    chartDist = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data:            valores,
                backgroundColor: COLORES.map(c => c + 'bb'),
                borderColor:     COLORES,
                borderWidth:     2,
                hoverOffset:     8,
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15,15,15,0.95)',
                    borderColor:     'rgba(255,255,255,0.08)',
                    borderWidth:     1,
                    callbacks: {
                        label: ctx => {
                            const pct = ((ctx.raw / total) * 100).toFixed(1);
                            return `  ${ctx.label}: €${fmt(ctx.raw)}  (${pct}%)`;
                        }
                    }
                }
            },
            cutout:    '68%',
            animation: { animateRotate: true, duration: 700 }
        }
    });

    // Leyenda manual
    if (legend) {
        legend.innerHTML = labels.map((lbl, i) => {
            const pct = ((valores[i] / total) * 100).toFixed(1);
            return `
              <div class="d-flex align-items-center justify-content-between gap-2">
                <div class="d-flex align-items-center gap-2">
                  <div class="rounded-circle flex-shrink-0"
                    style="width:9px;height:9px;background:${COLORES[i]}"></div>
                  <span class="text-white-80" style="font-size:0.8rem">${lbl}</span>
                </div>
                <span class="text-white-40 fw-semibold" style="font-size:0.78rem">${pct}%</span>
              </div>`;
        }).join('');
    }
}


// ──────────────────────────────────────────────────────────
// SELECTOR DE PERÍODO
// ──────────────────────────────────────────────────────────

function cambiarPeriodo(dias) {
    periodoActual = dias;
    document.querySelectorAll('.period-btn').forEach(btn => {
        if (btn.dataset.period == dias) {
            btn.classList.add('btn-nexo');
            btn.classList.remove('btn-outline-secondary');
        } else {
            btn.classList.remove('btn-nexo');
            btn.classList.add('btn-outline-secondary');
        }
    });
    renderPortfolioChart(dias);
}


// ──────────────────────────────────────────────────────────
// MODAL — COMPRA SIMULADA
// ──────────────────────────────────────────────────────────

function actualizarModalPrecio() {
    const id     = document.getElementById('modal-coin-select')?.value;
    const precio = preciosActuales[id] ?? 0;
    const prEl   = document.getElementById('modal-precio');
    if (prEl) prEl.innerText = '€ ' + fmt(precio);
    actualizarModalTotal();
}

function actualizarModalTotal() {
    const id     = document.getElementById('modal-coin-select')?.value;
    const precio = preciosActuales[id] ?? 0;
    const cant   = parseFloat(document.getElementById('modal-cantidad')?.value) || 0;
    const totEl  = document.getElementById('modal-total');
    if (totEl) totEl.innerText = '€ ' + fmt(precio * cant);
}

function simularCompra() {
    const sel    = document.getElementById('modal-coin-select');
    const nombre = sel?.options[sel.selectedIndex]?.text ?? '—';
    const cant   = document.getElementById('modal-cantidad')?.value ?? '0';
    const total  = document.getElementById('modal-total')?.innerText ?? '—';

    const modalEl = document.getElementById('modalCompra');
    const modal   = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    showToast('success', 'Compra Registrada', `${cant} ${nombre} por ${total} (demo)`);
}


// ──────────────────────────────────────────────────────────
// TIMESTAMP
// ──────────────────────────────────────────────────────────

function actualizarTimestamp() {
    const el = document.getElementById('update-time');
    if (el) {
        el.innerText = 'Act. ' + new Date().toLocaleTimeString('es-ES', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }
}


// ──────────────────────────────────────────────────────────
// CARGA PRINCIPAL DE DATOS DE MERCADO
// ──────────────────────────────────────────────────────────

async function cargarDatos() {
    const datos = await fetchMercado();

    if (datos && datos.length > 0) {
        renderMercado(datos);
        renderPosiciones();

        // Rellenar select del modal (solo la primera vez)
        const sel = document.getElementById('modal-coin-select');
        if (sel && sel.children.length === 0) {
            PORTFOLIO.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.text  = `${p.nombre}  (${p.symbol})`;
                sel.appendChild(opt);
            });
        }
        actualizarModalPrecio();
        actualizarTimestamp();
    } else {
        // Mostrar estado de error en la lista de mercado
        const ml = document.getElementById('market-loading');
        if (ml) ml.innerHTML =
            '<p class="text-warning small text-center py-3">⚠ Datos de mercado no disponibles.<br><span class="text-white-40">Se reintentará en 60 s</span></p>';
        showToast('error', 'Sin conexión', 'CoinGecko API no respondió. El gráfico usará datos simulados.');
    }
}


// ──────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

    // ── Verificar sesión ──
    const raw = localStorage.getItem('usuario_nexo') || sessionStorage.getItem('usuario_nexo');
    if (!raw) { window.location.href = '/login'; return; }

    const usr    = JSON.parse(raw);
    const avatar = document.getElementById('user-avatar');
    if (avatar) {
        avatar.src = 'https://ui-avatars.com/api/?name='
            + encodeURIComponent(usr.nombre)
            + '&background=ff6b00&color=fff&size=128';
    }

    // ── 1. Cargar precios de mercado ──
    await cargarDatos();

    // ── 2. Esperar 1.5 s antes del historial para evitar rate-limit de CoinGecko ──
    await esperar(1500);

    // ── 3. Cargar gráfico de evolución ──
    await renderPortfolioChart(periodoActual);

    // ── 4. Refresco automático cada 60 s ──
    setInterval(cargarDatos, REFRESCO_MS);

});
