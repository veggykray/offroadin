extends Node
## TEST-ONLY bot used for automated play-testing and tuning (no human needed).
## It drives through the adapter's virtual input, exactly like a player would,
## so it exercises the real movement, catching, spilling and checkout code.
##   style "careful"  : brakes early with gentle taps, slows down when loaded
##   style "reckless" : full throttle, slams reversals
## Not needed in the real game.

var style := "careful"
var activity: Node
var adapter: Node
var _bash_cd := 0.0
var _tap := 0
var _log_t := 0.0
var _result := {}
var _caught := 0
var _spilled := 0
var _crossed := {}
var miss_log: Array = []


func setup(a: Node) -> void:
	activity = a
	adapter = a.adapter
	adapter.use_virtual_input = true
	a.activity_completed.connect(func(r): _result = r)
	a.cargo.caught.connect(func(_m, _i): _caught += 1)
	a.cargo.spilled.connect(func(_m): _spilled += 1)


func _physics_process(delta: float) -> void:
	_bash_cd -= delta
	if activity == null or not activity.is_running():
		if adapter:
			adapter.virtual_axis = 0.0
		return
	var tr: Node2D = activity.trolley
	var cargo: Node = activity.cargo
	var x: float = tr.global_position.x
	var v: float = tr.velocity
	var target_x := x
	var counts: Dictionary = cargo.get_counts()
	var heading_to_checkout: bool = activity.order.order_ready
	if heading_to_checkout:
		target_x = activity.checkout.get_dock_x() - 20.0
		if activity.checkout.is_docked(x, v) and absf(v) < 60.0:
			adapter.virtual_dump = true
	else:
		var best := _best_catch(x)
		if best.size() > 0:
			target_x = best.x
		else:
			target_x = lerpf(activity.global_min_x(), activity.global_max_x(), 0.45)
		target_x = _dodge_rotten(target_x, x)
	if counts.get("rotten", 0) > 0 and _bash_cd <= 0.0:
		adapter.virtual_bash = true
		_bash_cd = 0.8
	adapter.virtual_axis = _drive(target_x, x, v, cargo.count(), heading_to_checkout)
	# diagnostics: where do mushrooms cross catch height vs where the trolley is
	for m in activity.mushrooms:
		if not is_instance_valid(m) or not m.is_flying() or m.spilled:
			continue
		var id: int = m.get_instance_id()
		if _crossed.has(id):
			continue
		if m.linear_velocity.y > 0.0 and m.global_position.y > activity.floor_y - 100.0:
			_crossed[id] = true
			var dx: float = m.global_position.x - x
			if absf(dx) > 60.0:
				miss_log.append("%s dx=%.0f x=%.0f trolley=%.0f t=%.1f age=%.2f" % [m.data.type_id, dx, m.global_position.x, x, activity.round_time, m.age])
	_log_t += delta
	if _log_t > 10.0:
		_log_t = 0.0
		print("[bot] t=%.0f phase=%d cargo=%d good=%d delivered=%d caught=%d spilled=%d loose=%d" % [activity.round_time, activity.spawner.phase, cargo.count(), counts.good, activity.order.delivered.good, _caught, _spilled, activity.mushrooms.size()])


func _predict(m: Node) -> Dictionary:
	var g: float = activity.shroom_gravity * m.data.gravity_multiplier
	var catch_y: float = activity.floor_y - 100.0
	var p: Vector2 = m.global_position
	var vel: Vector2 = m.linear_velocity
	if p.y > catch_y + 10.0:
		return {}
	# solve p.y + vel.y t + g/2 t^2 = catch_y (later root)
	var a := 0.5 * g
	var b := vel.y
	var c := p.y - catch_y
	var disc := b * b - 4.0 * a * c
	if disc < 0.0:
		return {}
	var t := (-b + sqrt(disc)) / (2.0 * a)
	if t < 0.0:
		return {}
	return {"x": p.x + vel.x * t, "t": t}


func _best_catch(x: float) -> Dictionary:
	var best := {}
	var best_score := INF
	var vmax: float = activity.trolley.effective_max_speed()
	for m in activity.mushrooms:
		if not is_instance_valid(m) or not m.is_flying() or m.data.role == 3 or m.data.is_bad():
			continue
		var pr := _predict(m)
		if pr.is_empty():
			continue
		if pr.x < activity.global_min_x() - 30.0 or pr.x > activity.global_max_x() + 30.0:
			continue
		var need: float = absf(pr.x - x) / vmax + 0.25
		if need > pr.t + 0.2:
			continue
		var score: float = pr.t - (1.0 if m.data.is_bonus() else 0.0)
		if score < best_score:
			best_score = score
			best = pr
	return best


func _dodge_rotten(target_x: float, x: float) -> float:
	for m in activity.mushrooms:
		if not is_instance_valid(m) or not m.is_flying() or not m.data.is_bad():
			continue
		var pr := _predict(m)
		if pr.is_empty() or pr.t > 0.9:
			continue
		if absf(pr.x - target_x) < 70.0:
			return clampf(target_x + signf(target_x - pr.x + 0.01) * 140.0, activity.global_min_x(), activity.global_max_x())
	return target_x


func _drive(target_x: float, x: float, v: float, load: int, to_checkout: bool) -> float:
	var tr: Node2D = activity.trolley
	var d := target_x - x
	if absf(d) < 10.0 and absf(v) < 50.0:
		return 0.0
	var m: float = tr.mass_factor()
	var careful := style == "careful"
	var brake: float = (tr.brake_decel + absf(v) * tr.brake_speed_factor * 0.5) / pow(m, 0.55)
	if careful:
		brake *= 0.45
	var stop_dist := v * v / (2.0 * brake)
	var vmax: float = tr.effective_max_speed()
	if careful:
		vmax *= clampf(1.0 - 0.05 * maxf(0.0, load - 6.0), 0.45, 1.0)
		if to_checkout:
			vmax *= 0.6
	var moving_toward := signf(v) == signf(d) and absf(v) > 20.0
	if moving_toward and absf(d) <= stop_dist * 1.15:
		# braking: careful taps the opposite key, reckless slams it
		if careful:
			_tap = (_tap + 1) % 6
			return -signf(v) if _tap < 2 else 0.0
		return -signf(v)
	if absf(v) > vmax and signf(v) == signf(d):
		return 0.0
	return signf(d)


func print_summary() -> void:
	var o: Node = activity.order
	print("[bot] SUMMARY style=%s t=%.1f state=%d phase=%d caught=%d spilled=%d delivered=%d stats=%s" % [style, activity.round_time, activity.state, activity.spawner.phase, _caught, _spilled, o.delivered.good, JSON.stringify(o.stats)])
	print("[bot] crossings=%d misses(>60px)=%d" % [_crossed.size(), miss_log.size()])
	for l in miss_log.slice(0, 25):
		print("   miss ", l)
	if not _result.is_empty():
		print("[bot] RESULT ", JSON.stringify(_result))
