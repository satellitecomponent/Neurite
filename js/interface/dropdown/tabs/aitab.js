class AiTab {
    constructor() {
        // Initialize UI components
        this.initNodeCountSlider();
        this.initAutoContextTokenSync();
        this.initModelTemperatureSlider();

        // Initialize other sliders or UI elements as needed
    }

    initNodeCountSlider() {
        const slider = Elem.byId('node-count-slider');
        On.input(slider, (e)=>{
            Elem.byId('node-slider-label').innerText = 'Top ' + slider.value + '\nnodes';
        });
    }

    autoContextTokenSync(tokenSlider, contextSlider) {
        let lastUserSetRatio = parseInt(contextSlider.value, 10) / parseInt(contextSlider.max, 10);
        let isProgrammaticChange = false;

        On.input(tokenSlider, (e)=>{
            const newMaxTokens = parseInt(tokenSlider.value, 10);
            contextSlider.max = newMaxTokens;
            const newContextValue = Math.round(lastUserSetRatio * newMaxTokens);

            isProgrammaticChange = true;
            contextSlider.value = newContextValue;
            isProgrammaticChange = false;

            contextSlider.dispatchEvent(new Event('input'));
        });

        On.input(contextSlider, (e)=>{
            if (!isProgrammaticChange) {
                lastUserSetRatio = parseInt(contextSlider.value, 10) / parseInt(contextSlider.max, 10);
            }
        });
    }

    initAutoContextTokenSync() {
        const maxTokensSlider = Elem.byId('max-tokens-slider');
        const maxContextSizeSlider = Elem.byId('max-context-size-slider');
        this.autoContextTokenSync(maxTokensSlider, maxContextSizeSlider);

        On.input(maxTokensSlider, (e)=>{
            Elem.byId('max-tokens-display').innerText = maxTokensSlider.value;
        });
        On.input(maxContextSizeSlider, (e)=>{
            const maxContextValue = parseInt(maxContextSizeSlider.value, 10);
            const maxContextMax = parseInt(maxContextSizeSlider.max, 10);
            const ratio = Math.round((maxContextValue / maxContextMax) * 100);
            Elem.byId('max-context-size-display').innerText = `Context: ${ratio}% \n(${maxContextValue} tokens)`;
        });

        maxContextSizeSlider.dispatchEvent(new Event('input'));
    }

    initModelTemperatureSlider() {
        const modelTemperatureSlider = Elem.byId('model-temperature');
        On.input(modelTemperatureSlider, (e)=>{
            Elem.byId('model-temperature-label').innerText = 'Temperature:\n ' + modelTemperatureSlider.value;
        });
    }
}
