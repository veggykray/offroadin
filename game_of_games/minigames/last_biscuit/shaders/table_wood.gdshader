shader_type spatial;
// Polished mahogany with long grain, worn patches and a deep lacquer sheen.
uniform vec3 base_dark : source_color = vec3(0.13, 0.045, 0.02);
uniform vec3 base_light : source_color = vec3(0.36, 0.13, 0.055);
uniform float grain_scale = 5.0;
uniform float wear = 0.35;
varying vec3 wpos;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }

void fragment() {
	vec2 p = vec2(wpos.x * grain_scale, wpos.z * 0.35);
	float warp = fbm(p * vec2(0.7, 1.5)) * 2.5;
	float rings = sin((p.x + warp) * 9.0) * 0.5 + 0.5;
	rings = pow(rings, 2.5);
	float fine = fbm(vec2(wpos.x * 90.0, wpos.z * 3.0));
	float plank = smoothstep(0.0, 0.02, abs(fract(wpos.x * 1.25 + 0.5) - 0.5));
	vec3 col = mix(base_dark, base_light, rings * 0.55 + fine * 0.35);
	col *= mix(0.55, 1.0, plank);
	float worn = smoothstep(0.55, 0.85, fbm(wpos.xz * 1.7 + 3.1)) * wear;
	col = mix(col, col * 1.6 + vec3(0.03, 0.015, 0.0), worn);
	ALBEDO = col;
	ROUGHNESS = mix(0.13, 0.32, worn + fine * 0.2) ;
	SPECULAR = 0.65;
	CLEARCOAT = 0.8;
	CLEARCOAT_ROUGHNESS = 0.08;
}
