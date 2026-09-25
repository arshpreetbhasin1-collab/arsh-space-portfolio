import * as THREE from 'three';

// Real-time corona over the Sun footage: a camera-facing quad whose shader draws a limb glow
// and slowly writhing streamers (fbm in polar coordinates) around a sun that sits below the
// bottom edge of the frame. Additive, so it only ever brightens the plate beneath.

const frag = /* glsl */ `
  uniform float uTime;
  uniform float uWeight;
  uniform float uAspect;
  uniform vec2 uCenter;
  uniform float uRadius;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 p = vUv - uCenter;
    p.x *= uAspect;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float d = max(0.0, r - uRadius);
    // Limb glow falling off away from the surface.
    float glow = exp(-d * 7.0) * 0.9 + exp(-d * 2.2) * 0.35;
    // Streamers: noise stretched along the radius, drifting slowly.
    float s = fbm(vec2(ang * 9.0, d * 3.5 - uTime * 0.12)) ;
    float rays = smoothstep(0.45, 0.95, s) * exp(-d * 3.0) * 0.9;
    float inside = smoothstep(uRadius + 0.01, uRadius - 0.04, r);
    float a = (glow + rays) * (1.0 - inside * 0.85) * uWeight;
    vec3 col = mix(vec3(1.0, 0.55, 0.16), vec3(1.0, 0.93, 0.78), clamp(glow, 0.0, 1.0));
    gl_FragColor = vec4(col * a, a);
  }
`;

export class SunCorona {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uWeight: { value: 0 },
        uAspect: { value: 1 },
        uCenter: { value: new THREE.Vector2(0.5, -0.32) },
        uRadius: { value: 0.66 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: frag,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mesh.visible = false;
  }

  update(time: number, weight: number, aspect: number, narrow: boolean) {
    this.mesh.visible = weight > 0.005;
    if (!this.mesh.visible) return;
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uWeight.value = weight;
    u.uAspect.value = aspect;
    // Portrait framing shows more of the disc, so the limb sits higher on phones.
    u.uCenter.value.set(0.5, narrow ? -0.12 : -0.32);
    u.uRadius.value = narrow ? 0.5 : 0.66;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
