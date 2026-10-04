shader_type canvas_item;
// Deep-water backdrop for the aquarium: depth gradient, distant fog, soft
// light rays, animated caustics and a sandy floor (also with caustics).
// Applied to a ColorRect that exactly covers aquarium_bounds.

uniform float light_level : hint_range(0.0, 1.5) = 1.0;
uniform float chase_energy : hint_range(0.0, 1.0) = 0.0;
uniform float horizon_uv = 0.80;   // where the far sand begins (0 = top, 1 = bottom)
uniform float floor_uv = 0.917;    // the play floor line
uniform float aspect = 2.14;
uniform vec4 surface_color : source_color = vec4(0.10, 0.38, 0.44, 1.0);
uniform vec4 deep_color : source_color = vec4(0.012, 0.05, 0.085, 1.0);
uniform vec4 sand_color : source_color = vec4(0.52, 0.45, 0.34, 1.0);
uniform vec2 deep_glow_uv = vec2(0.65, 0.42);
uniform float deep_glow = 0.0;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float caustic(vec2 uv, float t) {
	vec2 p = mod(uv * 6.2831, 6.2831) - 250.0;
	vec2 i = p;
	float c = 1.0;
	float inten = 0.005;
	for (int n = 0; n < 4; n++) {
		float tt = t * (1.0 - (3.5 / float(n + 1)));
		i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
		c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
	}
	c /= 4.0;
	c = 1.17 - pow(c, 1.4);
	return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}

void fragment() {
	vec2 uv = UV;
	float t = TIME * (0.35 + chase_energy * 0.25);
	// Water: bright near the surface, very dark in the depths.
	float depth = smoothstep(0.0, 0.95, uv.y);
	vec3 col = mix(surface_color.rgb, deep_color.rgb, pow(depth, 0.8));
	// Distant fog band - the tank continues much further back than you think.
	float fog = exp(-pow((uv.y - 0.55) * 3.0, 2.0)) * 0.5;
	col = mix(col, deep_color.rgb * 0.6, fog * 0.6);
	// Soft drifting light rays from the surface.
	float rays = 0.0;
	for (int k = 0; k < 3; k++) {
		float fk = float(k);
		float x = uv.x * (3.0 + fk * 1.7) + uv.y * (0.9 + fk * 0.3) + sin(t * (0.3 + fk * 0.13) + fk) * 0.6;
		rays += pow(max(0.0, sin(x * 3.14159)), 18.0 - fk * 4.0) * (0.4 - fk * 0.1);
	}
	rays *= (1.0 - smoothstep(0.0, 0.85, uv.y));
	col += vec3(0.25, 0.45, 0.42) * rays * 0.35;
	// Caustic shimmer near the surface.
	float cs = caustic(vec2(uv.x * aspect, uv.y) * 0.9 + vec2(0.0, t * 0.05), t);
	col += vec3(0.25, 0.5, 0.5) * cs * 0.18 * (1.0 - smoothstep(0.0, 0.35, uv.y));
	// Something faintly luminous in the deep (driven by the deep creature).
	float dg = exp(-pow(distance(uv * vec2(aspect, 1.0), deep_glow_uv * vec2(aspect, 1.0)) * 2.2, 2.0));
	col += vec3(0.05, 0.12, 0.10) * dg * deep_glow;

	// Sand: far sand (dark, foggy) -> near floor (warm, caustics).
	if (uv.y > horizon_uv) {
		float f = clamp((uv.y - horizon_uv) / max(0.001, 1.0 - horizon_uv), 0.0, 1.0);
		float persp = pow(f, 0.7);
		vec2 suv = vec2(uv.x * aspect * (1.5 + persp * 2.0), f * 6.0);
		float dunes = noise(suv * 3.0) * 0.6 + noise(suv * 9.0) * 0.4;
		float ripples = sin(suv.x * 14.0 + dunes * 4.0 + suv.y * 3.0) * 0.5 + 0.5;
		vec3 sand = sand_color.rgb * (0.55 + 0.35 * dunes + 0.08 * ripples);
		sand = mix(deep_color.rgb * 1.4, sand, smoothstep(0.0, 0.85, persp));
		float c2 = caustic(vec2(uv.x * aspect * 1.6, uv.y * 4.0) + vec2(t * 0.03, 0.0), t * 1.3);
		sand += vec3(0.55, 0.7, 0.6) * c2 * 0.45 * persp;
		// Soft edge where the sand meets the water.
		float edge = smoothstep(0.0, 0.08, f);
		col = mix(col, sand, edge);
	}
	// Vignette towards the tank edges.
	vec2 v = uv - 0.5;
	float vig = 1.0 - dot(v * vec2(1.1, 1.3), v * vec2(1.1, 1.3)) * 0.9;
	col *= clamp(vig, 0.0, 1.0);
	col *= light_level;
	COLOR = vec4(col, 1.0);
}
