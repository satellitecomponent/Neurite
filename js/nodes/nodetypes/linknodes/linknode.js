const LinkNode = {};

LinkNode.createAnchor = function(link, name){
    const a = Html.make.a(link);
    a.id = 'link-element';
    a.setAttribute('target', "_blank");
    a.textContent = name;
    a.style.cssText = "display: block; padding: 10px; word-wrap: break-word; white-space: pre-wrap; color: #bbb; transition: color 0.2s ease, background-color 0.2s ease; background-color: #222226; border-radius: 5px";
    return a;
}
LinkNode.createLinkWrapper = function(link, name){
    const div = Html.new.div();
    div.id = 'link-wrapper';
    div.style.width = '300px';
    div.style.padding = '20px 0';
    div.appendChild(LinkNode.createAnchor(link, name));
    return div;
}
LinkNode.createIframeWrapper = function(){
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
LinkNode.createContentWrapper = function(link, name){
    const div = Html.new.div();
    const style = div.style;
    style.display = 'flex';
    style.flexDirection = 'column';
    style.alignItems = 'center';
    style.height = '100%';
    style.width = '100%';
    div.append(LinkNode.createLinkWrapper(link, name),
               LinkNode.createIframeWrapper());
    return div;
}
LinkNode.create = function(link = '', name = '', text = '', sx, sy, x, y) {
    const nodeName = link.startsWith('blob:') ? name : link;
    const node = addNodeAtNaturalScale(nodeName, []);

    const windowDiv = node.windowDiv;
    windowDiv.appendChild(LinkNode.createContentWrapper(link, name));
    windowDiv.style.minWidth = '150px';
    windowDiv.style.minHeight = '200px';

    node.push_extra_cb( (node)=>({
            f: "textarea",
            a: {
                p: [0, 0, 1],
                v: node.titleInput.value
            }
        })
    );

    node.isLink = true;
    LinkNode.init(node);
    return node;
}

// To-Do: Find method to refresh saves of link nodes before the save update.

LinkNode.createIframe = function(wrapper){
    const iframe = Html.new.iframe();
    const style = iframe.style;
    style.width = '100%';
    style.height = '100%';
    style.border = 'none';
    style.overflow = 'auto';
    if (wrapper) wrapper.appendChild(iframe); // Append once and reuse
    return iframe;
}
LinkNode.init = function(node){
    const iframeWrapper = node.content.querySelector("#iframe-wrapper");
    node.iframeWrapper = iframeWrapper;
    node.iframe = iframeWrapper.querySelector("iframe")
                || LinkNode.createIframe(iframeWrapper);

    const link = node.content.querySelector("#link-element");
    node.link = link;
    node.linkUrl = (link ? link.getAttribute('href') : '');
    node.linkWrapper = node.content.querySelector("#link-wrapper");

    LinkNode.setupLinkListeners(node);
    LinkNode.setupSearchBarListener(node);
}

LinkNode.setupLinkListeners = function(node){
    const a = node.link;

    On.mouseover(a, Elem.setBothColors.bind(a, '#888', '#1a1a1d'));
    On.mouseout(a, Elem.setBothColors.bind(a, '#bbb', '#222226'));

    function onClick(e) {
        e.preventDefault();
        LinkNode.handleIframe(node);
    }
    On.click(a, onClick);
}

LinkNode.setupSearchBarListener = function(node){
    const titleInput = node.titleInput;
    function onKeyPress(e){
        if (e.key === 'Enter') {
            e.preventDefault();

            const inputValue = titleInput.value;
            if (String.isUrl(inputValue)) {
                LinkNode.updateIframeSrc(node, inputValue);
                node.linkUrl = inputValue;
                node.link.href = inputValue;
                node.link.textContent = inputValue;
            } else {
                handleNaturalLanguageSearch(inputValue);
            }
        }
    }
    On.keypress(titleInput, onKeyPress);
}

LinkNode.updateIframeSrc = function(node, url){
    const iframeWrapper = node.iframeWrapper;
    LinkNode.removeIframe(iframeWrapper);

    const iframe = LinkNode.createIframe(iframeWrapper);
    iframe.setAttribute('src', url || node.linkUrl);

    node.linkWrapper.style.display = 'none';
    iframeWrapper.style.display = 'block';
}

LinkNode.handleIframe = function(node){
    const iframeWrapper = node.iframeWrapper;
    if (iframeWrapper.style.display === 'none') {
        LinkNode.updateIframeSrc(node)
    } else {
        node.linkWrapper.style.display = 'block';
        iframeWrapper.style.display = 'none';
    }
}

LinkNode.removeIframe = function(wrapper){
    while (wrapper.firstChild) {
        wrapper.removeChild(wrapper.firstChild);
    }
}

LinkNode.handleProxyDisplay = async function(node){
    const iframeWrapper = node.iframeWrapper;
    LinkNode.removeIframe(iframeWrapper);

    const isHidden = (iframeWrapper.style.display === 'none' || !iframeWrapper.style.display);
    node.linkWrapper.style.display = (isHidden ? 'none' : 'block');
    iframeWrapper.style.display = (isHidden ? 'block' : 'none');
    if (!isHidden) return;

    const response = await Request.send(new LinkNode.ctDisplayProxy(node));
    if (response) {
        const webpageContent = await response.text();
        const iframe = LinkNode.createIframe(iframeWrapper);
        iframe.setAttribute('srcdoc', webpageContent);
    } else {
        alert("An error occurred displaying the webpage through a proxy server. Please ensure that the extract server is running on your localhost.");
    }
}
LinkNode.ctDisplayProxy = class {
    constructor(node){
        this.url = 'http://localhost:4000/raw-proxy?url=' + encodeURIComponent(node.linkUrl);
    }
    onFailure(){ return "Failed to display the webpage through a proxy server:" }
}
