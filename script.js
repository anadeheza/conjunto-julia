const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
 
if (!gl) {
  canvas.insertAdjacentHTML('afterend', '<p style="color:#ef9f27;padding:2rem">Tu navegador no soporta WebGL.</p>');
}
 
const vs = `
    attribute vec2 a_pos;
    void main(){ 
        gl_Position = vec4(a_pos, 0.0, 1.0); 
    }
`;
 
const fs = `
    precision highp float;
    uniform vec2 u_res;
    uniform vec2 u_center;
    uniform float u_zoom;
    uniform vec2 u_c;
    uniform int u_maxIter;
    
    vec3 palette(float t) {
        if (t < 0.25) { 
            float s = t / 0.25; 
            return vec3(s, 0.0, 0.0); 
        }
        if (t < 0.50) { 
            float s = (t - 0.25) / 0.25; 
            return vec3(1.0, s * 0.5, 0.0); 
        }
        if (t < 0.75) { 
            float s = (t - 0.50) / 0.25; 
            return vec3(1.0, 0.5 + s * 0.5, 0.0); 
        }
            
        float s = (t - 0.75) / 0.25; 
        return vec3(1.0, 1.0, s);
    }
    
    void main() {
        vec2 uv = (gl_FragCoord.xy - u_res * 0.5) / (u_res.y * 0.5 * u_zoom) + u_center;
        vec2 z = uv;
        int iter = u_maxIter;
        for (int i = 0; i < 1024; i++) {
            if (i >= u_maxIter) break;
            float zr2 = z.x * z.x;
            float zi2 = z.y * z.y;
            if (zr2 + zi2 > 4.0) { 
                iter = i; 
                break; 
            }
            z = vec2(zr2 - zi2 + u_c.x, 2.0 * z.x * z.y + u_c.y);
        }

        if (iter == u_maxIter) { 
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); 
            return; 
        }

        float t = float(iter) / float(u_maxIter);
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
 
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, 'a_pos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
 
const uRes    = gl.getUniformLocation(prog, 'u_res');
const uCenter = gl.getUniformLocation(prog, 'u_center');
const uZoom   = gl.getUniformLocation(prog, 'u_zoom');
const uC      = gl.getUniformLocation(prog, 'u_c');
const uMI     = gl.getUniformLocation(prog, 'u_maxIter');
 
let cx = 0, cy = 0, zoom = 1;
let cr = -0.7, ci2 = 0.27015, maxIter = 256;
 
function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
    }
}
 
// Convert between zoom value and slider position (exponential scale)
// slider 0..200 -> zoom 1..~22026
function zoomToSlider(z) { return Math.log(z) / Math.log(Math.E) * 200 / Math.log(Math.E * Math.E * 50); }
function sliderToZoom(s) { return Math.exp(s / 200 * Math.log(Math.E * Math.E * 50) / Math.log(Math.E)); }

function updateInfo() {
    document.getElementById('inf-cx').textContent   = cx.toFixed(4);
    document.getElementById('inf-cy').textContent   = cy.toFixed(4);
    document.getElementById('inf-zoom').textContent = zoom.toFixed(2) + '×';
    const im = ci2 >= 0 ? '+' + ci2.toFixed(3) : ci2.toFixed(3);
    document.getElementById('inf-c').textContent    = cr.toFixed(3) + im + 'i';

    // Sync zoom slider without triggering its event
    const slider = document.getElementById('zoom-slider');
    const pos = Math.round(Math.log(zoom) / Math.log(10000) * 200);
    slider.value = Math.max(0, Math.min(200, pos));
    document.getElementById('zoomv').textContent = zoom >= 1000
        ? zoom.toExponential(1) + '×'
        : zoom.toFixed(2) + '×';
}
 
function draw() {
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uCenter, cx, cy);
    gl.uniform1f(uZoom, zoom);
    gl.uniform2f(uC, cr, ci2);
    gl.uniform1i(uMI, maxIter);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    updateInfo();
}
 
function resetView() { 
    cx = 0; 
    cy = 0; 
    zoom = 1; 
    draw(); 
}
 
function setPreset(r, i, name) {
    cr = r; 
    ci2 = i;
    document.getElementById('cr').value = r;
    document.getElementById('ci').value = i;
    document.getElementById('crv').textContent = r.toFixed(3);
    document.getElementById('civ').textContent = i.toFixed(3);
    resetView();
}
 
document.getElementById('cr').oninput = e => {
    cr = parseFloat(e.target.value);
    document.getElementById('crv').textContent = cr.toFixed(3);
    draw();
};
document.getElementById('ci').oninput = e => {
    ci2 = parseFloat(e.target.value);
    document.getElementById('civ').textContent = ci2.toFixed(3);
    draw();
};
document.getElementById('mi').oninput = e => {
    maxIter = parseInt(e.target.value);
    document.getElementById('miv').textContent = maxIter;
    draw();
};
 
let drag = false, lastX = 0, lastY = 0;
canvas.addEventListener('mousedown', e => { 
    drag = true; 
    lastX = e.clientX; 
    lastY = e.clientY; 
});

window.addEventListener('mouseup', () => drag = false);

window.addEventListener('mousemove', e => {
    if (!drag) return;
    const scale = 3.0 / (canvas.height * zoom);
    cx -= (e.clientX - lastX) * scale;
    cy += (e.clientY - lastY) * scale;
    lastX = e.clientX; lastY = e.clientY;
    draw();
});

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - rect.width/2)  / (rect.height * 0.5 * zoom);
    const my = (e.clientY - rect.top  - rect.height/2) / (rect.height * 0.5 * zoom);
    const f = e.deltaY < 0 ? 1.25 : 1 / 1.25;
    cx += mx * (1 - f);
    cy -= my * (1 - f);
    zoom *= f;
    draw();
}, { passive: false });
 

let pt1 = null, pt2 = null, initDist = null, initZoom = null;
canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) { 
        drag = true; 
        lastX = e.touches[0].clientX; 
        lastY = e.touches[0].clientY; 
    }

    if (e.touches.length === 2) {
        drag = false;
        pt1 = e.touches[0]; pt2 = e.touches[1];
        initDist = Math.hypot(pt2.clientX - pt1.clientX, pt2.clientY - pt1.clientY);
        initZoom = zoom;
    }

    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && drag) {
        const scale = 3.0 / (canvas.height * zoom);
        cx -= (e.touches[0].clientX - lastX) * scale;
        cy += (e.touches[0].clientY - lastY) * scale;
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
        draw();
    }

    if (e.touches.length === 2 && initDist) {
        const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
        zoom = initZoom * (d / initDist);
        draw();
    }

    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', () => { 
    drag = false; 
    initDist = null; 
});
 
document.getElementById('zoom-slider').oninput = e => {
    const pos = parseInt(e.target.value);
    zoom = Math.pow(10000, pos / 200);
    draw();
};

window.addEventListener('resize', draw);
draw();