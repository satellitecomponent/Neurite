NodeView.prototype.toggleCollapse = function(e){
    if (e) e.stopPropagation();
    if (!this.model.content) return;

    const isCollapsed = this.div.classList.contains('collapsed');
    this[isCollapsed ? 'expand' : 'collapse']();

    // Check if the alt key is being held
    if (e && e.getModifierState(controls.altKey.value)) {
        this.model.getAllConnectedNodes().forEach(Node.toggleCollapse);
    }
}
Node.toggleCollapse = function(node){ node.view.toggleCollapse() }

NodeView.prototype.centerTitleInput = function(){
    const style = this.titleInput.style;
    style.position = 'absolute';
    style.top = '50%';
    style.left = '50%';
    style.transform = 'translate(-47.5%, -59%)';
    style.border = 'none';
    style.textAlign = 'center';
    style.pointerEvents = 'none';
    style.fontSize = '25px';
    style.width = 'fit-content';
}
NodeView.prototype.resetTitleInput = function(){
    const style = this.titleInput.style;
    style.position = '';
    style.top = '';
    style.left = '';
    style.transform = '';
    style.border = '';
    style.textAlign = '';
    style.pointerEvents = '';
    style.fontSize = '';
    style.width = '';
}

NodeView.prototype.hideButHeaderAndTitle = function(child){
    if (child !== this.headerContainer && child !== this.titleInput) {
        child.style.display = 'none'
    }
}
NodeView.prototype.collapse = function () {
    const div = this.div;

    const compStyle = getComputedStyle(div);
    this.model.content.dataset.originalSizes = JSON.stringify({
        width: compStyle.width,
        height: compStyle.height,
        minWidth: compStyle.minWidth,
        minHeight: compStyle.minHeight,
        maxWidth: compStyle.maxWidth,
        maxHeight: compStyle.maxHeight
    });

    Elem.forEachChild(div, this.hideButHeaderAndTitle, this);
    Elem.forEachChild(this.headerContainer, this.hideButHeaderAndTitle, this);

    const style = div.style;
    style.display = 'inline-block';
    style.minWidth = '60px';
    style.minHeight = '60px';
    style.width = '60px';
    style.height = '60px';
    style.maxWidth = '60px';
    style.maxHeight = '60px';
    style.borderRadius = '50%';
    style.boxShadow = 'none';
    style.backdropFilter = 'none';
    div.classList.add('collapsed');

    this.centerTitleInput();

    this.initCollapsed();

    if (div.classList.contains('window-anchored')) {
        div.classList.remove('window-anchored');
        this.circleCollapsed.classList.add('collapsed-anchor');
    }
}
NodeView.prototype.makeCircleCollapsed = function(){
    const circle = Html.make.div('collapsed-circle');
    circle.style.borderRadius = '50%';
    circle.style.boxShadow = getComputedStyle(this.div).boxShadow;
    return circle;
}
NodeView.prototype.onCircleDoubleClicked = function(e){
    if (App.nodeMode === 1) this.toggleCollapse(e)
    else e.currentTarget.classList.toggle('collapsed-anchor')
}
NodeView.prototype.initCollapsed = function(){
    if (!this.div.classList.contains('collapsed')) return;

    if (!this.btnExpand) {
        this.btnExpand = this.getBtnExpand();
        On.click(this.btnExpand, this.toggleCollapse.bind(this));

        const circle = this.circleCollapsed = this.getCircleCollapsed();
        On.dblclick(circle, this.onCircleDoubleClicked.bind(this));
        On.dragstart(circle, Event.preventDefault);
    }
    this.btnExpand.style.display = '';
    this.circleCollapsed.style.display = '';
}
NodeView.prototype.makeBtnExpand = function(){
    const btn = Svg.new.svg();
    btn.setAttribute('class', 'expand-button');
    btn.style.zIndex = 'inherit';

    const useElem = Svg.new.use();
    useElem.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#expand-icon");
    btn.appendChild(useElem);
    return btn;
}
NodeView.prototype.getBtnExpand = function(){
    const existing = this.div.querySelector('.expand-button');
    if (existing) return existing;

    const made = this.makeBtnExpand();
    this.div.appendChild(made);
    return made;
}
NodeView.prototype.getCircleCollapsed = function(){
    const existing = this.div.querySelector('.collapsed-circle');
    if (existing) return existing;

    const made = this.makeCircleCollapsed();
    this.div.appendChild(made);
    return made;
}

NodeView.prototype.expand = function () {
    const div = this.div;
    const style = div.style;
    const originalSize = JSON.parse(this.model.content.dataset.originalSizes);
    style.width = originalSize.width;
    style.height = originalSize.height;
    style.minWidth = originalSize.minWidth;
    style.minHeight = originalSize.minHeight;
    style.maxWidth = originalSize.maxWidth;
    style.maxHeight = originalSize.maxHeight;

    style.display = '';
    style.borderRadius = '';
    style.backgroundColor = '';
    style.borderColor = '';
    style.boxShadow = '';
    style.backdropFilter = '';
    div.classList.remove('collapsed');

    const show = (child) => { child.style.display = '' };
    Elem.forEachChild(div, show);
    Elem.forEachChild(this.headerContainer, show);

    this.resetTitleInput();

    const circle = this.circleCollapsed;
    if (!circle) return;

    if (circle.classList.contains('collapsed-anchor')) {
        div.classList.add('window-anchored');
        circle.classList.remove('collapsed-anchor');
    }
    Elem.hide(this.circleCollapsed);
    Elem.hide(this.btnExpand);
}



//Drag Box Selection

/*
On.contextmenu(document, (e)=>{
    if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        // Additional logic for when right-click is combined with Ctrl key
        // ...
    }
});
*/
let dragBox = null;
let startX, startY;

On.mousedown(document, (e)=>{
    if (e.button === 0 && e.getModifierState(controls.altKey.value)) {
        e.preventDefault();
        e.stopPropagation();
        isDraggingDragBox = true;
        startX = e.pageX;
        startY = e.pageY;

        dragBox = Html.make.div('drag-box');
        dragBox.style.left = startX + 'px';
        dragBox.style.top = startY + 'px';
        document.body.appendChild(dragBox);
    }
});

On.mousemove(document, (e)=>{
    if (isDraggingDragBox) {
        e.preventDefault();
        e.stopPropagation();

        const currentX = e.pageX;
        const currentY = e.pageY;

        const style = dragBox.style;
        style.width = Math.abs(currentX - startX) + 'px';
        style.height = Math.abs(currentY - startY) + 'px';
        style.left = Math.min(startX, currentX) + 'px';
        style.top = Math.min(startY, currentY) + 'px';
    }
});

On.mouseup(document, (e)=>{
    if (isDraggingDragBox) {
        isDraggingDragBox = false;

        let isAnyNodeSelected = false;

        // Finalize the drag box bounds
        const style = dragBox.style;
        const left = parseInt(style.left, 10);
        const top = parseInt(style.top, 10);
        dragBoxBounds = {
            left, top,
            right: left + parseInt(style.width, 10),
            bottom: top + parseInt(style.height, 10)
        };

        // Check for intersection with node windows and select them
        Graph.forEachNode( (node)=>{
            const rect = node.view.div.getBoundingClientRect();
            const isNodeSelected = (rect.left < dragBoxBounds.right && rect.right > dragBoxBounds.left &&
                                    rect.top < dragBoxBounds.bottom && rect.bottom > dragBoxBounds.top);
            if (!isNodeSelected) return;

            App.selectedNodes.toggleNode(node);
            isAnyNodeSelected = true;
        });

        if (!isAnyNodeSelected) App.selectedNodes.clear();

        dragBox.remove();
        dragBox = null;
        dragBoxBounds = null;
    }
});
