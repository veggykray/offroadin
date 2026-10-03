shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never;
// Billboarded candle flame with flicker.
uniform float seed = 0.0;
uniform float intensity = 1.0;
void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
}
void fragment() {
	vec2 uv = UV * 2.0 - 1.0;
	float t = TIME * 9.0 + seed * 17.0;
	uv.x += sin(t + uv.y * 3.0) * 0.08 * (1.0 - uv.y);
	float shape = 1.0 - length(vec2(uv.x * (1.9 + uv.y * 0.9), (uv.y + 0.25) * 0.85));
	shape = clamp(shape, 0.0, 1.0);
	float flick = 0.85 + 0.15 * sin(t * 1.7) * sin(t * 0.63);
	vec3 col = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.9, 0.6), pow(shape, 1.5));
	float core = smoothstep(0.55, 0.85, shape) * step(uv.y, 0.1);
	col = mix(col, vec3(0.4, 0.55, 1.0), core * 0.35);
	ALBEDO = col * pow(shape, 1.2) * 2.6 * flick * intensity;
}
