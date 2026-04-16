// app.js - Servidor principal NexoBank
require('dotenv').config();
const express = require('express');
const path = require('path');
const rutas = require('./src/routes/web');

const app = express();
const PUERTO = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estaticos
app.use(express.static(path.join(__dirname, 'public')));

// Rutas
app.use('/', rutas);

// Arrancar servidor
app.listen(PUERTO, () => {
    console.log(`Servidor en http://localhost:${PUERTO}`);
});
