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
    float brightness = texture2D(tex, uvv).r;
    float threshold = bayer(gl_FragCoord.xy);
    vec3 ink = vec3(23.0, 24.0, 21.0) / 255.0;
    vec3 paper = vec3(216.0, 208.0, 181.0) / 255.0;
    gl_FragColor = vec4(mix(ink, paper, step(threshold, brightness)), 1.0);
  }
`;

/** World-space wave streaks establish the sea without lighting the whole scene. */
export const SEA_VERTEX_SHADER = /* glsl */ `
  varying vec3 seaPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    seaPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const SEA_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float time;
  uniform vec3 moonDirection;
  varying vec3 seaPosition;

  void main() {
    vec3 toSea = seaPosition - cameraPosition;
    float distanceToSea = length(toSea.xz);
    vec2 bearing = toSea.xz / max(distanceToSea, 1.0);
    float moonPath = smoothstep(0.94, 0.999, dot(bearing, normalize(moonDirection.xz)));
    float phase = seaPosition.z * 0.006
                + sin(seaPosition.x * 0.0015 + time * 0.2) * 1.5 + time * 0.7;
    // Fade unresolved wave lines before they alias into a distant checkerboard.
    float resolved = 1.0 - smoothstep(0.5, 2.0, fwidth(phase));
    float crests = smoothstep(0.72, 0.98, sin(phase)) * resolved;
    float brokenReflection = 0.5 + 0.5 * sin(seaPosition.x * 0.0035 - time * 0.4);
    float shimmer = crests * brokenReflection * (0.12 + moonPath * 0.35);
    float horizon = 0.025 * smoothstep(1000.0, 18000.0, distanceToSea);
    gl_FragColor = vec4(vec3(0.012 + horizon + shimmer), 1.0);
  }
`;
