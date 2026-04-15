// web.js - Rutas de la aplicacion
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pageController');

router.get('/', ctrl.home);
router.get('/dashboard', ctrl.index);
router.get('/index.html', ctrl.index);
router.get('/home.html', ctrl.home);
router.get('/login', ctrl.login);
router.get('/login.html', ctrl.login);
router.get('/user', ctrl.user);
router.get('/user.html', ctrl.user);

router.get('/inversiones', ctrl.inversiones);
router.get('/inversiones.html', ctrl.inversiones);

module.exports = router;
