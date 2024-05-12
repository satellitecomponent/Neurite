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

let juliaConstant = new vec2(0.256, 0.01);

function updateJuliaConstant(event) {
    if (!isDragging) return;

    const juliaConstantElement = document.getElementById("julia-constant");
    const rect = juliaConstantElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    juliaConstant.x = x * 4 - 2;
    juliaConstant.y = y * 4 - 2;

    document.getElementById("julia-x").textContent = juliaConstant.x.toFixed(2);
    document.getElementById("julia-y").textContent = juliaConstant.y.toFixed(2);
    updateMandStep();
}

function updateEquation() {
    const fractalType = document.getElementById("fractal-select").value;
    const exponentValue = document.getElementById("exponent").value;
    const equationElement = document.getElementById("equation");

    if (fractalType === "mandelbrot") {
        equationElement.innerHTML = `z<sup>${exponentValue}</sup> + c`;
    } else if (fractalType === "burningShip") {
        equationElement.innerHTML = `|z|<sup>${exponentValue}</sup> + c`;
    } else if (fractalType === "julia") {
        equationElement.innerHTML = `z<sup>${exponentValue}</sup> +`;
    } else if (fractalType === "tricorn") {
        equationElement.innerHTML = `conj(z)<sup>${exponentValue}</sup> + c`;
    } else if (fractalType === "buffalo") {
        equationElement.innerHTML = `|z|<sup>${exponentValue}</sup> * z + c`;
    } else if (fractalType === "henon") {
        equationElement.innerHTML = `Henon Map`;
    } else if (fractalType === "ikeda") {
        equationElement.innerHTML = `Ikeda Map`;
    } else if (fractalType === "inverseMandelbrot") {
        equationElement.innerHTML = `z<sup>-${exponentValue}</sup> + c`;
    }
}



function updateMandStep() {
    const fractalType = document.getElementById("fractal-select").value;
    const exponentValue = document.getElementById("exponent").value;

    if (fractalType === "mandelbrot") {
        mand_step = (z, c) => {
            return z.ipow(exponentValue).cadd(c);
        };
    } else if (fractalType === "burningShip") {
        mand_step = (z, c) => {
            let absZ = new vec2(Math.abs(z.x), Math.abs(z.y));
            return absZ.ipow(exponentValue).cadd(c);
        };
    } else if (fractalType === "julia") {
        const juliaConstant = new vec2(0.256, 0.01); // Example constant
        mand_step = (z, c) => {
            return z.ipow(exponentValue).cadd(juliaConstant);
        };
    } else if (fractalType === "tricorn") {
        mand_step = (z, c) => {
            let conjZ = z.cconj();
            return conjZ.ipow(exponentValue).cadd(c);
        };
    } else if (fractalType === "buffalo") {
        mand_step = (z, c) => {
            let absZ = new vec2(Math.abs(z.x), Math.abs(z.y));
            return absZ.ipow(exponentValue).cmult(z).cadd(c);
        };
    } else if (fractalType === "henon") {
        mand_step = (z, c) => {
            return new vec2(1 - 1.4 * z.x * z.x + z.y, 0.3 * z.x).cadd(c);
        };
    } else if (fractalType === "ikeda") {
        mand_step = (z, c) => {
            let t = 0.4 - 6 / (1 + z.x * z.x + z.y * z.y);
            return new vec2(1 + 0.9 * (z.x * Math.cos(t) - z.y * Math.sin(t)), 0.9 * (z.x * Math.sin(t) + z.y * Math.cos(t))).cadd(c);
        };
    } else if (fractalType === "inverseMandelbrot") {
        mand_step = (z, c) => {
            return z.ipow(-exponentValue).cadd(c);
        };
    }

    settings.maxDist = getMaxDistForExponent(exponentValue);
    updateEquation();
}

function updateJuliaDisplay(fractalType) {
    const juliaConstantElement = document.getElementById("julia-constant");
    juliaConstantElement.style.display = (fractalType === "julia") ? "block" : "none";
    document.getElementById("julia-x").textContent = juliaConstant.x.toFixed(2);
    document.getElementById("julia-y").textContent = juliaConstant.y.toFixed(2);
}

document.addEventListener("DOMContentLoaded", function () {
    const fractalType = document.getElementById("fractal-select").value;
    updateMandStep();
    updateJuliaDisplay(fractalType);

    const juliaConstantElement = document.getElementById("julia-constant");
    juliaConstantElement.addEventListener("mousedown", startDragging);

    const tab2Element = document.getElementById("tab2");
    tab2Element.addEventListener("mousemove", updateJuliaConstant);
    tab2Element.addEventListener("mouseup", stopDragging);
    tab2Element.addEventListener("mouseleave", stopDragging);
});

document.getElementById("fractal-select").addEventListener("change", (e) => {
    updateMandStep();
    updateJuliaDisplay(e.target.value);
});