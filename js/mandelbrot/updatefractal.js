let isDragging = false;

function startDragging() {
    isDragging = true;
    // Disable text selection
    document.body.style.userSelect = 'none'; // Standard syntax
    document.body.style.webkitUserSelect = 'none'; // WebKit browsers
    document.__oldCursor = document.body.style.cursor; // Store old cursor
    document.body.style.cursor = 'grabbing';
}

function stopDragging() {
    isDragging = false;
    // Enable text selection
    document.body.style.userSelect = 'auto'; // Standard syntax
    document.body.style.webkitUseSelect = 'auto'; // WebKit browsers
    document.body.style.cursor = document.__oldCursor || 'default'; // Restore old cursor if it was saved
}



Fractal.juliaConstant = new vec2(0.256, 0.01);

Fractal.updateJuliaConstant = function(e){
    if (!isDragging) return;

    const rect = Elem.byId("julia-constant").getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const juliaConstant = Fractal.juliaConstant;

    juliaConstant.x = x * 4 - 2;
    juliaConstant.y = y * 4 - 2;

    Elem.byId("julia-x").textContent = juliaConstant.x.toFixed(2);
    Elem.byId("julia-y").textContent = juliaConstant.y.toFixed(2);
    Fractal.updateStep();
}



Fractal.mandelbrot = {
    html: "z<sup>${exponentValue}</sup> + c",
    step(z, c){ return z.ipow(settings.exponent).cadd(c) }
};
Fractal.burningShip = {
    html: "|z|<sup>${exponentValue}</sup> + c",
    step(z, c){
        const absZ = new vec2(Math.abs(z.x), Math.abs(z.y));
        return absZ.ipow(settings.exponent).cadd(c);
    }
};
Fractal.julia = {
    html: "z<sup>${exponentValue}</sup> +",
    step(z, c){
        const juliaConstant = new vec2(0.256, 0.01); // Example constant
        return z.ipow(settings.exponent).cadd(juliaConstant);
    }
};
Fractal.tricorn = {
    html: "conj(z)<sup>${exponentValue}</sup> + c",
    step(z, c){ return z.cconj().ipow(settings.exponent).cadd(c) }
};
Fractal.buffalo = {
    html: "|z|<sup>${exponentValue}</sup> * z + c",
    step(z, c){
        const absZ = new vec2(Math.abs(z.x), Math.abs(z.y));
        return absZ.ipow(settings.exponent).cmult(z).cadd(c);
    }
};
Fractal.henon = {
    html: "Henon Map",
    step(z, c){ return new vec2(1 - 1.4 * z.x * z.x + z.y, 0.3 * z.x).cadd(c) }
};
Fractal.ikeda = {
    html: "Ikeda Map",
    step(z, c){
        const t = 0.4 - 6 / (1 + z.x * z.x + z.y * z.y);
        return new vec2(1 + 0.9 * (z.x * Math.cos(t) - z.y * Math.sin(t)), 0.9 * (z.x * Math.sin(t) + z.y * Math.cos(t))).cadd(c);
    }
};
Fractal.inverseMandelbrot = {
    html: "z<sup>-${exponentValue}</sup> + c",
    step(z, c){ return z.ipow(-settings.exponent).cadd(c) }
};



Fractal.updateStep = function(){
    const fractal = Fractal[settings.fractal];
    Fractal.step = fractal.step;
    settings.maxDist = getMaxDistForExponent(settings.exponent);
    Elem.byId("equation").innerHTML = fractal.html.replace("${exponentValue}", settings.exponent);
}

Fractal.updateJuliaDisplay = function(fractalType){
    Elem.byId("julia-constant").style.display = (fractalType === "julia") ? "block" : "none";
    Elem.byId("julia-x").textContent = Fractal.juliaConstant.x.toFixed(2);
    Elem.byId("julia-y").textContent = Fractal.juliaConstant.y.toFixed(2);
}

Fractal.initializeSelect = function(){
    const fractalSelect = Elem.byId("fractal-select");
    const fractalType = fractalSelect.value;
    Fractal.updateStep();
    Fractal.updateJuliaDisplay(fractalType);

    On.mousedown(Elem.byId("julia-constant"), startDragging);

    const tab2Element = Elem.byId("tab2");
    On.mousemove(tab2Element, Fractal.updateJuliaConstant);
    On.mouseup(tab2Element, stopDragging);
    On.mouseleave(tab2Element, stopDragging);

    On.change(fractalSelect, (e)=>{
        Fractal.updateStep();
        Fractal.updateJuliaDisplay(e.target.value);
    });
}
