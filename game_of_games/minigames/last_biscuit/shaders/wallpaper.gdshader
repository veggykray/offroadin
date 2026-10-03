shader_type spatial;
// Decaying damask wallpaper with peeling stains and gilded motif.
uniform vec3 paper : source_color = vec3(0.10, 0.16, 0.12);
uniform vec3 motif : source_color = vec3(0.36, 0.28, 0.12);
uniform float scale = 1.6;
varying vec3 wpos;
varying vec3 wnrm;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; } return v; }

void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz); }

void fragment() {
	vec2 p = abs(wnrm.x) > 0.5 ? wpos.zy : wpos.xy;
	vec2 q = p * scale;
	vec2 c = fract(q + vec2(0.5 * floor(mod(q.y, 2.0)), 0.0)) - 0.5;
	c.x = abs(c.x);
	float d = length(c * vec2(1.6, 1.0));
	float leaf = smoothstep(0.02, 0.0, abs(d - 0.32 - 0.07 * sin(atan(c.y, c.x) * 5.0)));
	float core = smoothstep(0.12, 0.08, length(c - vec2(0.0, 0.05)));
	float stem = smoothstep(0.015, 0.0, abs(c.x - 0.04 * sin(c.y * 12.0))) * step(abs(c.y), 0.45);
	float m = clamp(leaf + core * 0.7 + stem * 0.6, 0.0, 1.0);
	vec3 col = mix(paper, motif, m * 0.85);
	float dirt = fbm(p * 0.8);
	float peel = smoothstep(0.62, 0.66, fbm(p * 1.3 + 11.0));
	col *= mix(0.6, 1.05, dirt);
	col = mix(col, vec3(0.20, 0.17, 0.12) * dirt, peel);
	float drip = smoothstep(0.7, 1.0, noise(vec2(p.x * 6.0, p.y * 0.4))) * smoothstep(3.0, 1.0, p.y);
	col *= 1.0 - drip * 0.35;
	ALBEDO = col;
	ROUGHNESS = mix(0.8, 0.35, m);
	METALLIC = m * 0.45;
}
