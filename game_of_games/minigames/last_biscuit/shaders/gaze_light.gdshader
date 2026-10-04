shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled;
// The diners' searchlight gaze: vertex-coloured fan, a bright outline around
// the focused cone, and soft scanlines sweeping outwards from the eyes.
instance uniform float core_frac = 0.7;   // fraction of the fan that is focused (vs peripheral)
uniform float shimmer = 1.0;
void fragment() {
	float scan = 0.8 + 0.2 * sin(UV.y * 70.0 - TIME * 7.0);
	float u = abs(UV.x - 0.5) * 2.0;
	float edge = smoothstep(0.06, 0.0, abs(u - core_frac)) * step(0.08, UV.y);
	float rim = smoothstep(0.93, 1.0, UV.y) * step(u, core_frac);
	float boost = 1.0 + edge * 2.2 + rim * 1.6;
	ALBEDO = COLOR.rgb * COLOR.a * mix(1.0, scan, shimmer) * boost;
}
