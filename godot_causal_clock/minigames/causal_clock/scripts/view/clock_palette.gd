class_name CausalClockPalette
extends RefCounted
## Colour language of the artifact. Materials are referenced by name from the
## layout JSON ("material": "walnut"), so new looks can be added here without
## touching any drawing code.

## dark / base / light / edge (rim highlight) / engrave (incised lines)
const MATERIALS := {
	"brass": {
		"dark": Color(0.40, 0.27, 0.10), "base": Color(0.78, 0.59, 0.28),
		"light": Color(0.98, 0.84, 0.52), "edge": Color(1.0, 0.92, 0.66), "engrave": Color(0.30, 0.19, 0.07),
	},
	"navy": {
		"dark": Color(0.04, 0.07, 0.16), "base": Color(0.09, 0.16, 0.33),
		"light": Color(0.18, 0.28, 0.50), "edge": Color(0.92, 0.76, 0.42), "engrave": Color(0.03, 0.05, 0.11),
	},
	"ivory": {
		"dark": Color(0.56, 0.53, 0.47), "base": Color(0.82, 0.79, 0.71),
		"light": Color(0.95, 0.93, 0.87), "edge": Color(0.92, 0.76, 0.42), "engrave": Color(0.42, 0.36, 0.26),
	},
	"iron": {
		"dark": Color(0.10, 0.11, 0.12), "base": Color(0.25, 0.27, 0.29),
		"light": Color(0.45, 0.47, 0.50), "edge": Color(0.66, 0.68, 0.70), "engrave": Color(0.05, 0.05, 0.06),
	},
	"walnut": {
		"dark": Color(0.17, 0.09, 0.05), "base": Color(0.36, 0.21, 0.12),
		"light": Color(0.55, 0.35, 0.21), "edge": Color(0.78, 0.6, 0.38), "engrave": Color(0.1, 0.05, 0.02),
	},
	"enamel": {
		"dark": Color(0.04, 0.12, 0.16), "base": Color(0.09, 0.27, 0.33),
		"light": Color(0.2, 0.48, 0.55), "edge": Color(0.86, 0.72, 0.42), "engrave": Color(0.02, 0.06, 0.08),
	},
	"silver": {
		"dark": Color(0.28, 0.29, 0.31), "base": Color(0.55, 0.57, 0.6),
		"light": Color(0.82, 0.84, 0.86), "edge": Color(0.96, 0.96, 0.98), "engrave": Color(0.18, 0.18, 0.2),
	},
	"bone": {
		"dark": Color(0.45, 0.4, 0.32), "base": Color(0.76, 0.71, 0.6),
		"light": Color(0.93, 0.9, 0.82), "edge": Color(1, 0.97, 0.9), "engrave": Color(0.3, 0.25, 0.18),
	},
	"gold": {
		"dark": Color(0.38, 0.25, 0.06), "base": Color(0.78, 0.58, 0.2),
		"light": Color(1.0, 0.85, 0.48), "edge": Color(1.0, 0.95, 0.75), "engrave": Color(0.3, 0.18, 0.04),
	},
	"copper": {
		"dark": Color(0.30, 0.12, 0.07), "base": Color(0.58, 0.28, 0.15),
		"light": Color(0.82, 0.48, 0.30), "edge": Color(0.95, 0.78, 0.48), "engrave": Color(0.26, 0.09, 0.04),
	},
}

const CHAIN_DIM := Color(0.50, 0.38, 0.20)
const CHAIN_METAL := Color(0.80, 0.63, 0.34)
const CHAIN_LIT := Color(1.0, 0.86, 0.50)
const INLAY_DIM := Color(0.55, 0.36, 0.14, 0.75)
const INLAY_LIT := Color(1.0, 0.82, 0.42)
const GLOW := Color(1.0, 0.72, 0.32)
const SELECT := Color(0.98, 0.9, 0.66)
const HOVER := Color(0.75, 0.82, 0.9)
const PIN := Color(0.86, 0.26, 0.2)
const WARN := Color(1.0, 0.32, 0.25)
const CW := Color(0.62, 0.9, 1.0)
const CCW := Color(1.0, 0.78, 0.45)
const PLATE := Color(0.06, 0.05, 0.04)
const INK := Color(0.93, 0.87, 0.74)
const INK_DIM := Color(0.62, 0.56, 0.46)


static func material(name: String) -> Dictionary:
	return MATERIALS.get(name, MATERIALS["brass"])
