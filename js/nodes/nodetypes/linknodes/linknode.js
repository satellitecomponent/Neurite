class LinkNode {
    constructor(link = '', title = '', text = '', sx, sy, x, y) {
        if (!link) return this;

        this.link = link;
        this.title = title;
        this.viewType = window.startedViaElectron ? `webview` : `iframe`;

        const nodeTitle = link.startsWith('blob:') ? title : link;
        const node = new Node();
        const { content, viewerWrapper } = this.makeContentWrapper();
        node.viewerWrapper = viewerWrapper;

        const divView = NodeView.addAtNaturalScale(node, nodeTitle, []).div;
        divView.appendChild(content);

        divView.style.minWidth = '150px';
        divView.style.minHeight = '200px';

        node.push_extra_cb((node) => ({
            f: "textarea",
            a: {
                p: [0, 0, 1],
                v: node.view.titleInput.value
            }
        }));

        node.isLink = true;
        this.init(node);
        return node;
    }

    get viewer() {
        return this.node?.viewer;
    }

    makeAnchor() {
        const a = Html.make.a(this.link, 'link-anchor');
        a.id = 'link-element';
        a.setAttribute('target', "_blank");
        a.textContent = this.title;
        a.title = this.link;
        return a;
    }

    makeLinkWrapper() {
        const div = Html.new.div();
        div.id = 'link-wrapper';
        div.style.width = '300px';
        div.style.padding = '20px 0';
        div.appendChild(this.makeAnchor());
        return div;
    }

    makeViewerWrapper() {
        const div = Html.new.div();
        div.id = 'viewer-wrapper';
        const style = div.style;
        style.padding = '10px';
        style.width = '500px';
        style.height = '500px';
        style.flexGrow = '1';
        style.flexShrink = '1';
        style.display = 'none';
        style.boxSizing = 'border-box';
        return div;
    }

    makeContentWrapper() {
        const div = Html.new.div();
        const style = div.style;
        style.display = 'flex';
        style.flexDirection = 'column';
        style.alignItems = 'center';
        style.height = '100%';
        style.width = '100%';

        const viewerWrapper = this.makeViewerWrapper();
        div.append(this.makeLinkWrapper(), viewerWrapper);

        return { content: div, viewerWrapper };
    }

    makeViewer(wrapper) {
        this.viewType ||= window.startedViaElectron ? 'webview' : 'iframe';
        const existing = wrapper.querySelector(this.viewType);
        if (existing) return existing;

        const el = (this.viewType === 'webview')
            ? document.createElement('webview')
            : Html.new.iframe();

        Object.assign(el.style, {
            width: '100%',
            height: '100%',
            border: 'none',
            overflow: 'auto'
        });

        if (this.viewType === 'webview') {
            el.setAttribute('webpreferences', [
                'contextIsolation=yes',
                'sandbox=yes',
                'nodeIntegration=no',
                'webSecurity=yes',
                'enableRemoteModule=no',
                'javascript=yes',
                'allowPopups=no'
            ].join(','));

            const defaultZoom = 0.6;
            el.addEventListener('dom-ready', () => {
                el.setZoomFactor(defaultZoom);
            });
        }

        wrapper.appendChild(el);
        return el;
    }

    makeNavigationIcons() {
        const view = this.node.view;
        if (!view?.addSvgButton) return;

        view.navButtons ||= {};

        let x = 59;

        if (this.viewType === 'webview') {
            const back = view.addSvgButton("button-back", "caret-left-icon", x, () => this.goBack());
            view.navButtons["button-back"] = back;
            x += 20;

            const forward = view.addSvgButton("button-forward", "caret-right-icon", x, () => this.goForward());
            view.navButtons["button-forward"] = forward;
            x += 20;
        }

        const refresh = view.addSvgButton("button-refresh", "refresh-button", x, () => this.refreshViewer());
        view.navButtons["button-refresh"] = refresh;
    }

    init(node) {
        node.typeNode = this;
        this.node = node;

        const wrapper = node.content.querySelector("#viewer-wrapper");
        this.viewerWrapper = wrapper;
        node.viewer = wrapper.querySelector(this.viewType)
            || this.makeViewer(wrapper);

        const link = node.content.querySelector("#link-element");
        if (!link) {
            console.warn("Delaying link anchor setup until next frame...");
            requestAnimationFrame(() => this.init(node)); // Retry in next frame
            return;
        }

        this.linkElement = link;
        node.link = link;

        this.setLinkNodeProperties();
        this.makeNavigationIcons();

        if (node.viewer) {
            node.viewer.addEventListener('dom-ready', () => {
                node.viewer.isReady = true;
            });
            node.viewer.addEventListener('did-navigate', (e) => {
                const url = e.url;
                this.link = url; // <- make sure the internal state is synced
                node.view.titleInput.value = url;
                this.setLinkNodeProperties();
            });

            node.viewer.addEventListener('did-navigate-in-page', (e) => {
                const url = e.url;
                this.link = url;
                node.view.titleInput.value = url;
                this.setLinkNodeProperties();
            });
        }

        this.linkWrapper = node.content.querySelector("#link-wrapper");
        On.mouseover(link, Elem.setBothColors.bind(link, '#888', '#1a1a1d'));
        On.mouseout(link, Elem.setBothColors.bind(link, '#bbb', '#222226'));
        On.click(link, this.onClick);
        On.keypress(node.view.titleInput, this.onSearchBarKeyPress);
    }

    onClick = (e) => {
        e.preventDefault();
        this.toggleViewer();
    }

    setLinkNodeProperties() {
        const url = this.link;
        const anchor = this.linkElement;
        if (!anchor) {
            console.warn("Link anchor not found for", url);
            return;
        }

        anchor.href = url;
        anchor.textContent = url;
        anchor.title = url;

        this.node.linkUrl = url;
    }

    // TODO: Handle blobs
    updateViewerSrc(url) {
        const node = this.node;
        this.link = url || node.linkUrl;
        this.viewer.setAttribute('src', this.link);
        this.linkWrapper.style.display = 'none';
        this.viewerWrapper.style.display = 'block';

        this.setLinkNodeProperties();
    }

    onSearchBarKeyPress = (e) => {
        if (e.key !== 'Enter') return;

        e.preventDefault();

        const node = this.node;
        const inputValue = node.view.titleInput.value;

        const result = resolveLinkOrSearch(inputValue);
        if (!result) return;

        this.updateViewerSrc(result.url);
    };

    refreshViewer() {
        const viewer = this.viewer;
        if (!viewer) return;

        if (this.viewType === 'webview' && typeof viewer.reload === 'function') {
            try {
                viewer.reload();
            } catch (e) {
                console.warn('Webview reload failed, falling back to src reset:', e);
                const currentSrc = viewer.getAttribute('src');
                this.updateViewerSrc(currentSrc);
            }
        } else {
            // iframe fallback: re-assign src to reload
            const currentSrc = viewer.getAttribute('src');
            this.updateViewerSrc(currentSrc);
        }
    }

    toggleViewer() {
        const url = this.viewer.getAttribute('src');
        if (this.viewerWrapper.style.display === 'none') {
            this.updateViewerSrc(url);
        } else {
            this.linkWrapper.style.display = 'block';
            this.viewerWrapper.style.display = 'none';
        }
    }

    removeViewer() {
        const wrapper = this.viewerWrapper;
        while (wrapper.firstChild) {
            wrapper.removeChild(wrapper.firstChild);
        }
    }

    goBack() {
        if (!this.viewer) return;
        if (this.viewType === `webview`) {
            if (this.viewer.canGoBack?.()) this.viewer.goBack();
        } else {
            try {
                this.viewer.contentWindow?.history.back();
            } catch (err) {
                Logger.warn("Iframe history not accessible (likely cross-origin)");
            }
        }
    }

    goForward() {
        if (!this.viewer) return;
        if (this.viewType === `webview`) {
            if (this.viewer.canGoForward?.()) this.viewer.goForward();
        } else {
            try {
                this.viewer.contentWindow?.history.forward();
            } catch (err) {
                Logger.warn("Iframe history not accessible (likely cross-origin)");
            }
        }
    }

    async handleProxyDisplay() {
        const viewer = this.viewer;
        if (!viewer) return;

        const proxy = new LinkNode.proxy(this.node.linkUrl);
        const webpageContent = await Request.send(proxy);
        if (!webpageContent) return;

        const blob = new Blob([webpageContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        viewer.setAttribute('src', url);
        this.linkWrapper.style.display = 'none';
        this.viewerWrapper.style.display = 'block';
    }

    static proxy = class Proxy {
        static baseUrl = Host.urlForPath('/webscrape/raw-proxy?url=');
        constructor(linkUrl) {
            this.url = LinkNode.proxy.baseUrl + encodeURIComponent(linkUrl);
        }
        onResponse(res) { return res.text(); }
        onFailure() {
            alert("An error occurred displaying the webpage through a proxy server. Please ensure that the extract server is running on your localhost.");
            return "Failed to display the webpage through a proxy server.";
        }
    }
}
