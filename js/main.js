window.addEventListener('DOMContentLoaded', () => {
  const ui = Visualizer.UI;
  const elements = ui.init();
  const canvas = document.getElementById('gl');

  let renderer;
  try {
    renderer = new Visualizer.Renderer(canvas);
  } catch (error) {
    ui.setStatus('WebGL2 unavailable', true);
    ui.showError(error.message);
    return;
  }

  const camera = new Visualizer.OrbitCamera(canvas);
  let paused = false;
  let time = 0;
  let lastFrame = performance.now();

  function compile() {
    try {
      renderer.setUserFunction(elements.fn.value);
      ui.setStatus('Compiled');
      ui.showError('');
    } catch (error) {
      ui.setStatus('Shader error', true);
      ui.showError(error.message);
    }
  }

  elements.compile.addEventListener('click', compile);

  elements.fn.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      compile();
    }
  });

  elements.pause.addEventListener('click', () => {
    paused = !paused;
    elements.pause.textContent = paused ? 'Resume' : 'Pause';
  });

  elements.reset.addEventListener('click', () => {
    time = 0;
    lastFrame = performance.now();
  });

  compile();

  function frame(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    const settings = ui.settings();

    if (!paused) time += dt * settings.speed;
    renderer.render(time, settings, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
});
