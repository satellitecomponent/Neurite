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

// EditTab class
class EditTab {
    constructor() {
        this.initSliders();
        this.initEventListeners();
        this.setRenderLength(this.getLength());
        this.setRenderQuality(this.getQuality());
        this.updateFilters();
        this.updateFlashlightStrength();
        this.updateFlashlightRadius();
    }

    initSliders() {
        let renderWidthMultSlider = document.getElementById("renderWidthMultSlider");
        renderWidthMultSlider.value = settings.renderWidthMult;
        renderWidthMultSlider.dispatchEvent(new Event('input'));

        let maxLinesSlider = document.getElementById("maxLinesSlider");
        maxLinesSlider.value = settings.maxLines;
        maxLinesSlider.dispatchEvent(new Event('input'));

        let regenDebtSlider = document.getElementById("regenDebtSlider");
        regenDebtSlider.value = settings.regenDebtAdjustmentFactor;
        regenDebtSlider.dispatchEvent(new Event('input'));

        document.getElementById('flashlightStrength').value = flashlight_fraction;
        document.getElementById('flashlightRadius').value = flashlight_stdev;
        triggerInputEvent('flashlightStrength');
        triggerInputEvent('flashlightRadius');
    }

    initEventListeners() {
        let innerOpacitySlider = document.getElementById('inner_opacity');
        innerOpacitySlider.addEventListener('input', () => {
            settings.innerOpacity = innerOpacitySlider.value / 100;
        });

        let outerOpacitySlider = document.getElementById('outer_opacity');
        outerOpacitySlider.addEventListener('input', () => {
            settings.outerOpacity = outerOpacitySlider.value / 100;
        });

        document.getElementById("length").addEventListener("input", () => {
            let v = this.getLength();
            this.setRenderLength(v);
            document.getElementById("length_value").textContent = (Math.round(v * 100) / 100);
        });

        document.getElementById("regenDebtSlider").addEventListener("input", () => {
            let v = this.getRegenDebtAdjustmentFactor();
            settings.regenDebtAdjustmentFactor = v;
            document.getElementById("regenDebtValue").textContent = v;
        });

        document.getElementById("renderWidthMultSlider").addEventListener("input", () => {
            let adjustedValue = this.getRenderWidthMult();
            this.setRenderWidthMult(adjustedValue);
            document.getElementById("renderWidthMultValue").textContent = adjustedValue.toFixed(2);
        });

        document.getElementById("maxLinesSlider").addEventListener("input", () => {
            let v = this.getMaxLines();
            settings.maxLines = v;
            document.getElementById("maxLinesValue").textContent = v;
        });

        document.getElementById("quality").addEventListener("input", () => {
            let v = this.getQuality();
            this.setRenderQuality(v);
            document.getElementById("quality_value").textContent = "Quality:" + (Math.round(v * 100) / 100);
        });

        document.getElementById("exponent").addEventListener("input", (e) => {
            let v = e.target.value * 1; // Convert to number
            mand_step = (z, c) => {
                return z.ipow(v).cadd(c);
            };
            document.getElementById("exponent_value").textContent = v;
            settings.maxDist = getMaxDistForExponent(v);
        });

        document.getElementById('flashlightStrength').addEventListener('input', this.updateFlashlightStrength);
        document.getElementById('flashlightRadius').addEventListener('input', this.updateFlashlightRadius);

        let colorPicker = document.getElementById("colorPicker");
        colorPicker.addEventListener("input", function () {
            document.body.style.backgroundColor = this.value;
        }, false);
        colorPicker.dispatchEvent(new Event("input"));

        var inversionSlider = document.getElementById('inversion-slider');
        var hueRotationSlider = document.getElementById('hue-rotation-slider');

        inversionSlider.addEventListener('input', () => {
            this.skipMidRangeInversion();
            this.updateFilters();
        });

        hueRotationSlider.addEventListener('input', () => {
            this.updateFilters();
        });
    }

    getLength() {
        let v = document.getElementById("length").value / 100;
        return 2 ** (v * 8);
    }

    getRegenDebtAdjustmentFactor() {
        let v = document.getElementById("regenDebtSlider").value;
        return v;
    }

    setRenderWidthMult(v) {
        settings.renderWidthMult = v;
    }

    getRenderWidthMult() {
        const sliderValue = parseFloat(document.getElementById("renderWidthMultSlider").value);
        let transformedValue;
        if (sliderValue <= 50) {
            transformedValue = sliderValue / 5;
        } else {
            transformedValue = 10 + ((sliderValue - 50) * 2);
        }
        return transformedValue;
    }

    setRenderLength(l) {
        let f = settings.renderStepSize * settings.renderSteps / l;
        settings.renderSteps /= f;
    }

    getMaxLines() {
        let v = parseInt(document.getElementById("maxLinesSlider").value);
        return v;
    }

    setRenderQuality(n) {
        let q = 1 / n;
        let f = settings.renderStepSize / q;
        settings.renderStepSize = q;
        settings.renderWidthMult *= f;
        settings.renderSteps *= f;
    }

    getQuality() {
        let v = document.getElementById("quality").value / 100;
        return 2 ** (v * 4);
    }

    updateFilters() {
        var inversionSlider = document.getElementById('inversion-slider');
        var hueRotationSlider = document.getElementById('hue-rotation-slider');
        var invertFilterDiv = document.getElementById('invert-filter');

        var inversionValue = inversionSlider.value;
        var hueRotationValue = hueRotationSlider.value;
        var filterValue = `invert(${inversionValue}%) hue-rotate(${hueRotationValue}deg)`;

        if (inversionValue === "0" && hueRotationValue === "0") {
            invertFilterDiv.style.backdropFilter = "";
        } else {
            invertFilterDiv.style.backdropFilter = filterValue;
        }

        document.querySelectorAll('.image-video-wrapper').forEach(wrapper => {
            wrapper.style.backdropFilter = filterValue;
        });
    }

    skipMidRangeInversion() {
        var inversionSlider = document.getElementById('inversion-slider');
        var value = parseInt(inversionSlider.value, 10);
        if (value === 50) {
            inversionSlider.value = inversionSlider.value > 49 ? 51 : 49;
        }
    }

    updateFlashlightStrength() {
        var strengthSlider = document.getElementById('flashlightStrength');
        flashlight_fraction = parseFloat(strengthSlider.value);
        document.getElementById('flashlightStrength_value').textContent = flashlight_fraction.toFixed(3);
    }

    updateFlashlightRadius() {
        var radiusSlider = document.getElementById('flashlightRadius');
        flashlight_stdev = parseFloat(radiusSlider.value);
        document.getElementById('flashlightRadius_value').textContent = flashlight_stdev.toFixed(3);
    }
}