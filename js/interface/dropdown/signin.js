
const redirectUri = `${NEURITE_BASE_URL}/resources/redirect.html`;

// Event listener to handle messages from the auth redirect
window.addEventListener('message', async function (event) {
    if (event.origin !== NEURITE_BASE_URL) {
        console.warn('Invalid origin:', event.origin);
        return;
    }

    //console.log('Message received:', event.data); // Log for debugging

    if (event.data.type === 'auth') {
        const { email } = event.data;

        if (email) {
            updateSignInState(email);
        }
    } else if (event.data.type === 'stripe') {
        const paymentStatus = event.data.status;
        //console.log('Stripe message received, status:', paymentStatus); // Debug log

        if (paymentStatus === 'success') {
            //console.log('Processing Stripe payment success...');
            try {
                neuritePanel.open(true); // True to fetch the latest user balance
                //console.log('User balance updated after payment success');
            } catch (error) {
                console.error('Error fetching balance after payment success:', error);
            }
        } else if (paymentStatus === 'cancel') {
            console.log('Payment canceled');
        }
    } else if (event.data.type === 'auth_error') {
        const { error } = event.data;
        console.error('Authentication error:', error);
        alert(`Authentication Error: ${error}`);
    }
});

async function updatePublicKeys() {
    // Attempt to retrieve both keys from localStorage
    let stripePublicKey = localStorage.getItem('stripePublicKey');
    let turnstilePublicKey = localStorage.getItem('turnstilePublicKey');

    // If both keys are present, return them immediately
    if (stripePublicKey && turnstilePublicKey) {
        return { stripePublicKey, turnstilePublicKey };
    }

    // If either key is missing, fetch both from the backend
    try {
        const response = await window.NeuriteBackend.get('/public-keys');
        if (!response.ok) {
            throw new Error("Failed to retrieve public keys from the server.");
        }

        const keys = await response.json();

        // Destructure the keys from the response
        ({ stripePublicKey, turnstilePublicKey } = keys);

        // Validate that both keys are present in the response
        if (!stripePublicKey || !turnstilePublicKey) {
            throw new Error("Incomplete public keys received from the server.");
        }

        // Store the fetched keys in localStorage for future use
        localStorage.setItem('stripePublicKey', stripePublicKey);
        localStorage.setItem('turnstilePublicKey', turnstilePublicKey);

        return { keys };
    } catch (error) {
        throw error; // Rethrow the error to handle it in the calling function if needed
    }
}

async function signIn() {
    try {
        const keys = await updatePublicKeys();
        const turnstilePublicKey = keys.turnstilePublicKey;

        // Proceed only if the turnstilePublicKey is available
        if (!turnstilePublicKey) {
            return;
        }

        const workerUrl = `${NEURITE_BASE_URL}/api/oauth`;
        const siteKey = turnstilePublicKey;

        // Construct the verification popup URL with encoded parameters
        const popupUrl = `/resources/verify.html?workerUrl=${encodeURIComponent(workerUrl)}&siteKey=${encodeURIComponent(siteKey)}`;
        const popup = window.open(popupUrl, 'Verification', 'width=500,height=600');

        if (!popup) {
            alert("Please enable popups for this site to complete the verification.");
            return;
        }
    } catch (error) {
        console.error("Sign-in failed:", error);
    }
}

async function signOut() {
    try {
        const response = await window.NeuriteBackend.post('/oauth/sign-out', null, { handleUnauthorized: true });

        if (!response.ok) {
            if (response.status === 401) {
                // Session has expired; proceed to sign out locally
                console.warn('Session expired. Signing out locally.');
                updateSignInState();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to sign out.');
            }
        }

        if (response.status === 200) {
            const data = await response.json();
            if (data.success) {
                updateSignInState();
            } else {
                throw new Error('Sign out was not successful.');
            }
        }
    } catch (error) {
        console.error('Sign out failed:', error);
        alert(`Error signing out: ${error.message}`);
    }
}

function updateSignInState(userEmail) {
    if (userEmail) { // User is signed in
        localStorage.setItem('userEmail', userEmail);
        localStorage.setItem('lastMeCheck', Date.now()); // Update timestamp
    } else { // User is signed out
        localStorage.removeItem('userEmail');
        localStorage.removeItem('lastMeCheck'); // Remove timestamp
    }
    updateSignInStateUI(Boolean(userEmail));
}


function updateSignInStateUI(isSignedIn) {
    if (!isSignedIn) neuritePanel.close(); // Close any open panels
    const signInButton = Elem.byId('sign-in-btn');
    signInButton.textContent = (isSignedIn ? "Sign Out" : "Sign In");
    signInButton.onclick = (isSignedIn ? signOut : signIn);
}

async function fetchCurrentUser() {
    let userEmail = null; // Initialize as null

    try {
        // Pass `handleUnauthorized: true` to allow silent handling of 401
        const response = await window.NeuriteBackend.get('/oauth/me', { handleUnauthorized: true });

        if (response.status === 401) {
            // Handle unauthorized error as signed-out state
            console.warn('User is not authenticated. Treating as signed-out state.');
        } else if (!response.ok) {
            throw new Error(`Failed to fetch user: ${response.statusText}`);
        } else {
            const data = await response.json();

            if (data.user && data.user.email) {
                // User is authenticated
                userEmail = data.user.email;
            }
        }
    } catch (error) {
        console.error('Error fetching current user:', error);
    } finally {
        // Always update sign-in state
        updateSignInState(userEmail);
    }
}

// Call fetchCurrentUser() only if the base URL is valid
if (NEURITE_BASE_URL) {
    fetchCurrentUser();
} else {
    updateSignInState();
}


async function checkNeuriteSignIn() {
    try {
        neuriteOriginCheck();
    } catch (error) {
        console.error("Origin check failed:", error);
        return false; // Early exit since origin is invalid
    }

    const lastMeCheck = localStorage.getItem('lastMeCheck');
    const now = Date.now();
    let needsMeCheck = true;

    if (lastMeCheck && (now - lastMeCheck) < 10 * 60 * 1000) {
        needsMeCheck = false;
    }

    if (needsMeCheck) {
        try {
            await fetchCurrentUser();
            // Update lastMeCheck after successful fetch
            localStorage.setItem('lastMeCheck', now);
        } catch (error) {
            console.error("Error fetching current user:", error);
            return false; // Exit if fetching user fails
        }
    }

    const userEmail = localStorage.getItem('userEmail');

    if (userEmail) {
        return true;
    } else {
        const confirmSignIn = confirm("You are not signed in. Sign in?");
        if (confirmSignIn) {
            signIn();
        }
        return false;
    }
}

function neuriteOriginCheck() {
    if (window.location.origin !== NEURITE_BASE_URL) {
        alert(`Please access neurite.network to sign in.`);
        throw new Error('Invalid Origin'); // Prevent further execution
    }
}

// Event Listener for Button Click
document.getElementById('openNeuriteModalButton').onclick = async function () {
    try {
        const isSignedIn = await checkNeuriteSignIn();
        if (isSignedIn) {
            neuritePanel.open();
        }
    } catch (error) {
        console.error("Error in onclick handler:", error);
    }
};

function handleNeuriteUnauthorized() {
    updateSignInState();
    const shouldSignIn = confirm('Your session has expired. Sign in to continue.');
    if (shouldSignIn) {
        signIn();
    }
    throw new Error('Unauthorized'); // Ensure control flow exits after handling
}
