@tool
extends Node2D
## Checkout component: dock point, a hopper/funnel that mushrooms tumble into,
## the reusable Scanner, and a bag at the bottom.
##
## POSITIONING: the node's origin is the FLOOR point directly under the hopper.
## Drag the whole Checkout node so that origin sits on your real floor next to
## your real checkout desk. The art here is placeholder; the gameplay only needs
## the child markers + the hopper collision.
##
## Children you can move in the editor:
##   DockPoint     where the trolley's centre must stop to dump (on the floor)
##   HopperTarget  what dumped mushrooms are aimed at
##   SpitPoint     where "returned" items get fired back out (random event)
##   Scanner       Area2D with the scan beam; anything scannable passing through
##                 gets evaluated (see Scanner.gd)

signal item_scanned(item: Node, scan_id: StringName, response: Dictionary)

@export var dock_tolerance := 55.0
## The trolley must be slower than this to dump.
@export var dock_max_speed := 140.0
@export var draw_placeholder_art := true

enum Mode { CLOSED, OPEN, DUMPING }
var mode := Mode.CLOSED
var _display_text := "CLOSED"
var _display_color := Color(0.9, 0.4, 0.3)
var _t := 0.0
var _beam_flash := 0.0
var _popups: Array[Dictionary] = []

@onready var scanner: Area2D = $Scanner
@onready var dock_point: Marker2D = $DockPoint
@onready var hopper_target: Marker2D = $HopperTarget
@onready var spit_point: Marker2D = $SpitPoint

## Hopper collision (local, origin on the floor under the funnel).
const FUNNEL := [
	[Vector2(-82, -178), Vector2(-40, -122)],   # left lip of the funnel
	[Vector2(82, -200), Vector2(40, -122)],     # right side of the funnel
	[Vector2(-40, -122), Vector2(-40, -96)],    # neck
	[Vector2(40, -122), Vector2(40, -96)],
	[Vector2(-50, -92), Vector2(-50, 0)],       # bag
	[Vector2(50, -92), Vector2(50, 0)],
	[Vector2(82, -200), Vector2(82, 0)],        # back of the counter
]


func _ready() -> void:
	if Engine.is_editor_hint():
		return
	_build_hopper()
	scanner.scanned.connect(_on_scanned)
	set_mode(Mode.CLOSED)


func _build_hopper() -> void:
	var sb := StaticBody2D.new()
	sb.name = "HopperBody"
	var mat := PhysicsMaterial.new()
	mat.bounce = 0.0
	mat.friction = 0.3
	sb.physics_material_override = mat
	for seg in FUNNEL:
		var cs := CollisionShape2D.new()
		var s := SegmentShape2D.new()
		s.a = seg[0]
		s.b = seg[1]
		cs.shape = s
		sb.add_child(cs)
	add_child(sb)


func configure_collision(layer: int, mask: int) -> void:
	var sb := get_node_or_null("HopperBody") as StaticBody2D
	if sb:
		sb.collision_layer = layer
		sb.collision_mask = mask
	scanner.collision_layer = 0
	scanner.collision_mask = layer


func set_mode(m: Mode) -> void:
	mode = m
	scanner.active = m != Mode.CLOSED
	match m:
		Mode.CLOSED:
			_display_text = "CLOSED"
			_display_color = Color(0.9, 0.4, 0.3)
		Mode.OPEN:
			_display_text = "READY!"
			_display_color = Color(0.4, 1, 0.5)
		Mode.DUMPING:
			_display_text = "SCANNING"
			_display_color = Color(1, 0.9, 0.4)


func get_dock_x() -> float:
	return dock_point.global_position.x


func is_docked(trolley_x: float, trolley_speed: float) -> bool:
	return absf(trolley_x - get_dock_x()) <= dock_tolerance and absf(trolley_speed) <= dock_max_speed


func get_hopper_target() -> Vector2:
	return hopper_target.global_position


func get_spit_point() -> Vector2:
	return spit_point.global_position


func show_message(text: String, color: Color) -> void:
	_display_text = text
	_display_color = color


func popup(text: String, color: Color) -> void:
	_popups.append({"text": text, "color": color, "t": 0.0, "x": randf_range(-20.0, 20.0)})


func _on_scanned(item: Node, scan_id: StringName, response: Dictionary) -> void:
	_beam_flash = 1.0
	show_message(response.get("text", "?"), response.get("color", Color.WHITE))
	popup(response.get("text", "?"), response.get("color", Color.WHITE))
	item_scanned.emit(item, scan_id, response)


func _process(delta: float) -> void:
	_t += delta
	_beam_flash = maxf(0.0, _beam_flash - delta * 3.0)
	var i := 0
	while i < _popups.size():
		_popups[i].t += delta
		if _popups[i].t > 1.3:
			_popups.remove_at(i)
		else:
			i += 1
	queue_redraw()


func _draw() -> void:
	if not draw_placeholder_art:
		return
	var font := ThemeDB.fallback_font
	var open := mode != Mode.CLOSED or Engine.is_editor_hint()
	# till counter
	draw_rect(Rect2(40, -96, 190, 96), Color(0.3, 0.32, 0.42))
	draw_rect(Rect2(40, -104, 196, 12), Color(0.55, 0.58, 0.7))
	draw_rect(Rect2(46, -86, 178, 6), Color(0.2, 0.2, 0.25))
	# conveyor stripes
	for k in 9:
		var x := 50.0 + fmod(k * 20.0 + _t * 30.0, 175.0)
		draw_line(Vector2(x, -97), Vector2(x + 8, -97), Color(0.15, 0.15, 0.18), 3.0)
	# till + display
	draw_rect(Rect2(150, -190, 70, 86), Color(0.22, 0.22, 0.28))
	draw_rect(Rect2(156, -184, 58, 30), Color(0.05, 0.08, 0.06))
	var txt := _display_text
	draw_string(font, Vector2(159, -164), txt.substr(0, 9), HORIZONTAL_ALIGNMENT_LEFT, 54, 11, _display_color)
	# lamp pole
	draw_line(Vector2(186, -190), Vector2(186, -250), Color(0.5, 0.5, 0.55), 4.0)
	var lamp := Color(0.3, 1, 0.4) if open else Color(0.9, 0.2, 0.15)
	var pulse := 0.6 + 0.4 * sin(_t * (8.0 if mode == Mode.OPEN else 2.0))
	draw_circle(Vector2(186, -258), 12.0, lamp * Color(1, 1, 1, pulse))
	draw_circle(Vector2(186, -258), 22.0, Color(lamp, 0.18 * pulse))
	# hopper funnel + bag
	var bag := PackedVector2Array([Vector2(-50, 0), Vector2(50, 0), Vector2(54, -92), Vector2(-54, -92)])
	draw_colored_polygon(bag, Color(0.8, 0.65, 0.42))
	draw_polyline(PackedVector2Array([Vector2(-54, -92), Vector2(-50, 0), Vector2(50, 0), Vector2(54, -92)]), Color(0.55, 0.42, 0.25), 3.0)
	draw_string(font, Vector2(-30, -40), "SHROOM", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.6, 0.15, 0.1))
	draw_string(font, Vector2(-20, -24), "MART", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.6, 0.15, 0.1))
	var funnel_poly := PackedVector2Array([Vector2(-82, -178), Vector2(-40, -122), Vector2(40, -122), Vector2(82, -200)])
	draw_colored_polygon(funnel_poly, Color(0.55, 0.6, 0.7, 0.35))
	for seg in FUNNEL:
		draw_line(seg[0], seg[1], Color(0.75, 0.8, 0.9), 4.0)
	# scan beam across the funnel mouth (sweeps a little so it reads as a laser)
	var beam_col := Color(1, 0.15, 0.15, 0.55 + 0.45 * _beam_flash) if open else Color(0.4, 0.1, 0.1, 0.3)
	var sweep := sin(_t * 5.0) * 6.0 if open else 0.0
	draw_line(Vector2(-74, -168 + sweep), Vector2(74, -182 + sweep), beam_col, 3.0 + 4.0 * _beam_flash)
	draw_circle(Vector2(-78, -168 + sweep), 5.0, Color(0.3, 0.3, 0.35))
	draw_circle(Vector2(78, -182 + sweep), 5.0, Color(0.3, 0.3, 0.35))
	if _beam_flash > 0.0:
		draw_circle(Vector2(0, -175), 50.0 * _beam_flash, Color(1, 0.3, 0.3, 0.25 * _beam_flash))
	# sign
	draw_rect(Rect2(-70, -320, 150, 36), Color(0.85, 0.2, 0.2))
	draw_rect(Rect2(-70, -320, 150, 36), Color(1, 0.95, 0.85), false, 2.0)
	draw_string(font, Vector2(-62, -296), "CHECKOUT 1", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1, 0.95, 0.85))
	draw_line(Vector2(5, -284), Vector2(5, -205), Color(0.5, 0.5, 0.55), 3.0)
	# popups
	for p in _popups:
		var a: float = 1.0 - p.t / 1.3
		var pos := Vector2(-30 + p.x, -215 - p.t * 70.0)
		draw_string(font, pos + Vector2(2, 2), p.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color(0, 0, 0, a * 0.6))
		draw_string(font, pos, p.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color(p.color, a))
	if Engine.is_editor_hint():
		draw_line(Vector2(-160, -4), Vector2(-160, 4), Color.YELLOW, 2.0)
