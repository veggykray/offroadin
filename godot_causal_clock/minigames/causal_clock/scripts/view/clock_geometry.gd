class_name CausalClockGeometry
extends RefCounted
## Radii and angle helpers shared by every visual component.
## All angles are degrees clockwise from 12 o'clock (same as the layout data).

const RING_AREA_RADIUS := 400.0
const MIN_HUB_RADIUS := 68.0
const MAX_BAND := 84.0
const GAP := 6.0

var layout: CausalClockLayout
var hub_radius: float = MIN_HUB_RADIUS
var band: float = 60.0
## Per element: inner and outer radius (the hub's inner radius is 0).
var r_in: PackedFloat32Array = PackedFloat32Array()
var r_out: PackedFloat32Array = PackedFloat32Array()
var outer_radius: float = RING_AREA_RADIUS
var bezel_inner: float = 0.0
var bezel_outer: float = 0.0


func _init(p_layout: CausalClockLayout) -> void:
	layout = p_layout
	var rc := layout.ring_count
	band = minf(MAX_BAND, (RING_AREA_RADIUS - MIN_HUB_RADIUS) / float(rc))
	hub_radius = MIN_HUB_RADIUS
	outer_radius = hub_radius + band * rc
	r_in.resize(layout.element_count())
	r_out.resize(layout.element_count())
	for i in rc:
		r_out[i] = outer_radius - band * i
		r_in[i] = r_out[i] - band + GAP
	r_out[rc] = hub_radius
	r_in[rc] = 0.0
	bezel_inner = outer_radius + 6.0
	bezel_outer = outer_radius + 74.0


func mid(element: int) -> float:
	if element == layout.hub_index():
		return hub_radius * 0.6
	return (r_in[element] + r_out[element]) * 0.5


## Radius of the seam between two elements (where a gear between them sits).
func seam(a: int, b: int) -> float:
	var outer := mini(a, b)
	return (r_in[outer] + r_out[outer + 1]) * 0.5 if outer + 1 < layout.element_count() else r_in[outer]


## Which element lies under a point at distance `d` from the centre.
func element_at(d: float) -> int:
	if d <= hub_radius:
		return layout.hub_index()
	for i in layout.ring_count:
		if d <= r_out[i] + GAP * 0.5 and d >= r_in[i] - GAP * 0.5:
			return i
	return -1


static func dir(angle_deg: float) -> Vector2:
	var a := deg_to_rad(angle_deg)
	return Vector2(sin(a), -cos(a))


static func point(angle_deg: float, radius: float) -> Vector2:
	return dir(angle_deg) * radius


## Angle (deg clockwise from 12) of a local vector.
static func angle_of(v: Vector2) -> float:
	return fposmod(rad_to_deg(atan2(v.x, -v.y)), 360.0)


static func arc(radius: float, from_deg: float, to_deg: float, step_deg: float = 3.0) -> PackedVector2Array:
	var pts := PackedVector2Array()
	var span := to_deg - from_deg
	var n := maxi(2, int(ceil(absf(span) / step_deg)) + 1)
	for i in n:
		pts.append(point(from_deg + span * float(i) / float(n - 1), radius))
	return pts
