class_name LBBiscuit
extends LBTableObject
## A piece of food. Everyone is starving, but nobody may eat until the guest
## of honour arrives. Can be held, dropped, slid, fought over (tugged) and -
## for biscuits - broken. A fake biscuit (squeaky rubber coaster) can be
## planted by a rival. food_type "guest" is THE biscuit on the ornate plate.

signal broke(big: LBBiscuit, small: LBBiscuit)

## Fraction of a whole biscuit (1.0 whole, ~0.62 large half, ~0.38 small half).
@export var size_fraction := 1.0
@export var is_fake := false
## Impact speed (m/s) against something heavy that snaps it.
@export var break_impact_speed := 2.6
## Tug tension (m) between two holders that starts cracking it.
@export var tug_crack_distance := 0.11
@export var tug_crack_time := 0.55

## How filling it is (hunger points).
const FOODS := {
	"biscuit": {"value": 1, "r": 0.075},
	"cake": {"value": 2, "r": 0.085},
	"sandwich": {"value": 1, "r": 0.08},
	"eclair": {"value": 2, "r": 0.075},
	"grapes": {"value": 1, "r": 0.075},
	"tart": {"value": 1, "r": 0.07},
	"sausage_roll": {"value": 1, "r": 0.075},
	"macaron": {"value": 1, "r": 0.06},
	"guest": {"value": 3, "r": 0.085},
}

var food_type := "biscuit"
var holders: Array = []        # every hand currently gripping it
var tug_strain := 0.0
var crumbs_seed := 0.0


func setup(pos: Vector2, fraction := 1.0, fake := false, type := "biscuit") -> void:
	configure(Kind.FAKE_BISCUIT if fake else Kind.BISCUIT, pos, randf() * TAU)
	food_type = type if FOODS.has(type) else "biscuit"
	size_fraction = fraction
	is_fake = fake
	radius = float(FOODS[food_type].r) * sqrt(fraction) + 0.01 * (1.0 - fraction)
	crumbs_seed = randf() * 100.0
	name = ("Fake" if fake else food_type.capitalize().replace(" ", "")) + "_%d" % (get_instance_id() % 1000)


## Worth eating at all (fakes and crumbs are not).
func is_real_prize() -> bool:
	return not is_fake and size_fraction >= 0.3


func value() -> float:
	if is_fake:
		return 0.0
	var v := float(FOODS[food_type].value)
	return v if size_fraction > 0.9 else maxf(1.0, round(v * size_fraction))


func is_guest() -> bool:
	return food_type == "guest"


func can_break() -> bool:
	return (food_type == "biscuit" or food_type == "guest") and size_fraction > 0.99 and not is_fake


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
	var y := 0.0075
	if world:
		for p in world.objects:
			if not p.on_table or not LBTableWorld.is_surface(p) or p.kind == Kind.NAPKIN:
				continue
			if p.plane_pos.distance_to(plane_pos) < p.radius * 0.85:
				y = 0.046 if p.kind == Kind.BISCUIT_PLATE else 0.02
	if held_by != null:
		y = 0.0
	mesh.position.y = lerpf(mesh.position.y, y, LBConst.damp(20.0, dt))
	# a contested biscuit trembles under the strain
	if tug_strain > 0.0:
		mesh.position.x = sin(Time.get_ticks_msec() * 0.08) * 0.004 * tug_strain
	else:
		mesh.position.x = 0.0
