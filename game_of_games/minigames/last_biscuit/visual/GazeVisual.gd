class_name LBGazeVisual
extends MeshInstance3D
## Makes a diner's gaze visible, deliberately unrealistically: a glowing
## searchlight fan painted on the table plus laser beams from the eyes.
## The fan is sampled from the real gameplay visibility (LBGaze), so cover
## casts true shadows and peripheral vision shows as a dim fringe. It warms
## from cool white-blue to angry red as the diner's suspicion of Bill grows,
## and flickers while Bill's hand is moving inside it.

const ANG_STEPS := 22
const RAD_STEPS := 13

@export var calm_color := Color(0.25, 0.8, 1.0)
@export var alarm_color := Color(1.0, 0.18, 0.05)
@export var intensity := 0.8
@export var beam_intensity := 0.9

var diner: LBDiner
var gaze: LBGaze
var is_mirror := false
var im := ImmediateMesh.new()
var _t := 0.0
var _cam: Camera3D
static var _mat: ShaderMaterial


func setup(d: LBDiner, g: LBGaze, mirror := false) -> void:
	if DisplayServer.get_name() == "headless":
		set_process(false)     # nothing to see: keep headless play-tests fast
	diner = d
	gaze = g
	is_mirror = mirror
	mesh = im
	top_level = true
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if _mat == null:
		_mat = ShaderMaterial.new()
		_mat.shader = load(LBMat.SHADER_DIR + "gaze_light.gdshader")
	material_override = _mat


func _process(dt: float) -> void:
	_t += dt
	global_transform = Transform3D.IDENTITY
	im.clear_surfaces()
	if diner == null or gaze == null or diner.manager == null:
		return
	if _cam == null:
		_cam = get_viewport().get_camera_3d()
	var m = diner.manager
	var player: LBHand = m.player
	var s: float = diner.suspicion.get_value(player)
	var col := calm_color.lerp(alarm_color, smoothstep(0.1, 0.75, s))
	var inten := intensity * (1.0 + s * 0.8)
	# hand moving inside this light: it flickers, a warning before the faces react
	var hv := gaze.visibility_of(player.plane_pos, 0.06 + player.height_above_table(), player.is_concealed())
	if hv > 0.05 and player.speed() > 0.14 and m.gs == LBManager.GS.PLAY:
		inten *= 1.0 + 0.6 * (0.5 + 0.5 * sin(_t * 38.0))
		col = col.lerp(alarm_color, 0.35)
	if m.gs == LBManager.GS.ENDING or m.gs == LBManager.GS.DONE:
		inten *= 0.0
	var sight := gaze.sight
	if diner.paused and m.gs == LBManager.GS.CAUGHT:
		inten *= 0.5
	set_instance_shader_parameter("core_frac", 1.0 / maxf(gaze.peripheral_mult, 1.0))
	if sight > 0.01 and inten > 0.001:
		_draw_fan(col, inten)
	if gaze.feel_radius > 0.0:
		_draw_feel(col, inten)
	if sight > 0.05 and inten > 0.001:
		_draw_beams(col, inten * sight)


func _range() -> float:
	return minf(gaze.view_range, gaze.focus_dist * 1.35 + 0.5)


func _draw_fan(col: Color, inten: float) -> void:
	var half := deg_to_rad(gaze.half_angle_deg) * gaze.peripheral_mult
	var rng := _range()
	var y := LBConst.TABLE_Y + 0.006
	var o := gaze.origin
	var grid := []
	for ai in ANG_STEPS + 1:
		var a := lerpf(-half, half, float(ai) / ANG_STEPS)
		var dir := gaze.dir.rotated(a)
		var row := []
		for ri in RAD_STEPS + 1:
			var r := rng * float(ri) / RAD_STEPS
			var p := o + dir * maxf(r, 0.02)
			var v := gaze.visibility_of(p, 0.06) if ri > 0 else gaze.sight
			# keep the light on the table top
			if absf(p.x) > LBConst.TABLE_HALF_W + 0.03 or absf(p.y) > LBConst.TABLE_HALF_L:
				v = 0.0
			row.append([Vector3(p.x, y, p.y), v, float(ai) / ANG_STEPS, float(ri) / RAD_STEPS])
		grid.append(row)
	im.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	for ai in ANG_STEPS:
		for ri in RAD_STEPS:
			var a: Array = grid[ai][ri]
			var b: Array = grid[ai + 1][ri]
			var c: Array = grid[ai][ri + 1]
			var d: Array = grid[ai + 1][ri + 1]
			for vtx in [a, c, b, b, c, d]:
				var vv: float = vtx[1]
				im.surface_set_color(Color(col.r, col.g, col.b, clampf(vv * inten, 0.0, 1.0)))
				im.surface_set_uv(Vector2(vtx[2], vtx[3]))
				im.surface_add_vertex(vtx[0])
	im.surface_end()


func _draw_feel(col: Color, inten: float) -> void:
	# the Blind Listener "feels" the air right in front of him
	var y := LBConst.TABLE_Y + 0.006
	var r := gaze.feel_radius
	var c := Color(0.75, 0.5, 1.0) if diner.suspicion.get_value(diner.manager.player) < 0.3 else col
	var pulse := 0.55 + 0.45 * sin(_t * 3.0)
	im.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	var steps := 28
	for i in steps:
		var a0 := TAU * i / steps
		var a1 := TAU * (i + 1) / steps
		var p0 := gaze.origin
		var p1 := gaze.origin + Vector2(cos(a0), sin(a0)) * r
		var p2 := gaze.origin + Vector2(cos(a1), sin(a1)) * r
		for p in [[p0, 0.6], [p1, 0.0], [p2, 0.0]]:
			var pp: Vector2 = p[0]
			im.surface_set_color(Color(c.r, c.g, c.b, inten * pulse * float(p[1])))
			im.surface_set_uv(Vector2(0.5, 0.0 if p[1] > 0.0 else 1.0))
			im.surface_add_vertex(Vector3(pp.x, y, pp.y))
	im.surface_end()


## Glowing beams from each eye to where they are looking.
func _draw_beams(col: Color, inten: float) -> void:
	var v := diner.visual as LBDinerVisual
	if v == null or _cam == null:
		return
	var rng := _range()
	var end2 := gaze.origin + gaze.dir * minf(gaze.focus_dist, rng)
	var end := LBConst.p2w(end2, LBConst.TABLE_Y + 0.01)
	var starts: Array[Vector3] = []
	if is_mirror and diner.teapot:
		# the Cheat's lasers go into the teapot and come out of it
		var tp := diner.teapot.global_position + Vector3(0, 0.13, 0)
		for e in v.eyes:
			_beam(e.global_position, tp, col, inten * 0.5, 0.008)
		starts.append(tp)
	else:
		for e in v.eyes:
			starts.append(e.global_position)
	im.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	for st in starts:
		_ribbon(st, end, col, inten, 0.012)
	# bright spot where the gaze lands
	_spot(end, col, inten)
	im.surface_end()


func _beam(a: Vector3, b: Vector3, col: Color, inten: float, w: float) -> void:
	im.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	_ribbon(a, b, col, inten, w)
	im.surface_end()


func _ribbon(a: Vector3, b: Vector3, col: Color, inten: float, w: float) -> void:
	var dir := (b - a)
	if dir.length() < 0.01:
		return
	var to_cam := (_cam.global_position - (a + b) * 0.5).normalized()
	var side := dir.normalized().cross(to_cam).normalized() * w
	var ca := Color(col.r, col.g, col.b, beam_intensity * inten)
	var cb := Color(col.r, col.g, col.b, beam_intensity * inten * 0.35)
	var core_a := Color(1, 1, 1, beam_intensity * inten * 0.6)
	for quad in [[side, ca, cb], [side * 0.3, core_a, cb]]:
		var sd: Vector3 = quad[0]
		var c0: Color = quad[1]
		var c1: Color = quad[2]
		var verts := [[a - sd, c0, Vector2(0, 0)], [b - sd, c1, Vector2(0, 1)], [a + sd, c0, Vector2(1, 0)],
				[a + sd, c0, Vector2(1, 0)], [b - sd, c1, Vector2(0, 1)], [b + sd, c1, Vector2(1, 1)]]
		for vv in verts:
			im.surface_set_color(vv[1])
			im.surface_set_uv(vv[2])
			im.surface_add_vertex(vv[0])


func _spot(p: Vector3, col: Color, inten: float) -> void:
	var steps := 16
	var r := 0.07 + 0.015 * sin(_t * 6.0)
	for i in steps:
		var a0 := TAU * i / steps
		var a1 := TAU * (i + 1) / steps
		im.surface_set_color(Color(col.r, col.g, col.b, inten * 0.9))
		im.surface_set_uv(Vector2(0.5, 0.0))
		im.surface_add_vertex(p)
		im.surface_set_color(Color(col.r, col.g, col.b, 0.0))
		im.surface_set_uv(Vector2(0.5, 1.0))
		im.surface_add_vertex(p + Vector3(cos(a0), 0, sin(a0)) * r)
		im.surface_set_color(Color(col.r, col.g, col.b, 0.0))
		im.surface_set_uv(Vector2(0.5, 1.0))
		im.surface_add_vertex(p + Vector3(cos(a1), 0, sin(a1)) * r)
