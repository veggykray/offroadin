shader_type spatial;
// Golden shortbread biscuit with docking holes and a sugared edge.
uniform vec3 bake : source_color = vec3(0.86, 0.62, 0.30);
uniform vec3 edge_col : source_color = vec3(0.62, 0.36, 0.13);
uniform float fake = 0.0;
varying vec3 lpos;
varying vec3 lnrm;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void vertex() { lpos = VERTEX; lnrm = NORMAL; }
void fragment() {
	vec2 p = lpos.xz * 22.0;
	float r = length(lpos.xz) * 22.0;
	vec3 col = bake * (0.88 + 0.2 * noise(p * 3.0));
	col = mix(col, edge_col, smoothstep(0.6, 1.0, r) * 0.7);
	vec2 g = fract(p * 1.6) - 0.5;
	float dock = smoothstep(0.1, 0.06, length(g)) * step(r, 0.75) * step(0.5, lnrm.y);
	col = mix(col, edge_col * 0.6, dock);
	float sugar = smoothstep(0.85, 0.95, noise(p * 14.0));
	col += vec3(sugar) * 0.25;
	vec3 coaster = vec3(0.55, 0.38, 0.22) * (0.8 + 0.2 * noise(p * 30.0));
	col = mix(col, coaster, fake);
	ALBEDO = col;
	ROUGHNESS = mix(0.8, 0.4, fake);
	SPECULAR = 0.3 + fake * 0.4;
}
