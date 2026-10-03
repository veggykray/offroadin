shader_type spatial;
// Cheap shaggy fur look for the dog and the cat's tail.
uniform vec3 fur : source_color = vec3(0.42, 0.28, 0.16);
uniform vec3 tip : source_color = vec3(0.75, 0.62, 0.45);
varying vec3 lpos;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
	vec3 i = floor(p); vec3 f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), u.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), u.x), u.y),
		mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), u.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
void vertex() {
	lpos = VERTEX;
	float n = noise(VERTEX * 40.0);
	VERTEX += NORMAL * n * 0.012;
}
void fragment() {
	float strand = noise(lpos * vec3(30.0, 160.0, 30.0));
	ALBEDO = mix(fur * 0.6, tip, strand);
	ROUGHNESS = 0.95;
	RIM = 0.6;
	RIM_TINT = 0.8;
	BACKLIGHT = vec3(0.2, 0.15, 0.1);
}
