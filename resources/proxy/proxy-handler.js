console.log('[proxy.html] Loaded proxy-handler.js');

const isElectronPreload = !!window.electron?.proxyBridge?.sendFetchResponse;
const isElectronUA = navigator.userAgent.includes('Electron');

if (!isElectronPreload || !isElectronUA) {
    console.warn('[proxy.html] Not in Electron environment.');
    document.body.innerHTML = 'Access Denied';
    throw new Error('[proxy.html] Not running in Electron. Aborting.');
}

window.addEventListener('message', async (event) => {
    const { id, endpoint, options } = event.data;
    if (!id || !endpoint) return;

    try {
        const url = new URL(endpoint, 'https://neurite.network'); // fallback base
        const allowedDomains = ['neurite.network', 'test.neurite.network'];

        if (!allowedDomains.includes(url.hostname)) {
            console.warn('[proxy.html] BLOCKED unauthorized domain:', url.hostname);
            return;
        }

        const response = await fetch(endpoint, {
            ...options,
            credentials: 'include',
            redirect: 'error' // prevent proxy-following redirects
        });

        const headersObj = Object.fromEntries(response.headers.entries());
        const contentType = headersObj['content-type'] || '';
        const isText = contentType.startsWith('text/') || contentType.includes('json');

        if (options?.stream) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            window.electron.proxyBridge.sendFetchResponse({
                id,
                streamMeta: {
                    status: response.status,
                    statusText: response.statusText,
                    headers: headersObj
                }
            });

            while (true) {
                const { value, done } = await reader.read();
                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    window.electron.proxyBridge.sendFetchResponse({ id, chunk });
                }
                if (done) {
                    window.electron.proxyBridge.sendFetchResponse({ id, done: true });
                    break;
                }
            }
        } else {
            const body = isText
                ? await response.text()
                : Array.from(new Uint8Array(await response.arrayBuffer()));

            window.electron.proxyBridge.sendFetchResponse({
                id,
                status: response.status,
                statusText: response.statusText,
                headers: headersObj,
                isText,
                body
            });
        }
    } catch (err) {
        console.error('[proxy.html] Fetch error:', err);
        window.electron.proxyBridge.sendFetchResponse({
            id,
            error: err.message
        });
    }
});
window.addEventListener('message', (event) => {
    const trusted = ['https://neurite.network', 'https://test.neurite.network'];
    if (!trusted.includes(event.origin)) return;
    if (!event.data?.type) return;

    console.log('[proxy.html] Forwarded message from OAuth redirect:', event.data);

    if (typeof window.electron?.proxyBridge?.sendAuthMessage === 'function') {
        window.electron.proxyBridge.sendAuthMessage(event.data);
    }
});
