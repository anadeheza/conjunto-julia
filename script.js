'use strict';

const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

if (!gl) {
    canvas.insertAdjacentHTML('afterend', '<p style="color:#ef9f27;padding:2rem">Your browser does not support WebGL.</p>');
    throw new Error('No WebGL');
}

const vs = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const fs = `
    precision highp float;
    uniform vec2  u_res;
    uniform vec2  u_center;
    uniform float u_zoom;
    uniform int   u_maxIter;

    vec3 palette(float t) {
        if (t < 0.25) { float s = t/0.25; return vec3(s, 0.0, 0.0); }
        if (t < 0.50) { float s = (t-0.25)/0.25; return vec3(1.0, s*0.5, 0.0); }
        if (t < 0.75) { float s = (t-0.50)/0.25; return vec3(1.0, 0.5+s*0.5, 0.0); }
        float s = (t-0.75)/0.25; return vec3(1.0, 1.0, s);
    }

    void main() {
        vec2 c = (gl_FragCoord.xy - u_res * 0.5) / u_zoom + u_center;
        vec2 z = vec2(0.0);
        float escaped_at = -1.0;
        float mod2 = 0.0;

        for (int i = 0; i < 2048; i++) {
            if (i >= u_maxIter) break;
            z = vec2(z.x*z.x - z.y*z.y + c.x, 2.0*z.x*z.y + c.y);
            mod2 = z.x*z.x + z.y*z.y;
            if (mod2 > 4.0) { escaped_at = float(i); break; }
        }

        if (escaped_at < 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

        // Clamp mod2 to >= 1.0 before log so log2(log2(...)) never goes negative,
        // which would make smooth_i exceed u_maxIter and produce white/black artifacts.
        float smooth_i = escaped_at + 1.0 - log2(log2(max(sqrt(mod2), 1.0)));
        smooth_i = max(0.0, smooth_i);
        float t = fract(smooth_i / float(u_maxIter) * 8.0);
        gl_FragColor = vec4(palette(t), 1.0);
    }
`;

function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(prog);
gl.useProgram(prog);
gl.clearColor(0.05, 0.05, 0.06, 1.0);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, 'a_pos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const uRes    = gl.getUniformLocation(prog, 'u_res');
const uCenter = gl.getUniformLocation(prog, 'u_center');
const uZoom   = gl.getUniformLocation(prog, 'u_zoom');
const uMI     = gl.getUniformLocation(prog, 'u_maxIter');

let cx = -0.5, cy = 0, zoom = 200, maxIter = 512;

function syncSize() {
    const w = canvas.clientWidth | 0;
    const h = canvas.clientHeight | 0;
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
    }
}

function baseZoom() { return canvas.height / 4.0; }

function fmtZoom(z) {
    if (z >= 1e9) return z.toExponential(2) + '×';
    if (z >= 1e6) return (z / 1e6).toFixed(2) + 'M×';
    if (z >= 1000) return (z / 1000).toFixed(2) + 'k×';
    return z.toFixed(2) + '×';
}

function updateUI() {
    document.getElementById('inf-cx').textContent = cx.toFixed(7);
    document.getElementById('inf-cy').textContent = cy.toFixed(7);
    const userZoom = zoom / baseZoom();
    const zStr = fmtZoom(userZoom);
    document.getElementById('inf-zoom').textContent = zStr;
    document.getElementById('zoomv').textContent = zStr;
    const pos = Math.log10(Math.max(1, userZoom)) / 9 * 300;
    document.getElementById('zoom-slider').value = Math.min(300, Math.max(0, pos));
}

function draw() {
    syncSize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uCenter, cx, cy);
    gl.uniform1f(uZoom, zoom);
    gl.uniform1i(uMI, maxIter);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    updateUI();
}

function goTo(re, im, scale) {
    cx = re;
    cy = im;
    zoom = baseZoom() * scale;
    draw();
}

function zoomAt(px, py, factor) {
    const wx = (px - canvas.width  / 2) / zoom + cx;
    const wy = (canvas.height / 2 - py) / zoom + cy;
    zoom *= factor;
    cx = wx - (px - canvas.width  / 2) / zoom;
    cy = wy + (py - canvas.height / 2) / zoom;
    draw();
}

document.getElementById('mi').oninput = e => {
    maxIter = parseInt(e.target.value);
    document.getElementById('miv').textContent = maxIter;
    draw();
};

document.getElementById('zoom-slider').oninput = e => {
    zoom = baseZoom() * Math.pow(10, parseFloat(e.target.value) / 300 * 9);
    draw();
};

let drag = false, lastX = 0, lastY = 0;

canvas.addEventListener('mousedown', e => { drag = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('mouseup', () => { drag = false; });
window.addEventListener('mousemove', e => {
    if (!drag) return;
    cx -= (e.clientX - lastX) / zoom;
    cy += (e.clientY - lastY) / zoom;
    lastX = e.clientX;
    lastY = e.clientY;
    draw();
});

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.25 : 1 / 1.25);
}, { passive: false });

let initDist = null, initZoom = null, pinchMidWorld = null;

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) { drag = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }
    if (e.touches.length === 2) {
        drag = false;
        const rect = canvas.getBoundingClientRect();
        const t0 = e.touches[0], t1 = e.touches[1];
        initDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        initZoom = zoom;
        const midPx = (t0.clientX + t1.clientX) / 2 - rect.left;
        const midPy = (t0.clientY + t1.clientY) / 2 - rect.top;
        pinchMidWorld = {
            wx: (midPx - canvas.width  / 2) / zoom + cx,
            wy: (canvas.height / 2 - midPy) / zoom + cy
        };
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && drag) {
        cx -= (e.touches[0].clientX - lastX) / zoom;
        cy += (e.touches[0].clientY - lastY) / zoom;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        draw();
    }
    if (e.touches.length === 2 && initDist) {
        const rect = canvas.getBoundingClientRect();
        const t0 = e.touches[0], t1 = e.touches[1];
        const d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        zoom = initZoom * (d / initDist);
        const midPx = (t0.clientX + t1.clientX) / 2 - rect.left;
        const midPy = (t0.clientY + t1.clientY) / 2 - rect.top;
        cx = pinchMidWorld.wx - (midPx - canvas.width  / 2) / zoom;
        cy = pinchMidWorld.wy + (midPy - canvas.height / 2) / zoom;
        draw();
    }
}, { passive: false });

canvas.addEventListener('touchend', () => { drag = false; initDist = null; });

window.addEventListener('resize', draw);

requestAnimationFrame(() => {
    syncSize();
    zoom = baseZoom();
    draw();
});