shader_type canvas_item;
// Heat haze: wobbles whatever has already been drawn beneath this layer.
// strength is driven by the TEMPERATURE level (0 below WARM, strongest at SCORCHING).

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform float strength = 0.0;

void fragment() {
	vec2 uv = SCREEN_UV;
	// Stronger toward the top of the room, where hot air collects.
	float rise = mix(1.0, 0.35, uv.y);
	float w1 = sin(uv.y * 85.0 - TIME * 5.5) * cos(uv.x * 37.0 + TIME * 3.1);
	float w2 = sin(uv.x * 63.0 + TIME * 4.3 + uv.y * 20.0);
	uv.x += w1 * strength * rise;
	uv.y += w2 * strength * 0.6 * rise;
	COLOR = texture(screen_tex, uv);
}
