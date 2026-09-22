window.Visualizer = window.Visualizer || {};

Visualizer.OrbitCamera = class OrbitCamera {
  constructor(canvas) {
    this.canvas = canvas;
    this.distance = 3.0;
    this.yaw = 0.5;
    this.pitch = -0.5;
    this.target = [0, 0, 0];
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    this.bindEvents();
  }

  bindEvents() {
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      this.canvas.setPointerCapture(event.pointerId);
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    });

    this.canvas.addEventListener('pointerup', (event) => {
      this.dragging = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    });

    this.canvas.addEventListener('pointercancel', () => {
      this.dragging = false;
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging || (event.buttons & 1) === 0) return;

      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;

      this.yaw -= dx * 0.005;
      this.pitch += dy * 0.005;
      const limit = Math.PI * 0.5 - 0.01;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });

    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.distance *= Math.pow(1.001, event.deltaY);
      this.distance = Math.max(1.25, Math.min(40, this.distance));
    }, { passive: false });
  }

  getBasis() {
    const eye = [
      this.target[0] + this.distance * Math.cos(this.pitch) * Math.sin(this.yaw),
      this.target[1] + this.distance * Math.sin(this.pitch),
      this.target[2] + this.distance * Math.cos(this.pitch) * Math.cos(this.yaw),
    ];

    const forward = normalize(subtract(this.target, eye));
    const worldUp = Math.abs(forward[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0];
    const right = normalize(cross(forward, worldUp));
    const up = normalize(cross(right, forward));

    return { eye, right, up, forward };
  }
};

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
