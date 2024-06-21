class Tooltip {
    constructor(options = {}) {
        this.tooltipElement = null;
        this.options = {
            offsetX: 0,
            offsetY: 0,
            zIndex: 500,
            width: '360px',
            ...options
        };
        this.eventListeners = {
            mouseover: this.handleMouseOver.bind(this),
            mouseout: this.handleMouseOut.bind(this),
            click: this.handleClick.bind(this)
        };
    }

    attachTooltipEvents(element) {
        element.addEventListener('mouseover', this.eventListeners.mouseover);
        element.addEventListener('mouseout', this.eventListeners.mouseout);
        element.addEventListener('click', this.eventListeners.click);
    }

    detachTooltipEvents(element) {
        element.removeEventListener('mouseover', this.eventListeners.mouseover);
        element.removeEventListener('mouseout', this.eventListeners.mouseout);
        element.removeEventListener('click', this.eventListeners.click);
    }

    handleMouseOver(event) {
        const snippetDataList = JSON.parse(event.target.dataset.snippetData);
        this.showTooltip(snippetDataList, event);
    }

    handleMouseOut(event) {
        if (!event.relatedTarget || !this.tooltipElement.contains(event.relatedTarget)) {
            this.hideTooltip();
        }
    }

    handleClick(event) {
        event.preventDefault();
        // Default click behavior can be implemented here if needed
    }

    showTooltip(data, event) {
        if (!this.tooltipElement) {
            this.createTooltipElement();
        }
        this.updateTooltipContent(data);
        this.positionTooltip(event);
        this.tooltipElement.style.display = 'block';
    }

    positionTooltip(event) {
        const x = event.clientX + this.options.offsetX;
        const y = event.clientY + this.options.offsetY;

        this.tooltipElement.style.left = `${x}px`;
        this.tooltipElement.style.top = `${y}px`;

        requestAnimationFrame(() => {
            const tooltipRect = this.tooltipElement.getBoundingClientRect();
            const newY = y - tooltipRect.height / 2;
            this.tooltipElement.style.top = `${newY}px`;
        });
    }

    hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'none';
        }
    }

    createTooltipElement() {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.classList.add('tooltip');
        this.tooltipElement.style.position = 'fixed';
        this.tooltipElement.style.zIndex = this.options.zIndex;
        this.tooltipElement.style.width = this.options.width;

        // Prevent click and drag events from passing through
        this.tooltipElement.style.pointerEvents = 'auto';

        this.tooltipElement.addEventListener('mouseout', (event) => {
            if (!event.relatedTarget || !this.tooltipElement.contains(event.relatedTarget)) {
                this.hideTooltip();
            }
        });

        // Prevent click events from passing through
        this.tooltipElement.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        // Prevent drag events from passing through
        this.tooltipElement.addEventListener('mousedown', (event) => {
            event.stopPropagation();
        });

        document.body.appendChild(this.tooltipElement);
    }

    updateTooltipContent(data) {
        // Placeholder method to be overridden by subclasses
        this.tooltipElement.innerHTML = '';
    }
}

class TopNChunksTooltip extends Tooltip {
    updateTooltipContent(data) {
        this.tooltipElement.innerHTML = '';
        data.forEach(item => {
            const resultElement = document.createElement("div");
            resultElement.classList.add("vdb-search-result");
            resultElement.innerHTML = `
                <div class="vdb-result-header">
                    <div class="vdb-result-source">${item.source}</div>
                    <div class="vdb-result-score">Relevance: <br />${item.relevanceScore.toFixed(3)}</div>
                </div>
                <div class="vdb-result-text custom-scrollbar">${item.text}</div>
            `;
            this.tooltipElement.appendChild(resultElement);
        });
    }
}