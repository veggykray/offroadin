class_name CausalClockPalette
extends RefCounted
## Colour language of the artifact. Materials are referenced by name from the
## layout JSON ("material": "walnut"), so new looks can be added here without
## touching any drawing code.

## dark / base / light / edge (rim highlight) / engrave (incised lines)
const MATERIALS := {
	"brass": {
		"dark": Color(0.30, 0.20, 0.08), "base": Color(0.62, 0.46, 0.22),
		"light": Color(0.90, 0.74, 0.44), "edge": Color(1.0, 0.88, 0.6), "engrave": Color(0.22, 0.14, 0.05),
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
		"dark": Color(0.28, 0.12, 0.07), "base": Color(0.6, 0.32, 0.18),
		"light": Color(0.88, 0.56, 0.36), "edge": Color(1, 0.78, 0.6), "engrave": Color(0.2, 0.08, 0.04),
	},
}

const CHAIN_DIM := Color(0.42, 0.36, 0.28)
const CHAIN_METAL := Color(0.68, 0.62, 0.52)
const CHAIN_LIT := Color(1.0, 0.86, 0.52)
const INLAY_DIM := Color(0.55, 0.36, 0.14, 0.75)
const INLAY_LIT := Color(1.0, 0.82, 0.42)
const GLOW := Color(1.0, 0.72, 0.32)
const SELECT := Color(0.98, 0.9, 0.66)
const HOVER := Color(0.75, 0.82, 0.9)
const PIN := Color(0.86, 0.26, 0.2)
const WARN := Color(1.0, 0.32, 0.25)
const CW := Color(0.62, 0.9, 1.0)
const CCW := Color(1.0, 0.78, 0.45)
const PLATE := Color(0.075, 0.07, 0.08)
const INK := Color(0.93, 0.87, 0.74)
const INK_DIM := Color(0.62, 0.56, 0.46)


static func material(name: String) -> Dictionary:
	return MATERIALS.get(name, MATERIALS["brass"])
