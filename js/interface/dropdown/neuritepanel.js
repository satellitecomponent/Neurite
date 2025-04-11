window.NeuriteEnv = {
    isProd: window.location.origin === 'https://neurite.network',
    isTest: window.location.origin === 'https://test.neurite.network',
    isElectron: window.startedViaElectron === true,
    isLocalhostFrontend: window.location.origin === 'http://localhost:8080',
    isLocalFileFrontend: window.location.origin === 'null',

    get isElectronWithLocalFrontend() {
        return this.isElectron && (this.isLocalhostFrontend || this.isLocalFileFrontend);
    },

    // Used for request fallback or redirect logic
    get baseUrl() {
        if (this.isProd) return 'https://neurite.network';
        if (this.isTest) return 'https://test.neurite.network';
        return null; // Electron-local and dev-hosted must proxy
    }
}

function neuriteOriginCheck() {
    const { isProd, isTest, isElectron } = window.NeuriteEnv;

    const isValidEnvironment = isProd || isTest || isElectron;
    if (isValidEnvironment) return;

    alert('Please access Neurite via neurite.network or the official app.');
    throw new Error('Blocked request: invalid origin');
}

class NeuriteBackend {
    constructor() {
        this.baseUrl = window.NeuriteEnv.baseUrl;
    }

    async request(endpoint, options = {}) {
        const isStreaming = options.stream === true;
        neuriteOriginCheck();

        const url = this.baseUrl ? `${this.baseUrl}/api${endpoint}` : `/api${endpoint}`;
        const requestOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            ...options
        };

        try {
            const response = window.NeuriteEnv.isElectronWithLocalFrontend
                ? await this.#electronRequest(endpoint, requestOptions, isStreaming)
                : await fetch(url, requestOptions);

            return this.#handleResponse(response, options.handleUnauthorized);
        } catch (err) {
            Logger.err(`API request to ${url} failed:`, err);
            throw err;
        }
    }

    async get(endpoint, options = {}) {
        return this.request(endpoint, { method: 'GET', ...options });
    }

    async post(endpoint, body, options = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
            ...options
        });
    }

    async #handleResponse(response, handleUnauthorized) {
        if (response.status === 401) {
            if (handleUnauthorized) return response;
            return handleNeuriteUnauthorized();
        }
        return response;
    }

    async #electronRequest(endpoint, requestOptions, isStreaming) {
        const fullEndpoint = `/api${endpoint}`;
        const encoder = new TextEncoder();
    
        if (isStreaming) {
            const id = crypto.randomUUID();
    
            let responseHeaders = {};
            let status = 200;
            let statusText = '';
    
            const stream = new ReadableStream({
                start(controller) {
                    const onChunk = (event, data) => {
                        if (data.id !== id) return;
    
                        if (data.streamMeta) {
                            // Initial headers/status block
                            responseHeaders = data.streamMeta.headers || {};
                            status = data.streamMeta.status || 200;
                            statusText = data.streamMeta.statusText || '';
                            return;
                        }
    
                        if (data.chunk) {
                            controller.enqueue(encoder.encode(data.chunk));
                        }
    
                        if (data.done) {
                            controller.close();
                            window.electronAPI._removeStreamListener(onChunk);
                        }
    
                        if (data.error) {
                            controller.error(new Error(data.error));
                            window.electronAPI._removeStreamListener(onChunk);
                        }
                    };
                    window.electronAPI._addStreamListener(onChunk);
                }
            });
    
            window.electronAPI.sendStreamRequest(id, fullEndpoint, requestOptions);
    
            return new Response(stream, {
                headers: new Headers(responseHeaders),
                status,
                statusText
            });
        }
    
        // --- Non-streaming ---
        const raw = await window.electronAPI.secureFetch(fullEndpoint, requestOptions);
    
        const headers = new Headers(raw.headers || {});
        const body = raw.isText
            ? raw.body
            : new Uint8Array(raw.body); // proxy.html sends byte array if not text
    
        return new Response(
            raw.isText ? body : body.buffer,
            {
                status: raw.status,
                statusText: raw.statusText || '',
                headers
            }
        );
    }
}

window.NeuriteBackend = new NeuriteBackend();

// neuritePanel.js

class NeuritePanel {
    constructor(modalId, balanceHandler) {
        this.modalId = modalId;
        this.balanceHandler = balanceHandler;
        this.balanceDisplay = null;
        this.addFundsButton = null;
        this.balanceBar = null;
        this.profilePanel = null;
        this.usagePanel = null;
        this.modelsPanel = null;
        this.signOutButton = null;
        this.deleteAccountButton = null;

        this.fetchUserBalanceThrottled = debounce(() => this.fetchUserBalance(true), 2000);
    }

    initializeElements() {
        this.balanceDisplay = document.getElementById('balance-display');
        this.addFundsButton = document.getElementById('add-funds-button');
        this.balanceBar = document.getElementById('balance-bar');
        this.profilePanel = document.getElementById('profilePanel');
        this.usagePanel = document.getElementById('usagePanel');
        this.modelsPanel = document.getElementById('modelsPanel');
        this.signOutButton = document.getElementById('sign-out-btn');

        const emailDisplay = document.getElementById('email-display');
        const storedEmail = localStorage.getItem('userEmail');
        if (storedEmail && emailDisplay) {
            emailDisplay.textContent = storedEmail;
        } else if (!emailDisplay) {
            Logger.warn('Email display element not found.');
        }

        this.setupTabEventListeners();

        if (this.addFundsButton) {
            this.addFundsButton.addEventListener('click', () => this.balanceHandler.addFunds());
        } else {
            Logger.err('Add funds button not found.');
        }

        if (this.signOutButton) {
            this.signOutButton.addEventListener('click', signOut);
        } else {
            Logger.err('Sign out button not found.');
        }

        // Initialize Delete Account Button
        this.deleteAccountButton = document.getElementById('delete-account-btn');
        if (this.deleteAccountButton) {
            this.deleteAccountButton.addEventListener('click', () => this.handleDeleteAccount());
        } else {
            Logger.err('Delete Account button not found.');
        }
    }

    setupTabEventListeners() {
        const panels = [
            { labelId: 'profilePanel', panel: this.profilePanel },
            { labelId: 'usagePanel', panel: this.usagePanel },
            { labelId: 'modelsPanel', panel: this.modelsPanel },
        ];

        panels.forEach(({ labelId, panel }) => {
            const labelElement = document.querySelector(`label[for="${labelId}"]`);
            if (labelElement) {
                labelElement.addEventListener('click', async () => {
                    togglePanel(panel);
                    panels.forEach(({ panel: otherPanel }) => {
                        if (otherPanel !== panel && !otherPanel.classList.contains('hidden')) {
                            togglePanel(otherPanel);
                        }
                    });
                });
            } else {
                Logger.err(`Label for ${labelId} not found.`);
            }
        });
    }

    open(refresh = false) {
        Modal.open(this.modalId);
        this.initializeElements();
        togglePanel(this.usagePanel);
        this.fetchUserBalance(refresh);
    }

    async fetchUserBalance(refresh = false) {
        const MAX_TOTAL_BALANCE = 25;
        const MIN_ADD_AMOUNT = 3;

        // Check if balance is stored locally and refresh is not requested
        let balance = parseFloat(localStorage.getItem('userBalance'));
        if (isNaN(balance) || refresh) {
            try {
                // Fetch balance from the server if refresh is true or no local balance
                balance = await this.balanceHandler.fetchUserBalance();
                // Update local storage
                localStorage.setItem('userBalance', balance);
            } catch (error) {
                Logger.err('Error fetching balance:', error);
                if (this.balanceDisplay) {
                    this.balanceDisplay.textContent = 'error';
                } else {
                    Logger.warn('Balance display element not found. Cannot display error.');
                }
                this.updateBalanceBar(0);
                return;
            }
        }

        // UI updates with the latest balance
        const amountInput = document.getElementById('amount-input');
        const safeBalance = Math.max(0, balance);
        // Update the maxAddableAmount to have only 2 decimal places
        const maxAddableAmount = Math.max(0, MAX_TOTAL_BALANCE - safeBalance).toFixed(2);

        // Update the min and max attributes for the input element
        amountInput.min = MIN_ADD_AMOUNT;
        amountInput.max = maxAddableAmount;

        // Ensure the value stays within range and rounds to two decimal places
        if (maxAddableAmount < MIN_ADD_AMOUNT) {
            amountInput.disabled = true;
            amountInput.value = '';
        } else {
            amountInput.disabled = false;
            if (amountInput.value) {
                amountInput.value = Math.min(Math.max(amountInput.value, MIN_ADD_AMOUNT), maxAddableAmount).toFixed(2);
            }
        }

        // Update balance display if element exists
        if (this.balanceDisplay) {
            this.balanceDisplay.textContent = `$${safeBalance.toFixed(2)}`;
        } else {
            //Logger.warn('Balance display element not found. Skipping balance display update.');
        }

        // Update balance bar if element exists
        this.updateBalanceBar(safeBalance);
    }

    async handleDeleteAccount() {
        const confirmation = await window.confirm(
            "Are you sure you want to delete your account? This action is final and any remaining balance will be deleted."
        );

        if (!confirmation) {
            return; // User canceled the deletion
        }

        try {
            // Disable the button to prevent multiple clicks
            this.deleteAccountButton.disabled = true;

            // Make the API request to delete the account using NeuriteBackend
            const response = await window.NeuriteBackend.post('/oauth/delete-account', {
                email: localStorage.getItem('userEmail')
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete account.');
            }

            const data = await response.json();

            alert('Your account has been successfully deleted.');

            if (data.success) {
                updateSignInState();
            }
        } catch (error) {
            Logger.err('Delete Account Error:', error);
            alert(`Error deleting account: ${error.message}`);
            this.deleteAccountButton.disabled = false;
        }
    }

    updateBalanceBar(balance) {
        const maxBalance = 25;
        const percentage = (balance / maxBalance) * 100;
        if (this.balanceBar) {
            this.balanceBar.style.width = `${percentage}%`;
        } else {
            //Logger.warn('Balance bar element not found. Skipping balance bar update.');
        }
    }

    close() {
        Modal.close();
    }
}


class BalanceHandler {
    constructor() {
        // No need for workerUrl as NeuriteBackend handles the base URL
    }

    async addFunds() {
        const amountInput = document.getElementById('amount-input');
        const amount = parseFloat(amountInput.value);

        const minAmount = 3.00;
        const maxAmount = parseFloat(amountInput.max);

        // Check if the max allowable amount is less than the min (indicating the limit is reached)
        if (maxAmount < 3) {
            alert("Limit reached: You cannot add more funds.");
            amountInput.disabled = true; // Disable the input if no more funds can be added
            return;
        }

        // Round the amount to two decimal places and validate it
        const roundedAmount = Math.round(amount * 100) / 100;
        if (isNaN(roundedAmount) || roundedAmount < minAmount || roundedAmount > maxAmount) {
            alert(`Amount must be between $${minAmount} and $${maxAmount.toFixed(2)}`);
            return;
        }

        try {
            const paymentTab = window.open('about:blank', '_blank', 'width=500,height=600');
            const sessionId = await this.createCheckoutSession(roundedAmount);
            this.initPaymentTab(paymentTab, sessionId);
        } catch (error) {
            // Error handling
            if (error.message.includes('Exceeds maximum balance')) {
                alert('Your balance is already close to or at the maximum allowed amount. No further funds can be added.');
                amountInput.disabled = true;
            } else {
                alert('Error initiating add funds: ' + error.message);
            }
        }
    }

    // Method within your class to initialize the payment tab and load Stripe.js
    initPaymentTab(paymentTab, sessionId) {
        paymentTab.document.body.innerHTML = '<p>Redirecting to payment...</p>';
        const stripeScript = paymentTab.document.createElement('script');
        stripeScript.src = 'https://js.stripe.com/v3/';

        stripeScript.onload = async () => {
            // Retrieve the Stripe key
            const keys = await updatePublicKeys();
            const stripePublicKey = keys.stripePublicKey;

            if (stripePublicKey) {
                // Create and inject a script to initiate Stripe with the session ID
                const redirectScript = `
                const stripe = Stripe('${stripePublicKey}');
                stripe.redirectToCheckout({ sessionId: '${sessionId}' }).catch((error) => {
                    document.body.innerHTML = 'Error: ' + error.message;
                });
            `;
                const scriptTag = paymentTab.document.createElement('script');
                scriptTag.text = redirectScript;
                paymentTab.document.body.appendChild(scriptTag);
            }
        };

        // Append Stripe.js to the payment tab
        paymentTab.document.head.appendChild(stripeScript);
    }

    // Fetch the user's balance directly from the Stripe Worker
    async fetchUserBalance() {
        try {
            const response = await window.NeuriteBackend.get('/stripe/get-balance');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch balance');
            }

            const data = await response.json();
            return data.balance;
        } catch (error) {
            Logger.err('Error fetching balance:', error);
            throw error;
        }
    }

    // Create a Stripe Checkout session directly on the Stripe Worker
    async createCheckoutSession(amount) {
        try {
            const response = await window.NeuriteBackend.post('/stripe/create-checkout-session', { amount });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create checkout session');
            }

            const data = await response.json();
            return data.sessionId;
        } catch (error) {
            Logger.err('Error creating checkout session:', error);
            throw error;
        }
    }
}
const neuritePanel = new NeuritePanel('neurite-modal', new BalanceHandler());
