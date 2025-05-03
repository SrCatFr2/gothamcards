document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const cardList = document.getElementById('card-list');
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const loadingElement = document.getElementById('loading');
    const progressText = document.getElementById('progress-text');
    const livesCounter = document.getElementById('lives-counter');
    const deadCounter = document.getElementById('dead-counter');
    const errorCounter = document.getElementById('error-counter');
    const livesContent = document.getElementById('lives-content');
    const deadContent = document.getElementById('dead-content');
    const errorContent = document.getElementById('error-content');
    const securityBadge = document.getElementById('security-badge');

    // Configuración de autenticación
    const API_KEY = 'dev_test_key'; // La misma que en el server.js
    let authToken = null;
    let tokenRefreshTimeout = null;

    // Estado
    let isChecking = false;
    let shouldStop = false;
    let processedCards = 0;
    let totalCards = 0;

    // Event Listeners
    startButton.addEventListener('click', startChecking);
    stopButton.addEventListener('click', stopChecking);

    // Obtener token al iniciar
    getAuthToken();

    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const tabName = this.getAttribute('data-tab');
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            document.getElementById(`${tabName}-content`).classList.add('active');
        });
    });

    // Función para actualizar el estado de seguridad visual
    function updateSecurityStatus(isSecure) {
        if (!securityBadge) return;

        if (isSecure) {
            securityBadge.className = 'security-badge secure';
            securityBadge.innerHTML = '<i class="fa-solid fa-shield-check"></i><span>Secure Connection</span>';
        } else {
            securityBadge.className = 'security-badge insecure';
            securityBadge.innerHTML = '<i class="fa-solid fa-shield-exclamation"></i><span>Connection Error</span>';
        }
    }

    // Función para obtener token de autenticación
    async function getAuthToken() {
        try {
            console.log('Requesting authentication token...');

            const response = await fetch('/api/auth/token', {
                method: 'GET',
                headers: {
                    'x-api-key': API_KEY
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.token) {
                authToken = data.token;
                updateSecurityStatus(true);
                console.log('Authentication token obtained');

                // Programar la próxima actualización antes de que expire
                if (tokenRefreshTimeout) {
                    clearTimeout(tokenRefreshTimeout);
                }
                tokenRefreshTimeout = setTimeout(getAuthToken, 25000); // 25 segundos (antes de los 30)

                return true;
            } else {
                throw new Error('Invalid token response');
            }
        } catch (error) {
            console.error('Authentication error:', error);
            updateSecurityStatus(false);

            // Reintentar después de un breve retraso
            setTimeout(getAuthToken, 5000);

            return false;
        }
    }

    async function startChecking() {
        // Verificar si tenemos token
        if (!authToken) {
            alert('Establishing secure connection. Please wait a moment and try again.');
            await getAuthToken();
            if (!authToken) return;
        }

        const cards = cardList.value.trim().split('\n');

        if (cards.length === 0 || (cards.length === 1 && cards[0] === '')) {
            alert('Please enter cards to check');
            return;
        }

        if (cards.length > 20) {
            alert('Maximum 20 cards allowed');
            return;
        }

        isChecking = true;
        shouldStop = false;
        startButton.disabled = true;
        stopButton.disabled = false;

        // Mostrar pantalla de carga
        if (loadingElement) {
            loadingElement.classList.remove('hidden');
        }

        // Reset counters
        processedCards = 0;
        totalCards = cards.filter(card => card.trim() !== '').length;
        livesCounter.textContent = '0';
        deadCounter.textContent = '0';
        errorCounter.textContent = '0';

        if (progressText) {
            progressText.textContent = `0/${totalCards}`;
        }

        // Clear previous results
        clearResults();

        for (let i = 0; i < cards.length; i++) {
            if (shouldStop) break;

            const card = cards[i].trim();
            if (!card) continue;

            try {
                // Parse card details
                const cardDetails = parseCardString(card);
                if (!cardDetails) {
                    updateCounter('error');
                    addResult('error', card, 'Invalid card format');
                    updateProgress();
                    continue;
                }

                // Check card
                const response = await checkCard(cardDetails);

                // Si hay un nuevo token en la respuesta, actualizarlo
                if (response.token) {
                    authToken = response.token;
                    console.log('Token refreshed from response');

                    // Reiniciar el temporizador
                    if (tokenRefreshTimeout) {
                        clearTimeout(tokenRefreshTimeout);
                    }
                    tokenRefreshTimeout = setTimeout(getAuthToken, 25000);
                }

                if (response.success) {
                    if (response.status === 'approved') {
                        updateCounter('live');
                        addResult('live', card, response);
                    } else {
                        updateCounter('dead');
                        addResult('dead', card, response);
                    }
                } else {
                    // Si hay error de autenticación, intentar renovar el token
                    if (response.message === 'Authentication required' || 
                        response.message === 'Invalid or expired token') {
                        await getAuthToken();
                        i--; // Reintentar esta tarjeta
                        continue;
                    }

                    updateCounter('error');
                    addResult('error', card, response.message || 'Unknown error');
                }

                updateProgress();

                // Add delay between checks
                await new Promise(resolve => setTimeout(resolve, 1500));

            } catch (error) {
                console.error('Error checking card:', error);
                updateCounter('error');
                addResult('error', card, 'Error checking card');
                updateProgress();
            }
        }

        // Reset state
        isChecking = false;
        startButton.disabled = false;
        stopButton.disabled = true;

        if (loadingElement) {
            loadingElement.classList.add('hidden');
        }
    }

    function updateProgress() {
        processedCards++;
        if (progressText) {
            progressText.textContent = `${processedCards}/${totalCards}`;
        }
    }

    function stopChecking() {
        shouldStop = true;
        stopButton.disabled = true;
    }

    function parseCardString(cardString) {
        // Validar formato: XXXXXXXXXXXXXXXX|MM|YY|CVV
        const parts = cardString.split('|');
        if (parts.length < 4) return null;

        const cardNumber = parts[0].replace(/\s+/g, ''); // Eliminar espacios
        const month = parts[1];
        const year = parts[2];
        const cvc = parts[3];

        return {
            cardNumber,
            month,
            year,
            cvc
        };
    }

    async function checkCard(cardDetails) {
        try {
            const response = await fetch('/api/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(cardDetails)
            });

            // Si hay error de autenticación
            if (response.status === 401 || response.status === 403) {
                return {
                    success: false,
                    message: 'Authentication required'
                };
            }

            return await response.json();
        } catch (error) {
            console.error('Error in API call:', error);
            return {
                success: false,
                message: 'Network error'
            };
        }
    }

    function updateCounter(type) {
        let counter;

        if (type === 'live') counter = livesCounter;
        else if (type === 'dead') counter = deadCounter;
        else counter = errorCounter;

        if (counter) {
            const currentCount = parseInt(counter.textContent) || 0;
            counter.textContent = (currentCount + 1).toString();
        }
    }

    function addResult(type, card, result) {
        let container;

        if (type === 'live') container = livesContent;
        else if (type === 'dead') container = deadContent;
        else container = errorContent;

        if (!container) return;

        // Crear elemento de resultado
        const resultDiv = document.createElement('div');
        resultDiv.className = `card-result ${type}`;

        // Formatear tarjeta para mostrar
        const formattedCard = formatCardNumber(card);

        // Construir HTML
        resultDiv.innerHTML = `
            <div class="card-number">${formattedCard}</div>
            <div class="card-details">
                ${result.card ? `
                    <span>${result.card.brand || 'Unknown'}</span>
                    <span>${result.card.bank || 'Unknown Bank'}</span>
                ` : ''}
            </div>
            <div class="card-message ${type}">
                ${result.result || result}
            </div>
        `;

        // Eliminar estado vacío si existe
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Añadir al contenedor
        container.prepend(resultDiv);
    }

    function formatCardNumber(card) {
        // Extraer solo el número de tarjeta
        const cardNumber = card.split('|')[0].replace(/\s+/g, '');

        // Añadir espacios cada 4 dígitos
        return cardNumber.replace(/(\d{4})/g, '$1 ').trim();
    }

    function clearResults() {
        // Limpiar contenedores y añadir estados vacíos
        if (livesContent) {
            livesContent.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-check-circle"></i>
                    <p>No approved cards yet</p>
                </div>
            `;
        }

        if (deadContent) {
            deadContent.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-times-circle"></i>
                    <p>No declined cards yet</p>
                </div>
            `;
        }

        if (errorContent) {
            errorContent.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <p>No error cards yet</p>
                </div>
            `;
        }
    }

    // Limpiar timeout al cerrar la página
    window.addEventListener('beforeunload', function() {
        if (tokenRefreshTimeout) {
            clearTimeout(tokenRefreshTimeout);
        }
    });
});