class_name LBBiscuit
extends LBTableObject
## THE biscuit. Can be held, dropped, slid, fought over (tugged) and broken.
## A fake biscuit (painted cork coaster) can be planted by a rival.

signal broke(big: LBBiscuit, small: LBBiscuit)

## Fraction of a whole biscuit (1.0 whole, ~0.62 large half, ~0.38 small half).
@export var size_fraction := 1.0
@export var is_fake := false
## Impact speed (m/s) against something heavy that snaps it.
@export var break_impact_speed := 2.6
## Tug tension (m) between two holders that starts cracking it.
@export var tug_crack_distance := 0.11
@export var tug_crack_time := 0.55

var holders: Array = []        # every hand currently gripping it
var tug_strain := 0.0
var crumbs_seed := 0.0


func setup(pos: Vector2, fraction := 1.0, fake := false) -> void:
	configure(Kind.FAKE_BISCUIT if fake else Kind.BISCUIT, pos, randf() * TAU)
	size_fraction = fraction
	is_fake = fake
	radius = 0.085 * sqrt(fraction) + 0.01 * (1.0 - fraction)
	crumbs_seed = randf() * 100.0
	name = ("FakeBiscuit" if fake else "Biscuit") + "_%d" % (get_instance_id() % 1000)


func is_real_prize() -> bool:
	return not is_fake and size_fraction >= 0.5


func add_holder(h: Node) -> void:
	if not holders.has(h):
		holders.append(h)
	held_by = holders[0]


func remove_holder(h: Node) -> void:
	holders.erase(h)
	held_by = holders[0] if holders.size() > 0 else null
	if holders.size() < 2:
		tug_strain = 0.0


func is_contested() -> bool:
	return holders.size() >= 2


func _process(dt: float) -> void:
	super(dt)
	if visual == null:
		return
	var mesh := visual.get_node_or_null("BiscuitMesh") as Node3D
	if mesh == null:
		return
	# sit on the plate when over it, otherwise on the bare table
	var on_plate := false
	if world:
		for p in world.find_kind(Kind.BISCUIT_PLATE):
			if p.plane_pos.distance_to(plane_pos) < p.radius * 0.85:
				on_plate = true
	var y := 0.046 if on_plate else 0.0075
	if held_by != null:
		y = 0.0
	mesh.position.y = lerpf(mesh.position.y, y, LBConst.damp(20.0, dt))
	# a contested biscuit trembles under the strain
	if tug_strain > 0.0:
		mesh.position.x = sin(Time.get_ticks_msec() * 0.08) * 0.004 * tug_strain
	else:
		mesh.position.x = 0.0
