extends Node2D

const AqDraw = preload("AqDraw.gd")
## The thing in the dark.
##
## Tracks a hidden `attention` value (0..1, never shown). Vibrations raise it
## (hard knocks a lot, frantic tapping a bit, rubbing barely), it slowly
## decays. The aquarium communicates it:
##   LOW       - almost nothing: plants sway with nothing there, a vague shape
##   MEDIUM    - two faint eyes open far back in the darkness
##   HIGH      - a huge shadow crosses the background, creatures get nervous
##   VERY HIGH - something enormous approaches the glass... then loses interest
## Then the finale: it comes right up to the glass and looks at Bill.

signal approach_finished
signal finale_finished
signal giant_tap(pos: Vector2)

@export_group("Attention")
## Attention lost per second.
@export var attention_decay := 0.004
@export var medium_threshold := 0.2
@export var high_threshold := 0.45
@export var very_high_threshold := 0.75
## No apparitions during the first seconds of the activity.
@export var quiet_start_time := 12.0

@export_group("Finale")
## Seconds for the giant to come from the darkness to the glass.
@export var finale_approach_time := 8.0
## Where its head ends up, relative to the aquarium centre.
@export var finale_head_offset := Vector2(-140, 380)

var activity: Node
var attention := 0.0
var mode := "dormant"
var mode_t := 0.0

# Render state.
var head_pos := Vector2.ZERO
var dist := 1.0         # 1 = far away in the dark, 0 = against the glass
var body_alpha := 0.0
var eyes_alpha := 0.0
var lid := 0.0
var tilt := 0.0
var look_at := Vector2.ZERO
var tentacle := 0.0     # 0 hidden .. 1 fully raised
var tip_target := Vector2.ZERO
var tip_press := 0.0
var _origin := Vector2.ZERO
var _from := Vector2.ZERO
var _to := Vector2.ZERO
var _event_timer := 20.0
var _approach_cd := 0.0
var _event_nervous := 0.0
var _t := 0.0
var _blink := 0.0
var _tap_fired := false
var _rumble_cd := 0.0
var _sighed := false


func setup(p_activity: Node) -> void:
	activity = p_activity
	z_index = -90


func reset_deep(origin: Vector2) -> void:
	_origin = origin
	attention = 0.0
	head_pos = origin
	dist = 1.0
	body_alpha = 0.0
	eyes_alpha = 0.0
	tentacle = 0.0
	tip_press = 0.0
	lid = 0.0
	tilt = 0.0
	_set_mode("dormant")
	_event_timer = quiet_start_time + randf_range(8.0, 16.0)
	_approach_cd = 0.0
	z_index = -90
	visible = true


func add_attention(amount: float) -> void:
	if mode.begins_with("finale") or mode == "disappointed":
		return
	var before_level := get_level()
	attention = clampf(attention + amount, 0.0, 1.2)
	if get_level() > before_level and mode == "dormant":
		# Respond fairly quickly so the player connects cause and effect.
		_event_timer = minf(_event_timer, randf_range(1.5, 3.5))


## 0 low, 1 medium, 2 high, 3 very high.
func get_level() -> int:
	if attention >= very_high_threshold: return 3
	if attention >= high_threshold: return 2
	if attention >= medium_threshold: return 1
	return 0


func get_nervousness() -> float:
	if mode.begins_with("finale") or mode == "disappointed":
		return 1.0
	return clampf(smoothstep(high_threshold * 0.8, 1.0, attention) + _event_nervous, 0.0, 1.0)


func get_visible_position() -> Vector2:
	return head_pos + _eye_offset(0) * _scale()


func get_glow_info() -> Dictionary:
	return {"pos": get_visible_position(), "amount": eyes_alpha * 0.8 + body_alpha * 0.3 * (1.0 - dist)}


func get_debug_text() -> String:
	return "deep: attention %.2f (level %d)  mode %s" % [attention, get_level(), mode]


func _set_mode(m: String) -> void:
	mode = m
	mode_t = 0.0


func _scale() -> float:
	return lerpf(1.0, 0.16, dist)


# ================================================================ update

func tick(delta: float) -> void:
	_t += delta
	mode_t += delta
	_rumble_cd -= delta
	_approach_cd -= delta
	_blink = move_toward(_blink, 0.0, delta * 2.5)
	_event_nervous = move_toward(_event_nervous, 0.0, delta * 0.15)
	if not mode.begins_with("finale") and mode != "disappointed":
		attention = maxf(0.0, attention - attention_decay * delta)
	look_at = activity.get_bill_point()
	match mode:
		"dormant":
			body_alpha = move_toward(body_alpha, 0.0, delta * 0.3)
			eyes_alpha = move_toward(eyes_alpha, 0.0, delta * 0.3)
			if activity.is_running() and activity.activity_time > quiet_start_time and activity.stage < activity.Stage.CALM:
				_event_timer -= delta
				if _event_timer <= 0.0:
					_start_event()
		"drift":
			var k := mode_t / 14.0
			head_pos = _from.lerp(_to, k)
			body_alpha = 0.16 * sin(clampf(k, 0, 1) * PI)
			eyes_alpha = 0.0
			if int(mode_t * 2.0) % 3 == 0:
				activity.environment.ghost_sway(head_pos.x, delta * 2.0)
			if k >= 1.0:
				_end_event()
		"ghost":
			activity.environment.ghost_sway(_from.x + mode_t * 120.0, delta * 3.0)
			if mode_t > 3.0:
				_end_event()
		"eyes":
			dist = 0.92
			body_alpha = 0.05
			eyes_alpha = 0.55 * clampf(mode_t / 2.0, 0, 1) * clampf((7.0 - mode_t) / 2.0, 0, 1)
			if absf(mode_t - 3.5) < 0.05:
				_blink = 1.0
			if mode_t > 7.0:
				_end_event()
		"pass":
			var k2 := mode_t / 11.0
			head_pos = _from.lerp(_to, k2)
			dist = 0.72
			body_alpha = 0.6 * sin(clampf(k2, 0, 1) * PI)
			eyes_alpha = 0.35 * sin(clampf(k2, 0, 1) * PI)
			_event_nervous = maxf(_event_nervous, 0.35)
			activity.environment.ghost_sway(head_pos.x, delta * 3.0)
			activity.water_fx.push(head_pos, 260.0, delta * 3.0)
			if k2 >= 1.0:
				_end_event()
		"approach":
			_event_nervous = 1.0
			if mode_t < 4.0:
				dist = lerpf(0.92, 0.42, smoothstep(0.0, 4.0, mode_t))
				body_alpha = lerpf(0.1, 0.78, smoothstep(0.0, 3.0, mode_t))
				eyes_alpha = lerpf(0.2, 0.95, smoothstep(0.0, 3.0, mode_t))
			elif mode_t < 7.0:
				if absf(mode_t - 5.5) < 0.05:
					_blink = 1.0
			elif mode_t < 11.0:
				var k3 := (mode_t - 7.0) / 4.0
				dist = lerpf(0.42, 0.95, smoothstep(0.0, 1.0, k3))
				body_alpha = lerpf(0.78, 0.0, k3)
				eyes_alpha = lerpf(0.95, 0.0, k3)
			else:
				attention = maxf(0.0, attention - 0.35)
				_approach_cd = 30.0
				_end_event()
		"finale_approach":
			var k4 := clampf(mode_t / finale_approach_time, 0.0, 1.0)
			var e := k4 * k4 * (3.0 - 2.0 * k4)
			dist = lerpf(1.0, 0.0, e)
			head_pos = _from.lerp(_to, e)
			body_alpha = lerpf(0.1, 1.0, smoothstep(0.0, 0.6, k4))
			eyes_alpha = lerpf(0.3, 1.0, smoothstep(0.0, 0.5, k4))
			z_index = 46 if dist < 0.35 else -90
			if dist < 0.6:
				activity.water_fx.push(head_pos, 900.0, delta * 2.0)
			if k4 >= 1.0:
				_set_mode("finale_wait")
				approach_finished.emit()
		"finale_wait":
			head_pos = _to + Vector2(0, sin(_t * 0.6) * 10.0)
			# Mostly stares at Bill; occasionally glances at the pointer on the glass.
			var surf = activity.surface
			if surf.pointer_inside and fmod(_t, 6.0) > 4.2:
				look_at = surf.pointer_pos
			if fmod(mode_t, 5.0) < 0.02 and mode_t > 1.0:
				_blink = 1.0
		"finale_tap":
			_finale_tap(delta)
		"disappointed":
			_disappointed(delta)
		"finale_leave":
			var k5 := clampf(mode_t / 5.0, 0.0, 1.0)
			dist = lerpf(0.0, 1.0, k5 * k5)
			head_pos = _to.lerp(_to + Vector2(500, -200), k5)
			body_alpha = 1.0 - k5
			eyes_alpha = 1.0 - k5
			tentacle = move_toward(tentacle, 0.0, delta)
			z_index = 46 if dist < 0.35 else -90
			if k5 >= 1.0:
				_set_mode("dormant")
				attention = 0.0
				_event_timer = 9999.0
				finale_finished.emit()
	queue_redraw()


func _start_event() -> void:
	var b: Rect2 = activity.aquarium_bounds
	var level := get_level()
	_event_timer = 9999.0
	var roll := randf()
	match level:
		0:
			if roll < 0.5:
				_from = Vector2(b.position.x - 200.0, b.position.y + b.size.y * randf_range(0.3, 0.55))
				_to = _from + Vector2(b.size.x * 0.5, randf_range(-40, 40))
				dist = 1.0
				_set_mode("drift")
			else:
				_from = Vector2(randf_range(b.position.x, b.end.x - 400.0), 0)
				_set_mode("ghost")
			_play_rumble(-18.0)
		1:
			head_pos = Vector2(randf_range(b.position.x + 300, b.end.x - 300), b.position.y + b.size.y * randf_range(0.35, 0.5))
			_set_mode("eyes")
			_play_rumble(-14.0)
		2:
			var left := randf() < 0.5
			_from = Vector2(b.position.x - 400.0 if left else b.end.x + 400.0, b.position.y + b.size.y * 0.45)
			_to = Vector2(b.end.x + 400.0 if left else b.position.x - 400.0, b.position.y + b.size.y * 0.4)
			head_pos = _from
			_set_mode("pass")
			_play_rumble(-6.0)
			_make_creatures_look()
		_:
			if _approach_cd > 0.0:
				_from = Vector2(b.position.x - 400.0, b.position.y + b.size.y * 0.45)
				_to = Vector2(b.end.x + 400.0, b.position.y + b.size.y * 0.42)
				head_pos = _from
				_set_mode("pass")
				_play_rumble(-6.0)
			else:
				head_pos = Vector2(b.get_center().x + randf_range(-200, 200), b.position.y + b.size.y * 0.42)
				_set_mode("approach")
				activity.audio.play("deep_approach", -4.0)
			_make_creatures_look()


func _end_event() -> void:
	_set_mode("dormant")
	var level := get_level()
	var ranges := [[28.0, 50.0], [14.0, 24.0], [10.0, 16.0], [5.0, 9.0]]
	_event_timer = randf_range(ranges[level][0], ranges[level][1])


func _make_creatures_look() -> void:
	for c in activity.creatures:
		if randf() < 0.7:
			c.look_at_point(get_visible_position(), randf_range(1.0, 2.0))


func _play_rumble(vol: float) -> void:
	if _rumble_cd > 0.0:
		return
	_rumble_cd = 4.0
	activity.audio.play("deep_rumble", vol, randf_range(0.8, 1.0))


# ================================================================ finale

func begin_finale_approach() -> void:
	var b: Rect2 = activity.aquarium_bounds
	_from = _origin
	_to = b.get_center() + finale_head_offset
	head_pos = _from
	dist = 1.0
	_set_mode("finale_approach")
	activity.audio.play("deep_approach", 0.0)
	_make_creatures_look()


func respond_to_tap(pos: Vector2) -> void:
	tip_target = pos
	_tap_fired = false
	_set_mode("finale_tap")


func leave_disappointed() -> void:
	_sighed = false
	_set_mode("disappointed")


func _finale_tap(delta: float) -> void:
	var t := mode_t
	head_pos = _to + Vector2(0, sin(_t * 0.6) * 10.0)
	look_at = tip_target if t < 4.5 else activity.get_bill_point()
	if t < 1.2:
		tentacle = 0.0
	elif t < 3.4:
		tentacle = smoothstep(1.2, 3.4, t) * 0.85
	elif t < 3.9:
		tentacle = 0.85
	elif t < 4.25:
		tentacle = lerpf(0.85, 0.75, (t - 3.9) / 0.35)   # wind back...
	elif t < 4.33:
		tentacle = 1.0                                     # ...WHAM
		tip_press = 1.0
		if not _tap_fired:
			_tap_fired = true
			giant_tap.emit(tip_target)
	elif t < 5.4:
		tentacle = 1.0
		tip_press = move_toward(tip_press, 0.6, delta)
	elif t < 7.0:
		tip_press = move_toward(tip_press, 0.0, delta * 2.0)
		tentacle = lerpf(1.0, 0.0, smoothstep(5.4, 7.0, t))
	elif t < 8.0:
		tentacle = 0.0
		if absf(t - 7.4) < 0.05:
			_blink = 1.0
	else:
		_set_mode("finale_leave")


func _disappointed(delta: float) -> void:
	var t := mode_t
	head_pos = _to + Vector2(0, sin(_t * 0.6) * 10.0)
	if t < 1.6:
		tilt = lerpf(0.0, 0.12, smoothstep(0.0, 1.6, t))   # confused head tilt
	elif t < 3.0:
		lid = lerpf(0.0, 0.45, smoothstep(1.6, 3.0, t))   # ...disappointed
	elif t < 4.0:
		if not _sighed:
			_sighed = true
			# A long, sad exhale.
			activity.water_fx.spawn_bubbles(head_pos + Vector2(200, 260), 30, 1.6)
			activity.audio.play("deep_rumble", -10.0, 0.6)
	else:
		tilt = move_toward(tilt, 0.0, delta * 0.1)
		_set_mode("finale_leave")


func debug_summon() -> void:
	attention = 1.0
	_approach_cd = 0.0
	if mode == "dormant":
		_start_event()


# ================================================================ drawing

func _eye_offset(i: int) -> Vector2:
	return Vector2(-260, -90) if i == 0 else Vector2(240, -70)


func _draw() -> void:
	if body_alpha <= 0.005 and eyes_alpha <= 0.005 and tentacle <= 0.0:
		return
	var s := _scale()
	var fog := Color(0.02, 0.07, 0.1)
	var f := clampf(dist * 0.9, 0.0, 0.92)
	var skin := Color(0.07, 0.1, 0.12).lerp(fog, f)
	var skin_light := Color(0.15, 0.2, 0.22).lerp(fog, f)
	var xf := Transform2D(tilt, head_pos) * Transform2D.IDENTITY.scaled(Vector2(s, s))

	if body_alpha > 0.005:
		# Massive head: a blunt dome with a long jaw, far bigger than the tank.
		var head := PackedVector2Array()
		for i in 48:
			var a := TAU * float(i) / 48.0
			var rx := 1150.0 * (1.0 + 0.05 * sin(a * 5.0))
			var ry := 720.0 * (1.0 + 0.04 * sin(a * 7.0 + 1.0))
			if sin(a) > 0.0:
				ry *= 1.15
			head.append(xf * Vector2(cos(a) * rx, sin(a) * ry - 120.0))
		AqDraw.poly(self, head, Color(skin, body_alpha))
		# Mottling.
		for k in 22:
			var mp := Vector2(sin(k * 12.9898) * 900.0, cos(k * 78.233) * 500.0 - 150.0)
			draw_circle(xf * mp, (40.0 + 30.0 * absf(sin(k * 3.1))) * s, Color(skin_light, body_alpha * 0.5))
		# Brow ridges over the eyes.
		for i in 2:
			var eo := _eye_offset(i)
			var brow := PackedVector2Array()
			for k in 13:
				var a2 := PI + PI * float(k) / 12.0
				brow.append(xf * (eo + Vector2(cos(a2) * 190.0, sin(a2) * 130.0 - 20.0)))
			draw_polyline(brow, Color(skin_light, body_alpha * 0.8), 30.0 * s)
		# Jaw line and teeth (low on the face; usually off-screen in the finale).
		var jaw := PackedVector2Array()
		for k in 21:
			var x := lerpf(-900.0, 900.0, float(k) / 20.0)
			jaw.append(xf * Vector2(x, 330.0 + pow(absf(x) / 900.0, 2.0) * -150.0))
		draw_polyline(jaw, Color(0.01, 0.02, 0.03, body_alpha), 18.0 * s)
		for k in 14:
			var x2 := lerpf(-760.0, 760.0, float(k) / 13.0)
			var y2 := 330.0 + pow(absf(x2) / 900.0, 2.0) * -150.0
			AqDraw.poly(self, PackedVector2Array([xf * Vector2(x2 - 18, y2), xf * Vector2(x2, y2 + 60 + 20 * sin(k * 2.0)), xf * Vector2(x2 + 18, y2)]), Color(0.75, 0.75, 0.65, body_alpha * (1.0 - f)))
		# Bioluminescent freckles.
		for k in 30:
			var fp := Vector2(sin(k * 4.7) * 1000.0, cos(k * 2.3) * 520.0 - 160.0)
			var g := 0.5 + 0.5 * sin(_t * 1.3 + k)
			draw_circle(xf * fp, 9.0 * s + 1.0, Color(0.4, 1.0, 0.9, body_alpha * 0.35 * g))
		# Lure on a stalk.
		var stalk := PackedVector2Array()
		for k in 10:
			var tt := float(k) / 9.0
			stalk.append(xf * Vector2(-60.0 - tt * 260.0 + sin(_t * 0.8 + tt * 2.0) * 30.0 * tt, -760.0 - sin(tt * PI * 0.8) * 260.0))
		draw_polyline(stalk, Color(skin_light, body_alpha), 22.0 * s + 1.0)
		var lure := stalk[stalk.size() - 1]
		var lg := 0.6 + 0.4 * sin(_t * 2.1)
		draw_circle(lure, 90.0 * s, Color(0.5, 1.0, 0.85, body_alpha * 0.12 * lg))
		draw_circle(lure, 38.0 * s, Color(0.7, 1.0, 0.9, body_alpha * 0.7 * lg))

	# Eyes.
	if eyes_alpha > 0.005:
		for i in 2:
			var eo2 := _eye_offset(i)
			var er := (115.0 if i == 0 else 98.0)
			var ec := xf * eo2
			var ers := er * s
			draw_circle(ec, ers * 1.6, Color(0.7, 0.9, 0.5, eyes_alpha * 0.08))
			draw_circle(ec, ers, Color(0.82, 0.88, 0.55, eyes_alpha))
			draw_circle(ec, ers * 0.82, Color(0.95, 0.85, 0.35, eyes_alpha))
			var look_dir := (look_at - ec)
			var off := look_dir.normalized() * ers * 0.3 if look_dir.length() > 1.0 else Vector2.ZERO
			# Vertical slit pupil.
			var slit := PackedVector2Array()
			for k in 16:
				var a3 := TAU * float(k) / 16.0
				slit.append(ec + off + Vector2(cos(a3) * ers * 0.16, sin(a3) * ers * 0.7))
			AqDraw.poly(self, slit, Color(0.02, 0.02, 0.03, eyes_alpha))
			draw_circle(ec + Vector2(-ers * 0.35, -ers * 0.4), ers * 0.12, Color(1, 1, 1, eyes_alpha * 0.7))
			var l := clampf(maxf(lid, _blink), 0.0, 1.0)
			if l > 0.01:
				var lid_pts := PackedVector2Array()
				for k in 13:
					var a4 := PI + PI * float(k) / 12.0
					lid_pts.append(ec + Vector2(cos(a4), sin(a4)) * ers * 1.06)
				var cover := lerpf(-ers, ers, l)
				lid_pts.append(ec + Vector2(ers * 1.06, cover))
				lid_pts.append(ec + Vector2(-ers * 1.06, cover))
				AqDraw.poly(self, lid_pts, Color(skin_light, maxf(eyes_alpha, body_alpha)))

	# The appendage (finale): rises from below and taps the glass from inside.
	if tentacle > 0.0:
		var b: Rect2 = activity.aquarium_bounds
		var base := Vector2(tip_target.x + 260.0, b.end.y + 260.0)
		var reach := tentacle
		var tip := base.lerp(tip_target, reach)
		var ctrl := Vector2(base.x + 120.0, lerpf(base.y, tip_target.y, 0.5))
		var pts := PackedVector2Array()
		for k in 24:
			var tt := float(k) / 23.0
			var p := (1 - tt) * (1 - tt) * base + 2 * (1 - tt) * tt * ctrl + tt * tt * tip
			p.x += sin(_t * 1.5 + tt * 4.0) * 12.0 * (1.0 - tt)
			pts.append(p)
		for k in range(pts.size() - 1):
			var tt2 := float(k) / pts.size()
			var w := lerpf(130.0, 34.0, tt2)
			draw_line(pts[k], pts[k + 1], Color(0.1, 0.13, 0.15), w)
			if k % 2 == 0:
				var sp: Vector2 = pts[k] + (pts[k + 1] - pts[k]).orthogonal().normalized() * w * 0.32
				draw_circle(sp, w * 0.16, Color(0.6, 0.55, 0.5, 0.8))
		var tip_r := lerpf(26.0, 66.0, tip_press)
		AqDraw.poly(self, _flat_disc(tip, tip_r, 1.0 - tip_press * 0.25), Color(0.16, 0.2, 0.22))
		if tip_press > 0.1:
			for k in 8:
				var a5 := TAU * k / 8.0
				draw_circle(tip + Vector2(cos(a5), sin(a5) * 0.75) * tip_r * 0.62, 7.0 * tip_press, Color(0.9, 0.85, 0.8, tip_press))
			draw_circle(tip, tip_r * 0.3, Color(0.85, 0.8, 0.75, 0.7 * tip_press))


func _flat_disc(c: Vector2, r: float, sy: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 24:
		var a := TAU * i / 24.0
		pts.append(c + Vector2(cos(a) * r, sin(a) * r * sy))
	return pts
