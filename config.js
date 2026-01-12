

// Prevent double declaration of SUPABASE_CONFIG
if (!window.SUPABASE_CONFIG) {
    // Supabase Configuration
    window.SUPABASE_CONFIG = {
        URL: localStorage.getItem('supabaseUrl') || 'https://putgtsdgeyqyptamwpnx.supabase.co',
        KEY: localStorage.getItem('supabaseKey') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1dGd0c2RnZXlxeXB0YW13cG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODMxMzAsImV4cCI6MjA4Mjk1OTEzMH0.bo30DP6UxtpHSvKTCwtaUmkJR8aT-BNEhyrW35IKsVE',
        TIMEOUT: 15000 // 15 seconds for better responsiveness (increased from 3 seconds)
    };
}

// API Helper Functions
class SupabaseAPI {
    constructor(url, key) {
        this.url = url;
        this.key = key;
    }

    /**
     * Perform API request to Supabase with retry logic
     * @param {string} endpoint - Table name and query string
     * @param {object} options - Fetch options
     * @param {number} retryCount - Current retry attempt
     * @returns {Promise} Response data
     */
    async request(endpoint, options = {}, retryCount = 0) {
        try {
            const headers = {
                'apikey': this.key,
                'Content-Type': 'application/json',
                ...options.headers
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), window.SUPABASE_CONFIG.TIMEOUT);

            const response = await fetch(`${this.url}/rest/v1/${endpoint}`, {
                ...options,
                headers,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                
                // Check if it's a payload too large error
                if (errorText.includes('payload too large') || response.status === 413) {
                    throw new Error('PAYLOAD_TOO_LARGE');
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            if (response.status === 204 || response.status === 201) {
                try {
                    const text = await response.text();
                    return text ? JSON.parse(text) : null;
                } catch (e) {
                    return null;
                }
            }

            const text = await response.text();
            if (!text) return null;

            try {
                return JSON.parse(text);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError, 'Text:', text);
                throw new Error('Invalid JSON response from server');
            }
        } catch (error) {
            // Handle AbortError (timeout) with exponential backoff
            if (error.name === 'AbortError') {
                if (retryCount < 3) {
                    const delayMs = 1000 * Math.pow(2, retryCount); // 1s, 2s, 4s
                    console.log(`Request timeout. Retrying in ${delayMs}ms (attempt ${retryCount + 1})...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    return this.request(endpoint, options, retryCount + 1);
                }
                throw new Error('Request timeout after multiple retries - please check your connection and try again');
            }
            
            // Retry on network errors
            if (error.message.includes('fetch') && retryCount < 2) {
                const delayMs = 1000 * (retryCount + 1);
                console.log(`Network error. Retrying in ${delayMs}ms (attempt ${retryCount + 1})...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return this.request(endpoint, options, retryCount + 1);
            }
            
            console.error('API request failed:', error);
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(table, query = '') {
        const endpoint = query ? `${table}?${query}` : table;
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(table, data) {
        return this.request(table, {
            method: 'POST',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });
    }

    /**
     * PATCH request
     */
    async patch(table, query, data) {
        return this.request(`${table}?${query}`, {
            method: 'PATCH',
            headers: {
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(table, query) {
        return this.request(`${table}?${query}`, {
            method: 'DELETE'
        });
    }
}

// Initialize API
const api = new SupabaseAPI(window.SUPABASE_CONFIG.URL, window.SUPABASE_CONFIG.KEY);

/**
 * User and Restaurant Session Management
 */
class SessionManager {
    constructor() {
        this.restaurantId = localStorage.getItem('restaurantId');
        this.userId = localStorage.getItem('userId');
        this.userRole = localStorage.getItem('userRole');
        this.userName = localStorage.getItem('userName');
    }

    /**
     * Login user
     */
    async login(email, password) {
        try {
            // Get user by email
            const users = await api.get('users', `email=eq.${encodeURIComponent(email)}`);
            
            if (!users || users.length === 0) {
                throw new Error('بيانات دخول غير صحيحة');
            }

            const user = users[0];
            
            // In production, use proper password hashing comparison
            // For now, store session
            this.setSession(user.id, user.restaurant_id, user.role, user.full_name);
            return user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Set session data
     */
    setSession(userId, restaurantId, role, userName) {
        this.userId = userId;
        this.restaurantId = restaurantId;
        this.userRole = role;
        this.userName = userName;

        localStorage.setItem('userId', userId);
        localStorage.setItem('restaurantId', restaurantId);
        localStorage.setItem('userRole', role);
        localStorage.setItem('userName', userName);
        localStorage.setItem('loginTime', new Date().toISOString());
    }

    /**
     * Clear session
     */
    logout() {
        this.userId = null;
        this.restaurantId = null;
        this.userRole = null;
        this.userName = null;

        localStorage.removeItem('userId');
        localStorage.removeItem('restaurantId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('loginTime');
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return !!this.userId && !!this.restaurantId;
    }

    /**
     * Get current restaurant ID
     */
    getRestaurantId() {
        if (!this.restaurantId) {
            this.restaurantId = prompt('⚠️ يرجى إدخال معرف المطعم:\n(متاح في جدول restaurants)');
            if (this.restaurantId) {
                localStorage.setItem('restaurantId', this.restaurantId);
            }
        }
        return this.restaurantId;
    }

    /**
     * Check if user has role
     */
    hasRole(requiredRole) {
        const roleHierarchy = {
            'admin': 3,
            'manager': 2,
            'staff': 1
        };
        return (roleHierarchy[this.userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
    }
}

// Initialize session
const session = new SessionManager();

/**
 * Utility Functions
 */
const utils = {
    /**
     * Format currency
     */
    formatCurrency(amount, currency = 'ج.م') {
        return `${amount} ${currency}`;
    },

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    /**
     * Show notification
     */
    notify(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg text-white z-50 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            'bg-blue-500'
        }`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    },

    /**
     * Generate UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Validate email
     */
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Validate phone
     */
    isValidPhone(phone) {
        return /^[0-9\+\-\s\(\)]{7,}$/.test(phone);
    }
};

/**
 * Loading state management
 */
class LoadingManager {
    constructor() {
        this.counter = 0;
        this.overlay = null;
    }

    init() {
        const existing = document.getElementById('loadingOverlay');
        if (existing) {
            this.overlay = existing;
        } else {
            this.overlay = document.createElement('div');
            this.overlay.id = 'loadingOverlay';
            this.overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
            this.overlay.innerHTML = `
                <div class="bg-white rounded-lg p-6 text-center">
                    <div class="animate-spin inline-block w-8 h-8 border-4 border-gray-300 border-t-orange-500 rounded-full"></div>
                    <p class="mt-4 text-gray-700">جاري التحميل...</p>
                </div>
            `;
            document.body.appendChild(this.overlay);
        }
    }

    show() {
        this.counter++;
        if (this.overlay) {
            this.overlay.classList.remove('hidden');
        }
    }

    hide() {
        this.counter = Math.max(this.counter - 1, 0);
        if (this.counter === 0 && this.overlay) {
            this.overlay.classList.add('hidden');
        }
    }
}
const loading = new LoadingManager();

// Export for use in other scripts
window.api = api;
window.session = session;
window.utils = utils;
window.loading = loading;