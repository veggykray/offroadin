shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, depth_test_disabled, blend_mix;
// A floating "eye" over a diner's head: opens as they grow suspicious,
// glows red when close to catching you. Pure readability, no realism.
uniform float amount = 0.0;
uniform float pulse = 0.0;
void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}
void fragment() {
	vec2 uv = UV * 2.0 - 1.0;
	float open = mix(0.12, 1.0, smoothstep(0.0, 0.7, amount));
	// almond eye outline
	float lid = abs(uv.y) - open * 0.55 * (1.0 - uv.x * uv.x);
	float eye = smoothstep(0.05, 0.0, lid) * step(abs(uv.x), 1.0);
	float outline = smoothstep(0.1, 0.04, abs(lid)) * step(abs(uv.x), 1.0);
	float iris = smoothstep(0.32, 0.28, length(uv)) * eye;
	float pupil = smoothstep(0.14, 0.1, length(uv)) * eye;
	vec3 red = vec3(1.0, 0.15, 0.05);
	vec3 amber = vec3(1.0, 0.75, 0.2);
	vec3 rim = mix(amber, red, smoothstep(0.4, 0.8, amount));
	vec3 col = vec3(0.98, 0.95, 0.9) * eye;
	col = mix(col, rim, iris);
	col = mix(col, vec3(0.05), pupil);
	col = mix(col, rim, outline);
	float a = max(eye, outline) * smoothstep(0.02, 0.12, amount);
	ALBEDO = col * (1.0 + pulse * 0.8);
	ALPHA = a * 0.95;
}
