module.exports = (req, res) => {
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
    // Simulación para prueba
    const { cardNumber } = req.body;
    
    if (!cardNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing card details'
      });
    }
    
    // Respuesta simulada para prueba
    return res.status(200).json({
      success: true,
      status: 'approved',
      card: {
        number: `${cardNumber.substring(0, 6)}xxxxxx${cardNumber.substring(cardNumber.length - 4)}`,
        brand: cardNumber.startsWith('4') ? 'VISA' : 'MASTERCARD',
        bank: 'Test Bank',
        type: 'CREDIT'
      },
      result: 'Approved! 🟩',
      token: 'test_token'
    });
  } catch (error) {
    console.error('Check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during card check'
    });
  }
};
