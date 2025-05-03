const CryptoJS = require('crypto-js');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Clave maestra para encriptación (en producción debería estar en variables de entorno)
const MASTER_KEY = crypto.randomBytes(32).toString('hex');

// Clave de API para autorizar la generación de tokens (en producción debería estar en variables de entorno)
const API_KEYS = {
  // Clave principal para el frontend oficial
  'gotham_official_client': crypto.randomBytes(16).toString('hex'),

  // Claves para pruebas o desarrolladores autorizados
  'dev_test_key': 'dev_test_key_value'
};

// Tiempo de expiración del token en milisegundos (30 segundos)
const TOKEN_EXPIRY = 30 * 1000;

// Registro de tokens emitidos para prevenir reutilización
const issuedTokens = new Map();

// Límites de solicitudes por IP
const requestLimits = new Map();
const MAX_REQUESTS_PER_MINUTE = 10;

/**
 * Verifica si una clave de API es válida
 * @param {string} apiKey - Clave de API a verificar
 * @returns {boolean} - True si la clave es válida
 */
function isValidApiKey(apiKey) {
  return Object.values(API_KEYS).includes(apiKey);
}

/**
 * Verifica si una IP ha excedido el límite de solicitudes
 * @param {string} ip - Dirección IP del cliente
 * @returns {boolean} - True si ha excedido el límite
 */
function hasExceededRateLimit(ip) {
  const now = Date.now();

  // Limpiar registros antiguos
  for (const [recordIp, record] of requestLimits.entries()) {
    if (now - record.timestamp > 60000) { // 1 minuto
      requestLimits.delete(recordIp);
    }
  }

  // Verificar o inicializar el registro para esta IP
  if (!requestLimits.has(ip)) {
    requestLimits.set(ip, { count: 1, timestamp: now });
    return false;
  }

  const record = requestLimits.get(ip);

  // Si ha pasado más de un minuto, reiniciar el contador
  if (now - record.timestamp > 60000) {
    record.count = 1;
    record.timestamp = now;
    return false;
  }

  // Incrementar el contador y verificar el límite
  record.count++;
  return record.count > MAX_REQUESTS_PER_MINUTE;
}

/**
 * Genera un token de seguridad encriptado
 * @param {string} clientId - Identificador único del cliente
 * @param {string} apiKey - Clave de API para autorización
 * @returns {string|null} - Token encriptado o null si la clave de API no es válida
 */
function generateToken(clientId, apiKey) {
  try {
    // Verificar la clave de API
    if (!isValidApiKey(apiKey)) {
      console.log('Invalid API key attempted:', apiKey);
      return null;
    }

    // Verificar límite de solicitudes
    if (hasExceededRateLimit(clientId.split('-')[0])) {
      console.log('Rate limit exceeded for IP:', clientId.split('-')[0]);
      return null;
    }

    const timestamp = Date.now();
    const tokenId = uuidv4();

    // Crear datos del token
    const tokenData = {
      id: tokenId,
      cid: hashValue(clientId),
      ts: timestamp,
      exp: timestamp + TOKEN_EXPIRY,
      nce: uuidv4(),
      fp: generateFingerprint(clientId)
    };

    // Registrar el token emitido
    issuedTokens.set(tokenId, {
      clientId: clientId,
      expiresAt: timestamp + TOKEN_EXPIRY
    });

    // Limpiar tokens expirados
    cleanExpiredTokens();

    // Convertir el objeto a string y encriptar
    const tokenString = JSON.stringify(tokenData);
    const encryptedToken = CryptoJS.AES.encrypt(tokenString, MASTER_KEY).toString();

    // Codificar en base64 para uso en URL
    return Buffer.from(encryptedToken).toString('base64');
  } catch (error) {
    console.error('Error generating token:', error);
    return null;
  }
}

/**
 * Verifica si un token es válido
 * @param {string} token - Token encriptado
 * @param {string} clientId - Identificador del cliente para verificación
 * @returns {boolean} - True si el token es válido
 */
function verifyToken(token, clientId) {
  try {
    // Decodificar de base64
    const encryptedToken = Buffer.from(token, 'base64').toString();

    // Desencriptar
    const decryptedBytes = CryptoJS.AES.decrypt(encryptedToken, MASTER_KEY);
    const tokenString = decryptedBytes.toString(CryptoJS.enc.Utf8);

    if (!tokenString) {
      return false;
    }

    const tokenData = JSON.parse(tokenString);

    // Verificar que el token no ha expirado
    const currentTime = Date.now();
    if (tokenData.exp <= currentTime) {
      return false;
    }

    // Verificar que el token pertenece al mismo cliente
    const hashedClientId = hashValue(clientId);
    if (tokenData.cid !== hashedClientId) {
      return false;
    }

    // Verificar que el token no ha sido invalidado
    if (!issuedTokens.has(tokenData.id)) {
      return false;
    }

    // Verificar huella digital
    const expectedFingerprint = generateFingerprint(clientId);
    if (tokenData.fp !== expectedFingerprint) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error verifying token:', error);
    return false;
  }
}

/**
 * Invalida un token específico
 * @param {string} token - Token a invalidar
 */
function invalidateToken(token) {
  try {
    // Decodificar y desencriptar el token
    const encryptedToken = Buffer.from(token, 'base64').toString();
    const decryptedBytes = CryptoJS.AES.decrypt(encryptedToken, MASTER_KEY);
    const tokenString = decryptedBytes.toString(CryptoJS.enc.Utf8);

    if (tokenString) {
      const tokenData = JSON.parse(tokenString);
      // Eliminar el token del registro
      issuedTokens.delete(tokenData.id);
    }
  } catch (error) {
    console.error('Error invalidating token:', error);
  }
}

/**
 * Limpia tokens expirados del registro
 */
function cleanExpiredTokens() {
  const now = Date.now();
  for (const [tokenId, data] of issuedTokens.entries()) {
    if (data.expiresAt <= now) {
      issuedTokens.delete(tokenId);
    }
  }
}

/**
 * Genera una huella digital basada en el ID del cliente
 */
function generateFingerprint(clientId) {
  return CryptoJS.SHA256(`${clientId}|${MASTER_KEY.substring(16, 32)}`).toString();
}

/**
 * Hash un valor para protección adicional
 */
function hashValue(value) {
  return CryptoJS.SHA256(value + MASTER_KEY.substring(8, 24)).toString();
}

module.exports = {
  generateToken,
  verifyToken,
  invalidateToken,
  isValidApiKey,
  API_KEYS
};