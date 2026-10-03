class_name AmplitudeLipSync
extends LipSyncDriver
## Drives the mouth from the sound of a playing audio file.
##
## Loudness controls how far the mouth opens. The *tone* of the sound picks the
## shape: low/dark sounds round the lips ("oo", "oh"), hissy sounds pull them
## back to show teeth ("s", "ee"), and each new syllable picks a slightly
## different open shape so it never looks like a simple flapping jaw.
##
## Two analysis paths:
##   * 16-bit / 8-bit PCM WAV files are analysed up-front (exact, and lets the
##     mouth move a fraction *before* the sound, which reads as better sync).
##   * Anything else (OGG, MP3, compressed WAV) is analysed live with an
##     AudioEffectSpectrumAnalyzer on the door's own audio bus.

## How far ahead of the audio the mouth moves (seconds).
var anticipation := 0.04
## Live analysis: decibels considered "silence" below the loudest recent sound.
var dynamic_range_db := 32.0

var _player: Node  # AudioStreamPlayer, AudioStreamPlayer2D or AudioStreamPlayer3D
var _stream: AudioStream
var _bus: StringName
var _analysis: Dictionary = {}  # offline features
var _played := false
var _peak_db := -70.0
var _low_mean := 0.6
var _low_var := 0.01
var _hiss_mean := 0.1
var _hiss_var := 0.003

const HOP := 0.01  # seconds per analysis frame

static var _cache := {}


func _init(player: Node, stream: AudioStream, analyzer_bus: StringName = &"") -> void:
	_player = player
	_stream = stream
	_bus = analyzer_bus


func start() -> void:
	super.start()
	if _stream is AudioStreamWAV:
		_analysis = analyze_wav(_stream as AudioStreamWAV)
	_player.set("stream", _stream)
	_player.call("play")
	_played = true


func stop() -> void:
	super.stop()
	if is_instance_valid(_player) and _player.get("playing"):
		_player.call("stop")


func get_duration() -> float:
	return _stream.get_length() if _stream else -1.0


func uses_offline_analysis() -> bool:
	return not _analysis.is_empty()


func _sample(delta: float) -> Dictionary:
	if not is_instance_valid(_player):
		_finish()
		return {}
	var playing: bool = _player.get("playing")
	if _played and not playing and _time > 0.05:
		_finish()
		return {"pose": MouthPose.new(), "energy": 0.0}
	var t: float = _player.call("get_playback_position") + AudioServer.get_time_since_last_mix() - AudioServer.get_output_latency()
	t = maxf(t, 0.0)
	var f := _features_offline(t + anticipation) if not _analysis.is_empty() else _features_live(delta)
	return {"pose": _pose_from_features(f.x, f.y, f.z), "energy": f.x}


## Returns Vector3(energy, lowness, hiss).
func _features_offline(t: float) -> Vector3:
	var e: PackedFloat32Array = _analysis.energy
	if e.is_empty():
		return Vector3.ZERO
	var fi := t / HOP
	var i := clampi(int(fi), 0, e.size() - 1)
	var j := mini(i + 1, e.size() - 1)
	var w := clampf(fi - float(i), 0.0, 1.0)
	var low: PackedFloat32Array = _analysis.lowness
	var hiss: PackedFloat32Array = _analysis.hiss
	return Vector3(lerpf(e[i], e[j], w), lerpf(low[i], low[j], w), lerpf(hiss[i], hiss[j], w))


func _features_live(delta: float) -> Vector3:
	var idx := AudioServer.get_bus_index(_bus) if _bus != &"" else -1
	if idx < 0 or AudioServer.get_bus_effect_count(idx) == 0:
		return Vector3.ZERO
	var fx := AudioServer.get_bus_effect_instance(idx, 0) as AudioEffectSpectrumAnalyzerInstance
	if fx == null:
		return Vector3.ZERO
	var total := _mag(fx, 90, 4000)
	var low := _mag(fx, 90, 700)
	var mid := _mag(fx, 700, 3000)
	var high := _mag(fx, 3500, 9000)
	var db := linear_to_db(maxf(total, 0.000001))
	_peak_db = maxf(_peak_db - 4.0 * delta, db)
	var energy := clampf((db - (_peak_db - dynamic_range_db)) / dynamic_range_db, 0.0, 1.0)
	var raw_low := clampf(low / maxf(low + mid, 0.000001), 0.0, 1.0)
	var raw_hiss := clampf(high / maxf(total, 0.000001), 0.0, 1.0)
	# Judge tone relative to this voice's running average.
	if energy > 0.3:
		var k := 1.0 - exp(-delta * 2.0)
		_low_mean = lerpf(_low_mean, raw_low, k)
		_low_var = lerpf(_low_var, pow(raw_low - _low_mean, 2.0), k)
		_hiss_mean = lerpf(_hiss_mean, raw_hiss, k)
		_hiss_var = lerpf(_hiss_var, pow(raw_hiss - _hiss_mean, 2.0), k)
	var lowness := clampf(0.4 + (raw_low - _low_mean) / (2.5 * sqrt(maxf(_low_var, 0.0004))), 0.0, 1.0)
	var hiss := clampf((raw_hiss - _hiss_mean) / (2.0 * sqrt(maxf(_hiss_var, 0.0004))), 0.0, 1.0)
	return Vector3(energy, lowness, hiss)


func _mag(fx: AudioEffectSpectrumAnalyzerInstance, from_hz: float, to_hz: float) -> float:
	var v := fx.get_magnitude_for_frequency_range(from_hz, to_hz, AudioEffectSpectrumAnalyzerInstance.MAGNITUDE_AVERAGE)
	return (v.x + v.y) * 0.5


## Analyses a PCM WAV into per-10ms loudness / tone features. Cached per stream.
## Returns {} if the WAV is compressed (then live analysis is used instead).
static func analyze_wav(wav: AudioStreamWAV) -> Dictionary:
	if _cache.has(wav):
		return _cache[wav]
	var fmt := wav.format
	if fmt != AudioStreamWAV.FORMAT_16_BITS and fmt != AudioStreamWAV.FORMAT_8_BITS:
		return {}
	var data := wav.data
	var bytes_per_sample := 2 if fmt == AudioStreamWAV.FORMAT_16_BITS else 1
	var channels := 2 if wav.stereo else 1
	var frame_bytes := bytes_per_sample * channels
	var total_frames := data.size() / frame_bytes
	if total_frames <= 0:
		return {}
	var rate := float(wav.mix_rate)
	var hop := maxi(int(rate * HOP), 1)
	var lp_a := 1.0 - exp(-TAU * 700.0 / rate)  # one-pole low-pass ~700 Hz
	var rms := PackedFloat32Array()
	var lows := PackedFloat32Array()
	var hisses := PackedFloat32Array()
	var lp := 0.0
	var prev := 0.0
	var pos := 0
	while pos < total_frames:
		var n := mini(hop, total_frames - pos)
		var s2 := 0.0
		var d2 := 0.0
		var l2 := 0.0
		for k in n:
			var off := (pos + k) * frame_bytes
			var x := 0.0
			if bytes_per_sample == 2:
				x = data.decode_s16(off) / 32768.0
				if channels == 2:
					x = (x + data.decode_s16(off + 2) / 32768.0) * 0.5
			else:
				x = (data.decode_s8(off)) / 128.0
			lp += lp_a * (x - lp)
			var d := x - prev
			prev = x
			s2 += x * x
			d2 += d * d
			l2 += lp * lp
		var r := sqrt(s2 / n)
		rms.append(r)
		lows.append(clampf(sqrt(l2 / n) / maxf(r, 0.00001), 0.0, 1.0))
		hisses.append(clampf(sqrt(d2 / n) / maxf(r, 0.00001) * 0.55, 0.0, 1.0))
		pos += n
	# Loudness relative to this clip: map a 30 dB window below its loud parts to 0..1.
	var dbs := PackedFloat32Array()
	for r in rms:
		dbs.append(linear_to_db(maxf(r, 0.00001)))
	var sorted := dbs.duplicate()
	sorted.sort()
	var ref_db := sorted[int((sorted.size() - 1) * 0.95)]
	var energy := PackedFloat32Array()
	var voiced_low := PackedFloat32Array()
	var voiced_hiss := PackedFloat32Array()
	for i in dbs.size():
		var e := clampf((dbs[i] - (ref_db - 30.0)) / 30.0, 0.0, 1.0)
		energy.append(e)
		if e > 0.3:
			voiced_low.append(lows[i])
			voiced_hiss.append(hisses[i])
	# Tone is judged relative to this voice: every voice has a different "normal".
	voiced_low.sort()
	voiced_hiss.sort()
	var low_lo := _pct(voiced_low, 0.25, 0.5)
	var low_hi := maxf(_pct(voiced_low, 0.95, 0.9), low_lo + 0.05)
	var hiss_lo := _pct(voiced_hiss, 0.6, 0.2)
	var hiss_hi := maxf(_pct(voiced_hiss, 0.97, 0.6), hiss_lo + 0.1)
	for i in dbs.size():
		if energy[i] < 0.1:
			# Tone features are meaningless in near-silence.
			lows[i] = 0.0
			hisses[i] = 0.0
		else:
			lows[i] = clampf((lows[i] - low_lo) / (low_hi - low_lo), 0.0, 1.0)
			hisses[i] = clampf((hisses[i] - hiss_lo) / (hiss_hi - hiss_lo), 0.0, 1.0)
	var result := {"energy": energy, "lowness": lows, "hiss": hisses}
	_cache[wav] = result
	return result


static func _pct(sorted_values: PackedFloat32Array, p: float, fallback: float) -> float:
	if sorted_values.is_empty():
		return fallback
	return sorted_values[int((sorted_values.size() - 1) * p)]
