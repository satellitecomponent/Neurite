class LinkNode {
    constructor(link = '', name = '', text = '', sx, sy, x, y) {
        this.link = link;
        this.name = name;

        const nodeName = link.startsWith('blob:') ? name : link;
        const node = new Node();

        const divView = NodeView.addAtNaturalScale(node, nodeName, []).div;
        divView.appendChild(this.makeContentWrapper());
        divView.style.minWidth = '150px';
        divView.style.minHeight = '200px';

        node.push_extra_cb( (node)=>({
                f: "textarea",
                a: {
                    p: [0, 0, 1],
                    v: node.view.titleInput.value
                }
            })
        );

        node.isLink = true;
        node.typeNode = this;
        this.node = node;
        this.init();
        return node;
    }

    makeAnchor(){
        const a = Html.make.a(this.link);
        a.id = 'link-element';
        a.setAttribute('target', "_blank");
        a.textContent = this.name;
        a.style.cssText = "display: block; padding: 10px; word-wrap: break-word; white-space: pre-wrap; color: #bbb; transition: color 0.2s ease, background-color 0.2s ease; background-color: #222226; border-radius: 5px";
        return a;
    }
    makeLinkWrapper(){
        const div = Html.new.div();
        div.id = 'link-wrapper';
        div.style.width = '300px';
        div.style.padding = '20px 0';
        div.appendChild(this.makeAnchor());
        return div;
    }
    makeIframeWrapper(){
        const div = Html.new.div();
        div.id = 'iframe-wrapper';
        const style = div.style;
        style.padding = '10px';
        style.width = '100%';
        style.height = '100%';
        style.flexGrow = '1';
        style.flexShrink = '1';
        style.display = 'none';
        style.boxSizing = 'border-box';
        return div;
    }
    makeContentWrapper(){
        const div = Html.new.div();
        const style = div.style;
        style.display = 'flex';
        style.flexDirection = 'column';
        style.alignItems = 'center';
        style.height = '100%';
        style.width = '100%';
        div.append(this.makeLinkWrapper(), this.makeIframeWrapper());
        return div;
    }

    // To-Do: Find method to refresh saves of link nodes before the save update.

    makeIframe(wrapper){
        const iframe = Html.new.iframe();
        const style = iframe.style;
        style.width = '100%';
        style.height = '100%';
        style.border = 'none';
        style.overflow = 'auto';
        if (wrapper) wrapper.appendChild(iframe); // Append once and reuse
        return iframe;
    }

    init(){
        const node = this.node;
        const iframeWrapper = node.content.querySelector("#iframe-wrapper");
        this.iframeWrapper = iframeWrapper;
        node.iframe = iframeWrapper.querySelector("iframe")
                    || this.makeIframe(iframeWrapper);

        const link = node.content.querySelector("#link-element");
        node.link = link;
        node.linkUrl = (link ? link.getAttribute('href') : '');
        this.linkWrapper = node.content.querySelector("#link-wrapper");

        On.mouseover(link, Elem.setBothColors.bind(link, '#888', '#1a1a1d'));
        On.mouseout(link, Elem.setBothColors.bind(link, '#bbb', '#222226'));
        On.click(link, onClick);
        On.keypress(node.view.titleInput, this.onSearchBarKeyPress);
    }
    onClick = (e)=>{
        e.preventDefault();
        this.handleIframe();
    }
    onSearchBarKeyPress = (e)=>{
        if (e.key === 'Enter') {
            e.preventDefault();

            const node = this.node;
            const inputValue = node.view.titleInput.value;
            if (String.isUrl(inputValue)) {
                this.updateIframeSrc(inputValue);
                node.linkUrl = inputValue;
                node.link.href = inputValue;
                node.link.textContent = inputValue;
            } else {
                handleNaturalLanguageSearch(inputValue);
            }
        }
    }

    updateIframeSrc(url){
        this.removeIframe();
        this.makeIframe(this.iframeWrapper).setAttribute('src', url || this.node.linkUrl);

        this.linkWrapper.style.display = 'none';
        this.iframeWrapper.style.display = 'block';
    }

    handleIframe(){
        if (this.iframeWrapper.style.display === 'none') {
            this.updateIframeSrc()
        } else {
            this.linkWrapper.style.display = 'block';
            this.iframeWrapper.style.display = 'none';
        }
    }

    removeIframe(){
        const wrapper = this.iframeWrapper;
        while (wrapper.firstChild) {
            wrapper.removeChild(wrapper.firstChild);
        }
    }

    async handleProxyDisplay(){
        const iframeWrapper = this.iframeWrapper;
        this.removeIframe();

        const isHidden = (iframeWrapper.style.display === 'none' || !iframeWrapper.style.display);
        this.linkWrapper.style.display = (isHidden ? 'none' : 'block');
        iframeWrapper.style.display = (isHidden ? 'block' : 'none');
        if (!isHidden) return;

        const proxy = new LinkNode.proxy(this.node.linkUrl);
        const webpageContent = await Request.send(proxy);
        if (!webpageContent) return;

        this.makeIframe(iframeWrapper).setAttribute('srcdoc', webpageContent);
    }
    static proxy = class Proxy {
        static baseUrl = 'http://localhost:4000/raw-proxy?url=';
        constructor(linkUrl){
            this.url = Proxy.baseUrl + encodeURIComponent(linkUrl);
        }
        onResponse(res){ return res.text() }
        onFailure(){
            alert("An error occurred displaying the webpage through a proxy server. Please ensure that the extract server is running on your localhost.");
            return "Failed to display the webpage through a proxy server:";
        }
    }
}
