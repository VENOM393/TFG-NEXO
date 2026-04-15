// login.js - Inicio de sesion NexoBank

const usuarios = {
    'demo': { clave: '1234', nombre: 'Alex Morgan', email: 'demo@nexobank.com' },
    'alex': { clave: '1234', nombre: 'Alex Morgan', email: 'alex@nexobank.com' }
};

function togglePassword() {
    let campo = document.getElementById('password');
    let btn = campo.nextElementSibling;
    if(campo.type === 'password') {
        campo.type = 'text';
        btn.textContent = 'visibility_off';
    } else {
        campo.type = 'password';
        btn.textContent = 'visibility';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let sesion = localStorage.getItem('usuario_nexo') || sessionStorage.getItem('usuario_nexo');
    if(sesion) { window.location.href = 'index.html'; return; }

    let form = document.getElementById('login-form');
    if(!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        let usr = document.getElementById('username').value.trim().toLowerCase();
        let pass = document.getElementById('password').value;
        let recordar = document.getElementById('remember').checked;
        let datos = usuarios[usr];

        if(!datos || datos.clave !== pass) {
            // Quitar error previo si hay
            let errViejo = document.querySelector('.login-error');
            if(errViejo) errViejo.remove();

            let err = document.createElement('div');
            err.className = 'login-error bg-nexo-red-soft border border-nexo-red rounded p-3 mb-4 text-danger small';
            err.innerText = 'Usuario o contraseña incorrectos';
            form.insertBefore(err, form.firstChild);

            // Shake del panel
            document.querySelector('.glass-panel').style.animation = 'shake 0.5s';
            setTimeout(() => document.querySelector('.glass-panel').style.animation = '', 500);
            setTimeout(() => err.remove(), 3000);
            return;
        }

        // Login correcto
        let infoSesion = { user: usr, nombre: datos.nombre, email: datos.email };

        if(recordar) localStorage.setItem('usuario_nexo', JSON.stringify(infoSesion));
        else sessionStorage.setItem('usuario_nexo', JSON.stringify(infoSesion));

        let ok = document.createElement('div');
        ok.className = 'bg-nexo-green-soft border border-nexo-green rounded p-3 mb-4 text-success';
        ok.innerText = '¡Bienvenido, ' + datos.nombre + '! Redirigiendo...';
        form.insertBefore(ok, form.firstChild);

        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    });
});
