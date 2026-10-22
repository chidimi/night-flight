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

  void main() {
    float brightness = texture2D(tex, uvv).r * (1.0 - veil);
    float threshold = bayer(gl_FragCoord.xy);
    vec3 ink = vec3(23.0, 24.0, 21.0) / 255.0;
    vec3 paper = vec3(216.0, 208.0, 181.0) / 255.0;
    gl_FragColor = vec4(mix(ink, paper, step(threshold, brightness)), 1.0);
  }
`;
