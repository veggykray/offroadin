shader_type canvas_item;
// Breathing vignette: darkens the frame edges, pulses warm as the beast gets
// worked up, flickers redder when it is irritated.

uniform float breath = 0.0;
uniform float excite = 0.0;
uniform float irritated = 0.0;

void fragment() {
	vec2 uv = UV - 0.5;
	uv.x *= 1.6;
	float d = length(uv);
	float edge = smoothstep(0.45 - breath * 0.015, 1.05, d);
	vec3 warm = mix(vec3(0.0), vec3(0.45, 0.08, 0.05), excite * (0.6 + 0.4 * breath));
	warm = mix(warm, vec3(0.5, 0.0, 0.0), irritated * 0.4);
	float a = edge * (0.75 + excite * 0.1);
	COLOR = vec4(warm, a);
}
