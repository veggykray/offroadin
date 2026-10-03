shader_type spatial;
// Elderly skin: blotchy, slightly translucent, ruddy around the cheeks.
uniform vec3 skin : source_color = vec3(0.86, 0.68, 0.58);
uniform vec3 blush : source_color = vec3(0.80, 0.38, 0.33);
uniform float blotch = 0.3;
uniform float seed = 0.0;
varying vec3 lpos;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
	vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), u.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), u.x), u.y),
		mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), u.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
void vertex() { lpos = VERTEX; }
void fragment() {
	float n = noise(lpos * 38.0 + seed) * 0.6 + noise(lpos * 110.0 + seed) * 0.4;
	float spots = smoothstep(0.78, 0.86, noise(lpos * 60.0 + seed * 3.0));
	vec3 col = mix(skin, blush, smoothstep(0.4, 0.9, n) * blotch * 0.55);
	col = mix(col, skin * vec3(0.7, 0.55, 0.45), spots * 0.6);
	ALBEDO = col;
	ROUGHNESS = 0.55 + n * 0.2;
	SPECULAR = 0.35;
	SSS_STRENGTH = 0.15;
	BACKLIGHT = vec3(0.12, 0.05, 0.03);
	RIM = 0.15;
	RIM_TINT = 0.6;
}
