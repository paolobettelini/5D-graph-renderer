window.Visualizer = window.Visualizer || {};

Visualizer.UI = (() => {
  const ids = [
    'fn', 'shapeSphere', 'showBounds', 'xmin', 'xmax', 'ymin', 'ymax', 'zmin', 'zmax',
    'valscale', 'opacityBoost', 'steps', 'jitter', 'minAlpha', 'pixelRatioCap', 'speed',
    'pause', 'reset', 'lightEnabled', 'lightX', 'lightY', 'lightZ', 'lightIntensity',
    'lightSteps', 'lightAttenuation', 'ambient', 'compile', 'status', 'errorBox', 'ui', 'resizer',
  ];

  const el = {};

  function init() {
    for (const id of ids) el[id] = document.getElementById(id);
    initResizer();
    return el;
  }

  function number(id, fallback, min = -Infinity, max = Infinity) {
    const parsed = Number.parseFloat(el[id].value);
    const value = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, value));
  }

  function integer(id, fallback, min, max) {
    const parsed = Number.parseInt(el[id].value, 10);
    const value = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, value));
  }

  function settings() {
    const domainMin = [number('xmin', -1), number('ymin', -1), number('zmin', -1)];
    const domainMax = [number('xmax', 1), number('ymax', 1), number('zmax', 1)];

    return {
      domainMin,
      domainMax,
      valScale: Math.max(number('valscale', 1), 1e-6),
      opacityBoost: number('opacityBoost', 1, 0),
      steps: integer('steps', 128, 8, 2048),
      jitter: number('jitter', 0.5, 0, 1),
      minAlpha: number('minAlpha', 0.001, 0, 1),
      pixelRatioCap: number('pixelRatioCap', 2, 0.5, 4),
      speed: number('speed', 1),
      volumeShape: el.shapeSphere.checked ? 1 : 0,
      showBounds: el.showBounds.checked,
      lightEnabled: el.lightEnabled.checked ? 1 : 0,
      lightPos: [number('lightX', 2.5), number('lightY', 0.5), number('lightZ', 0)],
      lightIntensity: number('lightIntensity', 5, 0),
      lightSteps: integer('lightSteps', 24, 1, 128),
      lightAttenuation: number('lightAttenuation', 1, 0),
      ambient: number('ambient', 0.18, 0),
    };
  }

  function setStatus(message, isError = false) {
    el.status.textContent = message;
    el.status.classList.toggle('status-error', isError);
    el.status.classList.toggle('status-ok', !isError);
  }

  function showError(message) {
    if (!message) {
      el.errorBox.hidden = true;
      el.errorBox.textContent = '';
      return;
    }
    el.errorBox.textContent = message;
    el.errorBox.hidden = false;
  }

  function initResizer() {
    let resizing = false;

    el.resizer.addEventListener('pointerdown', (event) => {
      resizing = true;
      el.resizer.setPointerCapture(event.pointerId);
    });

    window.addEventListener('pointermove', (event) => {
      if (!resizing) return;
      const rect = el.ui.getBoundingClientRect();
      const maxWidth = Math.min(window.innerWidth - 16, 900);
      const width = Math.max(260, Math.min(maxWidth, event.clientX - rect.left));
      el.ui.style.width = `${width}px`;
    });

    window.addEventListener('pointerup', (event) => {
      if (!resizing) return;
      resizing = false;
      if (el.resizer.hasPointerCapture(event.pointerId)) {
        el.resizer.releasePointerCapture(event.pointerId);
      }
    });
  }

  return {
    init,
    settings,
    setStatus,
    showError,
    get elements() {
      return el;
    },
  };
})();
