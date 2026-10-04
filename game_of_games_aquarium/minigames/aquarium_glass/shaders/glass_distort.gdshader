shader_type canvas_item;
// Glass vibration: bends whatever is behind the glass with expanding rings.
// Applied to a ColorRect covering the glass. Up to 8 ripples at once.

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform vec4 ripples[8];        // xy = centre (rect UV), z = age (s), w = strength
uniform float ripple_radius[8]; // max radius in rect pixels
uniform vec2 rect_size = vec2(1800.0, 840.0);
uniform vec2 rect_to_screen = vec2(1.0, 1.0); // rect UV delta -> screen UV delta
uniform float tremble = 0.0;

void fragment() {
	vec2 px = UV * rect_size;
	vec2 offset = vec2(0.0);
	float shine = 0.0;
	for (int i = 0; i < 8; i++) {
		vec4 r = ripples[i];
		if (r.w <= 0.0) continue;
		vec2 c = r.xy * rect_size;
		vec2 d = px - c;
		float dist = length(d);
		float speed = 900.0;
		float front = r.z * speed;
		float maxr = ripple_radius[i];
		if (dist > front + 40.0 || dist > maxr + 40.0) continue;
		float fade = exp(-r.z * 3.2) * (1.0 - smoothstep(maxr * 0.6, maxr + 40.0, dist));
		float wave = sin((dist - front) * 0.09) * exp(-abs(dist - front) * 0.018);
		vec2 dir = dist > 0.001 ? d / dist : vec2(0.0);
		offset += dir * wave * r.w * fade * 9.0;
		shine += max(0.0, wave) * r.w * fade * 0.12;
	}
	offset += vec2(sin(TIME * 70.0 + px.y * 0.05), cos(TIME * 63.0 + px.x * 0.05)) * tremble * 1.5;
	vec2 suv = SCREEN_UV + (offset / rect_size) * rect_to_screen;
	vec3 col = texture(screen_tex, suv).rgb;
	col += vec3(0.7, 0.9, 1.0) * shine;
	COLOR = vec4(col, 1.0);
}
