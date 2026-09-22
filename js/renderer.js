window.Visualizer = window.Visualizer || {};

Visualizer.Renderer = class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });

    if (!this.gl) throw new Error('WebGL2 is not available in this browser.');

    this.renderProgram = null;
    this.renderLocations = null;
    this.wireProgram = null;
    this.wireLocations = null;
    this.width = 0;
    this.height = 0;

    this.createBuffers();
    this.createWireProgram();
  }

  createBuffers() {
    const gl = this.gl;

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    this.cubeWireBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeWireBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, Visualizer.Geometry.cubeEdges, gl.STATIC_DRAW);

    this.sphereWireBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereWireBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, Visualizer.Geometry.sphereLines, gl.STATIC_DRAW);
  }

  createWireProgram() {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, Visualizer.Shaders.wireVertex);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, Visualizer.Shaders.wireFragment);
    this.wireProgram = this.linkProgram(vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    this.wireLocations = {
      aPos: gl.getAttribLocation(this.wireProgram, 'aPos'),
      camPos: gl.getUniformLocation(this.wireProgram, 'camPos'),
      camRight: gl.getUniformLocation(this.wireProgram, 'camRight'),
      camUp: gl.getUniformLocation(this.wireProgram, 'camUp'),
      camForward: gl.getUniformLocation(this.wireProgram, 'camForward'),
      camFov: gl.getUniformLocation(this.wireProgram, 'camFov'),
      iResolution: gl.getUniformLocation(this.wireProgram, 'iResolution'),
    };
  }

  setUserFunction(userCode) {
    const gl = this.gl;
    const fragmentSource = Visualizer.Shaders.buildVolumeFragment(userCode.trim());
    const vs = this.compileShader(gl.VERTEX_SHADER, Visualizer.Shaders.quadVertex);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const nextProgram = this.linkProgram(vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const locations = {
      aPos: gl.getAttribLocation(nextProgram, 'aPos'),
      iResolution: gl.getUniformLocation(nextProgram, 'iResolution'),
      iTime: gl.getUniformLocation(nextProgram, 'iTime'),
      domainMin: gl.getUniformLocation(nextProgram, 'domainMin'),
      domainMax: gl.getUniformLocation(nextProgram, 'domainMax'),
      valScale: gl.getUniformLocation(nextProgram, 'valScale'),
      steps: gl.getUniformLocation(nextProgram, 'steps'),
      jitter: gl.getUniformLocation(nextProgram, 'jitter'),
      opacityBoost: gl.getUniformLocation(nextProgram, 'opacityBoost'),
      minAlpha: gl.getUniformLocation(nextProgram, 'minAlpha'),
      volumeShape: gl.getUniformLocation(nextProgram, 'volumeShape'),
      camPos: gl.getUniformLocation(nextProgram, 'camPos'),
      camRight: gl.getUniformLocation(nextProgram, 'camRight'),
      camUp: gl.getUniformLocation(nextProgram, 'camUp'),
      camForward: gl.getUniformLocation(nextProgram, 'camForward'),
      camFov: gl.getUniformLocation(nextProgram, 'camFov'),
      lightEnabled: gl.getUniformLocation(nextProgram, 'lightEnabled'),
      lightPos: gl.getUniformLocation(nextProgram, 'lightPos'),
      lightIntensity: gl.getUniformLocation(nextProgram, 'lightIntensity'),
      lightSteps: gl.getUniformLocation(nextProgram, 'lightSteps'),
      lightAttenuation: gl.getUniformLocation(nextProgram, 'lightAttenuation'),
      ambientLight: gl.getUniformLocation(nextProgram, 'ambientLight'),
    };

    if (this.renderProgram) gl.deleteProgram(this.renderProgram);
    this.renderProgram = nextProgram;
    this.renderLocations = locations;
  }

  resize(pixelRatioCap) {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    gl.viewport(0, 0, width, height);
  }

  render(time, settings, camera) {
    const gl = this.gl;
    this.resize(settings.pixelRatioCap);

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (!this.renderProgram) return;

    this.drawVolume(time, settings, camera);
    if (settings.showBounds) this.drawBounds(settings.volumeShape, camera);
  }

  drawVolume(time, settings, camera) {
    const gl = this.gl;
    const loc = this.renderLocations;
    const basis = camera.getBasis();

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.renderProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(loc.iResolution, this.width, this.height);
    gl.uniform1f(loc.iTime, time);
    gl.uniform3fv(loc.domainMin, settings.domainMin);
    gl.uniform3fv(loc.domainMax, settings.domainMax);
    gl.uniform1f(loc.valScale, settings.valScale);
    gl.uniform1i(loc.steps, settings.steps);
    gl.uniform1f(loc.jitter, settings.jitter);
    gl.uniform1f(loc.opacityBoost, settings.opacityBoost);
    gl.uniform1f(loc.minAlpha, settings.minAlpha);
    gl.uniform1i(loc.volumeShape, settings.volumeShape);

    gl.uniform3fv(loc.camPos, basis.eye);
    gl.uniform3fv(loc.camRight, basis.right);
    gl.uniform3fv(loc.camUp, basis.up);
    gl.uniform3fv(loc.camForward, basis.forward);
    gl.uniform1f(loc.camFov, Math.PI / 4);

    gl.uniform1i(loc.lightEnabled, settings.lightEnabled);
    gl.uniform3fv(loc.lightPos, settings.lightPos);
    gl.uniform1f(loc.lightIntensity, settings.lightIntensity);
    gl.uniform1i(loc.lightSteps, settings.lightSteps);
    gl.uniform1f(loc.lightAttenuation, settings.lightAttenuation);
    gl.uniform1f(loc.ambientLight, settings.ambient);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  drawBounds(volumeShape, camera) {
    const gl = this.gl;
    const loc = this.wireLocations;
    const basis = camera.getBasis();
    const isSphere = volumeShape === 1;
    const buffer = isSphere ? this.sphereWireBuffer : this.cubeWireBuffer;
    const count = isSphere ? Visualizer.Geometry.sphereLines.length / 3 : Visualizer.Geometry.cubeEdges.length / 3;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.wireProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.uniform3fv(loc.camPos, basis.eye);
    gl.uniform3fv(loc.camRight, basis.right);
    gl.uniform3fv(loc.camUp, basis.up);
    gl.uniform3fv(loc.camForward, basis.forward);
    gl.uniform1f(loc.camFov, Math.PI / 4);
    gl.uniform2f(loc.iResolution, this.width, this.height);

    gl.drawArrays(gl.LINES, 0, count);
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error.';
      gl.deleteShader(shader);
      throw new Error(message);
    }

    return shader;
  }

  linkProgram(vs, fs) {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'Unknown shader link error.';
      gl.deleteProgram(program);
      throw new Error(message);
    }

    return program;
  }
};
