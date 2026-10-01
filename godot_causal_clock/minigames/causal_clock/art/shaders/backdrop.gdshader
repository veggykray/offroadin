// Dreamlike room behind the clock: warm pool of light behind the artifact,
// slow-moving god rays from an unseen window, vignette and film grain.
shader_type canvas_item;

uniform vec4 base_top : source_color = vec4(0.065, 0.055, 0.07, 1.0);
uniform vec4 base_bottom : source_color = vec4(0.012, 0.012, 0.022, 1.0);
uniform vec4 pool_color : source_color = vec4(0.11, 0.07, 0.04, 1.0);
uniform vec4 ray_color : source_color = vec4(1.0, 0.8, 0.52, 1.0);
uniform float ray_strength = 0.16;
uniform vec2 light_pos = vec2(0.16, -0.2);
uniform float aspect = 1.7778;
uniform float flare = 0.0;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(float x) {
	float i = floor(x);
	float f = fract(x);
	return mix(hash(vec2(i, 0.0)), hash(vec2(i + 1.0, 0.0)), smoothstep(0.0, 1.0, f));
}

void fragment() {
	vec2 uv = UV;
	vec3 col = mix(base_top.rgb, base_bottom.rgb, uv.y);
	vec2 p = vec2(uv.x * aspect, uv.y);
	float d = distance(p, vec2(0.5 * aspect, 0.5));
	col += pool_color.rgb * smoothstep(0.8, 0.0, d) * (1.0 + flare * 2.0);
	vec2 dir = uv - light_pos;
	float ang = atan(dir.y, dir.x);
	float t = TIME * 0.05;
	float r = vnoise(ang * 22.0 + t * 3.0) * 0.6 + vnoise(ang * 47.0 - t * 4.0) * 0.4;
	r = pow(r, 3.0);
	float fall = smoothstep(1.7, 0.1, length(dir));
	col += ray_color.rgb * r * fall * (ray_strength + flare * 0.4);
	float v = smoothstep(1.3, 0.3, d);
	col *= mix(0.3, 1.0, v);
	col += (hash(uv * vec2(1931.0, 1087.0) + fract(TIME * 0.73)) - 0.5) * 0.018;
	COLOR = vec4(col, 1.0);
}
