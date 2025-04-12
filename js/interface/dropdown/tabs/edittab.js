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
        this.#initControls();
        this.#initEventListeners();
        this.setRenderLength(settings.renderLength);
        this.setRenderQuality(settings.renderQuality);
        this.updateFilters();
        this.setFlashlightStrength(settings.flashlight_fraction);
        this.setFlashlightRadius(settings.flashlight_stdev);
    }

    #initControls(){
        Elem.byId('length').value = settings.renderLength;
        Elem.byId('length_value').value = settings.renderLength;

        Elem.byId('quality').value = settings.renderQuality;
        Elem.byId('quality_value_number').value = settings.renderQuality;

        Elem.byId('frames_delay_value_number').value = settings.framesDelay;

        Elem.byId('renderWidthMultSlider').value = settings.renderWidthMult;
        Elem.byId('renderWidthMultValue').value = settings.renderWidthMult;

        Elem.byId('maxLinesSlider').value = settings.maxLines;
        Elem.byId('maxLinesValue').value = settings.maxLines;

        Elem.byId('regenDebtSlider').value = settings.regenDebtAdjustmentFactor;
        Elem.byId('regenDebtValue').value = settings.regenDebtAdjustmentFactor;

        Elem.byId('renderDelaySlider').value = settings.renderDelay;
        Elem.byId('draw_speed_value').value = settings.renderDelay;

        Elem.byId('zoomSpeedSlider').value = settings.zoomSpeedMultiplier;
        Elem.byId('zoom_speed_value').value = settings.zoomSpeedMultiplier;

        Elem.byId('flashlightStrength').value = settings.flashlight_fraction;
        Elem.byId('flashlightStrength_value').value = settings.flashlight_fraction;

        Elem.byId('flashlightRadius').value = settings.flashlight_stdev;
        Elem.byId('flashlightRadius_value').value = settings.flashlight_stdev;
    }

    #initEventListeners(){
        const innerOpacitySlider = Elem.byId('inner_opacity');
        const innerOpacityValue = Elem.byId('inner_opacity_value');
        On.input(innerOpacitySlider, (e) => {
            this.setInnerOpacity(innerOpacitySlider.value);
            updateSliderValue(innerOpacitySlider, innerOpacityValue);
        });
        On.input(innerOpacityValue, (e) => {
            this.setInnerOpacity(innerOpacityValue.value);
            updateValueSlider(innerOpacityValue, innerOpacitySlider);
        });

        const outerOpacitySlider = Elem.byId('outer_opacity');
        const outerOpacityValue = Elem.byId('outer_opacity_value');
        On.input(outerOpacitySlider, (e) => {
            this.setOuterOpacity(outerOpacitySlider.value);
            updateSliderValue(outerOpacitySlider, outerOpacityValue);
        });
        On.input(outerOpacityValue, (e) => {
            this.setOuterOpacity(outerOpacityValue.value);
            updateValueSlider(outerOpacityValue, outerOpacitySlider);
        });

        const lengthSlider = Elem.byId('length');
        const lengthValue = Elem.byId('length_value');
        On.input(lengthSlider, (e) => {
            this.setRenderLength(parseInt(lengthSlider.value));
            updateSliderValue(lengthSlider, lengthValue);
        });
        On.input(lengthValue, (e) => {
            this.setRenderLength(parseInt(lengthValue.value));
            updateValueSlider(lengthValue, lengthSlider);
        });

        const regenDebtSlider = Elem.byId('regenDebtSlider');
        const regenDebtValue = Elem.byId('regenDebtValue');
        On.input(regenDebtSlider, (e) => {
            settings.regenDebtAdjustmentFactor = parseFloat(regenDebtSlider.value);
            updateSliderValue(regenDebtSlider, regenDebtValue);
        });
        On.input(regenDebtValue, (e) => {
            settings.regenDebtAdjustmentFactor = parseFloat(regenDebtValue.value);
            updateValueSlider(regenDebtValue, regenDebtSlider);
        });

        const renderWidthMultSlider = Elem.byId('renderWidthMultSlider');
        const renderWidthMultValue = Elem.byId('renderWidthMultValue');
        On.input(renderWidthMultSlider, (e) => {
            this.setRenderWidthMult(parseFloat(renderWidthMultSlider.value));
            updateSliderValue(renderWidthMultSlider, renderWidthMultValue);
        });
        On.input(renderWidthMultValue, (e) => {
            this.setRenderWidthMult(parseFloat(renderWidthMultValue.value));
            updateValueSlider(renderWidthMultValue, renderWidthMultSlider);
        });

        const renderDelaySlider = Elem.byId('renderDelaySlider');
        const renderDelayValue = Elem.byId('draw_speed_value');
        On.input(renderDelaySlider, (e) => {
            settings.renderDelay = parseInt(renderDelaySlider.value);
            updateSliderValue(renderDelaySlider, renderDelayValue);
        });
        On.input(renderDelayValue, (e) => {
            settings.renderDelay = parseInt(renderDelayValue.value);
            updateValueSlider(renderDelayValue, renderDelaySlider);
        });

        const zoomSpeedSlider = Elem.byId('zoomSpeedSlider');
        const zoomSpeedValue = Elem.byId('zoom_speed_value');
        On.input(zoomSpeedSlider, (e) => {
            settings.zoomSpeedMultiplier = parseFloat(zoomSpeedSlider.value);
            updateSliderValue(zoomSpeedSlider, zoomSpeedValue);
        });
        On.input(zoomSpeedValue, (e) => {
            settings.zoomSpeedMultiplier = parseFloat(zoomSpeedValue.value);
            updateValueSlider(zoomSpeedValue, zoomSpeedSlider);
        });

        const maxLinesSlider = Elem.byId('maxLinesSlider');
        const maxLinesValue = Elem.byId('maxLinesValue');
        On.input(maxLinesSlider, (e) => {
            settings.maxLines = parseInt(maxLinesSlider.value);
            updateSliderValue(maxLinesSlider, maxLinesValue);
        });
        On.input(maxLinesValue, (e) => {
            settings.maxLines = parseInt(maxLinesValue.value);
            updateValueSlider(maxLinesValue, maxLinesSlider);
        });

        const framesDelayValue = Elem.byId('frames_delay_value_number');
        On.input(framesDelayValue, (e)=>{
            const v = parseInt(framesDelayValue.value);
            settings.framesDelay = Math.min(Math.max(0, v), 9);
        });

        const qualitySlider = Elem.byId('quality');
        const qualityValue = Elem.byId('quality_value_number');
        On.input(qualitySlider, (e) => {
            this.setRenderQuality(parseFloat(qualitySlider.value));
            updateSliderValue(qualitySlider, qualityValue);
        });
        On.input(qualityValue, (e) => {
            this.setRenderQuality(parseFloat(qualityValue.value));
            updateValueSlider(qualityValue, qualitySlider);
        });

        On.input(Elem.byId('exponent'), (e) => Fractal.updateStep());

        const flashlightStrengthSlider = Elem.byId('flashlightStrength');
        const flashlightStrengthValue = Elem.byId('flashlightStrength_value');
        On.input(flashlightStrengthSlider, (e) => {
            this.setFlashlightStrength(parseFloat(flashlightStrengthSlider.value));
            updateSliderValue(flashlightStrengthSlider, flashlightStrengthValue);
        });
        On.input(flashlightStrengthValue, (e) => {
            this.setFlashlightStrength(parseFloat(flashlightStrengthValue.value));
            updateValueSlider(flashlightStrengthValue, flashlightStrengthSlider);
        });

        const flashlightRadiusSlider = Elem.byId('flashlightRadius');
        const flashlightRadiusValue = Elem.byId('flashlightRadius_value');
        On.input(flashlightRadiusSlider, (e) => {
            this.setFlashlightRadius(parseFloat(flashlightRadiusSlider.value));
            updateSliderValue(flashlightRadiusSlider, flashlightRadiusValue);
        });
        On.input(flashlightRadiusValue, (e) => {
            this.setFlashlightRadius(parseFloat(flashlightRadiusValue.value));
            updateValueSlider(flashlightRadiusValue, flashlightRadiusSlider);
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

    setInnerOpacity(val){
        settings.innerOpacity = val;
        settings._innerOpacity = val / 100;
    }
    setOuterOpacity(val){
        settings.outerOpacity = val;
        settings._outerOpacity = val / 100;
    }

    setRenderWidthMult(val){
        settings.renderWidthMult = val;
        settings._renderWidthMult = (val <= 50) ? val / 5
                                  : 10 + (val - 50) * 2;
    }

    setRenderLength(val){
        settings.renderLength = val;

        const l = 2 ** (8 * val / 100);
        const f = settings.renderStepSize * settings.renderSteps / l;
        settings.renderSteps /= f;
    }

    setRenderQuality(val){
        settings.renderQuality = val;

        const n = 2 ** (4 * val / 100);
        const q = 1 / n;
        const f = settings.renderStepSize / q;
        settings.renderStepSize = q;
        settings._renderWidthMult *= f;
        settings.renderSteps *= f;
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

    setFlashlightStrength(val){
        settings.flashlight_fraction = val;
        settings._flashlight_fraction = val / 100;
    }
    setFlashlightRadius(val){
        settings.flashlight_stdev = val;
        settings._flashlight_stdev = val / 100;
    }
}
