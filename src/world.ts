import type { FlightState } from './flight.ts';
import * as THREE from 'three';
import { DITHER_VERTEX_SHADER, DITHER_FRAGMENT_SHADER } from './shaders.ts';
export function createWorld(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 60000);
  camera.rotation.order = 'YXZ';
  let seed = 12;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const starPositions = [];
  for (let i = 0; i < 1100; i++) {
    const azimuth = random() * Math.PI * 2,
      y = random(),
      horizontalRadius = Math.sqrt(1 - y * y);
    starPositions.push(
      Math.cos(azimuth) * horizontalRadius * 25000,
      y * 25000,
      Math.sin(azimuth) * horizontalRadius * 25000,
    );
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(starPositions, 3),
  );
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xcccccc, size: 1.25, sizeAttenuation: false }),
  );
  scene.add(stars);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(120000, 120000),
    new THREE.MeshBasicMaterial({ color: 0x030303 }),
  );
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea);
  const lightPositions = [];
  for (let i = 0; i < 180; i++) {
    const z = -3000 - random() * 26000,
      x = 1500 + Math.sin(z * 0.0003) * 1100 + random() * 350;
    lightPositions.push(x, 3, z);
  }
  const lightGeometry = new THREE.BufferGeometry();
  lightGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(lightPositions, 3),
  );
  scene.add(
    new THREE.Points(
      lightGeometry,
      new THREE.PointsMaterial({ color: 0x777777, size: 1, sizeAttenuation: false }),
    ),
  );
  const renderTarget = new THREE.WebGLRenderTarget(640, 360, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  });
  const ditherScene = new THREE.Scene(),
    ditherCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = { tex: { value: renderTarget.texture }, veil: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: DITHER_VERTEX_SHADER,
    fragmentShader: DITHER_FRAGMENT_SHADER,
  });
  ditherScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  function resize(viewportWidth: number, viewportHeight: number) {
    const width = Math.min(960, Math.floor(viewportWidth / 1.5));
    renderer.setSize(width, Math.round((width * viewportHeight) / viewportWidth), false);
    renderTarget.setSize(width, Math.round((width * viewportHeight) / viewportWidth));
    camera.aspect = viewportWidth / viewportHeight;
    camera.updateProjectionMatrix();
  }
  function draw(state: FlightState) {
    camera.position.set(state.x, state.altitude, state.z);
    camera.rotation.set(state.pitch, -state.heading, -state.bank);
    stars.position.copy(camera.position);
    sea.position.set(state.x, 0, state.z);
    const cloudDensity = Math.exp(
      -Math.pow(
        (Math.sin(state.z / 4400 + 1.1) + 0.3 * Math.sin(state.x / 2800)) / 0.24,
        2,
      ),
    );
    uniforms.veil.value = cloudDensity * 0.98;
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(ditherScene, ditherCamera);
  }
  return { resize, draw };
}
