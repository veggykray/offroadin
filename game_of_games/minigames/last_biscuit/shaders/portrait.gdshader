shader_type spatial;
// A gloomy oil portrait of an ancestor. look offsets the painted pupils.
uniform vec3 bg : source_color = vec3(0.10, 0.08, 0.05);
uniform vec3 coat : source_color = vec3(0.12, 0.09, 0.08);
uniform vec3 face : source_color = vec3(0.62, 0.48, 0.36);
uniform float head_w = 0.17;
uniform float head_h = 0.22;
uniform float seed = 0.0;
uniform vec2 look = vec2(0.0);
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void fragment() {
	vec2 uv = vec2(UV.x, 1.0 - UV.y);
	float vign = smoothstep(0.85, 0.2, length(uv - vec2(0.5, 0.55)));
	vec3 col = bg * (0.5 + vign * 0.9);
	float body = smoothstep(0.02, 0.0, length((uv - vec2(0.5, -0.05)) * vec2(1.0, 1.4)) - 0.42);
	col = mix(col, coat, body);
	float collar = body * smoothstep(0.02, 0.0, abs(uv.x - 0.5) - 0.06 + uv.y * 0.1) * step(uv.y, 0.33);
	col = mix(col, vec3(0.75, 0.72, 0.65), collar);
	vec2 hc = (uv - vec2(0.5, 0.56)) / vec2(head_w, head_h);
	float head = smoothstep(1.03, 0.97, length(hc));
	vec3 fc = face * (0.75 + 0.35 * (1.0 - length(hc + vec2(0.35, -0.3))));
	col = mix(col, fc, head);
	vec2 le = (uv - vec2(0.5 - head_w * 0.38, 0.6)) / vec2(0.035, 0.022);
	vec2 re = (uv - vec2(0.5 + head_w * 0.38, 0.6)) / vec2(0.035, 0.022);
	float eyes = smoothstep(1.1, 0.9, length(le)) + smoothstep(1.1, 0.9, length(re));
	col = mix(col, vec3(0.85, 0.82, 0.7), eyes * head);
	float pupils = smoothstep(0.55, 0.35, length(le - look * 0.5)) + smoothstep(0.55, 0.35, length(re - look * 0.5));
	col = mix(col, vec3(0.05), pupils * head);
	float brow = smoothstep(0.012, 0.0, abs(uv.y - 0.635 - 0.01 * sin(seed + uv.x * 20.0))) * step(abs(uv.x - 0.5), head_w * 0.65) * head;
	col = mix(col, vec3(0.2, 0.15, 0.1), brow);
	float mouth = smoothstep(0.006, 0.0, abs(uv.y - 0.49)) * step(abs(uv.x - 0.5), 0.04) * head;
	col = mix(col, vec3(0.25, 0.1, 0.08), mouth);
	float crack = smoothstep(0.96, 1.0, noise(uv * 60.0 + seed)) * 0.4;
	col *= (0.85 + noise(uv * 400.0) * 0.15) * (1.0 - crack);
	col = mix(col, col * vec3(0.9, 0.8, 0.55), 0.4); // old varnish
	ALBEDO = col;
	ROUGHNESS = 0.45;
	SPECULAR = 0.6;
}
