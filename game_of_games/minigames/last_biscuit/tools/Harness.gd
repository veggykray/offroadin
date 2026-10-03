extends Node
## Developer harness: runs the mini-game with a scripted scenario and saves
## screenshots. Usage:
##   godot --path . res://minigames/last_biscuit/tools/Harness.tscn -- --scenario=overview --out=shots
## Scenarios: overview, debug, approach, caught, slap, ending, events

var game: LBManager
var scenario := "overview"
var out_dir := "res://shots"
var t := 0.0
var frame := 0
var _done := {}
var size := Vector2i(1600, 900)
var bot: LBBot
var _report_t := 0.0


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--scenario="):
			scenario = a.split("=")[1]
		elif a.begins_with("--out="):
			out_dir = a.split("=")[1]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out_dir) if out_dir.begins_with("res://") else out_dir)
	game = load("res://minigames/last_biscuit/LastBiscuit.tscn").instantiate()
	add_child(game)
	game.last_biscuit_completed.connect(func(id): print("COMPLETED ", id))
	game.player_caught.connect(func(by, n): print("CAUGHT by ", by, " attempt ", n, " t=", t))
	game.noise_sys.noise.connect(func(pos, loud, src, kind):
		if "--noise" in OS.get_cmdline_user_args():
			print("noise t=%.2f %s %.2f src=%s at %s" % [t, kind, loud, src.name if src else "-", pos]))


func shot(name_: String) -> void:
	var img := get_viewport().get_texture().get_image()
	var p := out_dir.path_join(scenario + "_" + name_ + ".png")
	img.save_png(p)
	print("shot ", p)


func at(time: float, key: String) -> bool:
	if t >= time and not _done.has(key):
		_done[key] = true
		return true
	return false


func _process(dt: float) -> void:
	t += dt
	frame += 1
	# the virtual X pointer must not steer the hand unless a scenario drives it
	if scenario != "approach" and scenario != "bot" and scenario != "heatmap" and game.player.scripted_target == null:
		game.player.use_mouse = false
	match scenario:
		"overview":
			if at(3.4, "dbg"):
				var h: Label = game.hud.hint
				print("hint rect ", h.get_global_rect(), " col ", h.get_theme_color("font_color"), " vis ", h.is_visible_in_tree(), " text ", h.text.length())
			if at(3.5, "a"): shot("a")
			if at(4.0, "q"): get_tree().quit()
		"debug":
			if at(1.0, "d"): game.set_debug(true)
			if at(3.5, "a"): shot("a")
			if at(4.0, "p2"): game.debug_jump_phase(4)
			if at(7.0, "b"): shot("b")
			if at(7.5, "q"): get_tree().quit()
		"approach":
			var p := game.player
			if t > 2.0:
				p.scripted_target = LBConst.BILL_HAND_HOME.lerp(Vector2(0.05, 0.05), clampf((t - 2.0) / 5.0, 0.0, 1.0))
			if at(4.0, "a"): shot("a")
			if at(6.0, "b"): shot("b")
			if at(7.5, "c"): shot("c")
			if at(8.0, "g"): Input.action_press("lb_grab")
			if at(8.6, "d"): shot("d")
			if t > 8.6:
				p.scripted_target = Vector2(0.05, 0.05).lerp(LBConst.BILL_HAND_HOME, clampf((t - 8.6) / 3.0, 0.0, 1.0))
			if at(10.0, "e"): shot("e")
			if at(12.5, "f"): shot("f")
			if at(13.5, "q"): get_tree().quit()
		"caught":
			if at(2.0, "c"):
				game.player.plane_pos = Vector2(0.0, 1.2)
				game._on_caught(game.diners[1], game.player)
			if at(3.0, "a"): shot("a")
			if at(5.0, "b"): shot("b")
			if at(7.5, "c2"): shot("c")
			if at(9.5, "d"): shot("d")
			if at(12.0, "e"): shot("e")
			if at(12.5, "q"): get_tree().quit()
		"slap":
			if at(1.5, "p"):
				game.debug_jump_return()
			if at(4.5, "s"):
				var r: LBRivalHand = game.rivals[0]
				r.plane_pos = game.player.plane_pos + Vector2(0.18, -0.05)
				r.state = LBRivalHand.St.ACTIVE
				r.reach_scale = 1.0
				r.active = true
				game.do_slap(game.player, r)
			if at(4.52, "a"): shot("a")
			if at(4.7, "b"): shot("b")
			if at(6.0, "c"): shot("c")
			if at(6.5, "q"): get_tree().quit()
		"ending":
			if game.bill.dog.visible and not _done.has("dog"):
				_done["dog"] = true
				shot("dog")
			if at(1.5, "e"): game.debug_jump_ending()
			if at(2.3, "a"): shot("a")
			if at(3.2, "b"): shot("b")
			if at(3.95, "c"): shot("c")
			if at(4.15, "d"): shot("d")
			if at(7.0, "e2"): shot("e")
			if at(13.0, "f"): shot("f")
			if at(13.5, "q"): get_tree().quit()
		"bot":
			if bot == null:
				var greed := 0.0
				for a in OS.get_cmdline_user_args():
					if a.begins_with("--greed="):
						greed = float(a.split("=")[1])
				bot = LBBot.new(game, greed)
				game.comedy.enabled = true
				Engine.time_scale = 3.0 if DisplayServer.get_name() == "headless" else 1.0
				game.player_caught.connect(func(_b, _n): bot.stats.caught += 1)
				game.last_biscuit_completed.connect(func(_i):
					print("BOT WON in %.1fs play time, attempts %d, stats %s" % [game.play_time, game.attempt, bot.stats])
					get_tree().quit())
				game.phase_changed.connect(func(ph): print("  phase -> %d at %.1fs" % [ph, game.play_time]))
			bot.step(dt)
			if "--shots" in OS.get_cmdline_user_args() and at(40.0, "bs"):
				game.set_debug(true)
			if "--shots" in OS.get_cmdline_user_args() and at(41.0, "bs2"):
				shot("stuck")
				get_tree().quit()
			_report_t += dt
			if _report_t > 10.0:
				_report_t = 0.0
				var p := game.player
				var rb := game.real_biscuit()
				var rinfo := ""
				for r in game.rivals:
					rinfo += "%s:%s%s " % [r.name.substr(0, 4), LBRivalHand.St.keys()[r.state].substr(0, 4), "F" if r.frozen else ""]
				print("  t=%.0f pos=(%.2f,%.2f) phase=%d held=%s caught=%d biscuit=%s %s | %s" % [game.play_time, p.plane_pos.x, p.plane_pos.y, game.phase, p.held.name if p.held else "-", bot.stats.caught,
						("(%.2f,%.2f)" % [rb.plane_pos.x, rb.plane_pos.y]) if rb else "none", (rb.held_by.name if rb and rb.held_by else ""), rinfo])
				if "--explain" in OS.get_cmdline_user_args():
					print("     ", bot.explain(p.plane_pos, bot._goal))
			if game.play_time > 420.0:
				print("BOT TIMEOUT stats %s" % [bot.stats])
				get_tree().quit()
		"heatmap":
			# fraction of time each table cell is watched by anyone (ASCII)
			if not has_meta("grid"):
				Engine.time_scale = 4.0
				set_meta("grid", {})
				set_meta("n", 0)
			if frame % 3 == 0 and t > 1.0:
				var grid: Dictionary = get_meta("grid")
				var h := game.player
				var saved := h.plane_pos
				for zi in range(0, 24):
					for xi in range(0, 11):
						var p := Vector2(-1.0 + xi * 0.2, 4.6 - zi * 0.25)
						h.plane_pos = p
						var v := 0.0
						for d in game.diners:
							v = maxf(v, d.gaze_visibility(h))
						var k := Vector2i(xi, zi)
						grid[k] = grid.get(k, 0.0) + (1.0 if v > 0.05 else 0.0)
						var k2 := Vector2i(xi + 100, zi)
						grid[k2] = grid.get(k2, 0.0) + (1.0 if v > 0.3 else 0.0)
				h.plane_pos = saved
				set_meta("n", get_meta("n") + 1)
			if game.play_time > 90.0:
				var grid: Dictionary = get_meta("grid")
				var n: int = get_meta("n")
				print("watched fraction (rows: z from 4.6 down to -1.15; cols x -1..1). digits = tenths")
				for zi in range(0, 24):
					var line := "z=%5.2f  " % (4.6 - zi * 0.25)
					for xi in range(0, 11):
						var f: float = grid.get(Vector2i(xi, zi), 0.0) / n
						line += str(mini(int(f * 10.0), 9)) + " "
					line += "   core: "
					for xi in range(0, 11):
						var f2: float = grid.get(Vector2i(xi + 100, zi), 0.0) / n
						line += str(mini(int(f2 * 10.0), 9)) + " "
					print(line)
				get_tree().quit()
		"rivals":
			if at(1.0, "p"):
				game.debug_jump_phase(4)
				game.player.plane_pos = LBConst.BILL_HAND_HOME
				game.player.snap_cursor_to_hand()
				Engine.time_scale = 2.0 if DisplayServer.get_name() == "headless" else 1.0
			if frame % 30 == 0 and t > 1.0:
				var line := "t=%.1f " % t
				for r in game.rivals:
					line += "| %s %s %s %s (%.2f,%.2f) " % [r.name.substr(0, 6), LBRivalHand.St.keys()[r.state], r.ai_note, "F" if r.frozen else "", r.plane_pos.x, r.plane_pos.y]
				var bs := ""
				for b in game.world.biscuits():
					bs += "%s%.2f@(%.2f,%.2f)%s " % ["FAKE" if b.is_fake else "B", b.size_fraction, b.plane_pos.x, b.plane_pos.y, ("held:" + b.held_by.name) if b.held_by else ""]
				print(line, " || ", bs)
			if t > 1.0 and int(t) % 6 == 0 and at(t, "s%d" % int(t)) and DisplayServer.get_name() != "headless":
				shot("t%d" % int(t))
			if t > 40.0:
				get_tree().quit()
		"tug":
			if at(1.0, "r"):
				game.debug_jump_return()
				game.paused_rivals = true
				for d in game.diners:
					d.paused = true
			if at(1.5, "g"):
				var r: LBRivalHand = game.rivals[1]
				r.state = LBRivalHand.St.ACTIVE
				r.active = true
				r.reach_scale = 1.0
				r.plane_pos = game.player.plane_pos + Vector2(0.05, -0.05)
				r.grab(game.player.held)
				print("contested: ", (game.player.held as LBBiscuit).is_contested())
			if t > 1.6 and t < 3.5:
				var bb := game.real_biscuit()
				if bb and frame % 2 == 0:
					print("t=%.2f holders=%d strain=%.2f pvel=%.2f rvel=%.2f d=%.2f" % [t, bb.holders.size(), bb.tug_strain, game.player.vel.length(), game.rivals[1].vel.length(), game.player.plane_pos.distance_to(game.rivals[1].plane_pos)])
				game.player.scripted_target = game.player.plane_pos + Vector2(0, 0.4)
				game.rivals[1].plane_pos += Vector2(0.004, -0.004)
			if at(2.4, "a"): shot("a")
			if at(3.6, "s"):
				print("state ", LBManager.GS.keys()[game.gs], " biscuits ", game.world.biscuits().map(func(b): return "%.2f %s" % [b.size_fraction, b.held_by.name if b.held_by else "-"]))
				shot("b")
			if at(4.0, "brk"):
				var bb := game.real_biscuit()
				if bb.size_fraction > 0.9:
					game.break_biscuit(bb)
			if at(4.5, "c"):
				print("state ", LBManager.GS.keys()[game.gs], " biscuits ", game.world.biscuits().map(func(b): return "%.2f %s" % [b.size_fraction, b.held_by.name if b.held_by else "-"]))
				shot("c")
			if at(7.0, "q"):
				print("after beat state ", LBManager.GS.keys()[game.gs])
				get_tree().quit()
		"reach":
			if at(1.0, "1"): game.comedy.trigger("legit_reach")
			if frame % 20 == 0:
				for d in game.diners:
					if d.reaching > 0.0:
						var v := d.visual as LBDinerVisual
						print("%s reaching %.2f arm vis %s pos %s scale %s" % [d.display_name, d.reaching, v.point_arm.visible, v.point_arm.global_position, v.point_arm.scale])
			if at(4.0, "a"): shot("a")
			if at(5.0, "q"): get_tree().quit()
		"closeup":
			var cam := game.camera
			var spots := [
				["teapot", Vector3(0.9, 1.25, 0.2), Vector3(0.36, 0.85, -0.82)],
				["cheat", Vector3(0.2, 1.4, -1.6), Vector3(1.48, 1.2, -2.4)],
				["sleeper", Vector3(-0.3, 1.4, 3.4), Vector3(-1.48, 1.25, 2.4)],
				["glasses", Vector3(-0.2, 1.4, 1.0), Vector3(-1.48, 1.25, 0.0)],
				["plate", Vector3(0.0, 1.3, 0.9), Vector3(0.0, 0.76, 0.0)],
				["hand", Vector3(0.6, 1.5, 5.6), Vector3(0.18, 0.8, 4.4)],
			]
			if t > 2.0:
				cam.set_process(false)
				var idx := int((t - 2.0) / 1.0)
				if idx < spots.size():
					var sp: Array = spots[idx]
					cam.global_position = sp[1]
					cam.look_at(sp[2], Vector3.UP)
					cam.fov = 40.0
					if at(2.0 + idx + 0.8, sp[0]):
						shot(sp[0])
				else:
					get_tree().quit()
		"events":
			if at(1.0, "1"): game.comedy.trigger("sneeze")
			if at(2.0, "a"): shot("sneeze")
			if at(5.0, "2"): game.comedy.trigger("legit_reach")
			if at(8.6, "b"): shot("reach")
			if at(12.0, "3"): game.comedy.trigger("waiter")
			if at(18.5, "c"): shot("waiter")
			if at(21.0, "4"): game.comedy.trigger("fly")
			if at(25.0, "d"): shot("fly")
			if at(28.0, "5"): game.comedy.trigger("teeth")
			if at(29.6, "e"): shot("teeth")
			if at(32.0, "6"): game.comedy.trigger("cat_tail")
			if at(34.6, "f"): shot("cat")
			if at(38.0, "q"): get_tree().quit()
