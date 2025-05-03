const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

/**
 * Administrador de proxies
 */
class ProxyManager {
    constructor() {
        this.enabled = true; // Activado por defecto
        this.proxiesPath = path.join(process.cwd(), 'api', 'proxies.txt'); // Ruta correcta para Vercel
        this.proxies = [];
        this.loadProxies();
    }

    /**
     * Carga los proxies desde el archivo
     */
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
                // Para Vercel, usar proxies hardcodeados si no se encuentra el archivo
                console.log(`Proxy file not found: ${this.proxiesPath}. Using hardcoded proxies.`);
                this.proxies = [
                    // Añade aquí tus proxies de webshare en el formato correcto
                    // Ejemplo:
                    // { host: "p.webshare.io", port: "80", auth: { username: "user1", password: "pass1" } }
                ];
            }
        } catch (error) {
            console.error('Error loading proxies:', error);
            this.proxies = [];
        }
    }

    /**
     * Obtiene un proxy aleatorio
     * @returns {object|null} - Proxy o null si no hay disponibles
     */
    getRandomProxy() {
        if (!this.enabled || !this.proxies.length) return null;
        return this.proxies[Math.floor(Math.random() * this.proxies.length)];
    }

    /**
     * Crea un agente HTTPS para axios
     * @param {object} proxy - Datos del proxy
     * @returns {HttpsProxyAgent|null} - Agente para axios
     */
    createProxyAgent(proxy) {
        if (!this.enabled || !proxy) return null;
        try {
            // El formato correcto para https-proxy-agent v5
            const proxyUrl = `http://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`;
            return new HttpsProxyAgent(proxyUrl);
        } catch (error) {
            console.error('Error creating proxy agent:', error);
            return null;
        }
    }

    /**
     * Activa o desactiva el uso de proxies
     * @param {boolean} status - Estado de activación
     */
    setEnabled(status) {
        this.enabled = !!status;
        console.log(`Proxy system ${this.enabled ? 'enabled' : 'disabled'}`);
        if (this.enabled) {
            this.loadProxies();
        }
    }

    /**
     * Configura proxy para axios sin usar HttpsProxyAgent 
     * (alternativa si hay problemas con el agente)
     * @param {object} proxy - Datos del proxy
     * @returns {object} - Configuración de proxy para axios
     */
    getAxiosProxyConfig(proxy) {
        if (!this.enabled || !proxy) return {};
        
        return {
            proxy: {
                host: proxy.host,
                port: parseInt(proxy.port),
                auth: {
                    username: proxy.auth.username,
                    password: proxy.auth.password
                },
                protocol: 'http'
            }
        };
    }
}

module.exports = new ProxyManager();
