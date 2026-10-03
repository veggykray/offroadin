shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, blend_mix;
// The Cheat's eyes as a warped reflection in the polished teapot.
uniform vec2 look = vec2(0.0);
uniform float open_amount = 1.0;
uniform float visible = 1.0;
uniform float narrow = 0.0;
void fragment() {
	vec2 uv = UV * 2.0 - 1.0;
	// fisheye warp of a convex mirror
	float rr = dot(uv, uv);
	uv *= 1.0 + rr * 0.35;
	float alpha = 0.0;
	vec3 col = vec3(0.0);
	for (int i = 0; i < 2; i++) {
		vec2 c = vec2(i == 0 ? -0.42 : 0.42, 0.0);
		vec2 e = (uv - c) / vec2(0.36, 0.22 * open_amount * (1.0 - narrow * 0.6) + 0.001);
		float eye = smoothstep(1.05, 0.9, length(e));
		vec2 pc = (uv - c - look * vec2(0.18, 0.08)) / vec2(0.13, 0.13);
		float pupil = smoothstep(1.0, 0.75, length(pc)) * eye;
		col = mix(col, vec3(0.92, 0.9, 0.85), eye);
		col = mix(col, vec3(0.04, 0.03, 0.02), pupil);
		alpha = max(alpha, eye);
		vec2 bc = uv - c - vec2(0.0, 0.3 - narrow * 0.1);
		float brow = smoothstep(0.06, 0.02, abs(bc.y + bc.x * (i == 0 ? -0.3 : 0.3) * narrow)) * step(abs(bc.x), 0.36);
		col = mix(col, vec3(0.1, 0.08, 0.06), brow);
		alpha = max(alpha, brow);
	}
	ALBEDO = col;
	ALPHA = alpha * visible * smoothstep(1.0, 0.7, length(UV * 2.0 - 1.0));
}
