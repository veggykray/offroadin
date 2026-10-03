shader_type spatial;
// Worn parquet floor disappearing into shadow.
varying vec3 wpos;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wpos.xz * 2.0;
	vec2 cell = floor(p);
	float flip = mod(cell.x + cell.y, 2.0);
	vec2 f = fract(p);
	float grain = noise(flip > 0.5 ? vec2(f.x * 40.0, f.y * 3.0) + cell * 7.0 : vec2(f.y * 40.0, f.x * 3.0) + cell * 7.0);
	float seam = smoothstep(0.0, 0.03, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
	vec3 col = mix(vec3(0.07, 0.035, 0.018), vec3(0.2, 0.1, 0.05), grain * (0.6 + 0.4 * hash(cell)));
	col *= mix(0.4, 1.0, seam);
	ALBEDO = col;
	ROUGHNESS = 0.4 + grain * 0.3;
}
