shader_type canvas_item;
// Living leathery hide: plated cells, wrinkles, pores, bioluminescent veins,
// warm subsurface glow near the silhouette and glow ripples spreading from
// contact points. The surface contour mirrors Game.surface_y().

uniform vec4 col_deep : source_color = vec4(0.09, 0.05, 0.08, 1.0);
uniform vec4 col_mid : source_color = vec4(0.34, 0.22, 0.25, 1.0);
uniform vec4 col_light : source_color = vec4(0.60, 0.45, 0.40, 1.0);
uniform vec4 col_rim : source_color = vec4(1.0, 0.60, 0.40, 1.0);
uniform vec4 col_vein : source_color = vec4(0.25, 1.0, 0.82, 1.0);
uniform vec4 col_pore : source_color = vec4(0.65, 1.0, 0.55, 1.0);
uniform vec4 col_flush : source_color = vec4(0.80, 0.42, 0.32, 1.0);
uniform float glow_amount = 0.0;
uniform float flush = 0.0;
uniform float tension = 0.0;
uniform float u_time = 0.0;
uniform vec4 ripple0 = vec4(0.0);
uniform vec4 ripple1 = vec4(0.0);
uniform vec4 ripple2 = vec4(0.0);
uniform vec4 ripple3 = vec4(0.0);
uniform vec4 ripple4 = vec4(0.0);
uniform vec4 ripple5 = vec4(0.0);
uniform float surface_base = 300.0;
uniform vec3 wave0 = vec3(70.0, 0.0011, 0.6);
uniform vec3 wave1 = vec3(38.0, 0.0027, 2.1);
uniform vec3 wave2 = vec3(16.0, 0.0071, 0.3);

varying vec2 wpos;

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

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		v += a * vnoise(p);
		p = p * 2.03 + vec2(1.7, 9.2);
		a *= 0.5;
	}
	return v;
}

float fbm3(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 3; i++) {
		v += a * vnoise(p);
		p = p * 2.03 + vec2(1.7, 9.2);
		a *= 0.5;
	}
	return v / 0.875;
}

vec3 voronoi(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	float d1 = 8.0;
	float d2 = 8.0;
	float id = 0.0;
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			vec2 g = vec2(float(x), float(y));
			vec2 o = hash2(i + g);
			vec2 r = g + o - f;
			float d = dot(r, r);
			if (d < d1) {
				d2 = d1;
				d1 = d;
				id = hash(i + g + 3.3);
			} else if (d < d2) {
				d2 = d;
			}
		}
	}
	return vec3(sqrt(d1), sqrt(d2), id);
}

float surface_y(float x) {
	return surface_base + wave0.x * sin(x * wave0.y + wave0.z)
			+ wave1.x * sin(x * wave1.y + wave1.z)
			+ wave2.x * sin(x * wave2.y + wave2.z);
}

float ripple(vec4 r) {
	float age = u_time - r.z;
	if (r.w <= 0.0 || age < 0.0 || age > 5.0) {
		return 0.0;
	}
	float d = distance(wpos, r.xy);
	float front = age * 620.0;
	float ring = exp(-pow((d - front) / 170.0, 2.0)) * exp(-age * 0.7);
	float core = exp(-d / 260.0) * exp(-age * 1.8) * 0.7;
	return (ring + core) * r.w;
}

void vertex() {
	wpos = VERTEX;
}

void fragment() {
	vec2 p = wpos / 220.0;
	float depth = wpos.y - surface_y(wpos.x);
	vec2 warp = vec2(fbm3(p * 0.6 + 3.1), fbm3(p * 0.6 + 7.7)) - 0.5;

	// Broad bulges and a fake normal for lighting.
	vec2 bp = p * 0.35 + warp * 0.8;
	float big = fbm(bp);
	float hx = fbm3(bp + vec2(0.06, 0.0)) - fbm3(bp);
	float hy = fbm3(bp + vec2(0.0, 0.06)) - fbm3(bp);
	vec3 n = normalize(vec3(-hx * 16.0, -hy * 16.0, 1.0));
	float light = clamp(dot(n, normalize(vec3(0.25, -0.75, 0.6))), 0.0, 1.0);

	// Leathery cells, stretched along the body.
	vec2 cp = p * vec2(2.0, 3.2) + warp * 1.7;
	vec3 v = voronoi(cp);
	float crack = smoothstep(0.0, 0.05 + tension * 0.05, v.y - v.x);
	float bulge = 1.0 - v.x * 0.75;
	// A finer network of creases inside each plate.
	vec3 v2 = voronoi(cp * 3.1 + warp * 3.0);
	float fine = smoothstep(0.0, 0.05, v2.y - v2.x);

	// Wrinkles: warped horizontals.
	float wr = sin(p.y * 24.0 + fbm3(p * 1.3) * 11.0 + p.x * 1.5);
	float wrinkles = smoothstep(0.7, 1.0, wr) * (0.45 + tension * 0.8);

	float shade = clamp(big * 1.25 - 0.12, 0.0, 1.0);
	vec3 col = mix(col_deep.rgb, col_mid.rgb, shade);
	col = mix(col, col_light.rgb, pow(shade, 3.0) * 0.85);
	// Mottled patches of colour across the hide.
	float mott = fbm3(p * 0.25 + 17.0);
	col = mix(col, col * vec3(1.15, 0.92, 0.88), smoothstep(0.45, 0.7, mott) * 0.6);
	col = mix(col, col * vec3(0.85, 0.95, 1.05), smoothstep(0.55, 0.3, mott) * 0.4);
	col *= mix(0.66, 1.0, crack);
	col *= mix(0.86, 1.0, fine);
	col *= mix(0.84, 1.1, bulge);
	col *= 0.9 + 0.12 * v.z;
	col *= 1.0 - wrinkles * 0.28;
	col = mix(col, col * col_flush.rgb * 1.7, flush * 0.55);
	col *= 0.62 + 0.62 * light;

	// Closer to the camera (lower on screen) is darker, wetter.
	float down = clamp((wpos.y - 320.0) / 850.0, 0.0, 1.0);
	col *= mix(1.0, 0.5, down);

	// Back-lit rim and subsurface glow at the silhouette.
	float rim = exp(-max(depth, 0.0) / 12.0);
	float sss = exp(-max(depth, 0.0) / 110.0);
	col = mix(col, col * vec3(1.5, 0.78, 0.62) + vec3(0.09, 0.02, 0.0), sss * 0.5);
	col += col_rim.rgb * rim * 0.9;

	// Pores; a few are bioluminescent.
	vec3 pv = voronoi(p * 9.0 + warp * 2.0);
	float pore = smoothstep(0.17, 0.06, pv.x);
	float pulse = 0.5 + 0.5 * sin(u_time * (0.8 + pv.z * 2.2) + pv.z * 40.0);
	col *= 1.0 - pore * 0.55;
	float pore_glow = pore * step(0.7, pv.z) * (0.18 + 0.9 * glow_amount) * pulse;

	// Veins under the skin, lit by glow and by ripples from contact.
	float vn = fbm3(p * 0.8 + warp * 0.9 + 11.0);
	float vein = pow(1.0 - abs(vn * 2.0 - 1.0), 20.0);
	float vein2 = pow(1.0 - abs(fbm3(p * 1.6 + warp * 0.7 + 5.0) * 2.0 - 1.0), 26.0) * 0.6;
	float rip = ripple(ripple0) + ripple(ripple1) + ripple(ripple2)
			+ ripple(ripple3) + ripple(ripple4) + ripple(ripple5);
	float vglow = (vein + vein2 * 0.6) * (glow_amount * 0.9 + rip * 1.5 + 0.04);
	col *= 1.0 - vein * 0.2;
	col += col_vein.rgb * min(vglow, 1.3) * 0.85;
	col += col_pore.rgb * pore_glow * 1.5;
	col += col_vein.rgb * rip * 0.04;

	COLOR = vec4(col, 1.0);
}
