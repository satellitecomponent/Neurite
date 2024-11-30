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
    isInvalid(){
        return isNaN(this.x) || isNaN(this.y)
    }
    plus(o) {
        return new vec2(this.x + o.x, this.y + o.y);
    }
    minus(o) {
        return new vec2(this.x - o.x, this.y - o.y);
    }
    times(o) {
        return new vec2(this.x * o.x, this.y * o.y);
    }
    div(o) {
        return new vec2(this.x / o.x, this.y / o.y);
    }
    dot(o) {
        return this.x * o.x + this.y * o.y
    }
    rot(a) {
        let c = Math.cos(a);
        let s = Math.sin(a);
        return new vec2(this.x * c - this.y * s, this.x * s + this.y * c);
    }
    rot90() {
        return new vec2(this.y, -this.x);
    }
    unrot90() {
        return new vec2(-this.y, this.x);
    }
    cross(o) {
        return this.x * o.y - this.y * o.x
    }
    scale(s) {
        return new vec2(this.x * s, this.y * s);
    }
    unscale(s) {
        return new vec2(this.x / s, this.y / s);
    }
    normed(s = 1) {
        return this.scale(s / this.mag());
    }
    mag2() {
        return this.dot(this);
    }
    mag() {
        return Math.hypot(this.x, this.y);
    }
    ang() {
        return Math.atan2(this.y, this.x);
    }
    pang() {
        if (this.x == 0 && this.y == 0) {
            return 0;
        }
        let p = this.x / (Math.abs(this.x) + Math.abs(this.y));
        return this.y < 0 ? p - 1 : 1 - p;
    }
    map(f) {
        return new vec2(f(this.x), f(this.y));
    }

    distanceTo(o) {
        return this.minus(o).mag();
    }

    cadd(o) {
        return this.plus(o);
    }
    csub(o) {
        return this.minus(o);
    }
    cneg(o) {
        return new vec2(-this.x, -this.y);
    }
    cmult(o) {
        return new vec2(this.x * o.x - this.y * o.y, this.y * o.x + this.x * o.y);
    }
    caamult(o) {
        //angle averaging multiply?
        let s = this.plus(o);
        return s.scale(this.cmult(o).mag() / s.mag());
    }
    cconj() {
        return new vec2(this.x, -this.y);
    }
    crecip() {
        // 1/(a+bi) = (a-bi)/mag2
        return this.cconj().unscale(this.mag2());
    }
    cdiv(o) {
        return this.cmult(o.crecip());
    }
    cpow(o) {
        let l = this.clog();
        if (typeof o === "number") {
            l = l.scale(o);
        } else {
            l = l.cmult(o);
        }
        if (l.hasNaN()) {
            return new vec2(0, 0);
        }
        return l.cexp();
    }
    ipow(n) {
        if (n < 0) {
            return this.crecip().ipow(-n);
        }
        if (n == 0) {
            return new vec2(1, 0);
        }
        if (n == 1) {
            return this;
        }
        let c = this.ipow(n >> 1);
        c = c.cmult(c);
        if (n & 1) {
            return c.cmult(this);
        }
        return c;
    }
    hasNaN() {
        return isNaN(this.x) || isNaN(this.y);
    }
    isFinite() {
        return isFinite(this.x) && isFinite(this.y);
    }
    cexp() {
        let m = Math.exp(this.x);
        let i = Math.sin(this.y);
        let r = Math.cos(this.y);
        return new vec2(m * r, m * i);
    }
    clog() {
        let r = Math.log(this.mag2()) / 2; //no sqrt because log rules
        let i = Math.atan2(this.y, this.x);
        return new vec2(r, i);
    }

    toString(){ return this.x + "," + this.y }
    sqrt() {
        //https://www.johndcook.com/blog/2020/06/09/complex-square-root/
        let l = this.mag();
        let u = Math.sqrt((l + this.x) / 2);
        let v = Math.sign(this.y) * Math.sqrt((l - this.x) / 2);
        return new vec2(u, v);
    }
    lerpto(o, t) {
        const lerp = Math.lerp;
        return new vec2(lerp(this.x, o.x, t), lerp(this.y, o.y, t));
    }
    ctostring() {
        return (this.y < 0 ? this.x + "-i" + (-this.y) : this.x + "+i" + this.y)
    }
}

function toSVG(coords) {
    return coords.minus(Svg.pan).scale(Svg.zoom)
}

var mousePos = new vec2(0, 0);
var zoom = new vec2(1, 0); //bigger is farther out
var pan = new vec2(0, 0);
var rotation = new vec2(1, 0);

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

function toZ(c) {
    Svg.updateScaleAndOffset();
    return c.minus(Svg.offset).unscale(Svg.scale).minus(new vec2(.5, .5)).scale(2).cmult(zoom).cadd(pan);
}

function toS(c) {
    return c.unscale(Svg.windowScale()).scale(2)
}
function toDZ(c) {
    return toS(c).cmult(zoom)
}

function fromZ(z) {
    Svg.updateScaleAndOffset();
    return fromZtoUV(z).scale(Svg.scale).plus(Svg.offset);
}
function fromZtoUV(z) {
    return z.csub(pan).cdiv(zoom).unscale(2).plus(new vec2(.5, .5))
}

Svg.oldPan = new vec2(0, 0);
Svg.pan = new vec2(0, 0);

Svg.updateViewbox = function(){
    //let lc = toSVG(toZ(new vec2(0,0)));
    const zoom_mag = zoom.mag();
    let left_corner = toSVG(new vec2(-zoom_mag, -zoom_mag).plus(pan));
    const diameter = zoom_mag * 2 * this.zoom;
    const rotation = zoom.ang();
    //let rotCenter = fromZ(pan);// = {let s = window.innerWidth; return new vec2(.5*s,.5*s);}

    if (diameter < Math.abs(this.recenterThreshold * left_corner.x) || diameter < Math.abs(this.recenterThreshold * left_corner.y)) {
        this.updatePan(pan.scale(1));
        left_corner = toSVG(toZ(new vec2(0, 0)));
        Logger.debug("recentering...");
    }
    if (diameter < this.rezoomThreshold || diameter > this.rezoomFactor / this.rezoomThreshold) {
        this.updateZoom(this.zoom * this.rezoomFactor / diameter);
        Logger.debug("rezooming...");
    }
    if (this.needsRecalc) this.recalc();

    const center = toSVG(pan); //center of rotation
    //where it ends up if you do the rotation about SVGpan
    const rotated_corner = center.cmult(zoom.unscale(zoom_mag).cconj());
    left_corner = left_corner.plus(rotated_corner.minus(center));

    svg.setAttribute("viewBox", left_corner.x + ' ' + left_corner.y + ' ' + diameter + ' ' + diameter);

    if (rotation !== this.oldRotation) {
        this.oldRotation = rotation;
        svg_viewmat.setAttribute("transform", "rotate(" + (-rotation * 180 / Math.PI) + ')');
        //svg_viewmat.setAttribute("transform","rotate("+(-r*180/Math.PI)+" "+c.x+" "+c.y+')');
    }

    return

    // the below has the issue of low-res svg when changing the matrix in firefox
    //svg.setAttribute("viewBox", (-svg_viewbox_size / 2) + ' ' + (-svg_viewbox_size / 2) + ' ' + svg_viewbox_size + ' ' + svg_viewbox_size);
    // z = bal(uv)*zoom+pan
    // svg = (z-svgpan)*svgzoom
    // want matrix to go svg -> bal(uv)*65536
    // bal(uv)*65536 = 65536*(z-pan)/zoom = 65536*(svg/svgzoom-svgpan-pan)/zoom
    // d/dsvg = 65536/svgzoom/zoom
    // f(0) = -65536*(svgpan+pan)/zoom
    //let t = zoom.crecip().scale(svg_viewbox_size / SVGzoom / 2);
    //let p = pan.minus(SVGpan).scale(-svg_viewbox_size / 2).cdiv(zoom);

    //svg_viewmat.setAttribute("transform", "matrix(" + t.x + ' ' + (t.y) + ' ' + (-t.y) + ' ' + (t.x) + ' ' + (p.x) + ' ' + (p.y) + ')');
    //svg_bg.setAttribute("transform","matrix("+z.x+' '+(-z.y)+' '+(z.y)+' '+(z.x)+' '+SVGpan.x+' '+SVGpan.y+')');

}

Svg.recalc = function(){
    const oldPan = this.oldPan;
    const oldZoom = this.oldZoom;
    const pan = this.pan;
    const zoom = this.zoom;
    for (const child of svg_bg.children){
        const recalculated = [];
        let coord = 0;
        const parts = child.getAttribute('d').split(/[, ]+/g);
        for (let p of parts){
            if (p.length && !isNaN(Number(p))){
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
    mousePos.x = e.pageX;
    mousePos.y = e.pageY;
    nodeSimulation.mousePath = [];
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

function mand_step(z, c) {
    return z.cmult(z).cadd(c);
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

function mand_unstep(z, c) {
    return z.csub(c).sqrt();
}



const Fractal = {}

Fractal.mand_i = function(z, iters = 16){
    const c = z;
    for (let i = 0; i < iters; i++) {
        if (z.mag2() > 4) return i;

        z = mand_step(z, c);
    }
    return (z.mag2() > 4) ? iters : iters + 1;
}

Fractal.mandDist = function(iters, c, z){
    const bailout = 1e8; //large so z^2+c -> z^2
    if (z === undefined) z = new vec2(0, 0);
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
        z = mand_step(z, c);
    }
    return iters;
}

function mandelbrott_grad(iters, c, z) {
    const bailout = 1e8; //large so z^2+c -> z^2
    if (z === undefined) z = new vec2(0, 0);

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
        z = mand_step(z, c);
        dz = dz.cmult(z.scale(2));
    }
    return new vec2(0, 0);
}

Fractal.mandGrad = function(maxIters, c, z){
    //return mandelbrott_grad(maxIters,c,z);
    const mandDist = Fractal.mandDist;
    const e = 1e-10;
    const d = mandDist(maxIters, c, z);
    return new vec2(
        mandDist(maxIters, c.plus(new vec2(e, 0)), z) - d,
        mandDist(maxIters, c.plus(new vec2(0, e)), z) - d
    ).unscale(e);

    //let re = 1.00000001;
    //let e = 1e-100;
    //if (z === undefined) { z = c;}
    //let d = mandDist(maxIters,c,z);
    //let f = (v) => (Math.abs(v)<e?v+e:v*re);
    //let fz = new vec2(f(z.x),f(z.y));
    //return new vec2(
    //    mandDist(maxIters,c,new vec2(fz.x,z.y))-d,
    //    mandDist(maxIters,c,new vec2(z.x,fz.y))-d
    //    ).div(fz.minus(z));
}

Fractal.gradzr = function(f, z, epsilon = 1e-6){
    const r = f(z);
    return new vec2(f(z.plus(new vec2(epsilon, 0))) - r, f(z.plus(new vec2(0, epsilon))) - r).unscale(epsilon);
}

function* trace_circle(iters, z0, step = 0.5) {
    const mandDist = Fractal.mandDist;
    const level = mandDist(iters, z0);
    let z = z0;
    while (true) {
        yield z;
        const val = mandDist(iters, z);
        const grad = Fractal.mandGrad(iters, z);
        z = z.plus(grad.cmult(new vec2(level - val, step).unscale(grad.mag2())));
    }
}

Fractal.mandColor = function(iters, z){
    let i = Fractal.mandDist(iters, z);
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
    if (NodeMode.val) r = nodeMode_v;
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
    const data = ["M ", toSVG(start), "\nL "];
    let prevZ = start;
    let maxlen = 32768; // 2 ^ 15
    const minD2 = 0.25 / 200 / 200;
    for (let z of trace_circle(iters, start, step)) {
        //if (z.minus(prevZ).mag2() < minD2){ continue;}
        if (z.pang() <= a0 && prevZ.pang() > a0) break;

        maxlen -= 1;
        if (maxlen <= 0) break;

        data.push(toSVG(z), ' ');
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
    const mandDist = Fractal.mandDist;
    const strRgb = Color.strRgb;
    for (let x = 8; x > 0.3; x *= 1 - 1 / 8) {
        let path = Svg.new.path();
        //path.setAttribute('fill',strRgb(mandDist(1024,new vec2(x,0))));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', strRgb(mandDist(1024, new vec2(x, 0))));
        path.setAttribute('stroke-width', String(Svg.zoom * 0.01));
        path.setAttribute('d', '');
        svg.children[1].appendChild(path);
        let start = new vec2(x, 0);
        let a0 = start.pang();
        let l = (m) => m;
        const data = ["M ", toSVG(l(start)), "\nL "];
        let prevZ = start;
        let maxlen = 4096; // 2 ^ 12
        let minD2 = 0.01 / 200 / 200;
        for (let z of trace_circle(1024, start, 0.1)) {
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

            data.push(toSVG(l(z)), ' ');
            prevZ = z;
        }
        data.push(" z");
        path.setAttribute('d', data.join(''));
        yield;
    }
}

function random_screen_pt_z() {
    const svgbb = svg.getBoundingClientRect();
    return toZ(new vec2(Math.random() * svgbb.width, Math.random() * svgbb.height));
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
    const mand_i = Fractal.mand_i;
    const iters = settings.iterations;
    let tries = 1;
    let pt;
    if (Math.random() > flashlight_fraction){
        do {
            pt = random_screen_pt_z();
            for (let i = (1 - Math.random() ** 2) * (tries * 4); i > 1; i--) {
                const gz = Fractal.mandGrad(iters, pt)
                pt = pt.plus(gz.unscale(gz.mag2() * 10 + 1));
                //if (mand_i(pt,iters) > iters){
                //    pt = (new vec2(Math.random()*2-1,Math.random()*2-1)).cmult(zoom).cadd(pan);
                //}
            }
            tries -= 1;
        } while (tries > 0 && mand_i(pt, iters) > iters)
        /*if (mand_i(pt,iters) > iters || pt.mag2()>8){
          return;
          }*/
    } else {
        pt = gaussianRandom2().scale(flashlight_stdev).cmult(zoom).cadd(toZ(mousePos));
    }
    return pt;
}
Fractal.path_to_basin = function * (pt){
    const mand_iter_n = Fractal.mand_iter_n;
    const gradzr = Fractal.gradzr; //gradzr(f,z,epsilon) = ∂|f(z)|/∂z
    let p = findInfimum(settings.iters, pt);
    while (true){
        const func = (z)=>mand_iter_n(p.i, z, z).mag2();
        let delta = gradzr(func, pt, 1e-5);
        delta = delta.unscale(delta.mag() + 1e-300).scale(zoom.mag() * .1);//normalize and scale delta
        pt = pt.plus(delta.scale(-settings.renderStepSize));
        yield pt;
    }
}
Fractal.hair_svg_path = function(pt,num_pts_max){
    const result = ["M", toSVG(pt), settings.renderDChar];
    let length = 0;
    let opt = pt;
    let opacity;

    let num_pts = 0;
    const mand_i = Fractal.mand_i;
    const iters = settings.iterations;
    if (mand_i(pt, iters) > iters) { //inside the set
        for (const next_pt of Fractal.path_to_basin(pt)) {
            const svg_pt = toSVG(next_pt);
            if (!svg_pt.isFinite()) break;
            result.push(svg_pt);
            length += next_pt.minus(pt);
            pt = next_pt;
            num_pts++;
            if (num_pts >= num_pts_max) break;
        }
        /*let p = findPeriod(pt,pt,1e-12,iters);
        for (; n > 0; n--){
            let npt = mand_iter_n(p,pt,pt);
            let delta = npt.minus(pt);
            delta = delta.cpow(new vec2(0.5,0));
            npt = pt.plus(delta.scale(0.1));
            if (mand_i(npt,iters)<=iters){
                break;
            }
            .push(toSVG(npt), ' ');
            length += npt.minus(pt).mag();
            pt = npt;
        }*/
        opacity = settings.innerOpacity / 10;
        length /= 4;
    } else { //outside the set
        const mandDist = Fractal.mandDist;
        if (mandDist(iters, pt) < settings.maxDist) return; //skip if too far

        for (let next_pt of trace_circle(iters, pt, Math.random() > 0.5 ? settings.renderStepSize : -settings.renderStepSize)) {
            //Logger.debug(p);
            //if ((n&3) == 0)
            const svg_pt = toSVG(next_pt);
            if (!svg_pt.isFinite()) break;
            result.push(svg_pt);
            length += next_pt.minus(pt).mag();
            pt = next_pt;
            num_pts++;
            if (num_pts >= num_pts_max) break;
        }
        color = Color.strRgb(mandDist(iters, pt));
        opacity = settings.outerOpacity;
    }
    if (length === 0) return;

    const width = Math.min(settings.renderWidthMult * length / num_pts, 0.1);
    const path = Svg.new.path();
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', Fractal.mandColor(iters, opt));
    path.setAttribute('stroke-width', String(width * Svg.zoom));
    path.setAttribute('stroke-opacity', String(opacity));
    path.setAttribute('d', result.join(' '));
    return path;
}
Fractal.cull_extra_lines = function(){
    const maxLines = settings.maxLines;
    if (maxLines === 0) {
        Elem.forEachChild(svg_bg, Fractal.removeNonPreserved);
        return;
    }

    const isNotPreserved = (elem)=>!elem.classList.contains('preserve') ;
    const unpreserved = Array.prototype.filter.call(svg_bg.children, isNotPreserved).reverse();
    while (unpreserved.length > maxLines) (unpreserved.pop()).remove();
}
Fractal.render_hair = function(num_pts_max){
    const random_point = Fractal.sample_random_point();
    const path = Fractal.hair_svg_path(random_point, num_pts_max);
    if (!path) return;

    svg_bg.appendChild(path);
    Fractal.cull_extra_lines();
}

Fractal.addPreservation = function(child){
    if (child.classList.contains('preserve')) return;

    child.classList.add('preserve');
    Logger.info("Preservation added to element with id:", child.id);
}
Fractal.clearPreservation = function(child){
    child.classList.remove('preserve')
}
Fractal.removeNonPreserved = function(child){
    if (child.classList.contains('preserve')) svg_bg.removeChild(child)
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

function gcd(a, b) {
    return (b === 0 ? a : gcd(b, a % b))
}

function findPeriod(c, z = new vec2(0, 0), epsilon2 = 1e-7, maxiters = 256) {
    let zf = mand_step(z, c);
    let i = 1;
    let p = 0;
    for (; i < maxiters; i++) {
        if (zf.minus(z).mag2() <= epsilon2) {
            p = i;
            break;
        }

        zf = mand_step(zf, c);
        zf = mand_step(zf, c);
        z = mand_step(z, c);
    }
    for (; i < maxiters; i++) {
        if (zf.minus(z).mag2() <= epsilon2) {
            p = gcd(p, i);
        }
        zf = mand_step(zf, c);
        zf = mand_step(zf, c);
        z = mand_step(z, c);
    }
    return p;
}

Fractal.mand_iter_n = function(n, c, z = new vec2(0, 0)){
    for (let i = 0; i < n; i += 1) {
        z = mand_step(z, c);
    }
    return z;
}

//finds smallest magnitude point in the orbit starting from z
function findInfimum(iters, z, c) {
    if (c === undefined) c = z;
    let besti = 0;
    let bestz = z;
    let bestd = z.mag2();
    for (let i = 1; i <= iters; i++) {
        z = mand_step(z, c);
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
let c = toZ(new vec2(x, y));
let isCurrentPixelInSet = isMandelbrotPixel(c, iters, escapeRadius);

// Check neighboring pixels
for (let dx = -pixelSpacing; dx <= pixelSpacing; dx += pixelSpacing) {
    for (let dy = -pixelSpacing; dy <= pixelSpacing; dy += pixelSpacing) {
        if (dx === 0 && dy === 0) continue; // Skip the current pixel

        let neighborC = toZ(new vec2(x + dx, y + dy));
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
        let c = toZ(new vec2(x, y));
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
