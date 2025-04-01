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
        const innerOpacityValue = Elem.byId('inner_opacity_value');
        const outerOpacitySlider = Elem.byId('outer_opacity');
        const outerOpacityValue = Elem.byId('outer_opacity_value');
    
        On.input(innerOpacitySlider, (e) => {
            settings.innerOpacity = innerOpacitySlider.value / 100;
            updateSliderValue(innerOpacitySlider, innerOpacityValue);
        });
    
        On.input(innerOpacityValue, (e) => {
            settings.innerOpacity = innerOpacityValue.value / 100;
            updateValueSlider(innerOpacityValue, innerOpacitySlider);
        });
    
        On.input(outerOpacitySlider, (e) => {
            settings.outerOpacity = outerOpacitySlider.value / 100;
            updateSliderValue(outerOpacitySlider, outerOpacityValue);
        });
    
        On.input(outerOpacityValue, (e) => {
            settings.outerOpacity = outerOpacityValue.value / 100;
            updateValueSlider(outerOpacityValue, outerOpacitySlider);
        });
    
        const lengthSlider = Elem.byId('length');
        const lengthValue = Elem.byId('length_value');
        On.input(lengthSlider, (e) => {
            const v = this.getLength();
            this.setRenderLength(v);
            updateSliderValue(lengthSlider, lengthValue);
        });
    
        On.input(lengthValue, (e) => {
            updateValueSlider(lengthValue, lengthSlider);
            const v = this.getLength();
            this.setRenderLength(v);
        });
    
        const regenDebtSlider = Elem.byId('regenDebtSlider');
        const regenDebtValue = Elem.byId('regenDebtValue');
        On.input(regenDebtSlider, (e) => {
            const v = this.getRegenDebtAdjustmentFactor();
            settings.regenDebtAdjustmentFactor = v;
            updateSliderValue(regenDebtSlider, regenDebtValue);
        });
    
        On.input(regenDebtValue, (e) => {
            updateValueSlider(regenDebtValue, regenDebtSlider);
            const v = this.getRegenDebtAdjustmentFactor();
            settings.regenDebtAdjustmentFactor = v;
        });
    
        const renderWidthMultSlider = Elem.byId('renderWidthMultSlider');
        const renderWidthMultValue = Elem.byId('renderWidthMultValue');
        On.input(renderWidthMultSlider, (e) => {
            const adjustedValue = this.getRenderWidthMult();
            this.setRenderWidthMult(adjustedValue);
            updateSliderValue(renderWidthMultSlider, renderWidthMultValue);
        });
    
        On.input(renderWidthMultValue, (e) => {
            updateValueSlider(renderWidthMultValue, renderWidthMultSlider);
            const adjustedValue = this.getRenderWidthMult();
            this.setRenderWidthMult(adjustedValue);
        });

        const renderDelaySlider = Elem.byId('renderDelaySlider');
        const renderDelayValue = Elem.byId('draw_speed_value');
        On.input(renderDelaySlider, (e) => {
            settings.renderDelay = parseInt(renderDelaySlider.value);
            updateSliderValue(renderDelaySlider, renderDelayValue);
        });
        On.input(renderDelayValue, (e) => {
            updateValueSlider(renderDelayValue, renderDelaySlider);
            settings.renderDelay = parseInt(renderDelaySlider.value);
        });
        
        const zoomSpeedSlider = Elem.byId('zoomSpeedSlider');
        const zoomSpeedValue = Elem.byId('zoom_speed_value');
        On.input(zoomSpeedSlider, (e) => {
            settings.zoomSpeedMultiplier = parseFloat(zoomSpeedSlider.value);
            updateSliderValue(zoomSpeedSlider, zoomSpeedValue);
        });
        On.input(zoomSpeedValue, (e) => {
            updateValueSlider(zoomSpeedValue, zoomSpeedSlider);
            settings.zoomSpeedMultiplier = parseFloat(zoomSpeedSlider.value);
        });
        
    
        const maxLinesSlider = Elem.byId('maxLinesSlider');
        const maxLinesValue = Elem.byId('maxLinesValue');
        On.input(maxLinesSlider, (e) => {
            const v = this.getMaxLines();
            settings.maxLines = v;
            updateSliderValue(maxLinesSlider, maxLinesValue);
        });
    
        On.input(maxLinesValue, (e) => {
            updateValueSlider(maxLinesValue, maxLinesSlider);
            const v = this.getMaxLines();
            settings.maxLines = v;
        });

        const qualitySlider = Elem.byId('quality');
        const qualityValue = Elem.byId('quality_value_number');
    
        On.input(qualitySlider, (e) => {
            const v = this.getQuality(qualitySlider);
            this.setRenderQuality(v);
            updateSliderValue(qualitySlider, qualityValue);
        });
        
        On.input(qualityValue, (e) => {
            updateValueSlider(qualityValue, qualitySlider);
            const v = this.getQuality(qualityValue);
            this.setRenderQuality(v);
        });
    
        On.input(Elem.byId('exponent'), (e) => updateMandStep());
    
        const flashlightStrengthSlider = Elem.byId('flashlightStrength');
        const flashlightStrengthValue = Elem.byId('flashlightStrength_value');
        On.input(flashlightStrengthSlider, (e) => {
            this.updateFlashlightStrength();
            updateSliderValue(flashlightStrengthSlider, flashlightStrengthValue);
        });
    
        On.input(flashlightStrengthValue, (e) => {
            updateValueSlider(flashlightStrengthValue, flashlightStrengthSlider);
            this.updateFlashlightStrength();
        });
    
        const flashlightRadiusSlider = Elem.byId('flashlightRadius');
        const flashlightRadiusValue = Elem.byId('flashlightRadius_value');
        On.input(flashlightRadiusSlider, (e) => {
            this.updateFlashlightRadius();
            updateSliderValue(flashlightRadiusSlider, flashlightRadiusValue);
        });
    
        On.input(flashlightRadiusValue, (e) => {
            updateValueSlider(flashlightRadiusValue, flashlightRadiusSlider);
            this.updateFlashlightRadius();
        });
    
        const colorPicker = Elem.byId('colorPicker');
        On.input(colorPicker, (e) => {
            document.body.style.backgroundColor = colorPicker.value;
        });
        colorPicker.dispatchEvent(new Event('input'));

        const brightnessSlider = Elem.byId('cSlider');
        const brightnessValue = Elem.byId('c_value');
        On.input(brightnessSlider, (e) => {
            updateSliderValue(brightnessSlider, brightnessValue);
        });
    
        On.input(brightnessValue, (e) => {
            updateValueSlider(brightnessValue, brightnessSlider);
        });

        const saturationSlider = Elem.byId('sSlider');
        const saturationValue = Elem.byId('s_value');
        On.input(saturationSlider, (e) => {
            updateSliderValue(saturationSlider, saturationValue);
        });
    
        On.input(saturationValue, (e) => {
            updateValueSlider(saturationValue, saturationSlider);
        });
    
        On.input(Elem.byId('inversion-slider'), (e) => {
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

    computeQuality(v) {
        return 2 ** ((v / 100) * 4);
    }
    
    getQuality(sourceElem = Elem.byId('quality')) {
        return this.computeQuality(parseFloat(sourceElem.value));
    }

    updateFilters() {
        const inversionValue = Elem.byId('inversion-slider').value;
        const hueRotationValue = Elem.byId('hue-rotation-slider').value;
        const filterValue = `invert(${inversionValue}%) hue-rotate(${hueRotationValue}deg)`;

        const bothZero = (inversionValue === "0" && hueRotationValue === "0");
        Elem.byId('invert-filter').style.backdropFilter = (bothZero ? '' : filterValue);

        document.querySelectorAll('.image-video-wrapper').forEach(
            (wrapper) => { wrapper.style.backdropFilter = filterValue }
        );
    }

    skipMidRangeInversion() {
        const inversionSlider = Elem.byId('inversion-slider');
        if (parseInt(inversionSlider.value, 10) === 50) {
            inversionSlider.value = inversionSlider.value > 49 ? 51 : 49;
        }
    }

    updateFlashlightStrength() {
        flashlight_fraction = (parseFloat(Elem.byId('flashlightStrength').value) / 100);
    }

    updateFlashlightRadius() {
        flashlight_stdev = (parseFloat(Elem.byId('flashlightRadius').value) / 100);
    }
}
