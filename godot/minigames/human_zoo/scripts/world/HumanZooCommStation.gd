class_name HumanZooCommStation
extends Node2D
## Bill's side of an enclosure: brass microphone, speaking trumpet, pressure
## gauge, valve, indicator lamp and tuning mechanism. Origin = gallery floor.
##
## HumanZooGame finds stations through register_station() and decides what the
## lamp shows; the station only draws. Swap in final art that keeps the same API.

@export var character_id: String = "king"
## The empty cage's station has a larger, prominent tuning dial.
@export var big_tuning_dial: bool = false
@export var interact_radius: float = 120.0

## "off" | "message" (someone has a message for this person) | "attention" |
## "static" | "new"
var lamp_mode := "off"
var focused := false
var active := false
var tuning_value := 0.3

var _t := 0.0
var _pulse := 0.0
var _needle := 0.0


func set_lamp(mode: String) -> void:
	lamp_mode = mode


func set_focused(on: bool) -> void:
	focused = on


func set_active(on: bool) -> void:
	active = on


func pulse() -> void:
	_pulse = 1.0


func _process(delta: float) -> void:
	_t += delta
	_pulse = maxf(_pulse - delta * 1.5, 0.0)
	var target := 0.15 + (0.55 + sin(_t * 13.0) * 0.2 if active else 0.0) + _pulse * 0.4
	_needle = lerpf(_needle, target, delta * 6.0)
	queue_redraw()


func _draw() -> void:
	var brass := Color(0.66, 0.5, 0.24)
	var dark := brass.darkened(0.45)
	var shine := brass.lightened(0.35)
	if focused:
		draw_circle(Vector2(0, -130), 150, Color(1.0, 0.85, 0.5, 0.05))
	# Base
	draw_colored_polygon(PackedVector2Array([Vector2(-46, 0), Vector2(46, 0), Vector2(34, -22), Vector2(-34, -22)]), dark)
	draw_rect(Rect2(-36, -26, 72, 6), brass)
	# Column with bands
	draw_rect(Rect2(-13, -178, 26, 154), brass.darkened(0.15))
	draw_rect(Rect2(-13, -178, 7, 154), shine.darkened(0.1))
	for y in [-60, -150]:
		draw_rect(Rect2(-17, y, 34, 8), brass)
	# Pipe from base into the floor (continues to the machine)
	draw_rect(Rect2(14, -30, 14, 46), dark)
	draw_rect(Rect2(10, -34, 22, 8), brass)
	# Valve wheel
	var vw := Vector2(-38, -84)
	draw_line(Vector2(-13, -84), vw, dark, 6.0)
	draw_arc(vw, 15, 0, TAU, 20, Color(0.6, 0.15, 0.1), 4.0)
	for i in 4:
		var a := _t * (2.0 if active else 0.0) + i * PI / 2.0
		draw_line(vw, vw + Vector2(cos(a), sin(a)) * 14, Color(0.6, 0.15, 0.1), 2.5)
	draw_circle(vw, 4, brass)
	# Pressure gauge
	var g := Vector2(0, -118)
	draw_circle(g, 24, dark)
	draw_circle(g, 20, Color(0.93, 0.9, 0.8))
	for i in 7:
		var a := lerpf(PI * 0.8, PI * 2.2, i / 6.0)
		draw_line(g + Vector2(cos(a), sin(a)) * 15, g + Vector2(cos(a), sin(a)) * 19, Color(0.2, 0.15, 0.1), 1.5)
	var na := lerpf(PI * 0.8, PI * 2.2, clampf(_needle, 0.0, 1.0))
	draw_line(g, g + Vector2(cos(na), sin(na)) * 16, Color(0.7, 0.1, 0.1), 2.0)
	draw_circle(g, 3, dark)
	# Tuning mechanism
	var tk := Vector2(22, -156) if not big_tuning_dial else Vector2(32, -150)
	var tr := 9.0 if not big_tuning_dial else 17.0
	draw_circle(tk, tr + 3, dark)
	draw_circle(tk, tr, Color(0.25, 0.2, 0.18))
	var ta := lerpf(-PI * 0.75, PI * 0.75, tuning_value) - PI / 2.0
	draw_line(tk, tk + Vector2(cos(ta), sin(ta)) * tr, shine, 2.5)
	if big_tuning_dial:
		for i in 9:
			var a := lerpf(-PI * 0.75, PI * 0.75, i / 8.0) - PI / 2.0
			draw_line(tk + Vector2(cos(a), sin(a)) * (tr + 4), tk + Vector2(cos(a), sin(a)) * (tr + 8), shine, 1.5)
	# Goose-neck microphone
	var neck := [Vector2(-6, -178), Vector2(-14, -200), Vector2(-28, -214), Vector2(-40, -222)]
	draw_polyline(PackedVector2Array(neck), dark, 6.0, true)
	var mic := Vector2(-48, -228)
	draw_circle(mic, 17, brass)
	draw_circle(mic, 13, Color(0.18, 0.15, 0.12))
	for i in 4:
		draw_line(mic + Vector2(-10, -6 + i * 4), mic + Vector2(10, -6 + i * 4), brass.darkened(0.2), 1.2)
	draw_arc(mic, 17, PI * 1.1, PI * 1.6, 8, shine, 2.0)
	# Speaking trumpet, pointing up toward the glass
	var vib := sin(_t * 40.0) * 1.5 if active else 0.0
	var horn := PackedVector2Array([Vector2(6, -176), Vector2(16, -182), Vector2(46 + vib, -242), Vector2(74 + vib, -262), Vector2(40 + vib, -256), Vector2(6, -186)])
	draw_colored_polygon(horn, brass)
	draw_line(Vector2(40 + vib, -256), Vector2(74 + vib, -262), shine, 3.0)
	draw_arc(Vector2(57 + vib, -259), 18, PI * 1.05, PI * 1.95, 10, dark, 3.0)
	# Indicator lamp in a little cage on top
	var lp := Vector2(0, -192)
	var lamp_col := Color(0.25, 0.1, 0.06)
	var glow := 0.0
	match lamp_mode:
		"message":
			lamp_col = Color(1.0, 0.7, 0.25)
			glow = 0.7 + 0.3 * sin(_t * 3.0)
		"attention":
			var on := fmod(_t, 0.5) < 0.28
			lamp_col = Color(1.0, 0.55, 0.2) if on else Color(0.35, 0.15, 0.08)
			glow = 0.9 if on else 0.0
		"static":
			var on2 := fmod(_t * 1.7, 1.0) < 0.5 and sin(_t * 23.0) > -0.3
			lamp_col = Color(0.55, 0.75, 1.0) if on2 else Color(0.15, 0.2, 0.3)
			glow = 0.6 if on2 else 0.0
		"new":
			lamp_col = Color(0.75, 0.95, 0.55)
			glow = 0.5
	if glow > 0.0:
		draw_circle(lp, 26, Color(lamp_col, 0.18 * glow))
		draw_circle(lp, 16, Color(lamp_col, 0.25 * glow))
	draw_circle(lp, 8, lamp_col)
	draw_arc(lp, 9, PI, TAU, 10, dark, 2.0)
	for i in 3:
		draw_line(lp + Vector2(-8 + i * 8, -8), lp + Vector2(-8 + i * 8, 6), dark, 1.2)
