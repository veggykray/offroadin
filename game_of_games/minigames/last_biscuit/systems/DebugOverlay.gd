class_name LBDebugOverlay
extends MeshInstance3D
## Debug drawing on top of the table: gaze cones (and the Cheat's mirror
## cone), noise radii, hand velocity, collision circles, cover objects and
## rival AI targets. Toggle with F1.

var manager: LBManager
var im := ImmediateMesh.new()
var mat := StandardMaterial3D.new()
var labels: Array[Label3D] = []


func _ready() -> void:
	manager = get_parent() as LBManager
	mesh = im
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo = true
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.no_depth_test = true
	mat.render_priority = 10
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	visible = false


func _process(_dt: float) -> void:
	if manager == null:
		return
	if labels.is_empty() and manager.diners.size() > 0:
		for d in manager.diners:
			var l := Label3D.new()
			l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			l.no_depth_test = true
			l.font_size = 40
			l.pixel_size = 0.0025
			l.outline_size = 8
			l.modulate = Color(1, 1, 0.6)
			add_child(l)
			labels.append(l)
	for i in labels.size():
		labels[i].visible = visible
	visible = manager.debug
	if not visible:
		return
	im.clear_surfaces()
	im.surface_begin(Mesh.PRIMITIVE_LINES, mat)
	var y := LBConst.TABLE_Y + 0.01
	for i in manager.diners.size():
		var d := manager.diners[i]
		var s := d.suspicion.get_value(manager.player)
		var col := Color(0.3, 1.0, 0.3, 0.8).lerp(Color(1.0, 0.1, 0.1, 0.9), s)
		_cone(d.gaze, col, y)
		if d.mirror_gaze:
			_cone(d.mirror_gaze, Color(0.4, 0.8, 1.0, 0.9), y + 0.005)
		if d.gaze.feel_radius > 0.0:
			_circle(d.gaze.origin, d.gaze.feel_radius, Color(0.8, 0.5, 1.0, 0.8), y)
		labels[i].global_position = d.head_world() + Vector3(0, 0.45, 0)
		labels[i].text = "%s\n%s  B:%.2f" % [d.display_name, d.state, s]
	# objects: collision circles; occluders (cover) highlighted
	for o in manager.world.objects:
		if not o.on_table:
			continue
		var c := Color(0.6, 0.6, 0.6, 0.35)
		if o.occludes:
			c = Color(0.2, 0.6, 1.0, 0.9)
		elif o.grabbable:
			c = Color(1.0, 0.85, 0.3, 0.5)
		if o is LBBiscuit:
			c = Color(1.0, 0.5, 0.0, 1.0)
		_circle(o.plane_pos, o.radius, c, y)
	# hands: circle + velocity
	for h in manager.hands:
		if not h.active:
			continue
		var hc := Color(1, 1, 1, 0.9) if h.is_player else Color(1.0, 0.3, 0.8, 0.9)
		_circle(h.plane_pos, h.radius, hc, y + 0.02)
		_line(h.plane_pos, h.plane_pos + h.vel * 0.4, Color(1, 1, 0, 1), y + 0.02)
		if h is LBRivalHand:
			var r := h as LBRivalHand
			_line(r.plane_pos, r.goal, Color(1.0, 0.3, 0.8, 0.5), y + 0.015)
			if r.frozen:
				_circle(r.plane_pos, r.radius * 1.4, Color(0.3, 0.8, 1.0, 1.0), y + 0.02)
	if manager.player.is_player:
		_circle(manager.player.plane_pos, manager.player.slap_range, Color(1, 1, 1, 0.15), y + 0.02)
	# noise rings
	for n in manager.noise_sys.recent:
		var age: float = n[2]
		var rad := LBNoiseSystem.audible_radius(n[1]) * clampf(age / 0.4, 0.05, 1.0)
		_circle(n[0], rad, Color(1.0, 0.6, 0.2, clampf(1.0 - age / 1.2, 0.0, 1.0)), y + 0.03, 48)
	# home zone
	_line(Vector2(-LBConst.TABLE_HALF_W, LBConst.HOME_ZONE_Z), Vector2(LBConst.TABLE_HALF_W, LBConst.HOME_ZONE_Z), Color(0.3, 1, 0.3, 0.6), y)
	im.surface_end()


func _cone(g: LBGaze, col: Color, y: float) -> void:
	if g.sight <= 0.01:
		col.a *= 0.25
	var half := deg_to_rad(g.half_angle_deg)
	var a := g.origin + g.dir.rotated(-half) * g.view_range
	var b := g.origin + g.dir.rotated(half) * g.view_range
	_line(g.origin, a, col, y)
	_line(g.origin, b, col, y)
	var steps := 12
	for i in steps:
		var p0 := g.origin + g.dir.rotated(lerpf(-half, half, float(i) / steps)) * g.view_range
		var p1 := g.origin + g.dir.rotated(lerpf(-half, half, float(i + 1) / steps)) * g.view_range
		_line(p0, p1, col, y)
	var ph := half * g.peripheral_mult
	var pc := Color(col.r, col.g, col.b, col.a * 0.35)
	_line(g.origin, g.origin + g.dir.rotated(-ph) * g.view_range * 0.6, pc, y)
	_line(g.origin, g.origin + g.dir.rotated(ph) * g.view_range * 0.6, pc, y)


func _circle(c: Vector2, r: float, col: Color, y: float, steps := 20) -> void:
	for i in steps:
		var a0 := TAU * i / steps
		var a1 := TAU * (i + 1) / steps
		_line(c + Vector2(cos(a0), sin(a0)) * r, c + Vector2(cos(a1), sin(a1)) * r, col, y)


func _line(a: Vector2, b: Vector2, col: Color, y: float) -> void:
	im.surface_set_color(col)
	im.surface_add_vertex(Vector3(a.x, y, a.y))
	im.surface_set_color(col)
	im.surface_add_vertex(Vector3(b.x, y, b.y))
