const express = require('express');
const path = require('path');
const stripeApi = require('./apis/charged/stripeapi');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON y form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Clave de API para desarrollo
const API_KEY = 'dev_test_key';

// Tokens válidos (en producción, esto debería estar en una base de datos)
const validTokens = new Map();

// Middleware para obtener la IP del cliente
function getClientId(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';
  return `${ip}-${userAgent.substring(0, 20)}`;
}

// Middleware para verificar la clave de API
function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }

  next();
}

// Middleware para verificar el token de seguridad
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const clientId = getClientId(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const tokenData = validTokens.get(token);
  if (!tokenData || tokenData.clientId !== clientId || tokenData.expiresAt < Date.now()) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }

  // Token válido, generar uno nuevo para la próxima solicitud
  const newToken = generateToken(clientId);
  res.locals.newToken = newToken;

  next();
}

// Función para generar un token
function generateToken(clientId) {
  // Generar un token aleatorio
  const token = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);

  // Almacenar el token con su información
  validTokens.set(token, {
    clientId: clientId,
    expiresAt: Date.now() + 30000 // 30 segundos
  });

  return token;
}

// Limpiar tokens expirados periódicamente
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of validTokens.entries()) {
    if (data.expiresAt < now) {
      validTokens.delete(token);
    }
  }
}, 60000); // Cada minuto

// Ruta para obtener un token de seguridad
app.get('/api/auth/token', verifyApiKey, (req, res) => {
  const clientId = getClientId(req);
  const token = generateToken(clientId);

  res.json({
    success: true,
    token: token
  });
});

// Ruta para verificar tarjetas (protegida por token)
app.post('/api/check', verifyToken, async (req, res) => {
  try {
    const { cardNumber, month, year, cvc } = req.body;

    if (!cardNumber || !month || !year || !cvc) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required card details' 
      });
    }

    const result = await stripeApi.checkCard(cardNumber, month, year, cvc);

    // Incluir el nuevo token en la respuesta
    if (res.locals.newToken) {
      result.token = res.locals.newToken;
    }

    res.json(result);
  } catch (error) {
    console.error('Error checking card:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while checking the card', 
      error: error.message 
    });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Gotham Checker server running on port ${PORT}`);
  console.log(`Server initialized with API key: ${API_KEY}`);
});