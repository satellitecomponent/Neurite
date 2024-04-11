class AiTab {
    constructor() {
        // Initialize UI components
        this.initNodeCountSlider();
        this.initAutoContextTokenSync();
        this.initModelTemperatureSlider();

        // Initialize other sliders or UI elements as needed
    }

    initNodeCountSlider() {
        const slider = document.getElementById('node-count-slider');
        slider.addEventListener('input', () => {
            document.getElementById('node-slider-label').innerText = 'Top ' + slider.value + '\nnodes';
        });
    }

    autoContextTokenSync(tokenSlider, contextSlider) {
        let lastUserSetRatio = parseInt(contextSlider.value, 10) / parseInt(contextSlider.max, 10);
        let isProgrammaticChange = false;

        tokenSlider.addEventListener('input', () => {
            const newMaxTokens = parseInt(tokenSlider.value, 10);
            contextSlider.max = newMaxTokens;
            const newContextValue = Math.round(lastUserSetRatio * newMaxTokens);

            isProgrammaticChange = true;
            contextSlider.value = newContextValue;
            isProgrammaticChange = false;

            contextSlider.dispatchEvent(new Event('input'));
        });

        contextSlider.addEventListener('input', () => {
            if (!isProgrammaticChange) {
                lastUserSetRatio = parseInt(contextSlider.value, 10) / parseInt(contextSlider.max, 10);
            }
        });
    }

    initAutoContextTokenSync() {
        const maxTokensSlider = document.getElementById('max-tokens-slider');
        const maxContextSizeSlider = document.getElementById('max-context-size-slider');
        this.autoContextTokenSync(maxTokensSlider, maxContextSizeSlider);

        // Initialize UI updates for max tokens and max context size
        maxTokensSlider.addEventListener('input', () => {
            document.getElementById('max-tokens-display').innerText = maxTokensSlider.value;
        });

        maxContextSizeSlider.addEventListener('input', () => {
            const maxContextValue = parseInt(maxContextSizeSlider.value, 10);
            const maxContextMax = parseInt(maxContextSizeSlider.max, 10);
            const ratio = Math.round((maxContextValue / maxContextMax) * 100);
            document.getElementById('max-context-size-display').innerText = `Context: ${ratio}% \n(${maxContextValue} tokens)`;
        });

        maxContextSizeSlider.dispatchEvent(new Event('input'));
    }

    initModelTemperatureSlider() {
        const modelTemperatureSlider = document.getElementById('model-temperature');
        modelTemperatureSlider.addEventListener('input', () => {
            document.getElementById('model-temperature-label').innerText = 'Temperature:\n ' + modelTemperatureSlider.value;
        });
    }
}