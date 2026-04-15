/**
 * dashboard.js — NexoBank · Panel Principal
 * ──────────────────────────────────────────
 * Estado en memoria (no persistente entre recargas — requeriría BD).
 * Toda la lógica de Enviar, Ingresar y Préstamo actualiza el estado
 * en tiempo real dentro de la sesión actual.
 */

'use strict';

// ── Estado global de sesión ─────────────────────────────────
let saldo = 24581.00;

let movimientos = [
    { tipo: 'gasto',   nombre: 'Suscripción Netflix',    fecha: 'Hoy, 10:30',       cant: 15.99,  icono: 'movie'          },
    { tipo: 'ingreso', nombre: 'Nómina Mensual',          fecha: 'Ayer, 09:00',      cant: 3200.00, icono: 'work'           },
    { tipo: 'gasto',   nombre: 'Supermercado Central',   fecha: '23 Nov, 18:45',    cant: 142.50, icono: 'shopping_cart'  },
    { tipo: 'gasto',   nombre: 'Viaje Uber',             fecha: '22 Nov, 23:15',    cant: 24.30,  icono: 'local_taxi'     },
    { tipo: 'ingreso', nombre: 'Transferencia Recibida', fecha: '20 Nov, 14:20',    cant: 150.00, icono: 'payments'       },
    { tipo: 'gasto',   nombre: 'Café Starbucks',         fecha: '19 Nov, 08:15',    cant: 5.75,   icono: 'coffee'         },
];

// Filtro activo de la lista
let filtroActivo = 'todos';


// ──────────────────────────────────────────────────────────
// UTILIDADES
// ──────────────────────────────────────────────────────────

function fmtDinero(n) {
    return Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ahoraStr() {
    return 'Hoy, ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function g(id) { return document.getElementById(id); }


// ──────────────────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────────────────

function showToast(tipo, titulo, msj) {
    const t     = g('toast');
    const icon  = g('toast-icon');
    const tEl   = g('toast-title');
    const mEl   = g('toast-message');

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
// RENDERIZADO — MOVIMIENTOS
// ──────────────────────────────────────────────────────────

function pintarMovimientos(lista) {
    const contenedor = g('transaction-list');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (lista.length === 0) {
        contenedor.innerHTML = '<p class="text-center text-white-40 py-4 small">No hay movimientos en esta categoría.</p>';
        return;
    }

    lista.forEach((m, i) => {
        const esIngreso  = m.tipo === 'ingreso';
        const colorMonto = esIngreso ? 'text-nexo-green' : 'text-nexo-red';
        const bgIcono    = esIngreso ? 'bg-nexo-green-soft' : 'bg-nexo-red-soft';
        const signo      = esIngreso ? '+' : '-';

        const div = document.createElement('div');
        div.className = `transaction-card ${m.tipo} d-flex align-items-center justify-content-between p-3 mb-2 rounded-3 cursor-pointer`;
        div.style.animation = `float 0.4s ease-out ${i * 0.07}s backwards`;
        div.innerHTML = `
          <div class="d-flex align-items-center gap-3">
            <div class="transaction-icon-box ${bgIcono}">
              <span class="material-symbols-outlined ${colorMonto} fs-4">${m.icono}</span>
            </div>
            <div>
              <p class="mb-0 fw-bold text-white" style="font-size:0.92rem">${m.nombre}</p>
              <p class="mb-0 text-secondary small" style="font-size:0.75rem">${m.fecha}</p>
            </div>
          </div>
          <div class="text-end">
            <p class="${colorMonto} font-monospace fw-bold mb-0 fs-5">
              ${signo}€${fmtDinero(m.cant)}
            </p>
          </div>`;
        contenedor.appendChild(div);
    });
}


// ──────────────────────────────────────────────────────────
// FILTRO DE MOVIMIENTOS
// ──────────────────────────────────────────────────────────

function filterTransactions(tipo) {
    filtroActivo = tipo;
    document.querySelectorAll('button[onclick^="filter"]').forEach(b => {
        const esActivo = b.getAttribute('onclick').includes(`'${tipo}'`);
        b.classList.toggle('btn-nexo', esActivo);
        b.classList.toggle('btn-outline-secondary', !esActivo);
    });
    pintarMovimientos(tipo === 'todos' ? movimientos : movimientos.filter(m => m.tipo === tipo));
}


// ──────────────────────────────────────────────────────────
// ACTUALIZAR SALDO Y STATS EN EL UI
// ──────────────────────────────────────────────────────────

function calcularStats() {
    const ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.cant, 0);
    const gastos   = movimientos.filter(m => m.tipo === 'gasto').reduce((s, m) => s + m.cant, 0);
    if (g('stat-income'))  g('stat-income').innerText  = fmtDinero(ingresos);
    if (g('stat-expense')) g('stat-expense').innerText = fmtDinero(gastos);
    if (g('stat-savings')) g('stat-savings').innerText = fmtDinero(Math.max(saldo * 0.51, 0));
}

function actualizarSaldo() {
    const el = g('total-balance');
    if (!el) return;

    // Animación de conteo rápido
    const inicio   = parseFloat(el.innerText.replace(/\./g, '').replace(',', '.')) || 0;
    const destino  = saldo;
    const pasos    = 25;
    const diff     = destino - inicio;
    let paso       = 0;

    const intervalo = setInterval(() => {
        paso++;
        const progreso = paso / pasos;
        const ease     = 1 - Math.pow(1 - progreso, 3); // ease-out cubic
        el.innerText   = fmtDinero(inicio + diff * ease);
        if (paso >= pasos) { clearInterval(intervalo); el.innerText = fmtDinero(saldo); }
    }, 20);

    calcularStats();
}

function añadirMovimiento(m) {
    movimientos.unshift(m); // añadir al principio
    pintarMovimientos(filtroActivo === 'todos' ? movimientos : movimientos.filter(x => x.tipo === filtroActivo));
}


// ──────────────────────────────────────────────────────────
// TARJETA 3D — VOLTEAR
// ──────────────────────────────────────────────────────────

function flipCard() {
    const card = g('credit-card-inner');
    if (card) {
        card.style.transform = card.style.transform === 'rotateY(180deg)' ? 'rotateY(0deg)' : 'rotateY(180deg)';
    }
}


// ──────────────────────────────────────────────────────────
// HELPER — ABRIR MODAL
// ──────────────────────────────────────────────────────────

function abrirModal(id) {
    const el = g('modal-' + id);
    if (el) bootstrap.Modal.getOrCreateInstance(el).show();
}

function cerrarModal(id) {
    const el = g('modal-' + id);
    if (el) bootstrap.Modal.getInstance(el)?.hide();
}

// Limpiar validación visual de un input
function limpiarError(inputId) {
    const el = g(inputId);
    if (el) { el.classList.remove('is-invalid'); el.classList.remove('is-valid'); }
}


// ──────────────────────────────────────────────────────────
// OPERACIÓN — ENVIAR DINERO
// ──────────────────────────────────────────────────────────

function envioActualizarVista() {
    const cant    = parseFloat(g('envio-cantidad')?.value) || 0;
    const nuevoS  = saldo - cant;
    const errEl   = g('envio-saldo-preview');
    if (!errEl) return;

    if (cant <= 0) {
        errEl.innerHTML = '';
        return;
    }
    if (cant > saldo) {
        errEl.innerHTML = `<span class="text-nexo-red small">⚠ Saldo insuficiente (disponible: €${fmtDinero(saldo)})</span>`;
    } else {
        errEl.innerHTML = `<span class="text-white-40 small">Saldo tras operación: <span class="text-white fw-semibold">€${fmtDinero(nuevoS)}</span></span>`;
    }
}

function procesarEnvio() {
    const destinatario = g('envio-destinatario')?.value?.trim();
    const iban         = g('envio-iban')?.value?.trim();
    const cant         = parseFloat(g('envio-cantidad')?.value);
    const concepto     = g('envio-concepto')?.value?.trim() || 'Transferencia';

    let valido = true;

    // Validaciones
    if (!destinatario) {
        g('envio-destinatario')?.classList.add('is-invalid'); valido = false;
    }
    if (!iban || iban.length < 9) {
        g('envio-iban')?.classList.add('is-invalid'); valido = false;
    }
    if (!cant || cant <= 0) {
        g('envio-cantidad')?.classList.add('is-invalid'); valido = false;
    }
    if (cant > saldo) {
        g('envio-cantidad')?.classList.add('is-invalid');
        showToast('error', 'Saldo insuficiente', `No tienes €${fmtDinero(cant)} disponibles.`);
        valido = false;
    }

    if (!valido) return;

    // Ejecutar operación
    saldo -= cant;
    actualizarSaldo();
    añadirMovimiento({
        tipo:   'gasto',
        nombre: `Transferencia a ${destinatario}`,
        fecha:  ahoraStr(),
        cant:   cant,
        icono:  'send',
        concepto,
    });

    cerrarModal('envio');
    showToast('success', 'Transferencia enviada', `€${fmtDinero(cant)} enviados a ${destinatario}`);

    // Limpiar form
    ['envio-destinatario','envio-iban','envio-cantidad','envio-concepto'].forEach(id => {
        const el = g(id); if (el) { el.value = ''; el.classList.remove('is-invalid','is-valid'); }
    });
    if (g('envio-saldo-preview')) g('envio-saldo-preview').innerHTML = '';
}


// ──────────────────────────────────────────────────────────
// OPERACIÓN — INGRESAR DINERO
// ──────────────────────────────────────────────────────────

function procesarIngreso() {
    const cant     = parseFloat(g('ingreso-cantidad')?.value);
    const origen   = g('ingreso-origen')?.value || 'Transferencia bancaria';
    const concepto = g('ingreso-concepto')?.value?.trim() || origen;

    if (!cant || cant <= 0) {
        g('ingreso-cantidad')?.classList.add('is-invalid');
        return;
    }
    if (cant > 50000) {
        g('ingreso-cantidad')?.classList.add('is-invalid');
        showToast('error', 'Límite superado', 'El importe máximo por operación es €50.000.');
        return;
    }

    saldo += cant;
    actualizarSaldo();
    añadirMovimiento({
        tipo:   'ingreso',
        nombre: concepto,
        fecha:  ahoraStr(),
        cant:   cant,
        icono:  'account_balance',
    });

    cerrarModal('ingreso');
    showToast('success', 'Ingreso completado', `+€${fmtDinero(cant)} añadidos a tu cuenta`);

    ['ingreso-cantidad','ingreso-concepto'].forEach(id => {
        const el = g(id); if (el) { el.value = ''; el.classList.remove('is-invalid','is-valid'); }
    });
}


// ──────────────────────────────────────────────────────────
// OPERACIÓN — PEDIR PRÉSTAMO
// Fórmula de amortización francesa: cuota = C × r / (1 − (1+r)^−n)
// ──────────────────────────────────────────────────────────

const TIN_ANUAL = 6.5; // % fijo para la demo

function calcularCuota(capital, meses) {
    const r = TIN_ANUAL / 12 / 100;
    if (r === 0) return capital / meses;
    return (capital * r) / (1 - Math.pow(1 + r, -meses));
}

function prestamoActualizarCalc() {
    const capital  = parseFloat(g('prestamo-importe')?.value) || 0;
    const meses    = parseInt(g('prestamo-plazo')?.value) || 12;
    const cuota    = calcularCuota(capital, meses);
    const total    = cuota * meses;
    const intereses = total - capital;

    if (g('prestamo-cuota'))     g('prestamo-cuota').innerText    = capital > 0 ? `€${fmtDinero(cuota)}/mes`  : '—';
    if (g('prestamo-total'))     g('prestamo-total').innerText    = capital > 0 ? `€${fmtDinero(total)}`      : '—';
    if (g('prestamo-intereses')) g('prestamo-intereses').innerText = capital > 0 ? `€${fmtDinero(intereses)}` : '—';

    // Sync slider ↔ input
    const slider = g('prestamo-slider');
    if (slider && slider.value != capital) slider.value = capital;
}

function prestamoSyncSlider() {
    const slider = g('prestamo-slider');
    const input  = g('prestamo-importe');
    if (slider && input) input.value = slider.value;
    prestamoActualizarCalc();
}

function procesarPrestamo() {
    const capital = parseFloat(g('prestamo-importe')?.value);
    const meses   = parseInt(g('prestamo-plazo')?.value) || 12;

    if (!capital || capital < 500) {
        g('prestamo-importe')?.classList.add('is-invalid');
        showToast('error', 'Importe inválido', 'El importe mínimo del préstamo es €500.');
        return;
    }
    if (capital > 50000) {
        g('prestamo-importe')?.classList.add('is-invalid');
        showToast('error', 'Importe elevado', 'El importe máximo es €50.000.');
        return;
    }

    const cuota = calcularCuota(capital, meses);

    saldo += capital;
    actualizarSaldo();
    añadirMovimiento({
        tipo:   'ingreso',
        nombre: `Préstamo Concedido — ${meses} meses`,
        fecha:  ahoraStr(),
        cant:   capital,
        icono:  'real_estate_agent',
    });

    cerrarModal('prestamo');
    showToast('success', '✅ Préstamo aprobado',
        `€${fmtDinero(capital)} ingresados · Cuota: €${fmtDinero(cuota)}/mes`);

    // Reset form
    const imp = g('prestamo-importe'); if (imp) { imp.value = '5000'; imp.classList.remove('is-invalid'); }
    const sl  = g('prestamo-slider');  if (sl)  sl.value = '5000';
    const pla = g('prestamo-plazo');   if (pla) pla.value = '24';
    prestamoActualizarCalc();
}


// ──────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // Verificar sesión
    const raw = localStorage.getItem('usuario_nexo') || sessionStorage.getItem('usuario_nexo');
    if (!raw) { window.location.href = '/login'; return; }

    const usr = JSON.parse(raw);

    // Nombre del usuario
    const spanNombre = document.querySelector('h1.display-4 span');
    if (spanNombre) spanNombre.innerText = usr.nombre.split(' ')[0];

    // Avatar
    const avatar = g('user-avatar');
    if (avatar) avatar.src = 'https://ui-avatars.com/api/?name='
        + encodeURIComponent(usr.nombre) + '&background=ff6b00&color=fff&size=128';

    // Saldo y stats
    const balEl = g('total-balance');
    if (balEl) balEl.innerText = fmtDinero(saldo);
    calcularStats();

    // Movimientos iniciales
    pintarMovimientos(movimientos);

    // Init calculadora de préstamo
    prestamoActualizarCalc();

    // Rellenar saldo disponible al abrir modal de envío
    document.getElementById('modal-envio')?.addEventListener('show.bs.modal', () => {
        const el = g('envio-saldo-disp');
        if (el) el.innerText = fmtDinero(saldo);
    });

});
