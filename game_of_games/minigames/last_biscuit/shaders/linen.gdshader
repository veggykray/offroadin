shader_type spatial;
// Embroidered linen / lace runner. uv.x across, uv.y along.
uniform vec3 cloth : source_color = vec3(0.86, 0.82, 0.72);
uniform vec3 thread : source_color = vec3(0.70, 0.55, 0.30);
uniform vec2 repeat = vec2(4.0, 40.0);
uniform float lace_edge = 0.12;
uniform float stain = 0.4;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void fragment() {
	vec2 uv = UV;
	vec2 q = uv * repeat;
	vec2 cell = fract(q) - 0.5;
	float r = length(cell);
	float rosette = smoothstep(0.03, 0.0, abs(r - 0.28)) + smoothstep(0.04, 0.0, abs(r - 0.12));
	float petals = smoothstep(0.05, 0.0, abs(r - 0.2 - 0.025 * cos(atan(cell.y, cell.x) * 8.0)));
	float weave = 0.92 + 0.08 * sin(uv.x * 1800.0) * sin(uv.y * 9000.0);
	vec3 col = cloth * weave;
	col = mix(col, thread, clamp(rosette * 0.6 + petals * 0.8, 0.0, 1.0));
	float edge = min(uv.x, 1.0 - uv.x);
	float scallop = smoothstep(0.0, 0.01, edge - lace_edge * (0.5 + 0.5 * abs(sin(uv.y * repeat.y * 3.14159))));
	float holes = step(0.6, noise(q * 8.0)) * (1.0 - scallop);
	col = mix(col, cloth * 0.95, 1.0 - scallop);
	float s = smoothstep(0.6, 0.9, noise(uv * vec2(3.0, 30.0) + 7.0)) * stain;
	col *= 1.0 - s * vec3(0.12, 0.2, 0.35);
	ALBEDO = col;
	ALPHA = 1.0 - holes * 0.9;
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	ROUGHNESS = 0.9;
	SPECULAR = 0.2;
	BACKLIGHT = vec3(0.25);
}
