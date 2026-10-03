shader_type canvas_item;
// Dusky, humid air above the beast: a warm glow low on the horizon, slow
// drifting haze, and the occasional distant glint.

uniform float cam_x = 0.0;
uniform float u_time = 0.0;
uniform float excite = 0.0;
uniform float flash = 0.0;
uniform vec4 col_top : source_color = vec4(0.04, 0.025, 0.09, 1.0);
uniform vec4 col_mid : source_color = vec4(0.22, 0.09, 0.22, 1.0);
uniform vec4 col_horizon : source_color = vec4(0.92, 0.50, 0.32, 1.0);

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
			mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 4; i++) {
		v += a * vnoise(p);
		p = p * 2.1 + 3.7;
		a *= 0.5;
	}
	return v;
}

void fragment() {
	vec2 uv = UV;
	float y = uv.y;
	vec3 col = mix(col_top.rgb, col_mid.rgb, smoothstep(0.0, 0.22, y));
	col = mix(col, col_horizon.rgb, smoothstep(0.14, 0.42, y));
	// A great diffuse glow behind the beast.
	vec2 sun = vec2(0.62 - cam_x * 0.00002, 0.3);
	float d = distance(uv * vec2(1.78, 1.0), sun * vec2(1.78, 1.0));
	col += vec3(1.0, 0.7, 0.45) * exp(-d * 3.2) * (0.45 + excite * 0.25);
	// Drifting haze bands.
	vec2 hp = vec2(uv.x * 2.4 + cam_x * 0.00011 + u_time * 0.01, uv.y * 7.0);
	float haze = fbm(hp + vec2(fbm(hp * 0.5 + u_time * 0.02), 0.0));
	col = mix(col, col * 1.25 + vec3(0.05, 0.02, 0.04), smoothstep(0.45, 0.8, haze) * 0.5 * (1.0 - y));
	// Faint distant motes high up.
	vec2 sp = vec2(uv.x * 160.0 + cam_x * 0.012, uv.y * 90.0);
	vec2 cell = floor(sp);
	float hs = hash(cell);
	float st = step(0.993, hs) * smoothstep(0.16, 0.0, length(fract(sp) - 0.5))
			* (0.5 + 0.5 * sin(u_time * 2.0 + hs * 50.0));
	col += vec3(1.0, 0.9, 0.8) * st * (1.0 - smoothstep(0.0, 0.3, y)) * 0.6;
	col += vec3(1.0, 0.85, 0.75) * flash;
	COLOR = vec4(col, 1.0);
}
