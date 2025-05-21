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

Math.bound = (min, val, max)=>Math.min(Math.max(min, val), max) ;
class Value {
    #min = -0; // i.e. not bound yet
    #max = 1;
    val = 1;
    constructor(key, funcParse, onUpdated){
        this.key = key;
        this.parse = funcParse;
        this.onUpdated = onUpdated;
    }
    bound(mayMin, mayVal, mayMax){
        this.#min = (isNaN(mayMin) ? Number.MIN_SAFE_INTEGER : mayMin);
        this.#max = (isNaN(mayMax) ? Number.MAX_SAFE_INTEGER : mayMax);
        const val = (isNaN(mayVal) ? 1 : mayVal);
        this.val = Math.bound(this.#min, val, this.#max);
        return this;
    }
    boundByStr(strMin, strVal, strMax){
        if (!Object.is(this.#min, -0)) return this; // i.e. already bound

        const mayMin = this.parse(strMin);
        const mayMax = this.parse(strMax);
        const mayVal = this.parse(strVal);
        return this.bound(mayMin, mayVal, mayMax);
    }

    init(prom){
        const val = this.val = (settings[this.key] ?? this.val);
        if (this.onUpdated) prom.then(this.onUpdated.bind(this, val)); // delay because it modifies other init settings
        return val;
    }
    set(val){
        if (this.parse) val = Math.bound(this.#min, val, this.#max);
        if (Number.isNaN(val)) val = this.val;
        if (val === this.val) return val;

        settings[this.key] = this.val = val;
        if (this.onUpdated) this.onUpdated(val);
        return val;
    }
    setByStr(strVal){
        return this.set(this.parse ? this.parse(strVal) : strVal)
    }

    static assignToThis(value){ this[value.key] = value.val }
    static new(funcParse, key, funcUpdate){
        return new Value(key, funcParse, funcUpdate)
    }
    static Float = Value.new.bind(Value, parseFloat);
    static Int = Value.new.bind(Value, parseInt);
    static Plain = Value.new.bind(Value, null);
}

View.Value = class {
    #handler = null;
    constructor(id, model){
        const elem = this.elem = Elem.byId(id);
        elem.dataset.key = model.key;

        this.model = (!model.parse) ? model
                   : model.boundByStr(elem.min, elem.value, elem.max);
    }

    init(onInput, prom){
        this.elem.value = this.model.init(prom);
        this.initView(onInput);
    }
    initView(onInput){
        if (!this.#handler) On.input(this.elem, this.#handler = onInput)
    }
    onInput(e){ return this.model.setByStr(this.elem.value) }
}
View.ValueDouble = class {
    constructor(id1, id2, model, onValue){
        this.model = model;
        this.onValue = onValue;
        this.view1 = new View.Value(id1, model);
        this.view2 = new View.Value(id2, model);
    }
    init(onInput, prom){
        this.view1.initView(this.#onView1Input);
        this.view2.initView(this.#onView2Input);
        this.onValue(this.model.init(prom));
    }
    #onView1Input = (e)=>this.onValue(this.view1.onInput(e))
    #onView2Input = (e)=>this.onValue(this.view2.onInput(e))
}

function NumberSlider(idSlider, idNumber, model){
    return new View.ValueDouble(idSlider, idNumber, model,
                                NumberSlider.onValue)
}
NumberSlider.onValue = function(val){
    this.view2.elem.value = val;

    const slider = this.view1.elem;
    // Optional: round to nearest step
    const precision = (slider.step < 1) ? slider.step.toString().split('.')[1]?.length || 2 : 0;
    val = parseFloat(val.toFixed(precision));

    slider.value = val;
    setSliderBackground(slider);
}

class EditTab {
    delay = new View.Value(
        'frames_delay_value_number', Value.Int('framesDelay')
    );
    controls = {
        draw: NumberSlider(
            'regenDebtSlider', 'regenDebtValue',
            Value.Float('regenDebtAdjustmentFactor')
        ),
        exponent: new View.Value(
            'exponent', Value.Int('exponent', this.updateFractal)
        ),
        fractal: new View.Value(
            'fractal-select', Value.Plain('fractal', this.updateFractal)
        ),
        length: NumberSlider(
            'length', 'length_value',
            Value.Int('renderLength', this.setRenderLength)
        ),
        lines: NumberSlider(
            'maxLinesSlider', 'maxLinesValue',
            Value.Int('maxLines')
        ),
        quality: NumberSlider(
            'quality', 'quality_value_number',
            Value.Float('renderQuality', this.setRenderQuality)
        ),
        radius: NumberSlider(
            'flashlightRadius', 'flashlightRadius_value',
            Value.Float('flashlight_stdev', this.setFlashlightRadius)
        ),
        speed: NumberSlider(
            'renderDelaySlider', 'draw_speed_value',
            Value.Int('renderDelay')
        ),
        strength: NumberSlider(
            'flashlightStrength', 'flashlightStrength_value',
            Value.Float('flashlight_fraction', this.setFlashlightStrength)
        ),
        width: NumberSlider(
            'renderWidthMultSlider', 'renderWidthMultValue',
            Value.Float('renderWidthMult', this.setRenderWidthMult)
        ),
        zoom: NumberSlider(
            'zoomSpeedSlider', 'zoom_speed_value',
            Value.Float('zoomSpeedMultiplier')
        ),

        rColor: new View.Value(
            'rColor', Value.Plain('rColor')
        ),
        gColor: new View.Value(
            'gColor', Value.Plain('gColor')
        ),
        bColor: new View.Value(
            'bColor', Value.Plain('bColor')
        ),
        backColor: new View.Value(
            'colorPicker', Value.Plain('backColor', this.setBackgroundColor)
        ),

        brightness: NumberSlider(
            'cSlider', 'c_value',
            Value.Int('brightness')
        ),
        hue: new View.Value(
            'hue-rotation-slider', Value.Int('hue', this.updateFilters)
        ),
        innerOpacity: NumberSlider(
            'inner_opacity', 'inner_opacity_value',
            Value.Int('innerOpacity', this.setInnerOpacity)
        ),
        inversion: new View.Value(
            'inversion-slider', Value.Int('inversion', this.updateFilters)
        ),
        outerOpacity: NumberSlider(
            'outer_opacity', 'outer_opacity_value',
            Value.Int('outerOpacity', this.setOuterOpacity)
        ),
        saturation: NumberSlider(
            'sSlider', 's_value',
            Value.Int('saturation')
        )
    };

    forEachModel(cb, ct){ // except delay
        const controls = this.controls;
        for (const name in controls) cb.call(ct, controls[name].model);
    }
    getDictValues(){
        const dictValues = {};
        this.forEachModel(Value.assignToThis, dictValues);
        return dictValues;
    }
    init(){
        let release = null;
        const prom = new Promise( (resolve)=>{ release = resolve } );

        const delay = this.delay;
        delay.init(delay.onInput.bind(delay), prom);
        const onInput = this.#onControlInput;
        const controls = this.controls;
        for (const name in controls) controls[name].init(onInput, prom);

        release();
    }
    #onControlInput = (e)=>{
        this.controls[e.currentTarget.dataset.key].onInput(e)
    }

    setInnerOpacity(val){ settings._innerOpacity = val / 100 }
    setOuterOpacity(val){ settings._outerOpacity = val / 100 }

    setBackgroundColor(val){ document.body.style.backgroundColor = val }

    setRenderWidthMult(val){
        settings._renderWidthMult = (val <= 50) ? val / 5
                                  : 10 + (val - 50) * 2
    }

    setRenderLength(val){
        const l = 2 ** (8 * val / 100);
        const f = settings.renderStepSize * settings.renderSteps / l;
        settings.renderSteps /= f;
    }

    setRenderQuality(val){
        const n = 2 ** (4 * val / 100);
        const q = 1 / n;
        const f = settings.renderStepSize / q;
        settings.renderStepSize = q;
        settings._renderWidthMult *= f;
        settings.renderSteps *= f;
    }

    updateFilters(){
        const inversion = settings.inversion;
        const valInversion = (inversion === 50 ? 51 : inversion); // skip mid range inversion

        const valHueRotation = settings.hue;
        const valFilter = `invert(${valInversion}%) hue-rotate(${valHueRotation}deg)`;

        const bothZero = (valInversion === 0 && valHueRotation === 0);
        Elem.byId('invert-filter').style.backdropFilter = (bothZero ? '' : valFilter);

        document.querySelectorAll('.image-video-wrapper').forEach(
            (wrapper) => { wrapper.style.backdropFilter = valFilter }
        );
    }

    setFlashlightStrength(val){ settings._flashlight_fraction = val / 100 }
    setFlashlightRadius(val){   settings._flashlight_stdev    = val / 100 }

    updateFractal(){
        Select.updateSelectedOption(Elem.byId('fractal-select')); // more reliable than both arg and setting
        Fractal.updateStep();
        Fractal.updateJuliaDisplay(settings.fractal);
    }
}
