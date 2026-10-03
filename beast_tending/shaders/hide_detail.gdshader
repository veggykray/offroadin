shader_type canvas_item;
// Adds leathery hide texture (plates, fine creases, pores, mottling) to the
// flat vertex colours of hand-drawn body regions, so they sit in the same
// skin as the terrain.

uniform float detail_scale = 0.025;
uniform float strength = 0.3;

varying vec2 lp;

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

vec2 hash2(vec2 p) {
	float n = hash(p);
	return vec2(n, hash(p + n + 17.0));
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
			mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec2 voronoi(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	float d1 = 8.0;
	float d2 = 8.0;
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 g = vec2(float(x), float(y));
			vec2 r = g + hash2(i + g) - f;
			float d = dot(r, r);
			if (d < d1) {
				d2 = d1;
				d1 = d;
			} else if (d < d2) {
				d2 = d;
			}
		}
	}
	return vec2(sqrt(d1), sqrt(d2));
}

void vertex() {
	lp = VERTEX;
}

void fragment() {
	vec2 p = lp * detail_scale;
	float n = vnoise(p * 0.6) * 0.6 + vnoise(p * 2.3) * 0.4;
	vec2 v = voronoi(p * vec2(1.0, 1.5) + n * 0.9);
	float crack = smoothstep(0.0, 0.06, v.y - v.x);
	float bulge = 1.0 - v.x * 0.7;
	vec2 pv = voronoi(p * 5.5 + 3.0);
	float pore = smoothstep(0.13, 0.04, pv.x);
	vec3 c = COLOR.rgb;
	c *= mix(1.0 - strength, 1.0, crack);
	c *= mix(0.88, 1.1, bulge);
	c *= 0.86 + n * 0.28;
	c *= 1.0 - pore * 0.35;
	COLOR = vec4(c, COLOR.a);
}
