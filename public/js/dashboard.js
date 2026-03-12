// dashboard.js - Panel principal NexoBank

let saldo = 24581.00;

const movimientos = [
    { tipo: 'gasto', nombre: 'Suscripción Netflix', fecha: 'Hoy, 10:30 AM', cant: 15.99, icono: 'movie' },
    { tipo: 'ingreso', nombre: 'Nómina Mensual', fecha: 'Ayer, 09:00 AM', cant: 3200.00, icono: 'work' },
    { tipo: 'gasto', nombre: 'Supermercado Central', fecha: '23 Nov, 18:45 PM', cant: 142.50, icono: 'shopping_cart' },
    { tipo: 'gasto', nombre: 'Viaje Uber', fecha: '22 Nov, 23:15 PM', cant: 24.30, icono: 'local_taxi' },
    { tipo: 'ingreso', nombre: 'Transferencia Recibida', fecha: '20 Nov, 14:20 PM', cant: 150.00, icono: 'payments' },
    { tipo: 'gasto', nombre: 'Café Starbucks', fecha: '19 Nov, 08:15 AM', cant: 5.75, icono: 'coffee' }
];

function fmtDinero(n) {
    return Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pintarMovimientos(lista) {
    let contenedor = document.getElementById('transaction-list');
    if(!contenedor) return;
    contenedor.innerHTML = '';

    lista.forEach((m, i) => {
        let esIngreso = m.tipo === 'ingreso';
        let colorMonto = esIngreso ? 'text-nexo-green' : 'text-nexo-red';
        let bgIcono = esIngreso ? 'bg-nexo-green-soft' : 'bg-nexo-red-soft';
        let signo = esIngreso ? '+' : '-';

        let div = document.createElement('div');
        div.className = `transaction-card ${m.tipo} d-flex align-items-center justify-content-between p-3 mb-3 rounded-3 cursor-pointer`;
        div.style.animation = `float 0.5s ease-out ${i * 0.1}s backwards`;
        div.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <div class="transaction-icon-box ${bgIcono}">
                    <span class="material-symbols-outlined ${colorMonto} fs-4">${m.icono}</span>
                </div>
                <div>
                    <p class="mb-0 fw-bold text-white" style="font-size:0.95rem;letter-spacing:0.02em">${m.nombre}</p>
                    <p class="mb-0 text-secondary small" style="font-size:0.75rem">${m.fecha}</p>
                </div>
            </div>
            <div class="text-end">
                <p class="${colorMonto} font-monospace fw-bold mb-0 fs-5">${signo}€${fmtDinero(m.cant)}</p>
            </div>`;
        contenedor.appendChild(div);
    });
}

function filterTransactions(tipo) {
    let botones = document.querySelectorAll('button[onclick^="filter"]');
    for(let b of botones) {
        if(b.getAttribute('onclick').indexOf(tipo) > -1) {
            b.classList.add('btn-nexo', 'text-white');
            b.classList.remove('btn-outline-secondary');
        } else {
            b.classList.remove('btn-nexo', 'text-white');
            b.classList.add('btn-outline-secondary');
        }
    }
    if(tipo === 'todos') pintarMovimientos(movimientos);
    else pintarMovimientos(movimientos.filter(m => m.tipo === tipo));
}

function flipCard() {
    let card = document.getElementById('credit-card-inner');
    if(card.style.transform === 'rotateY(180deg)') card.style.transform = 'rotateY(0deg)';
    else card.style.transform = 'rotateY(180deg)';
}

function showToast(tipo, msj, titulo) {
    let t = document.getElementById('toast');
    let msgEl = document.getElementById('toast-message');
    let tituloEl = document.getElementById('toast-title');
    let iconoEl = document.getElementById('toast-icon');

    if(msgEl) msgEl.innerText = msj;
    if(tituloEl) tituloEl.innerText = titulo;

    if(tipo === 'error' && iconoEl) {
        iconoEl.innerText = 'error';
        iconoEl.className = 'material-symbols-outlined text-nexo-red';
    } else if(iconoEl) {
        iconoEl.innerText = 'check_circle';
        iconoEl.className = 'material-symbols-outlined text-nexo-orange';
    }


    t.classList.remove('opacity-0', 'translate-y-toast');
    t.classList.add('opacity-100');
    setTimeout(() => {
        t.classList.add('opacity-0', 'translate-y-toast');
        t.classList.remove('opacity-100');
    }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
    let raw = localStorage.getItem('usuario_nexo') || sessionStorage.getItem('usuario_nexo');
    if(!raw) { window.location.href = 'login.html'; return; }

    let usr = JSON.parse(raw);

    let spanNombre = document.querySelector('h1.display-4 span');
    if(spanNombre) spanNombre.innerText = usr.nombre.split(' ')[0];

    let avatar = document.getElementById('user-avatar');
    if(avatar) avatar.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(usr.nombre) + "&background=ff6b00&color=fff&size=128";

    let balEl = document.getElementById('total-balance');
    if(balEl) balEl.innerText = fmtDinero(saldo);

    pintarMovimientos(movimientos);


});
