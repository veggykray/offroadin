extends Node2D
## Tiny particle helper (CPUParticles2D, works with every renderer).
## All effects are fire-and-forget and free themselves.


func burst(pos: Vector2, color: Color, amount := 10, speed := 220.0, gravity := 900.0, life := 0.5, size := 4.0, spread := 180.0, dir := Vector2.UP) -> void:
	var p := CPUParticles2D.new()
	p.one_shot = true
	p.emitting = false
	p.amount = maxi(1, amount)
	p.lifetime = life
	p.explosiveness = 0.95
	p.direction = dir
	p.spread = spread
	p.initial_velocity_min = speed * 0.45
	p.initial_velocity_max = speed
	p.gravity = Vector2(0, gravity)
	p.scale_amount_min = size * 0.6
	p.scale_amount_max = size
	p.color = color
	var ramp := Gradient.new()
	ramp.set_color(0, Color(1, 1, 1, 1))
	ramp.set_color(1, Color(1, 1, 1, 0))
	p.color_ramp = ramp
	p.position = pos
	add_child(p)
	p.emitting = true
	get_tree().create_timer(life + 0.3).timeout.connect(p.queue_free)


func catch_puff(pos: Vector2, color: Color) -> void:
	burst(pos, color.lightened(0.3), 8, 170.0, 500.0, 0.35, 3.5)
	burst(pos, Color(1, 1, 1, 0.8), 5, 110.0, 200.0, 0.25, 2.5)


func sparkle(pos: Vector2) -> void:
	burst(pos, Color(1, 0.92, 0.35), 26, 360.0, 260.0, 0.8, 4.5)
	burst(pos, Color(1, 1, 1), 12, 220.0, 120.0, 0.6, 3.0)


func splat(pos: Vector2) -> void:
	burst(pos, Color(0.45, 0.55, 0.15), 22, 300.0, 1100.0, 0.6, 5.5)
	burst(pos, Color(0.3, 0.25, 0.1), 10, 200.0, 900.0, 0.5, 4.0)


func dust(pos: Vector2, dir_x: float) -> void:
	burst(pos, Color(0.85, 0.82, 0.75, 0.7), 6, 140.0, -60.0, 0.45, 5.0, 35.0, Vector2(-dir_x, -0.5).normalized())


func bash_wave(pos: Vector2, dir_x: float) -> void:
	burst(pos, Color(1, 1, 0.85), 16, 520.0, 0.0, 0.25, 3.5, 30.0, Vector2(dir_x, -0.15).normalized())


func crash(pos: Vector2) -> void:
	burst(pos, Color(1, 0.95, 0.6), 18, 420.0, 600.0, 0.45, 4.0)
	burst(pos, Color(0.7, 0.7, 0.75), 10, 260.0, 300.0, 0.6, 6.0)


func confetti(pos: Vector2) -> void:
	for c in [Color(1, 0.3, 0.3), Color(1, 0.85, 0.2), Color(0.4, 0.9, 1), Color(0.5, 1, 0.5)]:
		burst(pos, c, 24, 650.0, 700.0, 1.6, 5.0, 60.0, Vector2.UP)
