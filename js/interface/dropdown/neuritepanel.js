// Determine if we are on the test or production origins
const isTest = window.location.origin === 'https://test.neurite.network';
const isProd = window.location.origin === 'https://neurite.network';

// Set the base URL or null if not on the test or production origins
const NEURITE_BASE_URL = isTest
    ? 'https://test.neurite.network'
    : isProd
        ? 'https://neurite.network'
        : null;

class NeuriteBackend {
    constructor() {
        this.baseUrl = NEURITE_BASE_URL;
    }

    // General method for making API calls
    async request(endpoint, options = {}) {
        neuriteOriginCheck(); // Check origin before making the request

        const url = `${this.baseUrl}/api${endpoint}`;
        const defaultOptions = {
            credentials: 'include', // Include cookies
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            ...options
        };

        try {
            const response = await fetch(url, defaultOptions);

            if (response.status === 401) {
                if (options.handleUnauthorized) {
                    // Let the caller handle the unauthorized error
                    return response;
                } else {
                    // Use the global unauthorized handler
                    handleNeuriteUnauthorized();
                }
            }

            // Optionally handle other status codes here

            return response;
        } catch (error) {
            console.error(`API request to ${url} failed:`, error);
            throw error;
        }
    }

    // Example GET request
    async get(endpoint, options = {}) {
        return this.request(endpoint, { method: 'GET', ...options });
    }

    // Example POST request
    async post(endpoint, body, options = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
            ...options
        });
    }
}


// Instantiate and make it globally accessible
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
            console.warn('Email display element not found.');
        }

        this.setupTabEventListeners();

        if (this.addFundsButton) {
            this.addFundsButton.addEventListener('click', () => this.balanceHandler.addFunds());
        } else {
            console.error('Add funds button not found.');
        }

        if (this.signOutButton) {
            this.signOutButton.addEventListener('click', signOut);
        } else {
            console.error('Sign out button not found.');
        }

        // Initialize Delete Account Button
        this.deleteAccountButton = document.getElementById('delete-account-btn');
        if (this.deleteAccountButton) {
            this.deleteAccountButton.addEventListener('click', () => this.handleDeleteAccount());
        } else {
            console.error('Delete Account button not found.');
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
                console.error(`Label for ${labelId} not found.`);
            }
        });
    }

    open(refresh = false) {
        openModal(this.modalId);
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
                console.error('Error fetching balance:', error);
                if (this.balanceDisplay) {
                    this.balanceDisplay.textContent = 'error';
                } else {
                    console.warn('Balance display element not found. Cannot display error.');
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
            //console.warn('Balance display element not found. Skipping balance display update.');
        }

        // Update balance bar if element exists
        this.updateBalanceBar(safeBalance);
    }

    async handleDeleteAccount() {
        const confirmation = confirm(
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
            console.error('Delete Account Error:', error);
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
            //console.warn('Balance bar element not found. Skipping balance bar update.');
        }
    }

    close() {
        closeModal(this.modalId);
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
            console.error('Error fetching balance:', error);
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
            console.error('Error creating checkout session:', error);
            throw error;
        }
    }
}
const neuritePanel = new NeuritePanel('neurite-modal', new BalanceHandler());
