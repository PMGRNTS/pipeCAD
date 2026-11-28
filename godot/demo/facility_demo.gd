extends Node3D
## Demo facility: pipe light rigs exported from Klamp Studio ride trolleys on ceiling rails.
##
## Right-drag: orbit    Middle-drag or Shift+right-drag: pan    Wheel: zoom
## Left-click a rig: shove it    Space: start/stop trolleys    + / -: speed
## Tab: follow the next rig    R: respawn rigs

const LAMP := preload("res://demo/sample_light_rig.glb")
const ROOM := Vector3(28.0, 6.2, 20.0) # floor size x, ceiling height, floor size z
const RAIL_Y := 5.55

var trolleys: Array[RailTrolley] = []
var hangers: Array[KlampHanger] = []
var cam: Camera3D
var hud: Label
var yaw := -0.7
var pitch := -0.32
var dist := 19.0
var focus := Vector3(0, 2.6, 0)
var follow := -1


func _ready() -> void:
	_environment()
	_building()
	_loop_rail()
	_spur_rail()
	cam = Camera3D.new()
	cam.fov = 60.0
	add_child(cam)
	_update_camera()
	hud = Label.new()
	hud.position = Vector2(16, 12)
	hud.add_theme_color_override("font_color", Color(0.95, 0.96, 0.98))
	hud.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	hud.add_theme_constant_override("outline_size", 6)
	var layer := CanvasLayer.new()
	layer.add_child(hud)
	add_child(layer)


# ---------------------------------------------------------------- facility
func _environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.04, 0.05, 0.06)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.67, 0.75)
	env.ambient_light_energy = 0.45
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.ssao_enabled = true
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var fill := DirectionalLight3D.new()
	fill.light_energy = 0.35
	fill.rotation = Vector3(deg_to_rad(-60), deg_to_rad(30), 0)
	add_child(fill)
	for x in [-9.0, 0.0, 9.0]:
		for z in [-6.0, 6.0]:
			var o := OmniLight3D.new()
			o.position = Vector3(x, ROOM.y - 0.4, z)
			o.omni_range = 9.0
			o.light_energy = 0.7
			o.light_color = Color(0.85, 0.9, 1.0)
			add_child(o)


func _building() -> void:
	var w := ROOM.x
	var d := ROOM.z
	var h := ROOM.y
	_box("Floor", Vector3(w, 0.2, d), Vector3(0, -0.1, 0), Color(0.42, 0.42, 0.4))
	_box("Ceiling", Vector3(w, 0.2, d), Vector3(0, h + 0.1, 0), Color(0.22, 0.24, 0.26))
	_box("WallN", Vector3(w, h, 0.3), Vector3(0, h / 2, -d / 2), Color(0.55, 0.57, 0.6))
	_box("WallS", Vector3(w, h, 0.3), Vector3(0, h / 2, d / 2), Color(0.55, 0.57, 0.6))
	_box("WallW", Vector3(0.3, h, d), Vector3(-w / 2, h / 2, 0), Color(0.5, 0.52, 0.55))
	_box("WallE", Vector3(0.3, h, d), Vector3(w / 2, h / 2, 0), Color(0.5, 0.52, 0.55))
	for x in [-11.0, 11.0]:
		for z in [-8.0, 0.0, 8.0]:
			_box("Column", Vector3(0.45, h, 0.45), Vector3(x, h / 2, z), Color(0.3, 0.45, 0.62))
	# machines and racking (all lower than the rigs' swing height)
	_box("Press", Vector3(3.0, 2.2, 1.6), Vector3(-3.5, 1.1, 0), Color(0.2, 0.42, 0.3))
	_box("Lathe", Vector3(2.4, 1.4, 1.0), Vector3(3.0, 0.7, 0.4), Color(0.25, 0.3, 0.45))
	_box("Rack", Vector3(6.0, 2.6, 1.0), Vector3(0, 1.3, -8.6), Color(0.62, 0.38, 0.12))
	_box("Crate", Vector3(1.2, 1.0, 1.2), Vector3(9.5, 0.5, -1.5), Color(0.55, 0.42, 0.25))
	# walkway lines
	for z in [-5.6, 5.6]:
		_box("Line", Vector3(18.0, 0.01, 0.12), Vector3(0, 0.005, z), Color(0.95, 0.78, 0.1), false)


func _box(n: String, size: Vector3, pos: Vector3, color: Color, solid := true) -> void:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.85
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	bm.material = mat
	mi.mesh = bm
	if not solid:
		mi.position = pos
		mi.name = n
		add_child(mi)
		return
	var body := StaticBody3D.new()
	body.name = n
	body.position = pos
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	cs.shape = shape
	body.add_child(cs)
	body.add_child(mi)
	add_child(body, true)


# ---------------------------------------------------------------- rails
func _new_rail(n: String, curve: Curve3D) -> CeilingRail:
	var rail := CeilingRail.new()
	rail.name = n
	rail.curve = curve
	rail.hanger_length = ROOM.y - RAIL_Y - rail.beam_height * 0.5
	add_child(rail)
	return rail


## A rounded rectangle, 16 m x 8 m, with the last point on the first so it is a loop.
func _loop_rail() -> void:
	var a := 8.0
	var b := 4.0
	var r := 2.5
	var k := r * 0.5523 # Bézier handle length for a quarter circle
	var c := Curve3D.new()
	c.bake_interval = 0.05
	var at := func(x: float, z: float) -> Vector3: return Vector3(x, RAIL_Y, z)
	c.add_point(at.call(-a + r, -b))
	c.add_point(at.call(a - r, -b), Vector3.ZERO, Vector3(k, 0, 0))
	c.add_point(at.call(a, -b + r), Vector3(0, 0, -k))
	c.add_point(at.call(a, b - r), Vector3.ZERO, Vector3(0, 0, k))
	c.add_point(at.call(a - r, b), Vector3(k, 0, 0))
	c.add_point(at.call(-a + r, b), Vector3.ZERO, Vector3(-k, 0, 0))
	c.add_point(at.call(-a, b - r), Vector3(0, 0, k))
	c.add_point(at.call(-a, -b + r), Vector3.ZERO, Vector3(0, 0, -k))
	c.add_point(at.call(-a + r, -b), Vector3(-k, 0, 0))
	var rail := _new_rail("LoopRail", c)
	var length := rail.get_length()
	# Two stations on the loop; three rigs hung three different ways.
	var stations := PackedFloat32Array([4.0, length * 0.5 + 4.0])
	var setups := [
		{"mode": KlampHanger.HangMode.SINGLE, "segments": 1, "rope": 1.5},
		{"mode": KlampHanger.HangMode.SINGLE, "segments": 5, "rope": 1.8, "yaw": 90.0},
		{"mode": KlampHanger.HangMode.BRIDLE, "segments": 2, "rope": 1.4},
	]
	for i in setups.size():
		_add_trolley(rail, length * i / setups.size() + 1.0, stations, setups[i])


## A straight shuttle rail along the south wall, with three stops.
func _spur_rail() -> void:
	var c := Curve3D.new()
	c.add_point(Vector3(-9.0, RAIL_Y, 7.5))
	c.add_point(Vector3(9.0, RAIL_Y, 7.5))
	var rail := _new_rail("ShuttleRail", c)
	_add_trolley(rail, 1.0, PackedFloat32Array([1.0, 9.0, 17.0]),
		{"mode": KlampHanger.HangMode.BRIDLE, "segments": 3, "rope": 2.0})


func _add_trolley(rail: CeilingRail, at: float, stops: PackedFloat32Array, setup: Dictionary) -> void:
	var t := RailTrolley.new()
	t.name = "Trolley%d" % (trolleys.size() + 1)
	t.progress = at
	t.cruise_speed = 1.4
	t.acceleration = 0.45
	t.braking = 0.55
	t.stops = stops
	t.dwell_time = 2.5
	rail.add_child(t)
	var h := KlampHanger.new()
	h.name = "Hanger"
	h.lamp_scene = LAMP
	h.hang_mode = setup["mode"]
	h.rope_segments = setup["segments"]
	h.rope_length = setup["rope"]
	h.lamp_yaw = setup.get("yaw", 0.0)
	h.extra_mass = 6.0 # the light bars added below
	h.spawned.connect(_add_lights)
	t.add_child(h)
	trolleys.append(t)
	hangers.append(h)


## Give each rig a glowing light bar and a real light, so the swinging is easy to see.
func _add_lights(lamp: RigidBody3D) -> void:
	var info: Dictionary = lamp.get_meta(KlampLampBuilder.META)
	var com: Vector3 = info["center_of_mass"]
	var bounds: AABB = info["bounds"]
	var bottom := bounds.position.y
	var glow := StandardMaterial3D.new()
	glow.albedo_color = Color(1, 0.95, 0.85)
	glow.emission_enabled = true
	glow.emission = Color(1.0, 0.88, 0.65)
	glow.emission_energy_multiplier = 3.0
	for z in [-0.15, 0.15]:
		var bar := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(1.0, 0.03, 0.08)
		bm.material = glow
		bar.mesh = bm
		bar.position = Vector3(com.x, bottom - 0.03, com.z + z)
		lamp.add_child(bar)
	var light := OmniLight3D.new()
	light.position = Vector3(com.x, bottom - 0.25, com.z)
	light.omni_range = 7.0
	light.light_energy = 1.6
	light.light_color = Color(1.0, 0.86, 0.66)
	light.shadow_enabled = true
	lamp.add_child(light)


# ---------------------------------------------------------------- camera & input
func _update_camera() -> void:
	var b := Basis.from_euler(Vector3(pitch, yaw, 0))
	cam.global_transform = Transform3D(b, focus + b.z * dist)


func _process(delta: float) -> void:
	if follow >= 0 and follow < hangers.size() and hangers[follow].lamp != null:
		focus = focus.lerp(hangers[follow].lamp.global_position, minf(1.0, delta * 4.0))
		_update_camera()
	var lines := PackedStringArray()
	lines.append("Klamp rigs on ceiling rails   |   Space start/stop   +/- speed   Tab follow   R respawn   click: shove")
	for i in trolleys.size():
		var t := trolleys[i]
		var h := hangers[i]
		var state := "stopped" if t.is_dwelling() else ("running" if t.running else "braking")
		lines.append("%s %-12s %4.2f m/s  swing %4.1f°  %s%s" % [
			">" if i == follow else " ", t.name, t.speed, rad_to_deg(h.get_swing_angle()),
			KlampHanger.HangMode.keys()[h.hang_mode].to_lower(), "  " + state])
	hud.text = "\n".join(lines)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		var pan := (mm.button_mask & MOUSE_BUTTON_MASK_MIDDLE) != 0 \
			or ((mm.button_mask & MOUSE_BUTTON_MASK_RIGHT) != 0 and mm.shift_pressed)
		if pan:
			var b := cam.global_transform.basis
			focus += (-b.x * mm.relative.x + b.y * mm.relative.y) * dist * 0.0012
			follow = -1
			_update_camera()
		elif (mm.button_mask & MOUSE_BUTTON_MASK_RIGHT) != 0:
			yaw -= mm.relative.x * 0.006
			pitch = clampf(pitch - mm.relative.y * 0.006, -1.45, 0.3)
			_update_camera()
	elif event is InputEventMouseButton and event.is_pressed():
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			dist = maxf(1.5, dist * 0.9)
			_update_camera()
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			dist = minf(60.0, dist * 1.1)
			_update_camera()
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			_shove(mb.position)
	elif event is InputEventKey and event.is_pressed() and not event.is_echo():
		match (event as InputEventKey).keycode:
			KEY_SPACE:
				var run := not trolleys[0].running
				for t in trolleys:
					t.running = run
			KEY_EQUAL, KEY_PLUS, KEY_KP_ADD:
				for t in trolleys:
					t.cruise_speed = minf(t.cruise_speed + 0.2, 4.0)
			KEY_MINUS, KEY_KP_SUBTRACT:
				for t in trolleys:
					t.cruise_speed = maxf(t.cruise_speed - 0.2, 0.2)
			KEY_TAB:
				follow = follow + 1 if follow + 1 < hangers.size() else -1
			KEY_R:
				for h in hangers:
					h.spawn()


func _shove(screen: Vector2) -> void:
	var from := cam.project_ray_origin(screen)
	var dir := cam.project_ray_normal(screen)
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * 100.0)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty() or not (hit["collider"] is RigidBody3D):
		return
	var body: RigidBody3D = hit["collider"]
	var push := dir
	push.y = 0.0
	body.apply_impulse(push.normalized() * body.mass * 1.2, (hit["position"] as Vector3) - body.global_position)
