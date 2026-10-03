class_name LBBot
extends RefCounted
## Automated play-tester used to tune difficulty. Plays like a careful,
## skilled human: reads where everyone is looking (the same information the
## faces give away), waits for windows, moves through gaps, freezes with a
## human-like reaction delay, avoids clutter, slaps rivals that get close.
## It does NOT see suspicion values.

var game: LBManager
var reaction := 0.22             # seconds before reacting to a new gaze
var dash_speed := 1.5
var risk_tol := 0.22             # how much 'being in the corner of an eye' it accepts
var greed := 0.0                 # 0 cautious .. 1 reckless
var _decide_t := 0.0
var _frozen_since := 0.0
var _danger_t := 0.0
var _goal := Vector2.ZERO
var _press_t := -1.0
var _wait := 0.0
var stats := {"caught": 0, "slaps": 0, "grabs": 0, "drops": 0}
# learned patterns: long-run fraction of time each cell is watched
var heat := {}
var _heat_t := 0.0
const CELL := 0.15


func _cell(p: Vector2) -> Vector2i:
	return Vector2i(roundi(p.x / CELL), roundi(p.y / CELL))


func _learn() -> void:
	var h := game.player
	var saved := h.plane_pos
	for zi in range(-4, 33):
		for xi in range(-6, 7):
			var c := Vector2i(xi, zi)
			var p := Vector2(xi * CELL, zi * CELL)
			h.plane_pos = p
			var v := 0.0
			for d in game.diners:
				v = maxf(v, d.gaze_visibility(h))
			heat[c] = lerpf(heat.get(c, 0.5), 1.0 if v > risk_tol else 0.0, 0.02)
	h.plane_pos = saved


func watched_fraction(p: Vector2) -> float:
	return heat.get(_cell(p), 0.5)


func _init(g: LBManager, greed_ := 0.0) -> void:
	game = g
	greed = greed_


func _visible_risk(p: Vector2) -> float:
	var r := 0.0
	for d in game.diners:
		var h := game.player
		var saved := h.plane_pos
		h.plane_pos = p
		r = maxf(r, d.gaze_visibility(h))
		h.plane_pos = saved
	return r


func explain(p0: Vector2, goal: Vector2) -> String:
	var out := ""
	var dir := (goal - p0).normalized()
	for i in range(1, 13):
		var c := p0 + dir * (i * 0.1)
		var who := ""
		var h := game.player
		var saved := h.plane_pos
		h.plane_pos = c
		for d in game.diners:
			var v := d.gaze_visibility(h)
			if v > risk_tol:
				who += d.display_name.substr(4, 3)
		h.plane_pos = saved
		out += "[%.1f %s%s] " % [c.y, "X" if _blocked(c) else "", who]
	return out


func _blocked(p: Vector2) -> bool:
	if absf(p.x) > LBConst.TABLE_HALF_W - 0.08:
		return true
	for o in game.world.objects:
		if not o.on_table or not o.hand_collides or o.held_by != null:
			continue
		if o.plane_pos.distance_to(p) < o.radius + game.player.radius * 0.9:
			return true
	return false


func step(dt: float) -> void:
	_heat_t -= dt
	if _heat_t <= 0.0:
		_heat_t = 0.25
		_learn()
	var p := game.player
	if game.gs != LBManager.GS.PLAY:
		p.scripted_target = p.plane_pos
		Input.action_release("lb_grab")
		_press_t = -1.0
		return
	var b := game.real_biscuit()
	var holding := p.held is LBBiscuit and (p.held as LBBiscuit).is_real_prize()
	if holding:
		_goal = Vector2(0.12, LBConst.HOME_ZONE_Z + 0.25)
	elif b:
		_goal = b.plane_pos
	# slap rivals that come close (especially if they hold the biscuit)
	var rv := p.nearest_rival(p.slap_range * 0.9)
	if rv and (rv.held != null or (holding and rv.plane_pos.distance_to(p.plane_pos) < 0.22)) and _press_t < 0.0 \
			and _visible_risk(p.plane_pos) < 0.05 and not Input.is_action_pressed("lb_grab"):
		Input.action_press("lb_grab")
		_press_t = 0.05
		stats.slaps += 1
	if _press_t > 0.0:
		_press_t -= dt
		if _press_t <= 0.0 and not holding:
			Input.action_release("lb_grab")
			_press_t = -1.0
	# grab the biscuit when on it (a click next to a rival would be a slap)
	if not holding and b and b.plane_pos.distance_to(p.plane_pos) < p.grab_range * 0.8 and _press_t < 0.0 \
			and not Input.is_action_pressed("lb_grab") and b.held_by == null:
		Input.action_press("lb_grab")
		stats.grabs += 1
	if not holding and p.held == null and not Input.is_action_pressed("lb_grab"):
		pass
	if not holding and p.held != null and not (p.held is LBBiscuit):
		Input.action_release("lb_grab")
	if holding:
		Input.action_press("lb_grab")
	elif _press_t < 0.0 and (b == null or b.plane_pos.distance_to(p.plane_pos) > p.grab_range or b.held_by != null):
		Input.action_release("lb_grab")
	# movement decisions
	_decide_t -= dt
	var here_risk := _visible_risk(p.plane_pos)
	# read the tells a human would: the Twitch's shoulder jerk, a drowsy head
	var tell := false
	for d in game.diners:
		if d.state == "tell" or d.state == "don" or d.state == "jolt":
			tell = true
	if here_risk > risk_tol or tell:
		_danger_t += dt
	else:
		_danger_t = 0.0
	if (_danger_t > reaction or (tell and _danger_t > 0.15)) and _danger_t < 2.5:
		p.scripted_target = p.plane_pos      # freeze and wait for them to look away
		_decide_t = 0.12
		return
	if _decide_t > 0.0:
		return
	_decide_t = 0.08
	var to_g := _goal - p.plane_pos
	if to_g.length() < 0.05:
		p.scripted_target = _goal
		return
	var stuck := _danger_t >= 2.5
	var path := _plan(p.plane_pos, _goal)
	if path.is_empty():
		p.scripted_target = p.plane_pos
		return
	# how far along the planned route is currently unwatched?
	var clear_k := -1
	for i in path.size():
		if i * G > (1.4 if not stuck else 0.15):
			break
		if _visible_risk(path[i]) > risk_tol and not stuck:
			break
		clear_k = i
	if clear_k < 0:
		p.scripted_target = p.plane_pos
		return
	# stop at the best resting spot within the clear stretch
	var best_i := 0
	var best_score := INF
	for i in range(0, clear_k + 1):
		var remaining := float(path.size() - i) * G
		var sc := remaining + watched_fraction(path[i]) * 2.2
		if path[i].distance_to(_goal) < 0.12:
			sc -= 5.0
		if sc < best_score:
			best_score = sc
			best_i = i
	if best_i == 0 and not stuck:
		p.scripted_target = p.plane_pos
		return
	p.scripted_target = path[best_i]


const G := 0.1


func _plan(from: Vector2, to: Vector2) -> Array[Vector2]:
	# A* over a coarse grid; cost favours rarely-watched cells
	var start := Vector2i(roundi(from.x / G), roundi(from.y / G))
	var goal := Vector2i(roundi(to.x / G), roundi(to.y / G))
	var open: Array[Vector2i] = [start]
	var came := {}
	var gs := {start: 0.0}
	var fs := {start: Vector2(start).distance_to(Vector2(goal))}
	var closed := {}
	var iters := 0
	while not open.is_empty() and iters < 3000:
		iters += 1
		var bi := 0
		for i in open.size():
			if fs.get(open[i], INF) < fs.get(open[bi], INF):
				bi = i
		var cur: Vector2i = open[bi]
		open.remove_at(bi)
		if cur == goal or Vector2(cur).distance_to(Vector2(goal)) < 1.2:
			var out: Array[Vector2] = []
			var c := cur
			while came.has(c):
				out.push_front(Vector2(c) * G)
				c = came[c]
			out.push_front(from)
			out.append(to)
			return out
		closed[cur] = true
		for dxy in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1), Vector2i(1, 1), Vector2i(-1, 1), Vector2i(1, -1), Vector2i(-1, -1)]:
			var n: Vector2i = cur + dxy
			if closed.has(n):
				continue
			var wp := Vector2(n) * G
			if n != goal and _blocked(wp):
				continue
			var step := Vector2(dxy).length() * (1.0 + 6.0 * watched_fraction(wp))
			var g2: float = gs[cur] + step
			if g2 < gs.get(n, INF):
				came[n] = cur
				gs[n] = g2
				fs[n] = g2 + Vector2(n).distance_to(Vector2(goal))
				if not open.has(n):
					open.append(n)
	return []
