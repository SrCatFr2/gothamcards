const API_KEY = 'dev_test_key';
const tokens = new Map();

function getClientId(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'unknown';
  return `${ip}-${userAgent.substring(0, 20)}`;
}

function generateToken(clientId) {
  const token = Math.random().toString(36).substring(2, 15) + 
              Math.random().toString(36).substring(2, 15);
  
  tokens.set(token, {
    clientId: clientId,
    expiresAt: Date.now() + 30000 // 30 segundos
  });
  
  return token;
}

module.exports = (req, res) => {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');
  
  // Manejar OPTIONS para preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Verificar API key
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== API_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
    }
    
    // Generar token
    const clientId = getClientId(req);
    const token = generateToken(clientId);
    
    return res.status(200).json({
      success: true,
      token: token
    });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};
