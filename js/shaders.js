window.Visualizer = window.Visualizer || {};

Visualizer.Shaders = (() => {
  const quadVertex = `#version 300 es
precision highp float;

in vec2 aPos;
out vec2 vUV;

void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const volumeFragmentTemplate = `#version 300 es
precision highp float;

out vec4 outColor;
in vec2 vUV;

uniform vec2 iResolution;
uniform float iTime;
uniform vec3 domainMin;
uniform vec3 domainMax;
uniform float valScale;
uniform int steps;
uniform float jitter;
uniform float opacityBoost;
uniform float minAlpha;
uniform int volumeShape;

uniform vec3 camPos;
uniform vec3 camRight;
uniform vec3 camUp;
uniform vec3 camForward;
uniform float camFov;

uniform int lightEnabled;
uniform vec3 lightPos;
uniform float lightIntensity;
uniform int lightSteps;
uniform float lightAttenuation;
uniform float ambientLight;

// USER_FUNCTION

uint hash(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u;
  return v.x ^ v.y;
}

float hashf(vec2 p) {
  uvec2 u = uvec2(floatBitsToUint(p.x), floatBitsToUint(p.y));
  return float(hash(u) % 10000u) / 10000.0;
}

bool intersectBox(vec3 ro, vec3 rd, out float tNear, out float tFar) {
  vec3 invD = 1.0 / rd;
  vec3 t0 = (-1.0 - ro) * invD;
  vec3 t1 = ( 1.0 - ro) * invD;
  vec3 lo = min(t0, t1);
  vec3 hi = max(t0, t1);
  tNear = max(max(lo.x, lo.y), lo.z);
  tFar = min(min(hi.x, hi.y), hi.z);
  return tFar >= max(tNear, 0.0);
}

bool intersectSphere(vec3 ro, vec3 rd, out float tNear, out float tFar) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - 1.0;
  float h = b * b - c;
  if (h < 0.0) return false;
  h = sqrt(h);
  tNear = -b - h;
  tFar = -b + h;
  return tFar >= max(tNear, 0.0);
}

bool intersectVolume(vec3 ro, vec3 rd, out float tNear, out float tFar) {
  if (volumeShape == 1) return intersectSphere(ro, rd, tNear, tFar);
  return intersectBox(ro, rd, tNear, tFar);
}

bool insideVolume(vec3 p) {
  if (volumeShape == 1) return dot(p, p) <= 1.0;
  return all(lessThanEqual(abs(p), vec3(1.0)));
}

vec3 posToDomain(vec3 pos) {
  vec3 normalized = pos * 0.5 + 0.5;
  return mix(domainMin, domainMax, normalized);
}

float sampleField(vec3 pos, float tt) {
  return user_fn(posToDomain(pos), tt);
}

vec3 estimateNormal(vec3 pos, float tt) {
  float eps = 0.006;
  float dx = sampleField(pos + vec3(eps, 0.0, 0.0), tt) - sampleField(pos - vec3(eps, 0.0, 0.0), tt);
  float dy = sampleField(pos + vec3(0.0, eps, 0.0), tt) - sampleField(pos - vec3(0.0, eps, 0.0), tt);
  float dz = sampleField(pos + vec3(0.0, 0.0, eps), tt) - sampleField(pos - vec3(0.0, 0.0, eps), tt);
  vec3 g = vec3(dx, dy, dz);
  float gLen = length(g);
  if (gLen < 1e-6) return vec3(0.0, 0.0, 1.0);
  return g / gLen;
}

float computeShadow(vec3 pos, float tt) {
  if (lightEnabled == 0 || lightIntensity <= 0.0) return 1.0;

  vec3 toLight = lightPos - pos;
  float dist = length(toLight);
  if (dist <= 1e-4) return 1.0;

  vec3 dir = toLight / dist;
  int count = max(1, min(lightSteps, 128));
  float stepLen = dist / float(count);
  float transmittance = 1.0;
  float start = max(stepLen * 0.35, 0.004);

  for (int i = 0; i < 128; i++) {
    if (i >= count) break;
    float sampleT = start + (float(i) + 0.5) * stepLen;
    if (sampleT >= dist) break;

    vec3 p = pos + dir * sampleT;
    if (!insideVolume(p)) break;

    float v = sampleField(p, tt);
    float density = clamp(abs(v) / max(valScale, 1e-6), 0.0, 1.0);
    transmittance *= exp(-density * lightAttenuation * stepLen * 8.0);
    if (transmittance < 0.01) return 0.0;
  }

  return transmittance;
}

void main() {
  vec2 ndc = vUV * 2.0 - 1.0;
  float aspect = iResolution.x / iResolution.y;
  float tanHalfFov = tan(camFov * 0.5);

  vec3 ro = camPos;
  vec3 rd = normalize(
    ndc.x * aspect * tanHalfFov * camRight +
    ndc.y * tanHalfFov * camUp +
    camForward
  );

  float tEnter;
  float tExit;
  if (!intersectVolume(ro, rd, tEnter, tExit)) {
    outColor = vec4(0.0);
    return;
  }

  float start = max(tEnter, 0.0);
  float totalLen = tExit - start;
  int stepCount = max(1, steps);
  float dt = totalLen / float(stepCount);
  float randomOffset = hashf(gl_FragCoord.xy);
  float sampleOffset = mix(0.5, randomOffset, clamp(jitter, 0.0, 1.0));
  vec4 accum = vec4(0.0);

  for (int i = 0; i < 2048; i++) {
    if (i >= stepCount) break;

    float curT = start + (float(i) + sampleOffset) * dt;
    if (curT >= tExit) break;

    vec3 pos = ro + curT * rd;
    if (!insideVolume(pos)) continue;

    float val = sampleField(pos, iTime);
    float density = clamp(abs(val) / max(valScale, 1e-6), 0.0, 1.0);
    float alpha = 1.0 - exp(-density * opacityBoost * 6.0 * dt * float(stepCount));

    if (alpha < minAlpha) continue;

    vec3 baseColor = vec3(clamp(val * 0.5 + 0.5, 0.0, 1.0));
    float lightFactor = ambientLight;

    if (lightEnabled == 1 && lightIntensity > 0.0) {
      vec3 normal = estimateNormal(pos, iTime);
      vec3 lightDir = normalize(lightPos - pos);
      float diffuse = max(dot(normal, lightDir), 0.0);
      float shadow = computeShadow(pos, iTime);
      lightFactor += diffuse * lightIntensity * shadow;
    }

    vec3 shaded = baseColor * lightFactor;
    accum.rgb += (1.0 - accum.a) * shaded * alpha;
    accum.a += (1.0 - accum.a) * alpha;

    if (accum.a >= 0.995) break;
  }

  vec3 straightColor = accum.a > 1e-6 ? accum.rgb / accum.a : vec3(0.0);
  straightColor = pow(max(straightColor, vec3(0.0)), vec3(1.0 / 2.2));
  outColor = vec4(straightColor, accum.a);
}`;

  const wireVertex = `#version 300 es
precision highp float;

in vec3 aPos;
uniform vec3 camPos;
uniform vec3 camRight;
uniform vec3 camUp;
uniform vec3 camForward;
uniform float camFov;
uniform vec2 iResolution;

void main() {
  vec3 v = aPos - camPos;
  float x = dot(v, camRight);
  float y = dot(v, camUp);
  float z = max(dot(v, camForward), 0.0001);
  float aspect = iResolution.x / iResolution.y;
  float tanHalf = tan(camFov * 0.5);
  gl_Position = vec4(x / (z * tanHalf * aspect), y / (z * tanHalf), 0.0, 1.0);
}`;

  const wireFragment = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  outColor = vec4(1.0, 1.0, 1.0, 0.58);
}`;

  function buildVolumeFragment(userCode) {
    const fn = `float user_fn(vec3 p, float tt) {
  float x = p.x;
  float y = p.y;
  float z = p.z;
  float t = tt;
  ${userCode}
}`;
    return volumeFragmentTemplate.replace('// USER_FUNCTION', fn);
  }

  return {
    quadVertex,
    wireVertex,
    wireFragment,
    buildVolumeFragment,
  };
})();
