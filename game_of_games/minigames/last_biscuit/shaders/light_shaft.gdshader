shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled;
// Cold window light shaft with drifting dust.
uniform vec3 tint : source_color = vec3(0.55, 0.68, 0.95);
uniform float strength = 0.075;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void fragment() {
	float edge = smoothstep(0.0, 0.35, UV.x) * smoothstep(1.0, 0.65, UV.x);
	float along = smoothstep(0.0, 0.15, UV.y) * smoothstep(1.0, 0.4, UV.y);
	float streak = 0.75 + 0.25 * noise(vec2(UV.x * 9.0, TIME * 0.05));
	float dust = smoothstep(0.93, 0.99, noise(UV * vec2(80.0, 50.0) + vec2(TIME * 0.3, -TIME * 0.2)));
	float fres = clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0);
	ALBEDO = tint * (edge * along * streak * strength + dust * edge * along * 0.08) * fres;
}
