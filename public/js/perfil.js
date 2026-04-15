// perfil.js - Pagina de perfil NexoBank

function logout() {
    localStorage.removeItem('usuario_nexo');
    sessionStorage.removeItem('usuario_nexo');
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    let raw = localStorage.getItem('usuario_nexo') || sessionStorage.getItem('usuario_nexo');
    if(!raw) { window.location.href = 'login.html'; return; }

    let usr = JSON.parse(raw);

    let nombre = document.querySelector('h2');
    if(nombre) nombre.innerText = usr.nombre;

    let email = document.querySelector('p.text-secondary');
    if(email) email.innerText = usr.email;

    let campos = document.querySelectorAll('p.border-white-10');
    if(campos.length > 0) campos[0].innerText = usr.nombre;
    if(campos.length > 1) campos[1].innerText = usr.email;

    let img = document.querySelector('.rounded-circle');
    if(img) img.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(usr.nombre) + '&background=ff6b00&color=fff&size=128';
});
