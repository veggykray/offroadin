// Additive shafts of light falling across the clock face (foreground).
shader_type canvas_item;
render_mode blend_add;

uniform vec4 ray_color : source_color = vec4(1.0, 0.82, 0.55, 1.0);
uniform float strength = 0.05;
uniform vec2 light_pos = vec2(0.16, -0.2);
uniform float flare = 0.0;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(float x) {
	float i = floor(x);
	float f = fract(x);
	return mix(hash(vec2(i, 0.0)), hash(vec2(i + 1.0, 0.0)), smoothstep(0.0, 1.0, f));
}

void fragment() {
	vec2 dir = UV - light_pos;
	float ang = atan(dir.y, dir.x);
	float t = TIME * 0.04;
	float r = vnoise(ang * 16.0 + t * 2.0) * 0.55 + vnoise(ang * 33.0 - t * 3.0) * 0.45;
	r = pow(r, 4.0);
	float fall = smoothstep(1.5, 0.0, length(dir));
	COLOR = vec4(ray_color.rgb * r * fall * (strength + flare * 0.25), 1.0);
}
