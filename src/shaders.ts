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
  uniform sampler2D cloudNoise;
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

  float noise(vec3 position) {
    vec2 plane = position.xz + position.y * vec2(0.37, 0.73);
    return texture2D(cloudNoise, plane / 64.0).r;
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
