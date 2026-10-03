extends SceneTree
## Renders every synthesised creature sound to tests/out/audio/*.wav and
## prints basic stats.  godot --headless --path . -s tests/export_sounds.gd

func _init() -> void:
	var dir := ProjectSettings.globalize_path("res://tests/out/audio/")
	DirAccess.make_dir_recursive_absolute(dir)
	for n in Synth.NAMES:
		var w: AudioStreamWAV = Synth.build(n)
		if w == null:
			print("MISSING ", n)
			continue
		var data := w.data
		var count := data.size() / 2
		var peak := 0
		var sq := 0.0
		for i in range(0, count, 4):
			var v := data.decode_s16(i * 2)
			peak = maxi(peak, absi(v))
			sq += float(v) * v
		var rms := sqrt(sq / (count / 4.0)) / 32768.0
		w.save_to_wav(dir + str(n) + ".wav")
		print("%-8s %.2fs peak %.2f rms %.3f" % [n, float(count) / w.mix_rate, peak / 32768.0, rms])
	quit()
