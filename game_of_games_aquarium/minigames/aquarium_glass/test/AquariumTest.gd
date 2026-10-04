extends Node2D
## TEMPORARY test scene. Disposable - none of the module depends on it.
## Draws a placeholder room (wall, window frame, carpet, delivery hatch),
## starts the activity with TestBill and shows the result at the end.
##
## Command line extras (for automated play-testing):
##   godot --path . -- --autoplay         a bot plays the whole thing
##   godot --path . -- --autoplay --shots screenshots at key moments

@onready var activity: Node2D = $AquariumActivity
@onready var bill: Node2D = $TestBill

var _t := 0.0
var _legend_t := 0.0
var _result_text := ""
var _back: Node2D
var _front: Node2D
var _hatch_open := 0.0


func _ready() -> void:
	_back = Node2D.new()
	_back.z_index = -200
	add_child(_back)
	_back.draw.connect(_draw_back)
	_front = Node2D.new()
	_front.z_index = 90
	add_child(_front)
	_front.draw.connect(_draw_front)
	move_child(bill, -1)

	activity.reward_delivered.connect(_on_reward)
	activity.glass_touched.connect(func(p, kind): bill.point_at(p, kind))
	activity.activity_completed.connect(_on_completed)
	activity.start_activity(bill)

	var args := OS.get_cmdline_user_args()
	if "--autoplay" in args:
		var bot = load("res://minigames/aquarium_glass/test/AquariumAutoPlaytest.gd").new()
		bot.take_screenshots = "--shots" in args
		bot.fast = "--fast" in args
		bot.idle_mode = "--idle" in args
		bot.chase_only = "--chase" in args
		if "--sloppy" in args:   # a first-time player: imprecise and slow to react
			bot.aim_error = 160.0
			bot.think_time = 0.9
			bot.max_knocks = 1
		add_child(bot)


func _on_reward(_id: String) -> void:
	_hatch_open = 1.0
	bill.receive_memory_from(to_global(_hatch_pos()))


func _on_completed(data: Dictionary) -> void:
	var lines := PackedStringArray()
	for k in data.keys():
		lines.append("%s: %s" % [k, str(data[k])])
	_result_text = "activity_completed\n" + "\n".join(lines) + "\n\n[Enter] play again"
	print("AQUARIUM COMPLETED: ", data)


func _unhandled_key_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k and k.pressed and not k.echo and k.keycode == KEY_ENTER and _result_text != "":
		_result_text = ""
		activity.reset_activity()
		activity.start_activity(bill)


func _hatch_pos() -> Vector2:
	var g: Rect2 = activity.aquarium_bounds
	return Vector2(activity.layout_point("Chute").x, g.end.y + 70.0)


func _process(delta: float) -> void:
	_t += delta
	_legend_t += delta
	_hatch_open = move_toward(_hatch_open, 0.0, delta * 0.3)
	_back.queue_redraw()
	_front.queue_redraw()


func _draw_back() -> void:
	var vp := Rect2(Vector2(-200, -200), Vector2(2320, 1480))
	_back.draw_rect(vp, Color(0.07, 0.07, 0.085))
	var g: Rect2 = activity.aquarium_bounds
	# Light spilling from the tank onto the wall.
	for i in 6:
		_back.draw_rect(g.grow(30.0 + i * 26.0), Color(0.1, 0.3, 0.32, 0.035))
	# Carpet.
	_back.draw_rect(Rect2(-200, g.end.y + 120.0, 2320, 400), Color(0.13, 0.08, 0.09))


func _draw_front() -> void:
	var g: Rect2 = activity.aquarium_bounds
	var frame := Color(0.12, 0.13, 0.14)
	var t := 26.0
	_front.draw_rect(Rect2(g.position.x - t, g.position.y - t, g.size.x + t * 2, t), frame)
	_front.draw_rect(Rect2(g.position.x - t, g.end.y, g.size.x + t * 2, t + 6), frame)
	_front.draw_rect(Rect2(g.position.x - t, g.position.y, t, g.size.y), frame)
	_front.draw_rect(Rect2(g.end.x, g.position.y, t, g.size.y), frame)
	_front.draw_rect(g.grow(t), Color(0.3, 0.32, 0.33), false, 2.0)
	_front.draw_rect(g, Color(0.02, 0.03, 0.03), false, 3.0)
	for i in 24:
		var x := lerpf(g.position.x - t * 0.5, g.end.x + t * 0.5, float(i) / 23.0)
		_front.draw_circle(Vector2(x, g.position.y - t * 0.5), 3.0, Color(0.25, 0.27, 0.28))
		_front.draw_circle(Vector2(x, g.end.y + t * 0.6), 3.0, Color(0.25, 0.27, 0.28))
	# Delivery hatch under the chute.
	var hp := _hatch_pos()
	_front.draw_rect(Rect2(hp - Vector2(46, 26), Vector2(92, 52)), Color(0.42, 0.34, 0.2))
	_front.draw_rect(Rect2(hp - Vector2(38, 18), Vector2(76, 36)), Color(0.05, 0.05, 0.05) if _hatch_open > 0.0 else Color(0.32, 0.26, 0.15))
	_front.draw_string(ThemeDB.fallback_font, hp + Vector2(-46, 46), "RETRIEVAL", HORIZONTAL_ALIGNMENT_CENTER, 92, 14, Color(0.7, 0.6, 0.4))
	var font := ThemeDB.fallback_font
	if _legend_t < 12.0:
		var a := clampf((12.0 - _legend_t) / 2.0, 0.0, 1.0) * 0.55
		_front.draw_string(font, Vector2(20, 1066), "test scene:  mouse = touch the glass   right-click = knock   F1 = debug", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1, 1, 1, a))
	if _result_text != "":
		var r := Rect2(1400, 60, 460, 260)
		_front.draw_rect(r, Color(0, 0, 0, 0.7))
		var lines := _result_text.split("\n")
		for i in lines.size():
			_front.draw_string(font, r.position + Vector2(16, 28 + i * 21), lines[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.9, 1, 0.9))
