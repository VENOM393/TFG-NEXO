// pageController.js - Controlador de vistas
const path = require('path');
const rutaVistas = path.join(__dirname, '../views');

const controlador = {
    index: (req, res) => res.sendFile(path.join(rutaVistas, 'index.html')),
    home: (req, res) => res.sendFile(path.join(rutaVistas, 'home.html')),
    login: (req, res) => res.sendFile(path.join(rutaVistas, 'login.html')),
    user: (req, res) => res.sendFile(path.join(rutaVistas, 'user.html'))
};

module.exports = controlador;
