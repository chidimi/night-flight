/** Screen-space ordered dithering keeps the two-colour pattern stationary. */
export const DITHER_VERTEX_SHADER = /* glsl */ `
  varying vec2 uvv;

  void main() {
    uvv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const DITHER_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D tex;
  uniform float veil;
  uniform mat3 cameraBasis;
  uniform vec2 viewScale;
  uniform vec3 cloudOffset;
  varying vec2 uvv;

  // A 4-by-4 Bayer matrix, expressed arithmetically to avoid dynamic indexing.
  float bayer(vec2 pixel) {
    vec2 cell = mod(floor(pixel), 4.0);
    float lowX = mod(cell.x, 2.0);
    float lowY = mod(cell.y, 2.0);
    float highX = floor(cell.x / 2.0);
    float highY = floor(cell.y / 2.0);
    float lowBits = 2.0 * lowX + 3.0 * lowY - 4.0 * lowX * lowY;
    float highBits = 2.0 * highX + 3.0 * highY - 4.0 * highX * highY;
    return (4.0 * lowBits + highBits + 0.5) / 16.0;
  }

  float hash(vec3 cell) {
    return fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise(vec3 position) {
    vec3 cell = floor(position);
    vec3 blend = fract(position);
    blend = blend * blend * (3.0 - 2.0 * blend);
    return mix(
      mix(mix(hash(cell), hash(cell + vec3(1, 0, 0)), blend.x),
          mix(hash(cell + vec3(0, 1, 0)), hash(cell + vec3(1, 1, 0)), blend.x), blend.y),
      mix(mix(hash(cell + vec3(0, 0, 1)), hash(cell + vec3(1, 0, 1)), blend.x),
          mix(hash(cell + vec3(0, 1, 1)), hash(cell + vec3(1, 1, 1)), blend.x), blend.y),
      blend.z);
  }

  void main() {
    vec3 viewRay = normalize(vec3((uvv * 2.0 - 1.0) * viewScale, -1.0));
    vec3 skyRay = cameraBasis * viewRay;
    vec3 samplePosition = skyRay * vec3(3.0, 7.0, 3.0) + cloudOffset;
    float cloudShape = noise(samplePosition) * 0.7
                     + noise(samplePosition * 2.1) * 0.3;
    float wisps = smoothstep(0.43, 0.73, cloudShape);
    float skyMask = smoothstep(-0.08, 0.12, skyRay.y);
    float obscurity = max(veil, wisps * skyMask * 0.96);
    // Only a trace of paper in the cloud edges; dense fog stays almost black.
    float cloudLight = wisps * skyMask * 0.055 * (1.0 - veil);
    float brightness = texture2D(tex, uvv).r * (1.0 - obscurity) + cloudLight;
    float threshold = bayer(gl_FragCoord.xy);
    vec3 ink = vec3(23.0, 24.0, 21.0) / 255.0;
    vec3 paper = vec3(216.0, 208.0, 181.0) / 255.0;
    gl_FragColor = vec4(mix(ink, paper, step(threshold, brightness)), 1.0);
  }
`;
