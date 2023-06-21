//https://github.com/tc39/proposal-regex-escaping/blob/main/specInJs.js
// this is a direct translation to code of the spec
if (!RegExp.escape) {
    RegExp.escape = (S) => {
        // 1. let str be ToString(S).
        // 2. ReturnIfAbrupt(str).
        let str = String(S);
        // 3. Let cpList be a List containing in order the code
        // points as defined in 6.1.4 of str, starting at the first element of str.
        let cpList = Array.from(str[Symbol.iterator]());
        // 4. let cuList be a new List
        let cuList = [];
        // 5. For each code point c in cpList in List order, do:
        for (let c of cpList) {
            // i. If c is a SyntaxCharacter then do:
            if ("^$\\.*+?()[]{}|".indexOf(c) !== -1) {
                // a. Append "\" to cuList.
                cuList.push("\\");
            }
            // Append c to cpList.
            cuList.push(c);
        }
        //6. Let L be a String whose elements are, in order, the elements of cuList.
        let L = cuList.join("");
        // 7. Return L.
        return L;
    };
}

        //console.log("test");
        document.body.style.overflow = 'hidden';
        var svg = document.getElementById("svg_bg");
        let svg_bg = svg.getElementById("bg");
        let svg_viewmat = svg.getElementById("viewmatrix");
        let svg_mousePath = svg.getElementById("mousePath");
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

            str() {
                return this.x + "," + this.y;
            }
            sqrt() {
                //https://www.johndcook.com/blog/2020/06/09/complex-square-root/
                let l = this.mag();
                let u = Math.sqrt((l + this.x) / 2);
                let v = Math.sign(this.y) * Math.sqrt((l - this.x) / 2);
                return new vec2(u, v);
            }
            lerpto(o, t) {
                return new vec2(lerp(this.x, o.x, t), lerp(this.y, o.y, t));
            }
            ctostring() {
                return ("" + this.y).startsWith("-") ? this.x + "-i" + (-this.y) : this.x + "+i" + this.y;
            }
        }

        function lerp(a, b, t) {
            return a * (1 - t) + b * t;
        }

        var mousePos = new vec2(0, 0);
        var mousePath = "";

        var zoom = new vec2(4, 0); //bigger is further out
        var pan = new vec2(0, 0);

        var zoomTo = new vec2(4, 0);
        var panTo = new vec2(0, 0);
        var autopilotReferenceFrame = undefined;
        var autopilotSpeed = 0;

        function skipAutopilot() {
            zoom = zoomTo
            pan = autopilotReferenceFrame ? autopilotReferenceFrame.pos.plus(panTo) : panTo;
        }

let opacitySlider = document.getElementById('opacity');
opacitySlider.addEventListener('input', function () {
    let innerCheckbox = document.getElementById('innerCheckbox');
    let outerCheckbox = document.getElementById('outerCheckbox');

    if (!innerCheckbox.checked) {
        settings.innerOpacity = opacitySlider.value / 100;
    }

    if (!outerCheckbox.checked) {
        settings.outerOpacity = opacitySlider.value / 100;
    }
});
innerCheckbox.addEventListener('click', function () {
    if (innerCheckbox.checked) {
        settings.innerOpacity = opacitySlider.value / 100;
    } else {
        settings.innerOpacity = opacitySlider.value / 1000;  // reset to current slider value
    }
});

outerCheckbox.addEventListener('click', function () {
    if (outerCheckbox.checked) {
        settings.outerOpacity = opacitySlider.value / 100;
    } else {
        settings.outerOpacity = opacitySlider.value / 100;  // reset to current slider value
    }
});


        var settings = {
            zoomSpeed: 0.001,
            panSpeed: 1,
            zoomContentExp: 0.5,
            gestureZoomSpeed: 0.01,
            gestureRotateSpeed: Math.PI / 180,
            scroll: ('GestureEvent' in window) ? "pan" : "zoom",
            maxLines: 512,
            nodeModeKey: "Shift", //"CapsLock",
            nodeModeTrigger: "down", //"toggle"
            renderStepSize: 1, //0.25,
            renderWidthMult: 0.25, //1,
            renderSteps: 16, //64,
            renderDChar: "L",
            opacity: 1,


            rotateModifier: "Alt",
            rotateModifierSpeed: Math.PI / 180 / 36,

            iterations: 256,

            //autopilotRF_Pscale:1,
            autopilotRF_Iscale: 0.5,
            //autopilotRF_Dscale:0.1,
            autopilotSpeed: 0.1,
            autopilotMaxSpeed: 0.1,

            buttonGraphics: {
                hover: ["RGB(100,100,100)", "RGB(200,200,255)"],
                click: ["RGB(70,70,70)", "RGB(100,100,100)"],
                initial: ["none", "RGB(170,170,170)"]
            },

            maxDist: 4,
            orbitStepRate: 2,

            innerOpacity: 1,
            outerOpacity: 1
        }

        function setRenderQuality(n) {
            let q = 1 / n;
            let f = settings.renderStepSize / q;
            settings.renderStepSize = q;
            settings.renderWidthMult *= f;
            settings.renderSteps *= f;
        }
        setRenderQuality(getQuality());

        function setRenderLength(l) {
            let f = settings.renderStepSize * settings.renderSteps / l;
            //settings.renderStepSize /= f;
            //settings.renderWidthMult *= f;
            settings.renderSteps /= f;
        }
        setRenderLength(getLength());

        function windowScaleAndOffset() {
            let svgbb = svg.getBoundingClientRect();
            let s = Math.min(svgbb.width, svgbb.height); //Math.hypot(window.innerHeight,window.innerWidth)/2**.5;
            let off = svgbb.width < svgbb.height ? svgbb.right : svgbb.bottom;
            return {
                s: s,
                o: new vec2(-(off - svgbb.right) / 2, -(off - svgbb.bottom) / 2)
            }
        }

        function toZ(c) {
            let {
                s,
                o
            } = windowScaleAndOffset();
            return c.minus(o).unscale(s).minus(new vec2(.5, .5)).scale(2).cmult(zoom).cadd(pan);
        }

        function toS(c) {
            let {
                s,
                o
            } = windowScaleAndOffset();
            return c.unscale(s).scale(2);
        }

        function toDZ(c) {
            let {
                s,
                o
            } = windowScaleAndOffset();
            return c.unscale(s).scale(2).cmult(zoom);
        }

        function fromZ(z) {
            let {
                s,
                o
            } = windowScaleAndOffset();
            return z.csub(pan).cdiv(zoom).unscale(2).plus(new vec2(.5, .5)).scale(s).plus(o);
        }

        function fromZtoUV(z) {
            return z.csub(pan).cdiv(zoom).unscale(2).plus(new vec2(.5, .5));
        }
        var SVGzoom = 8192;
        var SVGpan = new vec2(0, 0);
        let recenterThreshold = 0.01;
        let rezoomThreshold = 0.1;
        let rezoomFactor = 8192;
        let old_rotation = 0;

        function updateViewbox() {
            //let lc = toSVG(toZ(new vec2(0,0)));
            let zm = zoom.mag();
            let lc = toSVG(new vec2(-zm, -zm).plus(pan));
            let d = zm * 2 * SVGzoom;
            let r = zoom.ang();
            //let rotCenter = fromZ(pan);// = {let s = window.innerWidth; return new vec2(.5*s,.5*s);}

            let recalc = false;
            if (d < Math.abs(recenterThreshold * lc.x) || d < Math.abs(recenterThreshold * lc.y)) {
                let oldPan = SVGpan;
                SVGpan = pan.scale(1);
                lc = toSVG(toZ(new vec2(0, 0)));
                //console.log("recentering...");
                recalc = true;
            }
            if (d < rezoomThreshold || d > rezoomFactor / rezoomThreshold) {
                SVGzoom *= rezoomFactor / d;
                //console.log("rezooming...");
                recalc = true;
            }
            if (recalc) {
                recalc_svg();
            }

            let c = toSVG(pan); //center of rotation
            //where it ends up if you do the rotation about SVGpan
            let rc = c.cmult(zoom.unscale(zm).cconj());
            //
            lc = lc.plus(rc.minus(c));

            svg.setAttribute("viewBox", lc.x + " " + lc.y + " " + d + " " + d);


            if (r !== old_rotation) {
                old_rotation = r;
                svg_viewmat.setAttribute("transform", "rotate(" + (-r * 180 / Math.PI) + ")");
                //svg_viewmat.setAttribute("transform","rotate("+(-r*180/Math.PI)+" "+c.x+" "+c.y+")");
            }


            return

            // the below has the issue of low-res svg when changing the matrix in firefox
            svg.setAttribute("viewBox", (-svg_viewbox_size / 2) + " " + (-svg_viewbox_size / 2) + " " + svg_viewbox_size + " " + svg_viewbox_size);
            // z = bal(uv)*zoom+pan
            // svg = (z-svgpan)*svgzoom
            // want matrix to go svg -> bal(uv)*65536
            // bal(uv)*65536 = 65536*(z-pan)/zoom = 65536*(svg/svgzoom-svgpan-pan)/zoom
            // d/dsvg = 65536/svgzoom/zoom
            // f(0) = -65536*(svgpan+pan)/zoom
            let t = zoom.crecip().scale(svg_viewbox_size / SVGzoom / 2);
            let p = pan.minus(SVGpan).scale(-svg_viewbox_size / 2).cdiv(zoom);

            svg_viewmat.setAttribute("transform", "matrix(" + t.x + " " + (t.y) + " " + (-t.y) + " " + (t.x) + " " + (p.x) + " " + (p.y) + ")");
            //svg_bg.setAttribute("transform","matrix("+z.x+" "+(-z.y)+" "+(z.y)+" "+(z.x)+" "+SVGpan.x+" "+SVGpan.y+")");

        }

        function toSVG(coords) {
            return coords.minus(SVGpan).scale(SVGzoom);
        }

        function recalc_svg() {
            //todo
            //placeholder:
            let node = svg_bg;
            while (node.firstChild) {
                node.removeChild(node.lastChild);
            }
        }





        document.getElementById("body").addEventListener("mousemove", (event) => {
            mousePos.x = event.pageX;
            mousePos.y = event.pageY;
            mousePath = "";
        }, false);
        document.getElementById("body").addEventListener("mouseclick", (event) => {
            mousePos.x = event.pageX;
            mousePos.y = event.pageY;
            /*let p = toZ(mousePos);
            zoom = zoom.unscale(2);
            pan = p;*/
        }, false);

        function mand_step(z, c) {
            return z.cmult(z).cadd(c);
        }
        //function mand_step(z,c){return z.cpow(new vec2(time()/8/120/10+1,0)).cadd(c);}
        //function mand_step(z,c){return z.cmult(z).cadd(z.x==0&&z.y==0?c:c.cdiv(z));}
        //function mand_step(z,c){return z.cmult(z).cadd(c).map(Math.abs);}

        function mand_unstep(z, c) {
            return z.csub(c).sqrt();
        }

        function mand_i(z, iters = 16) {
            let c = z;
            for (let i = 0; i < iters; i++) {
                if (z.mag2() > 4) {
                    return i;
                }
                z = mand_step(z, c);
            }
            return (z.mag2() > 4) ? iters : iters + 1;
        }

        function mandelbrott_dist(iters, c, z) {
            if (z === undefined) {
                z = new vec2(0, 0);
            }
            let pz = z;
            for (let i = 0; i < iters; i++) {
                if (z.mag2() > 4) {
                    let zm = z.mag();
                    let pzm = pz.mag();
                    return i + (2 - pzm) / (zm - pzm);
                }
                pz = z;
                z = mand_step(z, c);
            }
            return iters;
        }

        function mandelbrott_dist(iters, c, z) {
            let bailout = 1e8; //large so z^2+c -> z^2
            if (z === undefined) {
                z = new vec2(0, 0);
            }
            let pz = z;
            for (let i = 0; i < iters; i++) {
                if (z.mag2() > bailout) {
                    //pz^2 = z
                    //pz^(2^?) = b
                    //ln(pz)2^?=ln(b)
                    //ln(ln(pz))+ln(2)*?=ln(ln(b))
                    let g = Math.log2(Math.log(bailout));
                    let llz = Math.log2(Math.log2(z.mag2()) / 2);
                    return i - llz;
                }
                pz = z;
                z = mand_step(z, c);
            }
            return iters;
        }

        function mandelbrott_grad(iters, c, z) {
            let bailout = 1e8; //large so z^2+c -> z^2
            if (z === undefined) {
                z = new vec2(0, 0);
            }
            let dz = new vec2(1, 0);
            for (let i = 0; i < iters; i++) {
                if (z.mag2() > bailout) {
                    //pz^2 = z
                    //pz^(2^?) = b
                    //ln(pz)2^?=ln(b)
                    //ln(ln(pz))+ln(2)*?=ln(ln(b))
                    return dz;
                    let llz = Math.log2(Math.log2(z.mag2()) / 2);
                    return i - llz;
                }
                z = mand_step(z, c);
                dz = dz.cmult(z.scale(2));
            }
            return new vec2(0, 0);
        }

        function mandGrad(maxIters, c, z) {
            //return mandelbrott_grad(maxIters,c,z);
            let e = 1e-10;
            let d = mandelbrott_dist(maxIters, c, z);
            return new vec2(
                mandelbrott_dist(maxIters, c.plus(new vec2(e, 0)), z) - d,
                mandelbrott_dist(maxIters, c.plus(new vec2(0, e)), z) - d
            ).unscale(e);

            //let re = 1.00000001;
            //let e = 1e-100;
            //if (z === undefined) { z = c;}
            //let d = mandelbrott_dist(maxIters,c,z);
            //let f = (v) => (Math.abs(v)<e?v+e:v*re);
            //let fz = new vec2(f(z.x),f(z.y));
            //return new vec2(
            //    mandelbrott_dist(maxIters,c,new vec2(fz.x,z.y))-d,
            //    mandelbrott_dist(maxIters,c,new vec2(z.x,fz.y))-d
            //    ).div(fz.minus(z));
        }

        function gradzr(f, z, epsilon = 1e-6) {
            let r = f(z);
            return new vec2(f(z.plus(new vec2(epsilon, 0))) - r, f(z.plus(new vec2(0, epsilon))) - r).unscale(epsilon);
        }


        function* trace_circle(iters, z0, step) {
            if (step === undefined) {
                step = 0.5;
            }
            let level = mandelbrott_dist(iters, z0);
            let z = z0;
            while (true) {
                yield z;
                let vz = mandelbrott_dist(iters, z);
                let gz = mandGrad(iters, z);
                z = z.plus(gz.cmult(new vec2(level - vz, step).unscale(gz.mag2())));
            }
        }

        function mcol(iters, z) {
            let i = mandelbrott_dist(iters, z);
            if (i >= iters) {
                i = findInfimum(iters, z);
                //i = findPeriod(z);
                return scol(i.i * 123 + 2, (1 - nodeMode_v), 128, 32 + (1 - nodeMode_v) * 48);
            } else {
                return scol(i);
            }
        }

        function col(i, r = undefined, c = 128, s = 127) {
            if (r === undefined) {
                r = nodeMode_v
            }
            let rgb = [c - s * Math.cos(i / 2 ** .9), c - s * Math.cos(i / 3 ** .9), c - s * Math.cos(i / 5 ** .9)];
            let y = 0.17697 * rgb[0] + 0.81240 * rgb[1] + 0.01063 * rgb[2];
            return [lerp(rgb[0], y, r), lerp(rgb[1], y, r), lerp(rgb[2], y, r)];
        }

        function scol(i, r = undefined, c = 128, s = 127) {
            c = col(i, r, c, s);
            return "RGB(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")";
        }


        //let l = document.getElementById("link");
        //l.style.position="absolute";
        //l.style.left="100px";
        //l.style.top="100px";


        function outlineMand(start, step, iters) {
            iters = iters === undefined ? 256 : iters;
            step = step === undefined ? 0.1 : step;
            let a0 = start.pang();
            let path = "M " + toSVG(start).str() + "\nL ";
            let pz = start;
            let maxlen = 1 << 15;
            let minD2 = 0.25 / 200 / 200;
            for (let z of trace_circle(iters, start, step)) {
                //if (z.minus(pz).mag2() < minD2){ continue;}
                if (z.pang() <= a0 && pz.pang() > a0) {
                    break;
                }
                maxlen--;
                if (maxlen <= 0) {
                    break;
                }
                path += toSVG(z).str() + " ";
                pz = z;
            }
            return path;
        }

        function addPath(path, stroke, fill) {
            if (stroke === undefined) {
                stroke = "red"
            }
            if (fill === undefined) {
                stroke = "none"
            }
            let pathn = document.createElementNS("http://www.w3.org/2000/svg", "path");
            pathn.setAttribute("fill", fill);
            pathn.setAttribute("stroke", stroke);
            pathn.setAttribute("d", path);
            svg.appendChild(pathn);
            return pathn;
        }

        function* iter() {
            for (let x = 8; x > 0.3; x *= 1 - 1 / 8) {
                let pathn = document.createElementNS("http://www.w3.org/2000/svg", "path");
                //pathn.setAttribute("fill",scol(mandelbrott_dist(1024,new vec2(x,0))));
                pathn.setAttribute("fill", "none");
                pathn.setAttribute("stroke", scol(mandelbrott_dist(1024, new vec2(x, 0))));
                pathn.setAttribute("stroke-width", "" + (SVGzoom * 0.01));
                pathn.setAttribute("d", "");
                svg.children[1].appendChild(pathn);
                let start = new vec2(x, 0);
                let a0 = start.pang();
                let l = (m) => m;
                let path = "M " + toSVG(l(start)).str() + "\nL ";
                let pz = start;
                let maxlen = 1 << 12;
                let minD2 = 0.01 / 200 / 200;
                for (let z of trace_circle(1024, start, 0.1)) {

                    if (z.pang() <= a0 && pz.pang() > a0) {
                        break;
                    }
                    maxlen--;
                    if (maxlen <= 0) {
                        pathn.setAttribute("d", path + " z");
                        yield;
                        maxlen = 1 << 12;
                    }
                    if (z.minus(pz).mag2() < minD2) {
                        continue;
                    }
                    path += toSVG(l(z)).str() + " ";
                    pz = z;
                }
                pathn.setAttribute("d", path + " z");
                yield;
            }
        }






        function windowify(title, content, pos, scale, iscale, link) {
            let odiv = document.createElement('div');
            let div = document.createElement('div');
            let buttons = document.getElementById("elements").children[0];
            let w = buttons.cloneNode(true);

            // Create a header container for buttons and title input
            let headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.alignItems = 'center';
            headerContainer.appendChild(w);

            div.appendChild(headerContainer);
            odiv.appendChild(div);

            let innerContent = document.createElement('div');
            innerContent.className = 'content';
            for (let c of content) {
                innerContent.appendChild(c);
            }
            div.appendChild(innerContent);


            odiv.setAttribute("data-init", "window");
            div.setAttribute("class", "window");

            div.addEventListener('click', (event) => {
                event.stopPropagation();
                if (event.altKey) {
                    div.classList.toggle('selected');
                }
            });

            let dropdown = document.querySelector('.dropdown');

            div.addEventListener('mousedown', function () {
                autopilotSpeed = 0;
                dropdown.classList.add('no-select');
            });

            div.addEventListener('mouseup', function () {
                dropdown.classList.remove('no-select');
            });

            // Add the title input to the header container
            let titleInput = document.createElement('input');
            titleInput.setAttribute('type', 'text');
            titleInput.setAttribute('value', title);
            titleInput.className = 'title-input';
            headerContainer.appendChild(titleInput);

            // Add resize container and handle
            let resizeContainer = document.createElement('div');
            resizeContainer.className = 'resize-container';
            div.appendChild(resizeContainer);

            let resizeHandle = document.createElement('div');
            resizeHandle.className = 'resize-handle';
            resizeContainer.appendChild(resizeHandle);


            let node = new Node(pos, odiv, scale, iscale || new vec2(1, 1));
            setResizeEventListeners(resizeHandle, node);
            observeContentResize(innerContent, div);
            div.win = node;
            return rewindowify(node);
}



        function setResizeEventListeners(resizeHandle, node) {
            const inverse2DMatrix = (matrix) => {
                const det = matrix[0] * matrix[3] - matrix[1] * matrix[2];
                if (det === 0) {
                    return null;
                }
                const invDet = 1 / det;
                return [
                    matrix[3] * invDet,
                    -matrix[1] * invDet,
                    -matrix[2] * invDet,
                    matrix[0] * invDet,
                ];
            };

            const getDivInverseTransformMatrix = (div) => {
                const transform = window.getComputedStyle(div).transform;
                if (transform === 'none') {
                    return [1, 0, 0, 1];
                }
                const matrix = transform
                    .split('(')[1]
                    .split(')')[0]
                    .split(',')
                    .map(parseFloat)
                    .slice(0, 4);
                return inverse2DMatrix(matrix);
            };

            let windowDiv = resizeHandle.parentElement.parentElement;
            let startX;
            let startY;
            let startWidth;
            let startHeight;

            let isMouseMoving = false;

            function extractScalingFactors(element) {
                const rect = element.getBoundingClientRect();
                const style = window.getComputedStyle(element);
                const width = parseFloat(style.width);
                const height = parseFloat(style.height);

                if (width === 0 || height === 0) {
                    return {
                        scaleX: 1,
                        scaleY: 1
                    };
                }

                const scaleX = rect.width / width;
                const scaleY = rect.height / height;

                return {
                    scaleX,
                    scaleY
                };
            }

            const handleMouseMove = (event) => {
                if (!event.buttons) {
                    handleMouseUp();
                    return;
                }
                isMouseMoving = true;

                // Extract scaling factors from the accumulated transform matrix
                const {
                    scaleX,
                    scaleY
                } = extractScalingFactors(windowDiv);

                // Calculate the change in position of the mouse considering the scaling factors
                const dx = 2 * (event.pageX - startX) / scaleX;
                const dy = 2 * (event.pageY - startY) / scaleY;

                const content = windowDiv.querySelector('.content');
                const minWidth = content ? content.offsetWidth + 0 : 100;
                const minHeight = content ? content.offsetHeight + 35 : 100;
                const newWidth = Math.max(startWidth + dx, minWidth);
                const newHeight = Math.max(startHeight + dy, minHeight);
                windowDiv.style.width = `${newWidth}px`;
                windowDiv.style.height = `${newHeight}px`;
            };

            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                isMouseMoving = false;
            };

            resizeHandle.addEventListener('mousedown', (event) => {
                event.preventDefault();
                event.stopPropagation();
                startX = event.pageX;
                startY = event.pageY;
                startWidth = parseInt(document.defaultView.getComputedStyle(windowDiv).width, 10);
                startHeight = parseInt(document.defaultView.getComputedStyle(windowDiv).height, 10);

                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });

            resizeHandle.addEventListener('mouseenter', () => {
                document.body.style.cursor = 'nwse-resize';
            });

            resizeHandle.addEventListener('mouseleave', () => {
                if (!isMouseMoving) {
                    document.body.style.cursor = 'auto';
                }
            });
        }






        function rewindowify(node) {
            node.push_extra("window");
            let w = node.content;


            let del = w.querySelector("#button-delete");
            let fs = w.querySelector("#button-fullscreen");
            let col = w.querySelector("#button-collapse");

            function set(e, v, s = "fill") {
                e.children[0].setAttribute("fill", settings.buttonGraphics[v][0]);
                e.children[1].setAttribute(s, settings.buttonGraphics[v][1]);
            }

            function ui(e, cb = (() => { }), s = "fill") {
                e.onmouseenter = (ev) => {
                    set(e, "hover", s);
                }
                e.onmouseleave = (ev) => {
                    set(e, "initial", s);
                    e.ready = false;
                }
                e.onmousedown = (ev) => {
                    set(e, "click", s);
                    e.ready = true;
                    cancel(ev);
                }
                e.onmouseup = (ev) => {
                    set(e, "initial", s);
                    cancel(ev);
                    if (e.ready) {
                        cb(ev);
                    }
                }
                e.onmouseleave();
            }
            ui(del, node.remove.bind(node));
            ui(fs, (() => {
                node.zoom_to_fit();
                zoomTo = zoomTo.scale(1.0625);
                autopilotSpeed = settings.autopilotSpeed;
            }));
            ui(col, (() => { }), "stroke");

            return node;
        }






        function put(e, p, s = 1) {
            let svgbb = svg.getBoundingClientRect();
            e.style.position = "absolute";
            e.style.transform = "scale(" + s + "," + s + ")";
            p = fromZtoUV(p);
            if (p.minus(new vec2(0.5, 0.5)).mag2() > 16) {
                e.style.display = "none";
            } else {
                e.style.display = "initial";
            }
            let w = Math.min(svgbb.width, svgbb.height);
            let off = svgbb.width < svgbb.height ? svgbb.right : svgbb.bottom;
            p.x = w * p.x - (off - svgbb.right) / 2;
            p.y = w * p.y - (off - svgbb.bottom) / 2;
            let bb = e.getBoundingClientRect();
            p = p.minus(new vec2(bb.width, bb.height).scale(0.5 / s));
            e.style.left = p.x + "px";
            e.style.top = p.y + "px";


            //e.style['margin-top'] = "-"+(e.offsetHeight/2)+"px";//"-50%";
            //e.style['margin-left'] = "-"+(e.offsetWidth/2)+"px";//"-50%";
            //e.style['vertical-align']= 'middle';
            //e.style['text-align']= 'center';

        }

        const NodeExtensions = {
            "window": (node, a) => {
                rewindowify(node);
            },
            "textarea": (node, o) => {
                let e = node.content;
                for (let w of o.p) {
                    e = e.children[w];
                }
                let p = o.p;
                e.value = o.v;
                node.push_extra_cb((n) => {
                    return {
                        f: "textarea",
                        a: {
                            p: p,
                            v: e.value
                        }
                    };
                });
            },
        }


        var movingNode = undefined;
        let prevNode = undefined;
        var NodeUUID = 0;
        var nodeMap = {};

        function nextUUID() {
            while (nodeMap[NodeUUID] !== undefined) {
                NodeUUID++;
            }
            return NodeUUID;
        }
        class Node {
            constructor(p, thing, scale = 1, intrinsicScale = 1, createEdges = true) {
            this.anchor = new vec2(0, 0);
            this.anchorForce = 0;
            this.mouseAnchor = new vec2(0, 0);
            this.edges = [];
            this.createdAt = new Date().toISOString();
            this.init = (nodeMap) => {};
            if (p === undefined) {
              let n = thing;
              let o = JSON.parse(n.dataset.node_json)
              for (const k of ['anchor', 'mouseAnchor', 'vel', 'pos', 'force']) {
                o[k] = new vec2(o[k]);
              }
              for (const k in o) {
                this[k] = o[k];
              }
              this.save_extras = [];
              this.content = thing;
              if (n.dataset.node_extras) {
                o = JSON.parse(n.dataset.node_extras);
                for (const e of o) {
                  NodeExtensions[e.f](this, e.a);
                }
              }
              this.attach();
                this.content.setAttribute("data-uuid", this.uuid);
                if (n.dataset.edges !== undefined && createEdges) {
                    let es = JSON.parse(n.dataset.edges);
                    this.init = ((nodeMap) => {
                        for (let e of es) {
                            edgeFromJSON(e, nodeMap);
                        }
                    }).bind(this);
                }
                return;
            } else {
              this.uuid = nextUUID();
            }
            this.uuid = "" + this.uuid;

            this.pos = p;
            this.scale = scale;
            this.intrinsicScale = intrinsicScale;

            this.content = thing;

            this.vel = new vec2(0, 0);
            this.force = new vec2(0, 0);
            this.followingMouse = 0;

            this.removed = false;

            this.content.setAttribute("data-uuid", this.uuid);
            this.attach();
            this.save_extras = [];
          }
          attach() {
            let div = this.content;
            let node = this;
            div.onclick = node.onclick.bind(node);
            div.ondblclick = node.ondblclick.bind(node);
            div.onmousedown = node.onmousedown.bind(node);
            div.onmouseup = node.onmouseup.bind(node);
            div.onmousemove = node.onmousemove.bind(node);
            div.onwheel = node.onwheel.bind(node);
          }
          json() {
            return JSON.stringify(this, (k, v) => {
              if (k === "content" || k === "edges" || k === "save_extras") {
                return undefined;
              }
              return v;
            });
          }
          push_extra_cb(f) {
            this.save_extras.push(f);
          }
          push_extra(func_name, args = undefined) {
            this.save_extras.push({
              f: func_name,
              a: args
            });
          }
            draw() {
                put(this.content, this.pos, this.intrinsicScale * this.scale * (zoom.mag2() ** -settings.zoomContentExp));

                // Before saving, get the current title input value and store it in a data-attribute
                let titleInput = this.content.querySelector('.title-input');
                if (titleInput) {
                    this.content.setAttribute('data-title', titleInput.value);
                }

                this.content.setAttribute("data-node_json", this.json());
                let se = [];
                for (let e of this.save_extras) {
                    se.push(typeof e === "function" ? e(this) : e);
                }
                this.content.setAttribute("data-node_extras", JSON.stringify(se));
            }
            zoom_to_fit(margin = 1) {
                let bb = this.content.getBoundingClientRect();
                let svgbb = svg.getBoundingClientRect();
                let so = windowScaleAndOffset();
                let aspect = svgbb.width / svgbb.height;
                let scale = bb.height * aspect > bb.width ? svgbb.height / (margin * bb.height) : svgbb.width / (margin * bb.width);
                this.zoom_by(1 / scale);
            }
            zoom_by(s = 1) {
                panTo = new vec2(0, 0); //this.pos;
                let gz = ((s) ** (-1 / settings.zoomContentExp));
                zoomTo = zoom.unscale(gz ** 0.5);
                autopilotReferenceFrame = this;
                panToI = new vec2(0, 0);
            }
            zoom_to(s = 1) {
                panTo = new vec2(0, 0); //this.pos;
                let gz = zoom.mag2() * ((this.scale * s) ** (-1 / settings.zoomContentExp));
                zoomTo = zoom.unscale(gz ** 0.5);
                autopilotReferenceFrame = this;
                panToI = new vec2(0, 0);
            }
            addEdge(edge) {
                this.edges.push(edge);
                this.updateEdgeData();
            }
updateEdgeData() {
  let es = JSON.stringify(this.edges.map((e) => e.dataObj()));
  this.content.setAttribute("data-edges", es);
}


            step(dt) {
                if (dt === undefined || isNaN(dt)) {
                    dt = 0;
                } else {
                    if (dt > 1) {
                        dt = 1;
                    }
                }
                if (!this.followingMouse) {
                    this.pos = this.pos.plus(this.vel.scale(dt / 2));
                    this.vel = this.vel.plus(this.force.scale(dt));
                    this.pos = this.pos.plus(this.vel.scale(dt / 2));
                    this.force = this.vel.scale(-Math.min(this.vel.mag() + 0.4 + this.anchorForce, 1 / (dt + 1e-300)));
                } else {
                    this.vel = new vec2(0, 0);
                    this.force = new vec2(0, 0);
                }
                let g = mandGrad(settings.iterations, this.pos);
                //g.y *= -1; //why?
                this.force = this.force.plus(g.unscale((g.mag2() + 1e-10) * 300));
                this.force = this.force.plus(this.anchor.minus(this.pos).scale(this.anchorForce));
                //let d = toZ(mousePos).minus(this.pos);
                //this.force = this.force.plus(d.scale(this.followingMouse/(d.mag2()+1)));
                if (this.followingMouse) {
                    let p = toZ(mousePos).minus(this.mouseAnchor);
                    this.vel = p.minus(this.pos).unscale(nodeMode ? 1 : dt);
                    this.pos = p;
                    this.anchor = this.pos;
                }
                //this.force = this.force.plus((new vec2(-.1,-1.3)).minus(this.pos).scale(0.1));
                this.draw();
            }
            searchStrings() {
                function* search(e) {
                    yield e.textContent;
                    if (e.value)
                        yield e.value;
                    for (let c of e.children) {
                        yield* search(c);
                    }
                }
                return search(this.content);
            }
            onclick(event) {

            }
            toggleWindowAnchored(anchored) {
                if (anchored) {
                    this.content.classList.add("window-anchored");
                } else {
                    this.content.classList.remove("window-anchored");
                }
            }
            ondblclick(event) {
                this.anchor = this.pos;
                this.anchorForce = 1 - this.anchorForce;
                this.toggleWindowAnchored(this.anchorForce === 1);
                cancel(event);
            }
            onmousedown(event) {
                this.mouseAnchor = toZ(new vec2(event.clientX, event.clientY)).minus(this.pos);
                this.followingMouse = 1;
                movingNode = this;
                if (nodeMode) {
                    if (prevNode === undefined) {
                        prevNode = this;
                    } else {
                        connect(this, prevNode, this.pos.minus(prevNode.pos).mag() / 2);
                        prevNode = undefined;
                    }
                } else {

                }
                cancel(event);
            }
            onmouseup(event) {
                this.followingMouse = 0;
                if (this === movingNode) {
                    movingNode = undefined;
                }
                cancel(event);
            }
            onmousemove(event) {
                if (this.followingMouse) {
                    prevNode = undefined;
                }
                /*if (this.followingMouse){
                this.pos = this.pos.plus(toDZ(new vec2(event.movementX,event.movementY)));
                this.draw()
                //cancel(event);
                }*/
            }
            onwheel(event) {
                if (nodeMode) {
                    let amount = Math.exp(event.wheelDelta * -settings.zoomSpeed);
                    let targetWindow = event.target.closest('.window');

                    // Check if the event target is a selected window
                    if (targetWindow && targetWindow.classList.contains('selected')) {
                        // Get all selected windows
                        const selectedWindows = document.querySelectorAll('.window.selected');

                        // Scale all selected windows
                        selectedWindows.forEach((selectedWindow) => {
                            let winNode = selectedWindow.win;

                            // Modify the scaling logic for selected windows here
                            winNode.scale *= amount;
                            winNode.pos = winNode.pos.lerpto(toZ(mousePos), 1 - amount);

                            // Scale edges connected to the selected window
                            winNode.edges.forEach((edge) => {
                                edge.scaleEdge(amount);
                            });
                        });
                    } else {
                        // Scale the current window
                        this.scale *= amount;
                        this.pos = this.pos.lerpto(toZ(mousePos), 1 - amount);
                    }

                    cancel(event);
                }
            }
            remove() {
                let dels = [];
                for (let n of nodes) {
                    for (let e of n.edges) {
                        if (e.pts.includes(this)) {
                            dels.push(e);
                        }
                    }
                }
                for (let e of dels) {
                    e.remove();
                }

                let index = nodes.indexOf(this);
                if (index !== -1) {
                    nodes.splice(index, 1);
                }
                if (nodeMap[this.uuid] === this) {
                    delete nodeMap[this.uuid];
                }

                this.removed = true;
                this.content.remove();
            }

        }
        let htmlnodes_parent = document.getElementById("nodes");
        let htmlnodes = htmlnodes_parent.children;
        let htmledges = document.getElementById("edges");

function edgeFromJSON(o, nodeMap) {
    let pts = o.p.map((k) => nodeMap[k]);

    if (pts.includes(undefined)) {
        console.warn("missing keys", o, nodeMap);
    }

    // Check if edge already exists
    for (let e of edges) {
        let e_pts = e.pts.map(n => n.uuid).sort();
        let o_pts = o.p.sort();
        if (JSON.stringify(e_pts) === JSON.stringify(o_pts)) {
            // Edge already exists, return without creating new edge
            return;
        }
    }

    let e = new Edge(pts, o.l, o.s, o.g);

    for (let pt of pts) {
        pt.addEdge(e); // add edge to all points
    }

    edges.push(e);
    return e;
}
        class Edge {
            constructor(pts, length = 0.6, strength = 0.1, style = {
                stroke: "red",
                "stroke-width": "0.01",
                fill: "red"
            }) {
                this.pts = pts;
                this.length = length;
                this.strength = strength;
                this.style = style;
                this.html = document.createElementNS("http://www.w3.org/2000/svg", "path");
                for (const [key, value] of Object.entries(style)) {
                    this.html.setAttribute(key, value);
                }
                htmledges.appendChild(this.html);
                this.attach();

                this.maxWidth = 0.05;
            }
            scaleEdge(amount) {
                this.length *= amount;
            }
            dataObj() {
                let o = {};
                o.l = this.length;
                o.s = this.strength;
                o.g = this.style;
                o.p = this.pts.map((n) => n.uuid);
                return o;
            }
            attach() {
                this.html.onwheel = this.onwheel.bind(this);
                this.html.onmouseover = this.onmouseover.bind(this);
                this.html.onmouseout = this.onmouseout.bind(this);
                this.html.ondblclick = this.ondblclick.bind(this);
            }
            stress() {
                let avg = this.center();
                return this.pts.reduce((t, n, i, a) => {
                    return t + n.pos.minus(avg).mag() - this.length;
                }, 0) / (this.length + 1);
            }
            center() {
                return this.pts.reduce((t, n, i, a) => {
                    return t.plus(n.pos);
                }, new vec2(0, 0)).unscale(this.pts.length);
            }
            draw() {
                this.html.setAttribute("stroke", this.mouseIsOver ? "lightskyblue" : this.style.stroke);
                this.html.setAttribute("fill", this.mouseIsOver ? "lightskyblue" : this.style.fill);

                const stressValue = Math.max(this.stress(), 0.01); // Make sure stressValue never goes below 0.01
                let wscale = this.style['stroke-width'] / (0.5 + stressValue) * (this.mouseIsOver ? 1.5 : 1.0);
                wscale = Math.min(wscale, this.maxWidth);
                let path = "M ";
                let c = this.center();
                let validPath = true;

                for (let n of this.pts) {
                    let r = n.scale * wscale;
                    let minusC = n.pos.minus(c);
                    let rotated = minusC.rot90();

                    if (rotated.x !== 0 || rotated.y !== 0) {
                        let left = rotated.normed(r);

                        // Check if coordinates are not NaN
                        if (!isNaN(left.x) && !isNaN(left.y) && !isNaN(n.pos.x) && !isNaN(n.pos.y)) {
                            path += toSVG(n.pos.minus(left)).str();
                            path += " L ";
                            path += toSVG(left.plus(n.pos)).str() + " ";
                        } else {
                            validPath = false;
                            break;
                        }
                    }
                }

                // Check if the first point's coordinates are not NaN
                let firstPoint = this.pts[0].pos.minus(this.pts[0].pos.minus(c).rot90().normed(this.pts[0].scale * wscale));
                if (!isNaN(firstPoint.x) && !isNaN(firstPoint.y)) {
                    path += " " + toSVG(firstPoint).str() + "z";
                } else {
                    validPath = false;
                }

                // Only set the 'd' attribute if the path is valid
                if (validPath) {
                    this.html.setAttribute("d", path);
                }
            }
            step(dt) {
                if (dt === undefined || isNaN(dt)) {
                    dt = 0;
                } else {
                    if (dt > 1) {
                        dt = 1;
                    }
                }
                let avg = this.center();
                for (let n of this.pts) {
                    let d = n.pos.minus(avg);
                    // Calculate the force only if the distance is greater than the desired length
                    if (d.mag() > this.length) {
                        let f = d.scale(1 - this.length / (d.mag() + 1e-300));
                        n.force = n.force.plus(f.scale(-this.strength));
                    }
                }
                this.draw();
            }
            onwheel(event) {
                if (nodeMode) {
                    let amount = Math.exp(event.wheelDelta * -settings.zoomSpeed);
                    this.length *= amount;
                    let avg = this.center();
                    for (let n of this.pts) {
                        n.pos = n.pos.minus(avg).scale(amount).plus(avg);
                    }
                    if (this.pts[0] !== undefined) {
                        this.pts[0].updateEdgeData();
                    }
                    cancel(event);
                }
            }
            onmouseover(event) {
                this.mouseIsOver = true;
            }
            onmouseout(event) {
                this.mouseIsOver = false;
            }
            ondblclick(event) {
                if (nodeMode) {
                    this.remove();
                    cancel(event);
                }
            }
            remove() {
                let index = edges.indexOf(this);
                if (index !== -1) {
                    edges.splice(index, 1);
                }
                index = this.pts[0].edges.indexOf(this);
                if (index !== -1) {
                    this.pts[0].edges.splice(index, 1);
                    this.pts[0].updateEdgeData();
                }
                this.html.remove();
            }
        }

        var nodes = [];
        var edges = [];
        var nodeMode_v = 0;
        var nodeMode = 0;



for (let n of htmlnodes) {
    let node = new Node(undefined, n, true);  // Indicate edge creation with `true`
    registernode(node);
}
for (let n of nodes) {
    n.init(nodeMap);
}

function clearnet() {
    while (edges.length > 0) {
        edges[edges.length - 1].remove();
    }
    while (nodes.length > 0) {
        nodes[nodes.length - 1].remove();
    }
}

function loadnet(text, clobber, createEdges = true) {
    if (clobber) {
        clearnet();
    }
    let d = document.createElement("div");
    d.innerHTML = text;
    let newNodes = [];
    for (let n of d.children) {
        let node = new Node(undefined, n, true, undefined, createEdges);
        newNodes.push(node);
        registernode(node);
        if (n.dataset.init === "window")
            rewindowify(node);
    }
    for (let n of newNodes) {
        htmlnodes_parent.appendChild(n.content);
    }
    for (let n of newNodes) {
        n.init(nodeMap); //2 pass for connections
    }
    for (let n of newNodes) {
        // Restore the title
        let titleInput = n.content.querySelector('.title-input');
        if (titleInput) {
            let savedTitle = n.content.getAttribute('data-title');
            if (savedTitle) {
                titleInput.value = savedTitle;
            }
        }
    }
}

        function searchNodesBy(searchTerm) {
            let keywords = searchTerm.toLowerCase().split(' ');
            let matched = [];
            for (let n of nodes) {
                let numMatches = 0;
                for (let keyword of keywords) {
                    if ([...n.searchStrings()].join().toLowerCase().includes(keyword)) {
                        numMatches++;
                    }
                }
                if (numMatches > 0) {
                    n.content.classList.add("search_matched");
                    n.content.classList.remove("search_nomatch");
                    matched.push({
                        node: n,
                        numMatches: numMatches
                    });
                } else {
                    n.content.classList.remove("search_matched");
                    n.content.classList.add("search_nomatch");
                }
            }
            matched.sort((a, b) => b.numMatches - a.numMatches);
            return matched.map(m => m.node);
        }

        function clearSearch() {
            for (let n of nodes) {
                n.content.classList.remove("search_matched");
                n.content.classList.remove("search_nomatch");
            }
        }

        let inp = document.getElementById("Searchbar")
        inp.addEventListener("input", function () {
            let res = document.getElementById("search-results")
            if (inp.value) {
                res.style.display = "block";
                let ns = searchNodesBy(inp.value);
                let resdiv = res.children[0];
                resdiv.innerHTML = "";
                for (let n of ns) {
                    let c = document.createElement("a")
                    c.appendChild(document.createTextNode(n.uuid + ""));
                    c.addEventListener("click", (function (event) {
                        this.zoom_to();
                        autopilotSpeed = settings.autopilotSpeed;
                    }).bind(n));
                    c.addEventListener("dblclick", (function (event) {
                        this.zoom_to();
                        skipAutopilot();
                        autopilotSpeed = settings.autopilotSpeed;
                    }).bind(n));
                    resdiv.appendChild(c);
                }
            } else {
                res.style.display = "none"
                clearSearch();
            }
        });

function connect(na, nb, length = 0.2, linkStrength = 0.1, linkStyle = {
    stroke: "none",
    "stroke-width": "0.005",
    fill: "lightcyan",
    opacity: "0.5"
}) {
    // Check if edge already exists
    if (na.edges.some(edge => edge.pts.includes(nb)) && nb.edges.some(edge => edge.pts.includes(na))) {
        return;
    }

    let edge = new Edge([na, nb], length, linkStrength, linkStyle);

    na.edges.push(edge);
    nb.edges.push(edge);

    edges.push(edge);
    return edge;
}

function connectRandom(n) {
    for (let i = 0; i < n; i++) {
        let a = Math.floor(Math.random() * nodes.length);
        let b = Math.floor(Math.random() * nodes.length);
        // Ensures both nodes have the connection
        connect(nodes[a], nodes[b]);
    }
}

        var gen = iter();

        function frame() {
            gen.next();
            setTimeout(frame, 100);
        }
        const panInput = document.getElementById("pan");
        const zoomInput = document.getElementById("zoom");
        let coordsLive = true;
        const coords = document.getElementById("coordinates");
        panInput.addEventListener("input", (e) => {
            const r = /([+-]?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)\s*,?\s*([+-]?i?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)/;
            const m = panInput.value.match(r);
            coordsLive = false;
            if (m === null) return;
            pan = new vec2(parseFloat(m[0]), parseFloat(m[6].replace(/[iI]/, "")));
        });
        zoomInput.addEventListener("input", (e) => {
            const r = /([+-]?(([0-9]*\.[0-9]*)|([0-9]+))([eE][+-]?[0-9]+)?)/;
            const m = zoomInput.value.match(r);
            coordsLive = false;
            if (m === null) return;
            const z = parseFloat(m);
            if (z !== 0) {
                zoom = zoom.scale(z / zoom.mag());
            }
        });
        for (const k of ["paste", "mousemove", "mousedown", "dblclick", "click"]) {
            panInput.addEventListener(k, (e) => {
                cancel(e);
            })
            zoomInput.addEventListener(k, (e) => {
                cancel(e);
            })
        }
        //frame();
        var mousePathPos;
        var current_time = undefined;
        let regenAmount = 0;
        let regenDebt = 0;
        let avgfps = 0;
        let panToI = new vec2(0, 0);
        let panToI_prev = undefined;

        function nodeStep(time) {
            let autopilot_travelDist = 0;
            let newPan = pan;
            if (autopilotReferenceFrame && autopilotSpeed !== 0) {
                if (panToI_prev === undefined) {
                    panToI_prev = autopilotReferenceFrame.pos.scale(1);
                }
                panToI = panToI.scale(1 - settings.autopilotRF_Iscale).plus(autopilotReferenceFrame.pos.minus(panToI_prev).scale(settings.autopilotRF_Iscale));
                newPan = pan.scale(1 - autopilotSpeed).plus(autopilotReferenceFrame.pos.scale(autopilotSpeed).plus(panToI));
                panToI_prev = autopilotReferenceFrame.pos.scale(1);
            } else {
                newPan = pan.scale(1 - autopilotSpeed).plus(panTo.scale(autopilotSpeed));
                panToI_prev = undefined;
            }
            autopilot_travelDist = pan.minus(newPan).mag() / zoom.mag();
            if (autopilot_travelDist > settings.autopilotMaxSpeed) {
                newPan = pan.plus(newPan.minus(pan).scale(settings.autopilotMaxSpeed / autopilot_travelDist));
                const speedCoeff = Math.tanh(Math.log(settings.autopilotMaxSpeed / autopilot_travelDist + 1e-300) / 10) * 2;
                zoom = zoom.scale(1 - speedCoeff * autopilotSpeed);
                //*Math.log(autopilot_travelDist/settings.autopilotMaxSpeed));
            } else {
                zoom = zoom.scale(1 - autopilotSpeed).plus(zoomTo.scale(autopilotSpeed));
            }
            pan = newPan;
            //zoom = zoom.scale(0.9).plus(zoom_to.scale(0.1));
            //pan = pan.scale(0.9).plus(pan_to.scale(0.1));
            if (coordsLive) {
                panInput.value = pan.ctostring();
                zoomInput.value = zoom.mag() + "";
            }
            //const inpColor = scol(Math.log(zoom.mag()),undefined,64,128);
            //coords.style.color = inpColor;
            updateViewbox();
            if (mousePath == "") {
                mousePathPos = toZ(mousePos);
                mousePath = "M " + toSVG(mousePathPos).str() + " L ";
            }
            for (let i = 0; i < settings.orbitStepRate; i++) {
                //let g = mandGrad(settings.iterations,mousePathPos);
                //mousePathPos = mousePathPos.plus(g.unscale((g.mag()+1e-10)*1000));

                mousePathPos = mand_step(mousePathPos, toZ(mousePos));

                //let p = findPeriod(mousePathPos);
                //mousePathPos = mand_iter_n(p,mousePathPos,mousePathPos);
                if (toSVG(mousePathPos).isFinite() && toSVG(mousePathPos).mag2() < 1e60)
                    mousePath += toSVG(mousePathPos).str() + " ";


            }
            if (nodeMode && prevNode !== undefined) {
                svg_mousePath.setAttribute("d", "M " + toSVG(prevNode.pos).str() + " L " + toSVG(toZ(mousePos)).str());
            } else {
                svg_mousePath.setAttribute("d", mousePath);
            }
            let width = zoom.mag() * 0.0005 * SVGzoom;
            svg_mousePath.setAttribute("stroke-width", width + "");
            if (current_time === undefined) {
                current_time = time;
            }
            let dt = time - current_time;
            current_time = time;
            if (dt > 0) {
                const alpha = Math.exp(-1 * dt / 1000);
                avgfps = avgfps * alpha + (1 - alpha) * 1000 / dt;
            }
            document.getElementById("debug_layer").children[1].textContent = "fps:" + avgfps;
            document.getElementById("fps").textContent = "avg fps:" + Math.round(avgfps * 100) / 100;

            dt *= (1 - nodeMode_v) ** 5;
            for (let n of nodes) {
                n.step(dt);
                let d = toZ(mousePos).minus(n.pos);
                //n.force = n.force.plus(d.unscale(-((d.mag2()**2)*500+1e-5)));
            }
            for (let e of edges) {
                e.step(dt); //line 2703
            }
            regenDebt = Math.min(16, regenDebt + lerp(4, regenAmount, Math.min(1, (nodeMode_v ** 5) * 1.01)));
            for (; regenDebt > 0; regenDebt--) {
                render_hair(Math.random() * settings.renderSteps);
            }
            regenAmount = 0;
            nodeMode_v = lerp(nodeMode_v, nodeMode, 0.125);
            window.requestAnimationFrame(nodeStep); //line 2711
        }
        nodeStep();


        //connectRandom(10);




        addEventListener("resize", (event) => { });


        document.addEventListener('wheel', (event) => {
            // Get the element that the user is scrolling on
            let targetElement = event.target;

            // Check if the target is a textarea and if so, ignore the zoom logic
            if (targetElement.tagName.toLowerCase() === 'textarea') {
                return;
            }
            if (event.getModifierState(settings.rotateModifier)) {
                autopilotSpeed = 0;
                coordsLive = true;
                let amount = event.wheelDelta * settings.rotateModifierSpeed;
                let p = toZ(new vec2(event.pageX, event.pageY));
                let zc = p.minus(pan);
                // p = zoom*center+pan = zoom'*center+pan'
                // zoom' = zoom*rot
                // pan' = pan + (zoom*center-zoom*rot*center)
                //      = pan + (1-rot) * zoom*center
                let r = new vec2(Math.cos(amount), Math.sin(amount));
                zoom = zoom.cmult(r);
                pan = pan.plus(zc.cmult(new vec2(1, 0).minus(r)));
                cancel(event);
                return;
            }
            if (settings.scroll === "zoom") {
                autopilotSpeed = 0;
                coordsLive = true;
                let dest = toZ(mousePos);
                regenAmount += Math.abs(event.wheelDelta);
                let amount = Math.exp(event.wheelDelta * settings.zoomSpeed);
                zoom = zoom.scale(amount);
                pan = dest.scale(1 - amount).plus(pan.scale(amount));
                cancel(event);
            } else if (settings.scroll === "pan") {
                autopilotSpeed = 0;
                coordsLive = true;
                let dest = toZ(mousePos);
                let dp;
                let amount;
                if (event.ctrlKey) {
                    dp = new vec2(0, 0);
                    amount = event.deltaY * settings.zoomSpeed;
                } else {
                    dp = toDZ(new vec2(event.deltaX, event.deltaY).scale(settings.panSpeed));
                    amount = event.deltaZ * settings.zoomSpeed;
                }
                regenAmount += Math.hypot(event.deltaX, event.deltaY, event.deltaZ);
                amount = Math.exp(amount)
                zoom = zoom.scale(amount);
                pan = dest.scale(1 - amount).plus(pan.scale(amount)).plus(dp);
                cancel(event);
                event.preventDefault();
            }
        });
        let mouseDown = false;
        let mouseDownPos = new vec2(0, 0);
        addEventListener("mousedown", (event) => {
            autopilotSpeed = 0;
            mouseDownPos = mousePos.scale(1);
            mouseDown = true;
            cancel(event);
        });
        addEventListener("mouseup", (event) => {
            mouseDown = false;
            if (movingNode !== undefined) {
                movingNode.onmouseup(event);
            }
        });
        addEventListener("mousemove", (event) => {
            if (mouseDown) {
                autopilotSpeed = 0;
                coordsLive = true;
                let delta = mousePos.minus(mouseDownPos);
                pan = pan.minus(toDZ(delta));
                regenAmount += delta.mag() * 0.25;
                mouseDownPos = mousePos.scale(1);
            }
        });
        addEventListener("keydown", (event) => {
            //console.log(event);
            if (event.key === settings.nodeModeKey) {
                if (settings.nodeModeTrigger === "down") {
                    if (settings.nodeModeKey === "CapsLock") {
                        nodeMode = event.getModifierState("CapsLock");
                    } else {
                        nodeMode = 1;
                    }
                } else if (settings.nodeModeTrigger === "toggle") {
                    nodeMode = 1 - nodeMode;
                }
            } else if (event.key === "Escape") {
                for (let n of nodes) {
                    n.followingMouse = 0;
                }
            }
        });

        function adjustTextareaHeight(textarea) {
            textarea.style.height = "";
            textarea.style.height = textarea.scrollHeight + "px";
        }

        let pyodideLoadingPromise = null;
        let pyodide = null;

        async function loadPyodideAndSetup() {
            // Load Pyodide
            let pyodideLoadPromise = loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.0/full/",
            });
            pyodide = await pyodideLoadPromise;

            // Load commonly used packages
            return Promise.all([
                pyodide.loadPackage('numpy'),
                pyodide.loadPackage('pandas'),
                pyodide.loadPackage('matplotlib'),
                pyodide.loadPackage('scipy'),
                pyodide.loadPackage('py'),
                pyodide.loadPackage('sympy'),
                pyodide.loadPackage('networkx'),
            ]);

            console.log('Pyodide and packages loaded');
        }

        async function runPythonCode(code, pythonView) {
            // Display a loading message
            pythonView.innerHTML = "Initializing Pyodide and dependencies...";

            // If Pyodide is not loaded yet, start loading it
            if (!pyodide) {
                if (!pyodideLoadingPromise) {
                    pyodideLoadingPromise = loadPyodideAndSetup();
                }
                await pyodideLoadingPromise;
            }

            try {
                // Clear the pythonView
                pythonView.innerHTML = "";

                // Run the code and get the result
                let result = pyodide.runPython(code);

                // Create a new div for the result
                let resultDiv = document.createElement("div");

                // Append the output to the new div
                resultDiv.innerHTML = result || '';

                // Append the new div to the pythonView
                pythonView.appendChild(resultDiv);

                // Return the resultDiv's innerHTML
                return resultDiv.innerHTML;
            } catch (error) {
                // If an error occurred, return the error message
                return error.message;
            }
        }

        function observeParentResize(parentDiv, iframe, paddingWidth = 50, paddingHeight = 80) {
            const resizeObserver = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    const {
                        width,
                        height
                    } = entry.contentRect;
                    iframe.style.width = Math.max(0, width - paddingWidth) + "px";
                    iframe.style.height = Math.max(0, height - paddingHeight) + "px";
                }
            });

            resizeObserver.observe(parentDiv);
            return resizeObserver;
        }
        
        function createTextNode(name = '', text = '', sx = undefined, sy = undefined, x = undefined, y = undefined) {
            let t = document.createElement("input");
            t.setAttribute("type", "text");
            t.setAttribute("value", "untitled");
            t.setAttribute("style", "background:none; ");
            t.classList.add("title-input");

            let n = document.createElement("textarea");
            n.classList.add('custom-scrollbar');
            n.onmousedown = cancel;
            n.setAttribute("type", "text");
            n.setAttribute("size", "11");
            n.setAttribute("style", "background-color: #222226; color: #bbb; overflow-y: scroll; resize: both; width: 218px;");

            let elements = [n];
            if (document.getElementById('code-checkbox') && document.getElementById('code-checkbox').checked) {
                let checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = "customCheckbox"; // Add an id for reference

                let label = document.createElement("label");
                label.htmlFor = "customCheckbox"; // Bind label to the checkbox
                checkbox.onchange = async function () {
                    if (this.checked) {
                        n.style.display = "none";
                        let re = /```(.*?)\n([\s\S]*?)```/gs;
                        let codeBlocks = n.value.matchAll(re);

                        for (let block of codeBlocks) {
                            let language = block[1].trim();
                            let code = block[2];

                            if (language === 'python') {
                                if (!n.pythonView) {
                                    n.pythonView = document.createElement("div");
                                    n.parentNode.insertBefore(n.pythonView, n.nextSibling);
                                }
                                n.pythonView.style.display = "block";
                                console.log('Running Python code...');
                                let result = await runPythonCode(code, n.pythonView);
                                console.log('Python code executed, result:', result);
                            } else if (language === 'html' || language === '') {
                                // Remove the old iframe if it exists
                                if (n.htmlView) {
                                    n.htmlView.remove();
                                }
                                // Always create a new iframe
                                n.htmlView = document.createElement("iframe");
                                n.htmlView.style.border = "none";
                                n.htmlView.style.boxSizing = "border-box";

                                // Prevent event bubbling
                                n.htmlView.onmousedown = function (event) {
                                    event.stopPropagation();
                                };

                                // Insert the iframe into the DOM
                                n.parentNode.insertBefore(n.htmlView, n.nextSibling);

                                n.htmlView.srcdoc = code;

                                let windowDiv = n.htmlView.parentNode;
                                while (windowDiv && (!windowDiv.win || !windowDiv.classList.contains('window'))) {
                                    windowDiv = windowDiv.parentNode;
                                }
                                if (windowDiv) {
                                    observeParentResize(windowDiv, n.htmlView);
                                }
                            }
                        }
                    } else {
                        n.style.display = "block";
                        if (n.htmlView) {
                            n.htmlView.style.display = "none";
                            n.htmlView.srcdoc = "";
                        }
                    }
                };
                elements.push(checkbox, label);
            }
            let node = addNodeAtNaturalScale(name, elements);

            let max_height = 300; // Set maximum height in pixels

            // Add a flag to the node to track resizing
            node.isResizing = false;

            // Add a mousedown event listener to track user interactions with the resize handle
            n.addEventListener('mousedown', (e) => {
                node.isResizing = true;
            });

            // Add a mouseup event listener to re-enable auto-height adjustment
            n.addEventListener('mouseup', (e) => {
                node.isResizing = false;
            });

            // Function to adjust the height and handle overflow of the textarea
            const adjustHeight = (element) => {
                if (!node.isResizing) {
                    if (element.scrollHeight > max_height) {
                        if (element.clientHeight < max_height) {
                            element.style.height = max_height + 'px';
                            element.style.overflowY = 'auto';
                        }
                    } else {
                        element.style.height = 'auto'; // Reset the height
                        element.style.height = element.scrollHeight + 'px'; // Set to scrollHeight
                    }
                }
            };

            // Function to auto-scroll to the bottom if user is already at the bottom
            const autoScrollToBottom = (element) => {
                if (element.scrollTop + element.clientHeight >= element.scrollHeight - 5) {
                    // Using scrollIntoView to smoothly scroll to the bottom
                    element.scrollIntoView(false);
                }
            };

            // Modify the oninput function to check the isResizing flag and max height
            n.oninput = function () {
                adjustHeight(this);
            };

            // Add the observer to the node
            node.observer = new ResizeObserver(() => {
                adjustHeight(n);
            });

            // Start observing the textarea element
            node.observer.observe(n);

            // Track the previous scrollHeight
            let prevScrollHeight = n.scrollHeight;

            // Use a MutationObserver to watch for changes to the textarea's value
            const mutationObserver = new MutationObserver(() => {
                if (n.scrollHeight !== prevScrollHeight) {
                    adjustHeight(n);
                    autoScrollToBottom(n);
                    prevScrollHeight = n.scrollHeight;
                }
            });

            mutationObserver.observe(n, {
                childList: true,
                subtree: true,
                characterData: true
            });

            if (sx !== undefined) {
                x = (new vec2(sx, sy)).cmult(zoom).plus(pan);
                y = x.y;
                x = x.x;
            }

            if (x !== undefined) {
                node.pos.x = x;
            }

            if (y !== undefined) {
                node.pos.y = y;
            }

            node.push_extra_cb((node) => {
                return {
                    f: "textarea",
                    a: {
                        p: [0, 0, 1],
                        v: t.value
                    }
                };
            })

            node.push_extra_cb((node) => {
                return {
                    f: "textarea",
                    a: {
                        p: [0, 1, 0],
                        v: n.value
                    }
                };
            })

            return node;
        }


        addEventListener("dblclick", (event) => {
            if (nodeMode) {
                if (prevNode) {
                    prevNode = undefined;
                } else {
                    //addNodeAtNaturalScale()
                    //let n = document.createElementNS("http://www.w3.org/2000/svg","svg");
                    //n.addChild(
                    //<svg width="20" height="20"><circle cx="10" cy="10" r="10" fill="blue"/></svg>
                    createTextNode();
                }
            }
            cancel(event);
        });

        let touches = new Map();

        addEventListener("touchstart", (ev) => {
            //pan = pan.plus(new vec2(0,1))
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const touch = ev.changedTouches.item(i);
                touches.set(touch.identifier, {
                    prev: touch,
                    now: touch
                });
            }
        }, false);
        addEventListener("touchcancel", (ev) => {
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const touch = ev.changedTouches.item(i);
                touches.delete(touch.identifier);
            }
        }, false);
        addEventListener("touchend", (ev) => {
            //pan = pan.plus(new vec2(0,-1))
            switch (touches.size) {
                case 2: //tap to zoom
                    if (ev.changedTouches.length == 1) {
                        const id = ev.changedTouches.item(0).identifier;
                        const t = touches.get(id);
                        if (t && t.prev == t.now) { //hasn't moved
                            const ts = [...touches.keys()];
                            const other = touches.get(ts[0] === id ? ts[1] : ts[0])
                            const {
                                s,
                                o
                            } = windowScaleAndOffset();
                            const amount = Math.exp(-(other.now.clientY - t.now.clientY) / s);
                            const dest = toZ(new vec2(other.now.clientX, other.now.clientY));
                            zoom = zoom.scale(amount);
                            pan = dest.scale(1 - amount).plus(pan.scale(amount));
                        }
                    }
                    break;

            }
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const touch = ev.changedTouches.item(i);
                touches.delete(touch.identifier);
            }
        }, false);
        addEventListener("touchmove", (ev) => {
            for (let i = 0; i < ev.changedTouches.length; i++) {
                const touch = ev.changedTouches.item(i);
                touches.set(touch.identifier, {
                    prev: touches.get(touch.identifier)?.now,
                    now: touch
                });
            }
            switch (touches.size) {
                case 1:
                    autopilotSpeed = 0;
                    coordsLive = true;
                    const t = [...touches.values()][0];
                    pan = pan.plus(toDZ(new vec2(t.prev.clientX, t.prev.clientY).minus(new vec2(t.now.clientX, t.now.clientY))));
                    cancel(ev);
                    break;
                case 2:
                /*
                const pts = [...touches.values()];
                const p1p = toS(new vec2(pts[0].prev.clientX,pts[0].prev.clientY));
                const p2p = toS(new vec2(pts[1].prev.clientX,pts[1].prev.clientY));
                const p1n = toS(new vec2(pts[0].now.clientX,pts[0].now.clientY));
                const p2n = toS(new vec2(pts[1].now.clientX,pts[1].now.clientY));
                //want to find new zoom,pan such that
                // old toZ(p1p) = new toZ(p1n)
                // old toZ(p2p) = new toZ(p2n)
                //
                //  toZ(x) ≈ x*zoom + pan
                //
                // so, we want zoom' pan' s.t.
                //  p1p*zoom + pan = p1n*zoom' + pan'
                //  p2p*zoom + pan = p2n*zoom' + pan'
                //
                //  (p2p-p1p) * zoom = (p2n-p1n) * zoom'
                //  (p1p+p2p)*zoom + 2pan = (p1p+p2p)*zoom' + 2pan'
                //
                //  zoom' = zoom * (p2p-p1p)/(p2n-p1n)
                //  pan' = pan + (p1p+p2p)*zoom/2 - (p1p+p2p)*zoom'/2
                //       = pan + (p1p+p2p)*(zoom - zoom')/2
                const nzoom = zoom.cmult( p2p.minus(p1p).cdiv( p2n.minus(p1n)));
                pan = pan.plus(p2p.plus(p1p).cmult(zoom.minus(nzoom)).scale(0.5));
                zoom = nzoom;


                ev.preventDefault();
                cancel(ev);
                break;
                */
                default:
                    break;
            }


        }, false);




        var gestureStartParams = {
            rotation: 0,
            x: 0,
            y: 0,
            scale: 0,
            zoom: new vec2(),
            pan: new vec2()
        };
        addEventListener("gesturestart", (e) => {
            e.preventDefault();
            //console.log(e);
            gestureStartParams.rotation = e.rotation;
            gestureStartParams.scale = e.scale;
            gestureStartParams.x = e.pageX;
            gestureStartParams.y = e.pageY;
            gestureStartParams.zoom = zoom;
            gestureStartParams.pan = pan;

        });
        addEventListener("gesturechange", (e) => {
            e.preventDefault();
            //console.log(e);
            let d_theta = e.rotation - gestureStartParams.rotation;
            let d_scale = e.scale;
            let r = -e.rotation * settings.gestureRotateSpeed;
            pan = gestureStartParams.pan;
            zoom = gestureStartParams.zoom;
            let r_center = toZ(new vec2(e.pageX, e.pageY));
            let s = 0;
            zoom = gestureStartParams.zoom.cmult(new vec2(Math.cos(r), Math.sin(r)));
            if (e.scale !== 0) {
                let s = 1 / e.scale;
                zoom = zoom.scale(s);
                regenAmount += Math.abs(Math.log(s)) * settings.maxLines;
            }
            let dest = r_center;
            let amount = s;
            let dp = r_center.minus(gestureStartParams.pan);
            pan = gestureStartParams.pan.plus(
                dp.minus(dp.cmult(zoom.cdiv(gestureStartParams.zoom))));
            //pan = dest.scale(1-amount).plus(gestureStartParams.pan.scale(amount));

        });
        addEventListener("gestureend", (e) => {
            e.preventDefault();
        });


        addEventListener("keyup", (event) => {
            //console.log(event);
            if (event.key === settings.nodeModeKey) {
                if (settings.nodeModeTrigger === "down") {
                    nodeMode = 0;
                    cancel(event);
                }
            }
        });




        //todo sshift click for node mode (Attach nodes to eachother)
        //todo patches for zoom in

        function random_screen_pt_z() {
            let svgbb = svg.getBoundingClientRect();
            return toZ(new vec2(Math.random() * svgbb.width, Math.random() * svgbb.height));
        }



        function render_hair(n) { //todo make faster.
            let iters = settings.iterations;
            let maxLines = settings.maxLines;
            let tries = 1;
            let pt;
            do {
                pt = random_screen_pt_z();
                for (let i = (1 - Math.random() ** 2) * (tries * 4); i > 1; i--) {
                    let gz = mandGrad(iters, pt)
                    pt = pt.plus(gz.unscale(gz.mag2() * 10 + 1));
                    //if (mand_i(pt,iters) > iters){
                    //    pt = (new vec2(Math.random()*2-1,Math.random()*2-1)).cmult(zoom).cadd(pan);
                    //}
                }
                tries--;
            } while (tries > 0 && mand_i(pt, iters) > iters)
            /*if (mand_i(pt,iters) > iters || pt.mag2()>8){
                return;
            }*/

            //let level = mandelbrott_dist(256,pt);
            //let width = 1/(level+5)**2;
            //let width = 1/(mandGrad(256,pt).mag()**1.5+1);


            let r = "M " + toSVG(pt).str() + " " + settings.renderDChar + " ";
            let length = 0;
            let n0 = n;
            let opt = pt;
            let na = 0;
            let opacity = settings.outerOpacity;

            if (mand_i(pt, iters) > iters) {
                //interior coloring
                /*let p = findPeriod(pt,pt,1e-12,iters);
                for (; n > 0; n--){
                    let npt = mand_iter_n(p,pt,pt);
                    let delta = npt.minus(pt);
                    delta = delta.cpow(new vec2(0.5,0));
                    npt = pt.plus(delta.scale(0.1));
                    if (mand_i(npt,iters)<=iters){
                        break;
                    }
                    r += toSVG(npt).str()+" ";
                    length += npt.minus(pt).mag();
                    pt = npt;
                }*/
                let p = findInfimum(iters, pt);
                for (; n > 0; n--) {
                    let delta = gradzr(((z) => (mand_iter_n(p.i, z, z).mag2())), pt, 1e-5);
                    delta = delta.unscale(delta.mag() + 1e-300).scale(zoom.mag() * .1);
                    //debugger
                    npt = pt.plus(delta.scale(-settings.renderStepSize));
                    if (mand_i(npt, iters) <= iters) {
                        break;
                    }
                    if (!toSVG(npt).isFinite()) break;
                    r += toSVG(npt).str() + " ";
                    na += 1;
                    length += npt.minus(pt).mag();
                    pt = npt;
                }
                opacity = settings.innerOpacity / 10;

                length /= 4;
            } else {
                if (mandelbrott_dist(iters, pt) < settings.maxDist) return;
                for (let p of trace_circle(iters, pt, Math.random() > 0.5 ? settings.renderStepSize : -settings.renderStepSize)) {
                    //console.log(p);
                    //if ((n&3) == 0)
                    if (!toSVG(p).isFinite()) break;
                    r += toSVG(p).str() + " ";
                    na += 1;
                    n -= 1;
                    if (n < 0) {
                        break;
                    }
                    length += p.minus(pt).mag();
                    pt = p;
                }
                color = scol(mandelbrott_dist(iters, pt));
            }
            if (na === 0) return;
            let width = Math.min(settings.renderWidthMult * length / n0, 0.1);
            let pathn = document.createElementNS("http://www.w3.org/2000/svg", "path");
            pathn.setAttribute("fill", "none");
            pathn.setAttribute("stroke", mcol(iters, opt));
            pathn.setAttribute("stroke-width", "" + width * SVGzoom);
            pathn.setAttribute("stroke-opacity", "" + opacity);
            pathn.setAttribute("d", r);
            svg_bg.appendChild(pathn);
            if (svg_bg.children.length > maxLines) {
                svg_bg.removeChild(svg_bg.children[0]);
            }
        }




        function dropHandler(ev) {
            console.log(ev);

            ev.preventDefault();
            let files = [];
            if (ev.dataTransfer.items) {
                // Use DataTransferItemList interface to access the file(s)
                [...ev.dataTransfer.items].forEach((item, i) => {
                    // If dropped items aren't files, reject them
                    if (item.kind === 'file') {
                        const file = item.getAsFile();
                        files.push(file);
                        console.log(`… file[${i}].name = ${file.name}`);
                    }
                });
            } else {
                // Use DataTransfer interface to access the file(s)
                [...ev.dataTransfer.files].forEach((file, i) => {
                    files.push(file)
                    console.log(`… file[${i}].name = ${file.name}`);
                });
            }
            console.log(files);
            //https://stackoverflow.com/questions/3814231/loading-an-image-to-a-img-from-input-file
            if (FileReader && files && files.length) {
                for (let i = 0; i < files.length; i++) {

                    let reader = new FileReader();

                    let baseType;
                    if (files[i].type) {
                        baseType = files[i].type.split("/")[0];
                    } else if (files[i].name.toLowerCase().endsWith(".txt")) {
                        baseType = "text";
                    } else if (files[i].name.toLowerCase().endsWith(".md")) {
                        baseType = "markdown";
                    } else {
                        console.log("Unhandled file type:", files[i]);
                        baseType = "unknown";
                    }

                    let url = URL.createObjectURL(files[i]);
                    let img;
                    let content = [];

                    let add = function (scale) {
                        let node = windowify(files[i].name, content, toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), scale);
                        /*node.push_extra_cb((node) => { //superceeded by new rewindowify (todo)
                          return {
                            f: "textarea",
                            a: {
                              p: [0, 1],
                              v: files[i].name.value
                            }
                          };
                        })*/
                        htmlnodes_parent.appendChild(node.content);
                        registernode(node);
                        node.followingMouse = 1;
                        node.draw();
                        node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
                    }
                    console.log("loading " + baseType);
                    switch (baseType) {
                        case "image":
                            img = document.createElement('img');
                            img.ondragstart = (e) => false;
                            content = [
                                img
                            ];
                            img.style = "display: block";
                            img.onload = function () {
                                let s = 512 / Math.hypot(img.naturalWidth, img.naturalHeight);
                                //img.style.transform = "scale("+s+","+s+")";
                                img.width = img.naturalWidth * s;
                                img.height = img.naturalHeight * s;
                                add(1);
                                URL.revokeObjectURL(img.src);
                            }
                            img.src = url;
                            break;
                        case "audio":
                            img = new Audio();
                            img.setAttribute("controls", "");
                            //let c = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                            //c.setAttribute("viewBox","0 0 128 64");
                            //let name = document.createElementNS("http://www.w3.org/2000/svg","text");
                            //name.setAttribute("x","0");name.setAttribute("y","0");
                            //name.appendChild(document.createTextNode(files[i].name));
                            //c.appendChild(name);
                            img.style = "display: block";
                            content = [
                                img
                            ];
                            add(1);
                            //div.appendChild(c);
                            img.src = url;
                            break;
                        case "video":
                            img = document.createElement('video');
                            img.style = "display: block";
                            img.setAttribute("controls", "");
                            content = [
                                img
                            ];
                            add(1);
                            img.src = url;
                            break;
                        case "text":
                            reader.onload = function (e) {
                                let text = e.target.result;
                                let node = createTextNode(files[i].name, '');
                                node.content.children[0].children[1].children[0].value = text; // set the content of the textarea
                                htmlnodes_parent.appendChild(node.content);
                            }
                            reader.readAsText(files[i]);
                            break;
                        case "markdown":
                            let mdReader = new FileReader();
                            mdReader.onload = function (e) {
                                let mdText = e.target.result;
                                let htmlContent = marked.parse(mdText, { mangle: false, headerIds: false });
                                let node = createTextNode(files[i].name, '');

                                let htmlContainer = document.createElement('div');
                                htmlContainer.innerHTML = htmlContent;
                                htmlContainer.style.maxWidth = '100%';
                                htmlContainer.style.overflow = 'auto';
                                htmlContainer.style.height = 'fit-content';
                                htmlContainer.style.backgroundColor = '#222226'; // Set background color

                                // Check if there is a textarea being appended, if there is remove it.
                                if (node.content.children[0].children[1].getElementsByTagName('textarea').length > 0) {
                                    node.content.children[0].children[1].removeChild(node.content.children[0].children[1].getElementsByTagName('textarea')[0]);
                                }

                                node.content.children[0].children[1].appendChild(htmlContainer);
                                htmlnodes_parent.appendChild(node.content);
                            }
                            mdReader.readAsText(files[i]);
                            break;
                    }
                }
            }

            // Not supported
            else {
                // fallback -- perhaps submit the input to an iframe and temporarily store
                // them on the server until the user's session ends.
                console.log("FileReader not supported or no files");
            }
        }


        function registernode(node) {
            let id = nodes.length;
            let div = node.content;
            /*div.setAttribute("onclick","(e)=>nodes["+id+"].onclick(e)");
            div.setAttribute("onmousedown","(e)=>nodes["+id+"].onmousedown(e)");
            div.setAttribute("onmouseup","(e)=>nodes["+id+"].onmouseup(e)");
            div.setAttribute("onmousemove","(e)=>nodes["+id+"].onmousemove(e)");*/
            nodes.push(node);
            nodeMap[node.uuid] = node;
        }

        function dragOverHandler(ev) {
            ev.preventDefault();
        }

        function nodemousedown(id) {
            if (id < nodes.length) {
                nodes[id].mousedown();
            }
        }

        function nodemouseup(id) {
            if (id < nodes.length) {
                nodes[id].mouseup();
            }
        }

        function nodemousemove(id) {
            if (id < nodes.length) {
                nodes[id].mousemove();
            }
        }

        function nodeclick(id) {
            if (id < nodes.length) {
                nodes[id].mouseclick();
            }
        }


        function cancel(event) {
            if (event.stopPropagation) {
                event.stopPropagation(); // W3C model
            } else {
                event.cancelBubble = true; // IE model
            }
        }

        function addNodeAtNaturalScale(title, content, scale = 1, nscale_mult = 1, window_it = true) {
            let node;
            if (window_it) {
                let pos = toZ(mousePos)
                if (!Array.isArray(content)) {
                    content = [content];
                }
                node = windowify(title, content, pos, nscale_mult * (zoom.mag2() ** settings.zoomContentExp), scale);
                htmlnodes_parent.appendChild(node.content);
            } else {
                let div = document.createElement('div');
                node = new Node(toZ(mousePos), div, nscale_mult * (zoom.mag2() ** settings.zoomContentExp), scale);
                div.appendChild(content);
                htmlnodes_parent.appendChild(div);
            }
            registernode(node)
            return node;
        }


        addEventListener("paste", (event) => {
            console.log(event);
            let cd = (event.clipboardData || window.clipboardData);
            let content = document.createElement("div");
            content.innerHTML = cd.getData("text");
            let t = document.createElement("input");
            t.setAttribute("type", "text");
            t.setAttribute("value", "untitled");
            t.setAttribute("style", " background:none;");
            t.classList.add("title-input");
            let node = windowify("untitled", [content], toZ(mousePos), (zoom.mag2() ** settings.zoomContentExp), 1);
            htmlnodes_parent.appendChild(node.content);
            registernode(node);
            node.followingMouse = 1;
            node.draw();
            node.mouseAnchor = toDZ(new vec2(0, -node.content.offsetHeight / 2 + 6));
        });

        addEventListener("paste", (event) => {
            if (event.target.tagName.toLowerCase() === "textarea") {
                event.stopPropagation();
                console.log("Paste disabled for textarea");
            }
        }, true);

        function gcd(a, b) {
            if (b === 0) {
                return a;
            }
            return gcd(b, a % b);
        }

        function findPeriod(c, z = new vec2(0, 0), epsilon2 = 1e-7, maxiters = 256) {
            let zf = mand_step(z, c);
            let i = 1;
            let p = 0;
            for (; i < maxiters; i++) {
                if (zf.minus(z).mag2() <= epsilon2) {
                    p = i;
                    break
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

        function mand_iter_n(n, c, z = new vec2(0, 0)) {
            for (let i = 0; i < n; i++) {
                z = mand_step(z, c);
            }
            return z;
        }

        function findInfimum(iters, z, c = undefined) {
            if (c === undefined) {
                c = z;
            }
            let besti = 0;
            let bestz = z;
            let bestd = z.mag2();
            for (let i = 1; i <= iters; i++) {
                z = mand_step(z, c);
                let d = z.mag2();
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