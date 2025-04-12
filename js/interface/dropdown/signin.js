window.addEventListener('message', async function (event) {
    console.log('[frontend] Received postMessage:', event.origin, event.data);
    const trustedOrigin = 'https://neurite.network' || 'https://test.neurite.network';
    if (event.origin !== trustedOrigin) {
        Logger.warn('Invalid origin from redirect:', event.origin);
        return;
    }

    const { type, email, status, error } = event.data;

    if (type === 'auth') {
        if (email) {
            updateSignInState(email);
            neuritePanel.open(true);
        }
    } else if (type === 'stripe') {
        if (status === 'success') {
            neuritePanel.open(true);
        } else if (status === 'cancel') {
            Logger.log('Stripe payment canceled');
        }
    } else if (type === 'auth_error') {
        Logger.err('Authentication error:', error);
        alert(`Authentication Error: ${error}`);
    }
});

async function updatePublicKeys() {
    let stripePublicKey = localStorage.getItem('stripePublicKey');
    let turnstilePublicKey = localStorage.getItem('turnstilePublicKey');

    if (stripePublicKey && turnstilePublicKey) {
        return { stripePublicKey, turnstilePublicKey };
    }

    try {
        const response = await window.NeuriteBackend.get('/public-keys');
        if (!response.ok) throw new Error("Failed to retrieve public keys from the server.");
        const keys = await response.json();
        ({ stripePublicKey, turnstilePublicKey } = keys);

        if (!stripePublicKey || !turnstilePublicKey) {
            throw new Error("Incomplete public keys received from the server.");
        }

        localStorage.setItem('stripePublicKey', stripePublicKey);
        localStorage.setItem('turnstilePublicKey', turnstilePublicKey);
        return { stripePublicKey, turnstilePublicKey };
    } catch (error) {
        throw error;
    }
}

async function signIn() {
    try {
        const keys = await updatePublicKeys();
        const turnstilePublicKey = keys.turnstilePublicKey;

        if (!turnstilePublicKey) {
            Logger.err("No Turnstile public key available");
            return;
        }

        const backendBase = window.NeuriteEnv.baseUrl || 'https://neurite.network';
        const redirectPage = window.NeuriteEnv.isTest
            ? 'https://test.neurite.network/resources/verify.html'
            : 'https://neurite.network/resources/verify.html';

        const workerUrl = `${backendBase}/api/oauth`;
        const frontendOrigin = window.location.origin;

        const popupUrl = `${redirectPage}?workerUrl=${encodeURIComponent(workerUrl)}&siteKey=${encodeURIComponent(turnstilePublicKey)}&origin=${encodeURIComponent(frontendOrigin)}`;

        if (window.NeuriteEnv.isElectronWithLocalFrontend) {
            window.electronAPI.openPopupViaProxy(popupUrl);
        } else {
            const popup = window.open(popupUrl, 'Verification', 'width=500,height=600');
            if (!popup) {
                alert("Please enable popups for this site to complete the verification.");
            }
        }
    } catch (error) {
        Logger.err("Sign-in failed:", error);
        alert("Sign-in error: " + error.message);
    }
}

async function signOut() {
    try {
        const response = await window.NeuriteBackend.post('/oauth/sign-out', null, { handleUnauthorized: true });

        if (!response.ok) {
            if (response.status === 401) {
                Logger.warn('Session expired. Signing out locally.');
                updateSignInState();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to sign out.');
            }
        }

        const data = await response.json();
        if (data.success) {
            updateSignInState();
        } else {
            throw new Error('Sign out was not successful.');
        }
    } catch (error) {
        Logger.err('Sign out failed:', error);
        alert(`Error signing out: ${error.message}`);
    }
}

function updateSignInStateUI(isSignedIn) {
    if (!isSignedIn) neuritePanel.close();
    const signInButton = Elem.byId('sign-in-btn');
    signInButton.textContent = (isSignedIn ? "Sign Out" : "Sign In");
    signInButton.onclick = (isSignedIn ? signOut : signIn);
}

function updateSignInState(userEmail) {
    if (userEmail) {
        localStorage.setItem('userEmail', userEmail);
        localStorage.setItem('lastMeCheck', Date.now());
    } else {
        localStorage.removeItem('userEmail');
        localStorage.removeItem('lastMeCheck');
    }
    updateSignInStateUI(Boolean(userEmail));
}

updateSignInState(!!localStorage.getItem('userEmail'));

async function checkSessionValid(forceRefresh = false) {
    const lastCheck = parseInt(localStorage.getItem('lastMeCheck'), 10);
    const now = Date.now();

    if (!forceRefresh && lastCheck && now - lastCheck < 10 * 60 * 1000) {
        return !!localStorage.getItem('userEmail');
    }

    try {
        const response = await window.NeuriteBackend.get('/oauth/me', { handleUnauthorized: true });

        if (response.ok) {
            const data = await response.json();
            const email = data?.user?.email;
            updateSignInState(email);
            localStorage.setItem('lastMeCheck', now);
            return !!email;
        } else {
            updateSignInState(null);
            return false;
        }
    } catch (err) {
        Logger.err("Session check failed:", err);
        updateSignInState(null);
        return false;
    }
}

async function checkNeuriteSignIn() {
    const isSignedIn = await checkSessionValid();
    if (!isSignedIn) {
        const confirmSignIn = await window.confirm("You are not signed in. Sign in?");
        if (confirmSignIn) signIn();
    }
    return isSignedIn;
}

document.getElementById('openNeuriteModalButton').onclick = async function () {
    try {
        const isSignedIn = await checkNeuriteSignIn();
        if (isSignedIn) {
            neuritePanel.open(true);
        }
    } catch (error) {
        Logger.err("Error in onclick handler:", error);
    }
}

function handleNeuriteUnauthorized() {
    updateSignInState();
    return window.confirm('Your session has expired. Sign in?')
        .then((shouldSignIn) => {
            if (shouldSignIn) {
                signIn();
            }
            throw new Error('Unauthorized'); // Ensure control flow exits after handling
        })
        .catch((error) => {
            console.error("Failed to display confirm dialog:", error);
            throw error; // Re-throw the error to maintain control flow
        });
}
