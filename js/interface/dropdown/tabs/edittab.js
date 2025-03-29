function getMaxDistForExponent(exponent) {
    const exponentToMaxDist = {
        1: 4,
        2: 4,
        3: 1.5,
        4: 1.25,
        5: 1,
        6: 1,
        7: 1,
        8: 1
    };
    return exponentToMaxDist[exponent] || 4; // default to 4 if no mapping found
}

class EditTab {
    init(){
        this.#initSliders();
        this.#initEventListeners();
        this.setRenderLength(this.getLength());
        this.setRenderQuality(this.getQuality());
        this.updateFilters();
        this.updateFlashlightStrength();
        this.updateFlashlightRadius();
    }

    #initSliders(){
        const renderWidthMultSlider = Elem.byId('renderWidthMultSlider');
        renderWidthMultSlider.value = settings.renderWidthMult;
        renderWidthMultSlider.dispatchEvent(new Event('input'));

        const maxLinesSlider = Elem.byId('maxLinesSlider');
        maxLinesSlider.value = settings.maxLines;
        maxLinesSlider.dispatchEvent(new Event('input'));

        const regenDebtSlider = Elem.byId('regenDebtSlider');
        regenDebtSlider.value = settings.regenDebtAdjustmentFactor;
        regenDebtSlider.dispatchEvent(new Event('input'));

        const renderDelaySlider = Elem.byId('renderDelaySlider');
        renderDelaySlider.value = settings.renderDelay;
        renderDelaySlider.dispatchEvent(new Event('input'));

        const zoomSpeedSlider = Elem.byId('zoomSpeedSlider');
        zoomSpeedSlider.value = settings.zoomSpeedMultiplier;
        zoomSpeedSlider.dispatchEvent(new Event('input'));

        Elem.byId('flashlightStrength').value = flashlight_fraction;
        Elem.byId('flashlightRadius').value = flashlight_stdev;
        triggerInputEvent('flashlightStrength');
        triggerInputEvent('flashlightRadius');
    }

    #initEventListeners(){
        const innerOpacitySlider = Elem.byId('inner_opacity');
        On.input(innerOpacitySlider, (e)=>{
            settings.innerOpacity = innerOpacitySlider.value / 100;
        });

        const outerOpacitySlider = Elem.byId('outer_opacity');
        On.input(outerOpacitySlider, (e)=>{
            settings.outerOpacity = outerOpacitySlider.value / 100;
        });

        On.input(Elem.byId('length'), (e)=>{
            const v = this.getLength();
            this.setRenderLength(v);
            Elem.byId('length_value').textContent = (Math.round(v * 100) / 100);
        });

        On.input(Elem.byId('regenDebtSlider'), (e)=>{
            const v = this.getRegenDebtAdjustmentFactor();
            settings.regenDebtAdjustmentFactor = v;
            Elem.byId('regenDebtValue').textContent = v;
        });

        On.input(Elem.byId('renderDelaySlider'), (e) => {
            settings.renderDelay = parseInt(e.target.value);
            Elem.byId('renderDelayValue').textContent = settings.renderDelay;
        })

        On.input(Elem.byId('zoomSpeedSlider'), (e)=>{
            const zoomSpeed = parseFloat(e.target.value);
            settings.zoomSpeedMultiplier = zoomSpeed;
            Elem.byId('zoomSpeedValue').textContent = zoomSpeed.toFixed(1);
        })

        On.input(Elem.byId('renderWidthMultSlider'), (e)=>{
            const adjustedValue = this.getRenderWidthMult();
            this.setRenderWidthMult(adjustedValue);
            Elem.byId('renderWidthMultValue').textContent = adjustedValue.toFixed(2);
        });

        On.input(Elem.byId('maxLinesSlider'), (e)=>{
            const v = this.getMaxLines();
            settings.maxLines = v;
            Elem.byId('maxLinesValue').textContent = v;
        });

        On.input(Elem.byId('quality'), (e)=>{
            const v = this.getQuality();
            this.setRenderQuality(v);
            Elem.byId('quality_value').textContent = "Quality:" + (Math.round(v * 100) / 100);
        });

        On.input(Elem.byId('exponent'), Fractal.updateStep);

        On.input(Elem.byId('flashlightStrength'), this.updateFlashlightStrength);
        On.input(Elem.byId('flashlightRadius'), this.updateFlashlightRadius);

        const colorPicker = Elem.byId('colorPicker');
        On.input(colorPicker, (e)=>{
            document.body.style.backgroundColor = colorPicker.value;
        });
        colorPicker.dispatchEvent(new Event('input'));

        On.input(Elem.byId('inversion-slider'), (e)=>{
            this.skipMidRangeInversion();
            this.updateFilters();
        });

        const hueRotationSlider = Elem.byId('hue-rotation-slider');
        On.input(hueRotationSlider, this.updateFilters.bind(this));
    }

    getLength() {
        const v = Elem.byId('length').value / 100;
        return 2 ** (v * 8);
    }

    getRegenDebtAdjustmentFactor() {
        return Elem.byId('regenDebtSlider').value
    }

    setRenderWidthMult(v) {
        settings.renderWidthMult = v;
    }

    getRenderWidthMult() {
        const sliderValue = parseFloat(Elem.byId('renderWidthMultSlider').value);
        let transformedValue;
        if (sliderValue <= 50) {
            transformedValue = sliderValue / 5;
        } else {
            transformedValue = 10 + ((sliderValue - 50) * 2);
        }
        return transformedValue;
    }

    setRenderLength(l) {
        const f = settings.renderStepSize * settings.renderSteps / l;
        settings.renderSteps /= f;
    }

    getMaxLines() {
        return parseInt(Elem.byId('maxLinesSlider').value)
    }

    setRenderQuality(n) {
        const q = 1 / n;
        const f = settings.renderStepSize / q;
        settings.renderStepSize = q;
        settings.renderWidthMult *= f;
        settings.renderSteps *= f;
    }

    getQuality() {
        const v = Elem.byId('quality').value / 100;
        return 2 ** (v * 4);
    }

    updateFilters() {
        const inversionValue = Elem.byId('inversion-slider').value;
        const hueRotationValue = Elem.byId('hue-rotation-slider').value;
        const filterValue = `invert(${inversionValue}%) hue-rotate(${hueRotationValue}deg)`;

        const bothZero = (inversionValue === "0" && hueRotationValue === "0");
        Elem.byId('invert-filter').style.backdropFilter = (bothZero ? '' : filterValue);

        document.querySelectorAll('.image-video-wrapper').forEach(
            (wrapper)=>{ wrapper.style.backdropFilter = filterValue }
        );
    }

    skipMidRangeInversion() {
        const inversionSlider = Elem.byId('inversion-slider');
        if (parseInt(inversionSlider.value, 10) === 50) {
            inversionSlider.value = inversionSlider.value > 49 ? 51 : 49;
        }
    }

    updateFlashlightStrength() {
        flashlight_fraction = parseFloat(Elem.byId('flashlightStrength').value);
        Elem.byId('flashlightStrength_value').textContent = flashlight_fraction.toFixed(3);
    }

    updateFlashlightRadius() {
        flashlight_stdev = parseFloat(Elem.byId('flashlightRadius').value);
        Elem.byId('flashlightRadius_value').textContent = flashlight_stdev.toFixed(3);
    }
}
