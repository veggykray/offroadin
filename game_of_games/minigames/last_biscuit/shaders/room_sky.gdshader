shader_type sky;
// Not visible: only feeds reflections and ambient so polished silver and
// porcelain catch warm candle glints and cold window light.
void sky() {
	vec3 d = EYEDIR;
	vec3 col = mix(vec3(0.03, 0.02, 0.015), vec3(0.12, 0.08, 0.05), smoothstep(-0.2, 0.6, d.y));
	// chandelier hotspot above
	col += vec3(1.6, 1.0, 0.5) * pow(max(d.y, 0.0), 24.0);
	// candle glints around the horizon
	float a = atan(d.x, d.z);
	col += vec3(1.2, 0.7, 0.3) * pow(max(0.0, sin(a * 7.0)), 40.0) * smoothstep(0.25, 0.0, abs(d.y - 0.05));
	// cold windows far end
	col += vec3(0.35, 0.5, 0.85) * smoothstep(0.75, 0.95, -d.z) * smoothstep(-0.05, 0.3, d.y) * 0.9;
	COLOR = col;
}
