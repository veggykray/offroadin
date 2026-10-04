shader_type spatial;
// Worn hospital gown: faded cream cotton with a tiny blue-grey floral print,
// grubby creases and washed-out patches.
uniform vec3 cloth : source_color = vec3(0.86, 0.83, 0.74);
uniform vec3 print_col : source_color = vec3(0.45, 0.52, 0.62);
uniform vec3 print_col2 : source_color = vec3(0.62, 0.5, 0.48);
uniform float scale = 38.0;
varying vec3 lpos;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void vertex() { lpos = VERTEX; }
void fragment() {
	vec2 p = (lpos.xy + lpos.zx * 0.7) * scale;
	vec2 cell = floor(p);
	vec2 f = fract(p) - 0.5 + (vec2(hash(cell), hash(cell + 3.1)) - 0.5) * 0.5;
	float r = length(f);
	float a = atan(f.y, f.x);
	float petals = smoothstep(0.05, 0.0, r - 0.17 - 0.07 * cos(a * 5.0));
	float centre = smoothstep(0.06, 0.03, r);
	float leaf = smoothstep(0.04, 0.0, abs(f.y + 0.2 - f.x * 0.6)) * step(abs(f.x + 0.15), 0.12);
	float pick = hash(cell + 7.7);
	vec3 pc = mix(print_col, print_col2, step(0.6, pick));
	vec3 col = cloth;
	col = mix(col, pc, petals * 0.55 * step(0.25, pick));
	col = mix(col, vec3(0.8, 0.7, 0.45), centre * step(0.25, pick) * 0.6);
	col = mix(col, vec3(0.5, 0.58, 0.48), leaf * 0.35);
	float grime = noise(lpos.xy * 9.0) * 0.6 + noise(lpos.zy * 23.0) * 0.4;
	col *= mix(0.78, 1.04, grime);
	float crease = smoothstep(0.45, 0.5, abs(fract(lpos.y * 11.0 + noise(lpos.xz * 6.0) * 1.5) - 0.5));
	col *= 1.0 - crease * 0.08;
	ALBEDO = col;
	ROUGHNESS = 0.92;
	SPECULAR = 0.15;
	BACKLIGHT = vec3(0.25, 0.23, 0.2);
}
