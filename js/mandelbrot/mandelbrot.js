document.body.style.overflow = 'hidden';
var svg = Elem.byId('svg_bg');
let svg_bg = svg.getElementById('bg');
let svg_viewmat = svg.getElementById('viewmatrix');
var svg_viewbox_size = 65536;

let time = () => (current_time === undefined) ? 0 : current_time;

class vec2 {
    constructor(x, y) {
        if (typeof x === "object") {
            y = x.y;
            x = x.x;
        }
        this.x = x;
        this.y = y;
    }
    isFinite(){ return isFinite(this.x) && isFinite(this.y) }
    isInvalid(){ return isNaN(this.x) || isNaN(this.y) }

    plus(o){  return new vec2(this.x + o.x, this.y + o.y) }
    minus(o){ return new vec2(this.x - o.x, this.y - o.y) }
    times(o){ return new vec2(this.x * o.x, this.y * o.y) }
    div(o){   return new vec2(this.x / o.x, this.y / o.y) }

    dot(o){ return this.x * o.x + this.y * o.y }
    rot(a){
        const c = Math.cos(a);
        const s = Math.sin(a);
        return new vec2(this.x * c - this.y * s, this.x * s + this.y * c);
    }

    rot90(){   return new vec2(this.y, -this.x) }
    unrot90(){ return new vec2(-this.y, this.x) }

    cross(o){ return this.x * o.y - this.y * o.x }

    scale(s){   return new vec2(this.x * s, this.y * s) }
    unscale(s){ return new vec2(this.x / s, this.y / s) }

    normed(s = 1){ return this.scale(s / this.mag()) }
    mag2(){ return this.dot(this) }

    mag(){ return Math.hypot(this.x, this.y) }
    ang(){ return Math.atan2(this.y, this.x) }

    pang(){
        if (this.x == 0 && this.y == 0) return 0;

        const p = this.x / (Math.abs(this.x) + Math.abs(this.y));
        return this.y < 0 ? p - 1 : 1 - p;
    }
    map(f){ return new vec2(f(this.x), f(this.y)) }

    distanceTo(o){
//        return this.minus(o).mag();
        return Math.hypot(this.x - o.x, this.y - o.y)
    }

    cadd(o){ return this.plus(o) }
    csub(o){ return this.minus(o) }

    cneg(){ return new vec2(-this.x, -this.y) }
    cmult(o){
        return new vec2(
            this.x * o.x - this.y * o.y,
            this.y * o.x + this.x * o.y
        )
    }
    caamult(o){
        //angle averaging multiply?
        const s = this.plus(o);
        return s.scale(this.cmult(o).mag() / s.mag());
    }
    cconj(){ return new vec2(this.x, -this.y) }
    crecip(){
        // 1/(a+bi) = (a-bi)/mag2
//        return this.cconj().unscale(this.mag2());
        const mag2 = this.mag2();
        return new vec2(this.x / mag2, -this.y / mag2);
    }
    cdiv(o){ return this.cmult(o.crecip()) }
    cpow(o){
        let l = this.clog();
        if (typeof o === "number") {
            l = l.scale(o);
        } else {
            l = l.cmult(o);
        }
        if (l.isInvalid()) {
            return new vec2(0, 0);
        }
        return l.cexp();
    }
    ipow(n){
        if (n < 0) return this.crecip().ipow(-n);
        if (n == 0) return new vec2(1, 0);
        if (n == 1) return this;

        let c = this.ipow(n >> 1);
        c = c.cmult(c);
        if (n & 1) {
            return c.cmult(this);
        }
        return c;
    }
    cexp(){
        const m = Math.exp(this.x);
        const i = Math.sin(this.y);
        const r = Math.cos(this.y);
        return new vec2(m * r, m * i);
    }
    clog(){
        const r = Math.log(this.mag2()) / 2; //no sqrt because log rules
        const i = Math.atan2(this.y, this.x);
        return new vec2(r, i);
    }

    toString(){ return this.x + "," + this.y }
    sqrt(){
        //https://www.johndcook.com/blog/2020/06/09/complex-square-root/
        const l = this.mag();
        const u = Math.sqrt((l + this.x) / 2);
        const v = Math.sign(this.y) * Math.sqrt((l - this.x) / 2);
        return new vec2(u, v);
    }
    lerpto(o, t){
        const lerp = Math.lerp;
        return new vec2(lerp(this.x, o.x, t), lerp(this.y, o.y, t));
    }
    ctostring(){
        return (this.y < 0 ? this.x + "-i" + (-this.y) : this.x + "+i" + this.y)
    }

    toSvg(){
//        return this.minus(Svg.pan).scale(Svg.zoom)
        const x = (this.x - Svg.pan.x) * Svg.zoom;
        const y = (this.y - Svg.pan.y) * Svg.zoom;
        return new vec2(x, y);
    }
}

Math.lerp = function(a, b, t){
    return a * (1 - t) + b * t
}

//settings object moved to dropdown.js

Svg.windowScale = function(svgbb){
    if (!svgbb) svgbb = svg.getBoundingClientRect();
    return Math.min(svgbb.width, svgbb.height); //Math.hypot(window.innerHeight,window.innerWidth)/2**.5;
}
Svg.updateScaleAndOffset = function(){
    const svgbb = svg.getBoundingClientRect();
    Svg.scale = Svg.windowScale(svgbb);

    const off = (svgbb.width < svgbb.height ? svgbb.right : svgbb.bottom);
    Svg.offset = new vec2(-(off - svgbb.right) / 2, -(off - svgbb.bottom) / 2);
}

function toS(c) {
//    return c.unscale(Svg.windowScale()).scale(2)
    const scale = Svg.windowScale();
    return new vec2(2 * c.x / scale, 2 * c.y / scale);
}
function toDZ(c){ return toS(c).cmult(Graph.zoom) }

function fromZ(z) {
    Svg.updateScaleAndOffset();
//    return fromZtoUV(z).scale(Svg.scale).plus(Svg.offset);
    const uv = fromZtoUV(z);
    return new vec2(
        uv.x * Svg.scale + Svg.offset.x,
        uv.y * Svg.scale + Svg.offset.y
    );
}
function fromZtoUV(z) {
//    return z.csub(Graph.pan).cdiv(Graph.zoom).unscale(2).plus(new vec2(.5, .5))
    const t = z.csub(Graph.pan).cdiv(Graph.zoom);
    return new vec2(t.x / 2 + .5, t.y / 2 + .5);
}

Svg.oldPan = new vec2(0, 0);
Svg.pan = new vec2(0, 0);

Svg.updateViewbox = function() {
    const zoom_mag = Graph.zoom.mag();
    let left_corner = (new vec2(-zoom_mag, -zoom_mag).plus(Graph.pan)).toSvg();
    const diameter = zoom_mag * 2 * this.zoom;
    const rotation = Graph.zoom.ang();

    // Handle recentering and rezooming (may update pan/zoom and set needsRecalc)
    if (diameter < Math.abs(this.recenterThreshold * left_corner.x) || diameter < Math.abs(this.recenterThreshold * left_corner.y)) {
        this.updatePan(Graph.pan.scale(1));
        left_corner = Graph.xyToZ(0, 0).toSvg();
        Logger.debug("recentering...");
    }
    if (diameter < this.rezoomThreshold || diameter > this.rezoomFactor / this.rezoomThreshold) {
        this.updateZoom(this.zoom * this.rezoomFactor / diameter);
        Logger.debug("rezooming...");
    }

    // Synchronously recalc if needed (before viewBox computation)
    if (this.needsRecalc) this.recalc(); 

    // Recompute values with latest pan/zoom after potential changes
    const updated_zoom_mag = Graph.zoom.mag();
    const updated_left_corner = (new vec2(-updated_zoom_mag, -updated_zoom_mag).plus(Graph.pan)).toSvg();
    const updated_diameter = updated_zoom_mag * 2 * this.zoom;

    const center = Graph.pan.toSvg();
    const rotated_corner = center.cmult(Graph.zoom.unscale(updated_zoom_mag).cconj());
    const final_left_corner = updated_left_corner.plus(rotated_corner.minus(center));

    svg.setAttribute("viewBox", `${final_left_corner.x} ${final_left_corner.y} ${updated_diameter} ${updated_diameter}`);

    if (rotation !== this.oldRotation) {
        this.oldRotation = rotation;
        svg_viewmat.setAttribute("transform", `rotate(${-rotation * 180 / Math.PI})`);
    }
};

Svg.recalc = function() {
    const oldPan = this.oldPan;
    const oldZoom = this.oldZoom;
    const pan = this.pan;
    const zoom = this.zoom;
    for (const child of svg_bg.children) {
        const recalculated = [];
        let coord = 0;
        const parts = child.getAttribute('d').split(/[, ]+/g);
        for (let p of parts) {
            if (p.length && !isNaN(Number(p))) {
                const c = (coord ? 'y' : 'x');
                p = Number(p) / oldZoom + oldPan[c];
                p = (p - pan[c]) * zoom;
                coord = 1 - coord;
            }
            recalculated.push(p);
        }
        child.setAttribute('d', recalculated.join(' '));
        const strokeWidth = child.getAttribute('stroke-width');
        child.setAttribute('stroke-width', strokeWidth * zoom / oldZoom);
    }
    this.oldPan = pan;
    this.oldZoom = zoom;
    this.needsRecalc = false;
}

const Body = {
    isPanning: false
}
Body.startPanning = function(e){
    Body.isPanning = true;
    Coordinate.deselect();
    this.style.userSelect = 'none'; // Disable text selection
}
Body.onMousemove = function(e){
    Graph.mousePos_setXY(e.pageX, e.pageY);
    App.nodeSimulation.mousePath = [];
}
Body.stopPanning = function(e){
    if (!Body.isPanning) return;

    Body.isPanning = false;
    this.style.userSelect = "auto"; // Re-enable text selection
}
Body.addEventListeners = function(body){
    On.mousedown(body, this.startPanning);
    On.mousemove(body, this.onMousemove);
    On.mouseup(body, this.stopPanning);
    On.mouseleave(body, this.stopPanning);
}

const Fractal = {}

Fractal.step = function(z, c){
//    return z.cmult(z).cadd(c);
    const x = z.x;
    const y = z.y;
    return new vec2(x * x - y * y + c.x, y * x + x * y + c.y);
}

/*

function mand_step(z, c) {
    // Randomly alter 'c' to introduce perturbations
    if (Math.random() < 0.1) { // 10% chance to alter
        c = c.plus(new vec2(Math.random() * 0.01 - 0.005, Math.random() * 0.01 - 0.005));
    }
    return z.cmult(z).cadd(c);
}
//Not yet functioning well.
function mand_step(z, c, iteration) {
    if (iteration > 50) { // After 50 iterations, alter the pattern
        return z.cmult(z).cadd(c.scale(Math.sin(iteration * 0.1)));
    }
    return z.cmult(z).cadd(c);
} */

//function mand_step(z,c){return z.cpow(new vec2(time()/8/120/10+1,0)).cadd(c);}
//function mand_step(z,c){return z.cmult(z).cadd(z.x==0&&z.y==0?c:c.cdiv(z));}
//function mand_step(z,c){return z.cmult(z).cadd(c).map(Math.abs);}

Fractal.unstep = function(z, c){ return z.csub(c).sqrt() }

Fractal.mand_i = function(z, iters = 16){
    const step = Fractal.step;
    const c = z;
    for (let i = 0; i < iters; i++) {
        if (z.mag2() > 4) return i;

        z = step(z, c);
    }
    return (z.mag2() > 4) ? iters : iters + 1;
}

Fractal.dist = function(iters, c, z = new vec2(0, 0)){
    const bailout = 1e8; //large so z^2+c -> z^2
    const step = Fractal.step;

    let prevZ = z;
    for (let i = 0; i < iters; i++) {
        if (z.mag2() > bailout) {
            //prevZ^2 = z
            //prevZ^(2^?) = b
            //ln(prevZ)2^?=ln(b)
            //ln(ln(prevZ))+ln(2)*?=ln(ln(b))
            let g = Math.log2(Math.log(bailout));
            const llz = Math.log2(Math.log2(z.mag2()) / 2);
            return i - llz;
        }
        prevZ = z;
        z = step(z, c);
    }
    return iters;
}

function mandelbrott_grad(iters, c, z = new vec2(0, 0)) {
    const bailout = 1e8; //large so z^2+c -> z^2
    const step = Fractal.step;

    let dz = new vec2(1, 0);
    for (let i = 0; i < iters; i++) {
        if (z.mag2() > bailout) {
            //prevZ^2 = z
            //prevZ^(2^?) = b
            //ln(prevZ)2^?=ln(b)
            //ln(ln(prevZ))+ln(2)*?=ln(ln(b))
            return dz;
            //let llz = Math.log2(Math.log2(z.mag2()) / 2);
            //return i - llz;
        }
        z = step(z, c);
        dz = dz.cmult(z.scale(2));
    }
    return new vec2(0, 0);
}

Fractal.grad = function(maxIters, c, z){
    //return mandelbrott_grad(maxIters,c,z);
    const e = 1e-10;
    const getDist = Fractal.dist;
    const d = getDist(maxIters, c, z);
    return new vec2(
        (getDist(maxIters, new vec2(e + c.x, c.y), z) - d) / e,
        (getDist(maxIters, new vec2(c.x, c.y + e), z) - d) / e
    );

    //let re = 1.00000001;
    //let e = 1e-100;
    //if (z === undefined) { z = c;}
    //let d = getDist(maxIters,c,z);
    //let f = (v) => (Math.abs(v)<e?v+e:v*re);
    //let fz = new vec2(f(z.x),f(z.y));
    //return new vec2(
    //    getDist(maxIters,c,new vec2(fz.x,z.y))-d,
    //    getDist(maxIters,c,new vec2(z.x,fz.y))-d
    //    ).div(fz.minus(z));
}

Fractal.gradzr = function(f, z, epsilon = 1e-6){
    const r = f(z);
    return new vec2(
        (f(new vec2(epsilon + z.x, z.y)) - r) / epsilon,
        (f(new vec2(z.x, z.y + epsilon)) - r) / epsilon
    );
}

Fractal.trace_circle = function* (iters, z0, step = 0.5) {
    const { dist: getDist, grad: getGrad } = Fractal;
    const epsilon = 1e-10;
    const maxDeviation = 1.0;
    const level = getDist(iters, z0);

    let z = z0;
    let prevGradMag2 = Infinity;
    let totalAngle = 0; // Track cumulative direction changes
    let prevDirection = null; // Previous step direction

    while (true) {
        const val = getDist(iters, z);
        const grad = getGrad(iters, z);
        const gradMag2 = grad.mag2();

        // Core termination: vanishing gradient or excessive deviation
        if (gradMag2 < epsilon || Math.abs(val - level) > maxDeviation) break;

        // Oscillation detection (sudden gradient spikes)
        if (gradMag2 > prevGradMag2 * 4) break;

        yield z;

        // Calculate step
        const residual = level - val;
        const direction = new vec2(residual, step);
        const delta = grad.cmult(direction).unscale(gradMag2);

        // Terminate on invalid steps
        if (!delta.isFinite() || delta.mag() > 2 * Math.abs(step)) break;

        // Detect looping paths via cumulative angle change
        if (prevDirection) {
            const angleChange = Math.abs(delta.ang() - prevDirection.ang());
            totalAngle += angleChange;
            if (totalAngle > 2 * Math.PI) break; // Full rotation = closed loop
        }
        prevDirection = delta;

        z = z.plus(delta);
        prevGradMag2 = gradMag2;
    }
};

Fractal.color = function(iters, z){
    let i = Fractal.dist(iters, z);
    if (i < iters) return Color.strRgb(i);//outside set
    //inside set
    i = findInfimum(iters, z);
    //i = findPeriod(z);
    return Color.strRgb(i.i * 123 + 2, (1 - nodeMode_v), 128, 32 + (1 - nodeMode_v) * 48);
}

let rSlider = Elem.byId('rSlider');
let cSlider = Elem.byId('cSlider');
let sSlider = Elem.byId('sSlider');

const Color = {
    pickers: {}
}
Color.setPickers = function(){
    Color.pickers = {
        r: Elem.byId('rColor'),
        g: Elem.byId('gColor'),
        b: Elem.byId('bColor')
    }
}
Color.setPickers();

Color.getNormalized = function(color, index){
    const hex = Color.pickers[color].value.slice(2 * index - 1, 2 * index + 1);
    return parseInt(hex, 16) / 255; // Normalize to [0, 1]
}
Color.rgbLerp = function(i, r = rSlider.value, c = cSlider.value, s = sSlider.value) {
    const cos = Math.cos;
    const normalized = Color.getNormalized;
    const red = normalized("r", 1) * (c - s * cos(i / 2 ** .9));
    const green = normalized("g", 2) * (c - s * cos(i / 3 ** .9));
    const blue = normalized("b", 3) * (c - s * cos(i / 5 ** .9));

    const lerp = Math.lerp;
    if (App.nodeMode) r = nodeMode_v;
    const y = 0.17697 * red + 0.81240 * green + 0.01063 * blue;
    return [lerp(red, y, r), lerp(green, y, r), lerp(blue, y, r)];
}
Color.strRgb = function(i, r, c, s){
    const round = Math.round;
    const rgb = Color.rgbLerp(i, r, c, s);
    return 'RGB(' + round(rgb[0]) + ',' + round(rgb[1]) + ',' + round(rgb[2]) + ')';
}

//let l = Elem.byId('link);
//l.style.position="absolute";
//l.style.left="100px";
//l.style.top="100px";

function outlineMand(start, step = 0.1, iters = 256) {
    const a0 = start.pang();
    const data = ["M ", start.toSvg(), "\nL "];
    let prevZ = start;
    let maxlen = 32768; // 2 ^ 15
    const minD2 = 0.25 / 200 / 200;
    for (let z of Fractal.trace_circle(iters, start, step)) {
        //if (z.minus(prevZ).mag2() < minD2){ continue;}
        if (z.pang() <= a0 && prevZ.pang() > a0) break;

        maxlen -= 1;
        if (maxlen <= 0) break;

        data.push(z.toSvg(), ' ');
        prevZ = z;
    }
    return data.join('');
}

function addPath(data, stroke = 'red', fill = 'none') {
    const path = Svg.new.path();
    path.setAttribute('fill', fill);
    path.setAttribute('stroke', stroke);
    path.setAttribute('d', data);
    svg.appendChild(path);
    return path;
}

//create a series of full outlines of the set at shrinking distances
function* iter() {
    const getDist = Fractal.dist;
    const strRgb = Color.strRgb;
    for (let x = 8; x > 0.3; x *= 1 - 1 / 8) {
        const path = Svg.new.path();
        //path.setAttribute('fill',strRgb(getDist(1024,new vec2(x,0))));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', strRgb(getDist(1024, new vec2(x, 0))));
        path.setAttribute('stroke-width', String(Svg.zoom * 0.01));
        path.setAttribute('d', '');
        svg.children[1].appendChild(path);
        const start = new vec2(x, 0);
        const a0 = start.pang();
        const data = ["M ", start.toSvg(), "\nL "];
        let prevZ = start;
        let maxlen = 4096; // 2 ^ 12
        const minD2 = 0.01 / 200 / 200;
        for (const z of Fractal.trace_circle(1024, start, 0.1)) {
            if (z.pang() <= a0 && prevZ.pang() > a0) break;

            maxlen -= 1;
            if (maxlen <= 0) {
                data.push(" z");
                path.setAttribute('d', data.join(''));
                data.pop();

                yield;
                maxlen = 4096; // 2 ^ 12
            }
            if (z.minus(prevZ).mag2() < minD2) continue;

            data.push(z.toSvg(), ' ');
            prevZ = z;
        }
        data.push(" z");
        path.setAttribute('d', data.join(''));
        yield;
    }
}

function random_screen_pt_z() {
    const svgbb = svg.getBoundingClientRect();
    return Graph.xyToZ(Math.random() * svgbb.width, Math.random() * svgbb.height);
}

// https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve
// Standard Normal variate using Box-Muller transform.
function gaussianRandom2() {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const m = Math.sqrt( -2.0 * Math.log( u ) )
    return new vec2( m * Math.cos( 2.0 * Math.PI * v ) , m * Math.sin( 2.0 * Math.PI * v ));
}

Fractal.sample_random_point = function(){
    if (Math.random() <= flashlight_fraction){
        return gaussianRandom2().scale(flashlight_stdev)
            .cmult(Graph.zoom).cadd(Graph.vecToZ())
    }

    const getGrad = Fractal.grad;
    const mand_i = Fractal.mand_i;
    const iters = settings.iterations;
    let tries = 1;
    let pt;
    do {
        pt = random_screen_pt_z();
        for (let i = (1 - Math.random() ** 2) * (tries * 4); i > 1; i--) {
            const gz = getGrad(iters, pt);
            pt = pt.plus(gz.unscale(gz.mag2() * 10 + 1));
            //if (mand_i(pt,iters) > iters){
            //    pt = (new vec2(Math.random()*2-1,Math.random()*2-1)).cmult(Graph.zoom).cadd(Graph.pan);
            //}
        }
        tries -= 1;
    } while (tries > 0 && mand_i(pt, iters) > iters)
    // if (mand_i(pt,iters) > iters || pt.mag2() > 8) return;
    return pt;
}
Fractal.path_to_basin = function* (pt) {
    const iter_n = Fractal.iter_n;
    const gradzr = Fractal.gradzr; //gradzr(f,z,epsilon) = ∂|f(z)|/∂z
    const p = findInfimum(settings.iterations, pt);
    const func = (z)=>iter_n(p.i, z, z).mag2() ;
    while (true) {
        let delta = gradzr(func, pt, 1e-5);
        delta = delta.unscale(delta.mag() + 1e-300).scale(Graph.zoom.mag() * .1); //normalize and scale delta
        pt = pt.plus(delta.scale(-settings.renderStepSize));
        yield pt;
    }
}
Fractal.generate_path_data = function(pt, num_pts_max) {
    const originalPoints = [pt];
    let length = 0;
    let opt = pt;
    let opacity;
    let color;
    let num_pts = 0;
    const mand_i = Fractal.mand_i;
    const iters = settings.iterations;

    if (mand_i(pt, iters) > iters) { //inside the set
        for (const next_pt of Fractal.path_to_basin(pt)) {
            if (!next_pt?.isFinite?.()) break;
            if (mand_i(next_pt, iters) <= iters) break;
            originalPoints.push(next_pt);
            length += next_pt.minus(pt).mag();
            pt = next_pt;
            num_pts++;
            if (num_pts >= num_pts_max) break;
        }
        opacity = settings.innerOpacity / 10;
        length /= 4;
    } else { //outside the set
        if (Fractal.dist(iters, pt) < settings.maxDist) return null;
        for (let next_pt of Fractal.trace_circle(iters, pt, 
            Math.random() > 0.5 ? settings.renderStepSize : -settings.renderStepSize)) {
            if (!next_pt?.isFinite?.()) break;
            originalPoints.push(next_pt);
            length += next_pt.minus(pt).mag();
            pt = next_pt;
            num_pts++;
            if (num_pts >= num_pts_max) break;
        }
        opacity = settings.outerOpacity;
    }

    if (originalPoints.some(p => !p?.isFinite?.())) return null;
    if (length === 0) return null;

    const width = Math.min(settings.renderWidthMult * length / num_pts, 0.1);
    color = Fractal.color(iters, opt);

    return {
        originalPoints,
        width,
        color,
        opacity,
        length
    };
}
Fractal.build_path_d = function(points) {
    if (!points?.length) return '';
    const svgPoints = points
        .map(p => p?.toSvg?.())
        .filter(p => p?.isFinite?.());
    
    if (!svgPoints.length) return '';
    
    let path = `M ${svgPoints[0].x} ${svgPoints[0].y}`;
    if (svgPoints.length > 1) {
        path += ` ${settings.renderDChar} ${svgPoints.slice(1).map(p => 
            `${p.x} ${p.y}`
        ).join(' ')}`;
    }
    return path;
}
Fractal.hair_svg_path = function(pt, num_pts_max) {
    const pathData = Fractal.generate_path_data(pt, num_pts_max);
    if (!pathData) return null;

    const path = Svg.new.path();
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', pathData.color);
    path.setAttribute('stroke-width', String(pathData.width * Svg.zoom));
    path.setAttribute('stroke-opacity', String(pathData.opacity));
    path.setAttribute('data-original-points', JSON.stringify(pathData.originalPoints));
    path.setAttribute('d', Fractal.build_path_d(pathData.originalPoints));
    return path;
}
Fractal.hair_svg_path_delayed = function(pt, num_pts_max) {
    const pathData = Fractal.generate_path_data(pt, num_pts_max);
    if (!pathData) return null;

    const path = Svg.new.path();
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', pathData.color);
    path.setAttribute('stroke-width', String(pathData.width * Svg.zoom));
    path.setAttribute('stroke-opacity', pathData.opacity);
    path.setAttribute('data-original-points', JSON.stringify(pathData.originalPoints));

    let currentPoints = [pathData.originalPoints[0]];
    path.setAttribute('d', Fractal.build_path_d(currentPoints));
    path.setAttribute('data-animating', 'true');
    const animate = async () => {
        const dynamicDelay = Math.max(10, settings.renderDelay / settings.regenDebtAdjustmentFactor);
        for (let i = 1; i < pathData.originalPoints.length; i++) {
            await Promise.delay(dynamicDelay);
            currentPoints.push(pathData.originalPoints[i]);
            path.setAttribute('data-original-points', JSON.stringify(currentPoints));
            path.setAttribute('d', Fractal.build_path_d(currentPoints));
        }
        path.removeAttribute('data-animating');
    };

    animate();
    return path;
}
Fractal.render_hair = function(num_pts_max) {
    const random_point = Fractal.sample_random_point();
    const path = (settings.useDelayedRendering && settings.renderDelay !== 0)
        ? Fractal.hair_svg_path_delayed(random_point, num_pts_max)
        : Fractal.hair_svg_path(random_point, num_pts_max);

    if (!path) return;

    svg_bg.appendChild(path);
    Fractal.cull_extra_lines();
}
Fractal.animate_path_removal = async function(path) {
    if (!svg_bg.contains(path)) return;
    path.setAttribute('data-animating', 'true');
    path.dataset.removing = 'true';
    try {
        const rawPoints = JSON.parse(path.getAttribute('data-original-points') || []);
        let originalPoints = rawPoints
            .filter(p => typeof p?.x === 'number' && typeof p?.y === 'number')
            .map(p => new vec2(p.x, p.y));
        
        const dynamicDelay = Math.max(10, settings.renderDelay / settings.regenDebtAdjustmentFactor);
        
        while (originalPoints.length > 1) {
            await Promise.delay(dynamicDelay);
            originalPoints.shift(); 
            path.setAttribute('data-original-points', JSON.stringify(originalPoints));
            path.setAttribute('d', Fractal.build_path_d(originalPoints));
        }
    } finally {
        path.remove();
        path.removeAttribute('data-animating');
        delete path.dataset.removing;
    }
}
Fractal.cull_extra_lines = function() {
    const maxLines = settings.maxLines;

    // Immediate removal case
    if (maxLines === 0) {
        const children = Array.from(svg_bg.children).reverse();
        children.forEach(Fractal.removeNonPreserved);
        return;
    }

    // Get all non-preserved lines
    const allLines = Array.from(svg_bg.children)
        .filter(path => Fractal.isNotPreserved(path));
        
    // Count only non-animating, non-removing lines against the limit
    const activeCount = allLines.filter(path =>
        !path.hasAttribute('data-animating') &&
        !path.dataset.removing
    ).length;

    // If over limit, remove oldest non-animating lines
    if (activeCount > maxLines) {
        const toRemove = allLines
            .filter(path =>
                !path.hasAttribute('data-animating') &&
                !path.dataset.removing
            )
            .slice(0, activeCount - maxLines);

        const shouldAnimate = settings.useDelayedRendering && settings.renderDelay !== 0;

        toRemove.forEach(path => {
            path.dataset.removing = 'true';
            if (shouldAnimate) {
                Fractal.animate_path_removal(path);
            } else {
                path.remove();
            }
        });
    }
}
Fractal.addPreservation = function(child){
    if (child.classList.contains('preserve')) return;

    child.classList.add('preserve');
    Logger.info("Preservation added to element with id:", child.id);
}
Fractal.clearPreservation = function(child){
    child.classList.remove('preserve')
}
Fractal.isNotPreserved = function(child){
    return !child.classList.contains('preserve')
}
Fractal.removeNonPreserved = function(child){
    if (!child.classList.contains('preserve')) svg_bg.removeChild(child)
}

On.keydown(document, (e)=>{
    if (e.altKey) {
        switch (e.key) {
            case 'f': // toggle preservation
                Logger.info("Adding preservation fractal lines.");
                Elem.forEachChild(svg_bg, Fractal.addPreservation);
                break;
            case 's': // take screenshot
                download_svg_screenshot("NeuriteSVG" + new Date().toISOString());
                Logger.info("Screenshot taken and downloaded.");
                break;
            case 'c': // clear all preservations
                Logger.info("Clearing all preserved fractal lines.");
                Elem.forEachChild(svg_bg, Fractal.clearPreservation);
                break;
        }
    }
});

function download_svg_screenshot(name) {
    var svg = Elem.byId('svg_bg');
    var bgColorInput = Elem.byId('colorPicker').value;

    // Ensure the SVG has explicit dimensions
    svg.setAttribute('width', svg.clientWidth);
    svg.setAttribute('height', svg.clientHeight);

    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function () {
        const canvas = Html.new.canvas();
        canvas.width = svg.clientWidth;
        canvas.height = svg.clientHeight;
        var ctx = canvas.getContext('2d');

        // If the selected color is not black, use it as the background color
        if (bgColorInput !== '#000000') {
            ctx.fillStyle = bgColorInput;  // Set background color from the input
            ctx.fillRect(0, 0, canvas.width, canvas.height);  // Fill background
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);  // Keep it transparent
        }

        ctx.drawImage(img, 0, 0);

        // for the download
        const a = Html.make.a(canvas.toDataURL("image/png"));
        a.download = name + ".png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up
        URL.revokeObjectURL(url);
    }
    img.src = url;
    img.onerror = Logger.err.bind(Logger, "Failed to load the image");
}

function gcd(a, b){ return (b === 0 ? a : gcd(b, a % b)) }

function findPeriod(c, z = new vec2(0, 0), epsilon2 = 1e-7, maxiters = 256) {
    const step = Fractal.step;
    let zf = step(z, c);
    let i = 1;
    let p = 0;
    for (; i < maxiters; i++) {
        if (zf.minus(z).mag2() <= epsilon2) {
            p = i;
            break;
        }

        zf = step(zf, c);
        zf = step(zf, c);
        z = step(z, c);
    }
    for (; i < maxiters; i++) {
        if (zf.minus(z).mag2() <= epsilon2) {
            p = gcd(p, i);
        }
        zf = step(zf, c);
        zf = step(zf, c);
        z = step(z, c);
    }
    return p;
}

Fractal.iter_n = function(n, c, z = new vec2(0, 0)){
    const step = Fractal.step;
    for (let i = 0; i < n; i += 1) z = step(z, c);
    return z;
}

//finds smallest magnitude point in the orbit starting from z
function findInfimum(iters, z, c) {
    if (c === undefined) c = z;
    const step = Fractal.step;
    let besti = 0;
    let bestz = z;
    let bestd = z.mag2();
    for (let i = 1; i <= iters; i++) {
        z = step(z, c);
        const d = z.mag2();
        if (d < bestd) {
            bestd = d;
            besti = i;
            bestz = z;
        }
    }
    return {
        i: besti,
        z: bestz
    };
}

function generateBoundaryPoints(numPoints = 100, methods = ["cardioid", "disk", "spike"]) {
    const points = [];

    if (methods.includes("cardioid")) {
        // Generate points for the main cardioid
        for (let i = 0; i < numPoints; i++) {
            const theta = (i / numPoints) * 2 * Math.PI;
            const r = (1 - Math.cos(theta)) / 2;
            const x = r * Math.cos(theta) + 0.25;
            const y = r * Math.sin(theta);
            points.push({ x, y });
        }
    }

    if (methods.includes("disk")) {
        // Generate points for the period-2 disk
        for (let i = 0; i < numPoints; i++) {
            const theta = (i / numPoints) * 2 * Math.PI;
            const r = 0.25;
            const x = r * Math.cos(theta) - 1;
            const y = r * Math.sin(theta);
            points.push({ x, y });
        }
    }

    if (methods.includes("spike")) {
        // Generate points along the negative real axis spike
        for (let i = 0; i < numPoints; i++) {
            const x = -2 + (2 * i / numPoints); // Range from -2 to 0
            const y = 0; // Imaginary part is close to zero
            points.push({ x, y });
        }
    }

    return points;
}



/* This code could be further adapted to create a movement feature that is limited to the perimeter of the Mandelbrot Set.

function calculatePixelSpacing(svgElement) {
// Extract scaling factors based on the current zoom level and SVG dimensions
const scalingFactors = scalingFactorsFromElem(svgElement);

// Base spacing at the default zoom level (no zoom)
const baseSpacing = 10; // This can be adjusted based on the level of detail desired

// Adjust the spacing based on the zoom scale
// Assuming that scalingFactors.scaleX and scaleY are proportional to the zoom level
const adjustedSpacing = baseSpacing / Math.max(scalingFactors.scaleX, scalingFactors.scaleY);

return adjustedSpacing;
}

function isMandelbrotPixel(c, maxIter, escapeRadius) {
let z = new vec2(0, 0);

for (let i = 0; i < maxIter; i++) {
    if (z.mag2() > escapeRadius) {
        return false; // The point escapes, not part of the set
    }
    z = z.cmult(z).plus(c);
}
return true; // The point does not escape, part of the set
}

function isPerimeterPixel(x, y, pixelSpacing, svgElement, iters, escapeRadius) {
let c = Graph.xyToZ(x, y);
let isCurrentPixelInSet = isMandelbrotPixel(c, iters, escapeRadius);

// Check neighboring pixels
for (let dx = -pixelSpacing; dx <= pixelSpacing; dx += pixelSpacing) {
    for (let dy = -pixelSpacing; dy <= pixelSpacing; dy += pixelSpacing) {
        if (dx === 0 && dy === 0) continue; // Skip the current pixel

        let neighborC = Graph.xyToZ(x + dx, y + dy);
        let isNeighborInSet = isMandelbrotPixel(neighborC, iters, escapeRadius);

        if (isCurrentPixelInSet !== isNeighborInSet) {
            return true; // Boundary found between inside and outside
        }
    }
}
return false;
}

function renderPerimeter(svgElement) {
let iters = settings.iterations;
let escapeRadius = 4;
let pixelSpacing = calculatePixelSpacing(svgElement);

for (let x = 0; x < window.innerWidth; x += pixelSpacing) {
    for (let y = 0; y < window.innerHeight; y += pixelSpacing) {
        let c = Graph.xyToZ(x, y);
        if (isPerimeterPixel(x, y, pixelSpacing, svgElement, iters, escapeRadius)) {
            // Convert back to screen coordinates and apply scaling
            let screenCoords = fromZ(c);
            screenCoords = screenCoords.scale(perimeterScaleFactor);

            markBoundaryPoint(screenCoords.x, screenCoords.y, svgElement);
        }
    }
}
}

function markBoundaryPoint(x, y, svgElement) {
const circle = Svg.new.circle();
circle.setAttribute('cx', x);
circle.setAttribute('cy', y);
circle.setAttribute('r', 2 * perimeterScaleFactor); // Apply scaling to the radius as well
circle.setAttribute('fill', 'red');
circle.classList.add("perimeter-point");
svgElement.appendChild(circle);
}

let svgElement = Elem.byId('svg_bg');
renderPerimeter(svgElement);
*/
