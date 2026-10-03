extends Node2D
## THE BEAST TENDING — wiring. Routes recognised gestures to whichever part of
## the beast is under Bill's hand, asks the sequence how the beast feels about
## it, and lets the body and mind react.

@onready var gestures: GestureRecognizer = $GestureRecognizer
@onready var mind: BeastMind = $BeastMind
@onready var sequence: TendingSequence = $TendingSequence
@onready var body: BeastBody = $World/Body
@onready var camera: BeastCamera = $Camera
@onready var hand: BillHand = $UI/Hand
@onready var cards: Cards = $Cards
@onready var debug_overlay: DebugOverlay = $UI/Debug
@onready var sky: ColorRect = $Sky/Rect

## Region hit-test priority (small, specific things first).
const PRIORITY := [&"crevice", &"nodules", &"flap", &"whiskers", &"fold", &"fur"]

var playing := false
var spores: CPUParticles2D


func _ready() -> void:
	Game.gestures = gestures
	gestures.enabled = false
	gestures.gesture_detected.connect(_on_gesture)
	gestures.gesture_began.connect(func(g): hand.set_gesture(g.type, true))
	gestures.gesture_ended.connect(func(_g): hand.set_gesture(Gesture.Type.NONE, gestures.pressed))
	gestures.type_changed.connect(func(tp): hand.set_gesture(tp, gestures.pressed))
	gestures.pointer_moved.connect(_on_pointer)
	mind.shifted_away.connect(_on_shifted_away)
	sequence.finished.connect(_on_finished)
	cards.start_requested.connect(_start)
	cards.restart_requested.connect(func(): get_tree().reload_current_scene())
	_make_spores()
	hand.show_hand(true)


func _start() -> void:
	playing = true
	gestures.enabled = true
	camera.input_enabled = true
	hand.show_hand(true)
	sequence.begin()


func _on_finished() -> void:
	playing = false
	gestures.enabled = false
	camera.input_enabled = false
	hand.show_hand(false)
	cards.show_end()


func find_region(world_pos: Vector2) -> BodyRegion:
	for id in PRIORITY:
		var r: BodyRegion = Game.region(id)
		if r and r.contains(world_pos):
			return r
	return null


func _on_gesture(g: Gesture) -> void:
	if not playing:
		return
	g.world_pos = Game.screen_to_world(g.screen_pos)
	if g.type == Gesture.Type.POKE:
		hand.tap()
	var region := find_region(g.world_pos)
	var level: int
	if region:
		level = sequence.judge(region, g)
		mind.apply(level, region, g)
		body.present(level, region, g.world_pos, g)
	else:
		level = sequence.judge_bare(g)
		mind.apply(level, null, g)
		body.present(level, null, g.world_pos, g)
		if g.type == Gesture.Type.POKE and Game.terrain:
			Game.terrain.add_ripple(g.world_pos, 0.12)
	debug_overlay.record(g, str(region.region_id) if region else "hide", level)


func _on_pointer(screen_pos: Vector2, pressed: bool, velocity: Vector2) -> void:
	var wp := Game.screen_to_world(screen_pos)
	for r in Game.regions.values():
		r.on_pointer(wp, pressed and playing, velocity)


func _on_shifted_away(region: BodyRegion) -> void:
	body.shift_away(region)
	sequence.on_shifted_away()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_F1, KEY_QUOTELEFT:
				Game.debug = not Game.debug
			KEY_F2:
				if Game.debug and playing:
					sequence.skip_stage()
			KEY_F3:
				if Game.debug and playing:
					body.hint(sequence.current_target(), 1.0)
			KEY_F4:
				if Game.debug:
					get_tree().reload_current_scene()
			KEY_M:
				var bus := AudioServer.get_bus_index("Master")
				AudioServer.set_bus_mute(bus, not AudioServer.is_bus_mute(bus))
			KEY_ESCAPE:
				hand.show_hand(Input.mouse_mode != Input.MOUSE_MODE_HIDDEN)


func _process(_delta: float) -> void:
	var m := sky.material as ShaderMaterial
	m.set_shader_parameter("cam_x", Game.camera_x())
	m.set_shader_parameter("u_time", Time.get_ticks_msec() / 1000.0)
	m.set_shader_parameter("excite", mind.escalation)
	spores.position = Vector2(Game.camera_x(), 560)


func _make_spores() -> void:
	spores = CPUParticles2D.new()
	spores.amount = 90
	spores.lifetime = 9.0
	spores.preprocess = 9.0
	spores.texture = Game.soft_texture
	spores.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	spores.emission_rect_extents = Vector2(1200, 560)
	spores.direction = Vector2(0.3, -1)
	spores.spread = 60.0
	spores.gravity = Vector2(4, -6)
	spores.initial_velocity_min = 4.0
	spores.initial_velocity_max = 22.0
	spores.scale_amount_min = 0.03
	spores.scale_amount_max = 0.11
	spores.local_coords = false
	spores.z_index = 20
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.2, 0.8, 1.0])
	grad.colors = PackedColorArray([Color(0.7, 1.0, 0.85, 0.0), Color(0.75, 1.0, 0.85, 0.7), Color(1.0, 0.85, 0.6, 0.5), Color(1.0, 0.8, 0.6, 0.0)])
	spores.color_ramp = grad
	var mat := CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	spores.material = mat
	$World.add_child(spores)
