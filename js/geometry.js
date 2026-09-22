window.Visualizer = window.Visualizer || {};

Visualizer.Geometry = (() => {
  const cubeEdges = new Float32Array([
    -1,-1,-1,  1,-1,-1,
     1,-1,-1,  1, 1,-1,
     1, 1,-1, -1, 1,-1,
    -1, 1,-1, -1,-1,-1,
    -1,-1, 1,  1,-1, 1,
     1,-1, 1,  1, 1, 1,
     1, 1, 1, -1, 1, 1,
    -1, 1, 1, -1,-1, 1,
    -1,-1,-1, -1,-1, 1,
     1,-1,-1,  1,-1, 1,
     1, 1,-1,  1, 1, 1,
    -1, 1,-1, -1, 1, 1,
  ]);

  function makeSphereLines(segments = 96) {
    const vertices = [];
    const planes = ['xy', 'xz', 'yz'];

    for (const plane of planes) {
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        const c0 = Math.cos(a0);
        const s0 = Math.sin(a0);
        const c1 = Math.cos(a1);
        const s1 = Math.sin(a1);

        if (plane === 'xy') vertices.push(c0, s0, 0, c1, s1, 0);
        if (plane === 'xz') vertices.push(c0, 0, s0, c1, 0, s1);
        if (plane === 'yz') vertices.push(0, c0, s0, 0, c1, s1);
      }
    }

    return new Float32Array(vertices);
  }

  return {
    cubeEdges,
    sphereLines: makeSphereLines(),
  };
})();
