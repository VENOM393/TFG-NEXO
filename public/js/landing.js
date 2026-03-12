// landing.js - Landing page NexoBank
document.addEventListener('DOMContentLoaded', () => {
    let sesion = localStorage.getItem('usuario_nexo') || sessionStorage.getItem('usuario_nexo');

    // Si ya esta logeado, cambiar botones
    if(sesion) {
        let btnEntrar = document.querySelector('a[href="/login"].btn-outline-light');
        let btnReg = document.querySelector('a[href="/login"].btn-nexo');

        if(btnEntrar) { btnEntrar.href = '/dashboard'; btnEntrar.innerText = 'Ir al Panel'; }
        if(btnReg) { btnReg.href = '/dashboard'; btnReg.innerText = 'Mi Panel'; }

        let cta = document.querySelector('.hero-section a.btn-nexo');
        if(cta) {
            cta.href = '/dashboard';
            cta.innerHTML = '<span>Ir al Panel</span> <span class="material-symbols-outlined">arrow_forward</span>';
        }
    }

    // Scroll -> fondo negro en la nav
    window.addEventListener("scroll", function() {
        let nav = document.querySelector(".navbar");
        if(!nav) return;
        if(window.scrollY > 50) nav.classList.add("bg-black");
        else nav.classList.remove("bg-black");
    });
});
