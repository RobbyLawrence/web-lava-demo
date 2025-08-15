(() => {
  const canvas = document.getElementById('glcanvas');
  const gl = canvas.getContext('webgl');
  if (!gl) {
    alert('WebGL not supported in this browser.');
    return;
  }

  // Resize handling (device pixel ratio aware)
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Compile shader helpers
  const compile = (type, source) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(sh);
      console.error('Shader compile error:', info, source);
      throw new Error(info);
    }
    return sh;
  };
  const link = (vs, fs) => {
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
    }
    return prog;
  };

  // Grab shader sources from DOM
  const vsSrc = document.getElementById('vs').textContent;
  const fsSrc = document.getElementById('fs').textContent;

  const vs = compile(gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
  const prog = link(vs, fs);

  gl.useProgram(prog);

  // Fullscreen quad
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  const verts = new Float32Array([
    -1,-1,  1,-1, -1, 1,
    -1, 1,  1,-1,  1, 1
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Uniforms
  const iResolution = gl.getUniformLocation(prog, 'iResolution');
  const iTime       = gl.getUniformLocation(prog, 'iTime');

  const uMode        = gl.getUniformLocation(prog, 'uMode');
  const uOctaves     = gl.getUniformLocation(prog, 'uOctaves');
  const uLacunarity  = gl.getUniformLocation(prog, 'uLacunarity');
  const uGain        = gl.getUniformLocation(prog, 'uGain');
  const uFBMScale    = gl.getUniformLocation(prog, 'uFBMScale');
  const uVoroScale   = gl.getUniformLocation(prog, 'uVoroScale');
  const uCrackWidth  = gl.getUniformLocation(prog, 'uCrackWidth');
  const uWarpStrength= gl.getUniformLocation(prog, 'uWarpStrength');
  const uFlowSpeed   = gl.getUniformLocation(prog, 'uFlowSpeed');
  const uPalette     = gl.getUniformLocation(prog, 'uPalette');

  // UI elements
  const $ = id => document.getElementById(id);
  const modeEl = $('mode');
  const octavesEl = $('octaves');
  const lacunarityEl = $('lacunarity');
  const gainEl = $('gain');
  const fbmScaleEl = $('fbmScale');
  const voroScaleEl = $('voroScale');
  const crackWidthEl = $('crackWidth');
  const warpStrengthEl = $('warpStrength');
  const flowSpeedEl = $('flowSpeed');
  const paletteEl = $('palette');

  const labels = {
    'octaves-val': octavesEl,
    'lacunarity-val': lacunarityEl,
    'gain-val': gainEl,
    'fbmScale-val': fbmScaleEl,
    'voroScale-val': voroScaleEl,
    'crackWidth-val': crackWidthEl,
    'warpStrength-val': warpStrengthEl,
    'flowSpeed-val': flowSpeedEl,
  };

  const updateLabel = (id, el) => {
    const span = document.getElementById(id);
    if (el === octavesEl) span.textContent = String(parseInt(el.value, 10));
    else span.textContent = Number(el.value).toFixed(2);
  };
  Object.entries(labels).forEach(([id, el]) => updateLabel(id, el));
  Object.entries(labels).forEach(([id, el]) => {
    el.addEventListener('input', () => updateLabel(id, el));
  });

  // Buttons
  $('fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });
  $('screenshot').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'lava.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // Animation loop
  let start = performance.now();
  function frame(now) {
    resize();
    const t = (now - start) * 0.001;
    gl.uniform2f(iResolution, canvas.width, canvas.height);
    gl.uniform1f(iTime, t);

    gl.uniform1i(uMode, parseInt(modeEl.value, 10));
    gl.uniform1i(uOctaves, parseInt(octavesEl.value, 10));
    gl.uniform1f(uLacunarity, parseFloat(lacunarityEl.value));
    gl.uniform1f(uGain, parseFloat(gainEl.value));
    gl.uniform1f(uFBMScale, parseFloat(fbmScaleEl.value));
    gl.uniform1f(uVoroScale, parseFloat(voroScaleEl.value));
    gl.uniform1f(uCrackWidth, parseFloat(crackWidthEl.value));
    gl.uniform1f(uWarpStrength, parseFloat(warpStrengthEl.value));
    gl.uniform1f(uFlowSpeed, parseFloat(flowSpeedEl.value));
    gl.uniform1i(uPalette, parseInt(paletteEl.value, 10));

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();