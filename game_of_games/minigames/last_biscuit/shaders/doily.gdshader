shader_type spatial;
render_mode cull_disabled;
// Paper lace doily, procedurally cut.
uniform vec3 paper : source_color = vec3(0.95, 0.93, 0.88);
void fragment() {
	vec2 c = UV * 2.0 - 1.0;
	float r = length(c);
	float a = atan(c.y, c.x);
	float scallop = 0.95 - 0.05 * abs(sin(a * 16.0));
	float ring1 = step(0.08, abs(fract(r * 9.0) - 0.5));
	float spokes = step(0.12, abs(sin(a * 24.0)));
	float holes = 1.0 - (1.0 - ring1) * (1.0 - spokes) * step(0.55, r);
	float petals = step(0.4, abs(sin(a * 8.0 + r * 6.0))) + step(r, 0.45);
	float a_ = step(r, scallop) * holes * clamp(petals, 0.0, 1.0);
	ALBEDO = paper;
	ALPHA = a_;
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	ROUGHNESS = 0.9;
}
