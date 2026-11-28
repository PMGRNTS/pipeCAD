extends Node3D
## Demo: pipe rigs exported from Klamp Studio ride trolleys on ceiling rails through a factory hall.
##
## Camera   right-drag orbit · middle-drag pan · wheel zoom · W A S D move
##          1-4 views · F fly · Tab follow next rig · V ride the selected trolley
## Rigs     click to select · Shift+click to shove · B bump selected · N send to next station
##          X stop/start selected · Space stop/start all · + / - speed · R respawn · H help

const Hall := preload("res://demo/factory_hall.gd")
const DemoCamera := preload("res://demo/demo_camera.gd")
const RIG := preload("res://demo/sample_light_rig.glb")
const GRID := preload("res://demo/sample_lighting_grid.glb")
const RAIL_Y := 6.5 # beam centre line, about 1 m under the trusses

var hall: Hall
var cam: DemoCamera
var trolleys: Array[RailTrolley] = []
var hangers: Array[KlampHanger] = []
var station_names := {} # RailTrolley stop index -> name, per rail
var loop_rail: CeilingRail
var selected := -1
var follow_index := -1
var help_on := true
var hud_left: RichTextLabel
var hud_right: RichTextLabel
var marker: MeshInstance3D
var _rail_names := {}


func _ready() -> void:
	_environment()
	hall = Hall.new()
	hall.name = "FactoryHall"
	add_child(hall)
	hall.build()
	_loop_line()
	_dispatch_shuttle()
	_inspection_spur()
	cam = DemoCamera.new()
	cam.fov = 62.0
	add_child(cam)
	cam.current = true
	view(1)
	_selection_marker()
	_hud()


# ---------------------------------------------------------------- look
func _environment() -> void:
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.36, 0.52, 0.74)
	sky_mat.sky_horizon_color = Color(0.7, 0.76, 0.82)
	sky_mat.ground_horizon_color = Color(0.5, 0.5, 0.5)
	sky_mat.ground_bottom_color = Color(0.2, 0.2, 0.2)
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.58, 0.62, 0.7)
	env.ambient_light_energy = 0.35
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_white = 6.0
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_hdr_threshold = 1.2
	if RenderingServer.get_current_rendering_method() == "forward_plus":
		env.ssao_enabled = true
		env.ssao_radius = 1.2
		env.ssao_intensity = 1.6
		env.volumetric_fog_enabled = OS.get_environment("DEMO_NO_FOG") == ""
		env.volumetric_fog_density = 0.0 # the hall adds its own FogVolume
		env.volumetric_fog_albedo = Color(0.9, 0.9, 0.88)
		env.volumetric_fog_length = 48.0
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation = Vector3(deg_to_rad(-58), deg_to_rad(-28), 0)
	sun.light_energy = 2.4
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 80.0
	sun.light_volumetric_fog_energy = 2.0
	add_child(sun)


# ---------------------------------------------------------------- rails & stations
func _new_rail(rail_name: String, curve: Curve3D) -> CeilingRail:
	var rail := CeilingRail.new()
	rail.name = rail_name
	curve.bake_interval = 0.05
	rail.curve = curve
	rail.hanger_spacing = 2.5
	rail.beam_material = hall.mats["rail"]
	rail.hanger_length = Hall.EAVES - RAIL_Y - rail.beam_height * 0.5
	add_child(rail)
	return rail


## The main line: a 26 m x 12 m loop with four work stations.
func _loop_line() -> void:
	var a := 13.0
	var b := 6.0
	var r := 3.0
	var k := r * 0.5523 # Bezier handle length for a quarter circle
	var c := Curve3D.new()
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
	loop_rail = _new_rail("MainLoop", c)
	_rail_names[loop_rail] = "Main loop"

	var stations := [
		["CUT & PREP", Vector3(-5, 0, -b), 1.0],
		["ASSEMBLY", Vector3(5, 0, -b), 1.0],
		["WIRING", Vector3(5, 0, b), -1.0],
		["TEST", Vector3(-5, 0, b), -1.0],
	]
	var stops := PackedFloat32Array()
	var names: Array[String] = []
	for i in stations.size():
		var s: Array = stations[i]
		var floor_pos: Vector3 = s[1]
		stops.append(c.get_closest_offset(Vector3(floor_pos.x, RAIL_Y, floor_pos.z)))
		names.append("%d · %s" % [i + 1, s[0]])
		_station(i, names[i], floor_pos, s[2])
	station_names[loop_rail] = names

	var setups := [
		{"lamp": RIG, "mode": KlampHanger.HangMode.SINGLE, "segments": 1, "rope": 3.0},
		{"lamp": GRID, "mode": KlampHanger.HangMode.BRIDLE, "segments": 2, "rope": 3.2},
		{"lamp": RIG, "mode": KlampHanger.HangMode.SINGLE, "segments": 4, "rope": 3.0, "yaw": 90.0},
		{"lamp": GRID, "mode": KlampHanger.HangMode.BRIDLE, "segments": 1, "rope": 3.2},
	]
	for i in setups.size():
		_add_trolley(loop_rail, stops[i] - 6.0, stops, setups[i])


## A straight shuttle over the dispatch lane, out to the roller door.
func _dispatch_shuttle() -> void:
	var c := Curve3D.new()
	c.add_point(Vector3(-9.0, RAIL_Y, 8.5))
	c.add_point(Vector3(17.5, RAIL_Y, 8.5))
	var rail := _new_rail("DispatchShuttle", c)
	_rail_names[rail] = "Dispatch"
	station_names[rail] = ["Lane start", "Pallets", "Door"]
	_add_trolley(rail, 0.5, PackedFloat32Array([0.5, 19.0, 26.0]),
		{"lamp": RIG, "mode": KlampHanger.HangMode.BRIDLE, "segments": 3, "rope": 3.2})


## A short spur across the goods-in end for inspection.
func _inspection_spur() -> void:
	var c := Curve3D.new()
	c.add_point(Vector3(17.0, RAIL_Y, -9.0))
	c.add_point(Vector3(17.0, RAIL_Y, 3.5))
	var rail := _new_rail("InspectionSpur", c)
	_rail_names[rail] = "Inspection"
	station_names[rail] = ["Goods in", "Inspect"]
	_add_trolley(rail, 0.5, PackedFloat32Array([0.5, 12.0]),
		{"lamp": GRID, "mode": KlampHanger.HangMode.BRIDLE, "segments": 2, "rope": 3.0, "yaw": 90.0})
	hall.box(Vector3(3.0, 0.004, 2.0), Vector3(17.0, 0.004, 3.0), "hazard")
	_sign("INSPECTION", Vector3(15.2, 0, 3.0), PI * 0.5)


func _add_trolley(rail: CeilingRail, at: float, stops: PackedFloat32Array, setup: Dictionary) -> void:
	var t := RailTrolley.new()
	t.name = "T%d" % (trolleys.size() + 1)
	t.progress = at
	t.cruise_speed = 1.3
	t.acceleration = 0.4
	t.braking = 0.5
	t.stops = stops
	t.dwell_time = 4.0
	rail.add_child(t)
	var h := KlampHanger.new()
	h.name = "Hanger"
	h.lamp_scene = setup["lamp"]
	h.hang_mode = setup["mode"]
	h.rope_segments = setup["segments"]
	h.rope_length = setup["rope"]
	h.lamp_yaw = setup.get("yaw", 0.0)
	h.extra_mass = 6.0 # the light bars added in _add_lights
	h.lamp_collision_mask = 1 | 2 # the floor and props, and the hall's walls and columns
	h.spawned.connect(_add_lights)
	t.add_child(h)
	trolleys.append(t)
	hangers.append(h)


## A work station under the loop: drop-zone markings, a sign, and kit for its job.
## `inward` is +1 when the inside of the loop is towards +z from the station.
func _station(index: int, title: String, p: Vector3, inward: float) -> void:
	var h := hall
	# drop zone: hazard border and number on the floor
	h.box(Vector3(3.4, 0.004, 0.18), p + Vector3(0, 0.004, 1.3), "hazard")
	h.box(Vector3(3.4, 0.004, 0.18), p + Vector3(0, 0.004, -1.3), "hazard")
	h.box(Vector3(0.18, 0.004, 2.78), p + Vector3(1.61, 0.004, 0), "hazard")
	h.box(Vector3(0.18, 0.004, 2.78), p + Vector3(-1.61, 0.004, 0), "hazard")
	h.label(str(index + 1), p + Vector3(0, 0.01, 0), 900, Color(1, 1, 1, 0.55), Vector3(-PI * 0.5, 0, 0))
	var side := p + Vector3(0, 0, inward * 2.6) # inside the loop, clear of the swing zone
	_sign(title, p + Vector3(-2.3, 0, inward * 1.6), 0.0 if inward > 0.0 else PI)
	match index:
		0: # cut & prep: pipe stock rack and a saw bench
			for k in 3:
				h.box(Vector3(0.08, 1.4, 0.08), side + Vector3(-1.2 + k * 1.2, 0.7, 0.3), "frame")
			for k in 6:
				h.cyl(0.021, 3.0, side + Vector3(0, 0.35 + (k % 3) * 0.4, 0.2 + (k / 3) * 0.15), "steel", h,
					Vector3(0, 0, PI * 0.5), 10)
			_bench(side + Vector3(2.4, 0, 0))
			h.cyl(0.18, 0.02, side + Vector3(2.4, 1.05, 0), "steel", h, Vector3(PI * 0.5, 0, 0))
		1: # assembly: two benches, parts bins, a pallet of fittings
			_bench(side + Vector3(-1.2, 0, 0))
			_bench(side + Vector3(1.2, 0, 0))
			for k in 6:
				h.box(Vector3(0.3, 0.15, 0.4), side + Vector3(-2.0 + k * 0.55, 0.98, -0.1), "orange" if k % 2 == 0 else "frame")
			h._pallet(side + Vector3(3.2, 0, 0.2), 5)
		2: # wiring: cable reels and a bench
			for k in 3:
				var reel := side + Vector3(-2.0 + k * 0.9, 0.45, 0.1)
				h.cyl(0.45, 0.06, reel + Vector3(0, 0, -0.25), "wood", h, Vector3(PI * 0.5, 0, 0))
				h.cyl(0.45, 0.06, reel + Vector3(0, 0, 0.25), "wood", h, Vector3(PI * 0.5, 0, 0))
				h.cyl(0.3, 0.44, reel, "dark" if k != 1 else "red", h, Vector3(PI * 0.5, 0, 0))
			_bench(side + Vector3(1.8, 0, 0))
		3: # test: a caged test stand and a control cabinet with status lights
			var c0 := side + Vector3(-1.0, 0, 0)
			for x in [-1.0, 1.0]:
				for z in [-0.6, 0.6]:
					h.box(Vector3(0.06, 2.2, 0.06), c0 + Vector3(x, 1.1, z), "yellow")
			h.box(Vector3(2.06, 0.06, 1.26), c0 + Vector3(0, 2.2, 0), "yellow")
			h.box(Vector3(2.0, 0.05, 1.2), c0 + Vector3(0, 0.03, 0), "hazard")
			h.box(Vector3(0.8, 1.9, 0.5), side + Vector3(1.6, 0.95, 0), "frame")
			for k in 3:
				h.box(Vector3(0.08, 0.08, 0.02), side + Vector3(1.4 + k * 0.2, 1.6, -0.26 * inward), "exit" if k != 1 else "lamp")


func _bench(p: Vector3) -> void:
	hall.box(Vector3(2.0, 0.06, 0.8), p + Vector3(0, 0.9, 0), "wood")
	for x in [-0.92, 0.92]:
		for z in [-0.34, 0.34]:
			hall.box(Vector3(0.05, 0.87, 0.05), p + Vector3(x, 0.435, z), "bench")
	hall.box(Vector3(1.9, 0.03, 0.7), p + Vector3(0, 0.2, 0), "bench")


func _sign(text: String, base: Vector3, yaw: float) -> void:
	hall.box(Vector3(0.08, 2.5, 0.08), base + Vector3(0, 1.25, 0), "dark")
	var board := hall.box(Vector3(1.8, 0.5, 0.04), base + Vector3(0, 2.6, 0), "yellow")
	board.rotation.y = yaw
	var l: Label3D = hall.label(text, base + Vector3(0, 2.6, 0) + Basis(Vector3.UP, yaw) * Vector3(0, 0, 0.03),
		70, Color(0.08, 0.08, 0.08), Vector3(0, yaw, 0))
	l.outline_size = 0
	var back: Label3D = hall.label(text, base + Vector3(0, 2.6, 0) - Basis(Vector3.UP, yaw) * Vector3(0, 0, 0.03),
		70, Color(0.08, 0.08, 0.08), Vector3(0, yaw + PI, 0))
	back.outline_size = 0


## Give each rig glowing light bars and a real light, so the swinging is easy to see.
func _add_lights(lamp: RigidBody3D) -> void:
	var info: Dictionary = lamp.get_meta(KlampLampBuilder.META)
	var com: Vector3 = info["center_of_mass"]
	var bounds: AABB = info["bounds"]
	var bottom := bounds.position.y
	var glow := StandardMaterial3D.new()
	glow.albedo_color = Color(1, 0.95, 0.85)
	glow.emission_enabled = true
	glow.emission = Color(1.0, 0.86, 0.6)
	glow.emission_energy_multiplier = 5.0
	var bar_len := minf(bounds.size.x, bounds.size.z) * 0.8
	for off in [-0.15, 0.15]:
		var bar := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.08, 0.035, bar_len) if bounds.size.x > bounds.size.z else Vector3(bar_len, 0.035, 0.08)
		bm.material = glow
		bar.mesh = bm
		bar.position = Vector3(com.x + (off if bounds.size.x > bounds.size.z else 0.0), bottom - 0.02,
			com.z + (0.0 if bounds.size.x > bounds.size.z else off))
		lamp.add_child(bar)
	var light := SpotLight3D.new()
	light.position = Vector3(com.x, bottom - 0.08, com.z)
	light.rotation.x = -PI * 0.5
	light.spot_range = 7.0
	light.spot_angle = 60.0
	light.light_energy = 3.0
	light.light_color = Color(1.0, 0.85, 0.62)
	light.shadow_enabled = true
	lamp.add_child(light)


# ---------------------------------------------------------------- camera views
## 1 overview (cut-away from above), 2 floor level from the doors, 3 from the west end, 4 a station.
func view(n: int) -> void:
	follow_index = -1
	match n:
		1: cam.orbit(Vector3(0, 2.0, 0), deg_to_rad(-35), deg_to_rad(-42), 36.0, true)
		2: cam.orbit(Vector3(-3, 2.6, -1), deg_to_rad(95), deg_to_rad(-5), 15.5, true)
		3: cam.orbit(Vector3(-4, 3.5, -2), deg_to_rad(-120), deg_to_rad(-12), 13.0, true)
		4: cam.orbit(Vector3(5, 2.6, -6), deg_to_rad(-25), deg_to_rad(-8), 8.0, true)


## Used by automated screenshots.
func debug_view(view_name: String) -> void:
	match view_name:
		"overview": view(1)
		"floor": view(2)
		"office": view(3)
		"station": view(4)
		"follow":
			follow_index = 0
			cam.follow(hangers[0].lamp)
		"ride":
			selected = 0
			cam.ride(trolleys[0])


# ---------------------------------------------------------------- selection
func _selection_marker() -> void:
	marker = MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.95
	torus.outer_radius = 1.05
	torus.rings = 48
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.2, 0.8, 1.0)
	m.emission_enabled = true
	m.emission = Color(0.2, 0.8, 1.0)
	m.emission_energy_multiplier = 2.0
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	torus.material = m
	marker.mesh = torus
	marker.visible = false
	add_child(marker)


func _hanger_of(body: Object) -> int:
	for i in hangers.size():
		if hangers[i].lamp == body:
			return i
	return -1


func _pick(screen: Vector2, shove: bool) -> void:
	var from := cam.project_ray_origin(screen)
	var dir := cam.project_ray_normal(screen)
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * 200.0, 1)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	var i := _hanger_of(hit["collider"]) if not hit.is_empty() else -1
	if i < 0:
		# The pipes are thin: also accept a click near a rig on screen.
		var best := 60.0
		for k in hangers.size():
			var lamp := hangers[k].lamp
			if lamp == null or cam.is_position_behind(lamp.global_position):
				continue
			var d := cam.unproject_position(lamp.global_position).distance_to(screen)
			if d < best:
				best = d
				i = k
		if i >= 0 and shove:
			hit = {"position": hangers[i].lamp.global_position}
	if i < 0:
		selected = -1
		return
	selected = i
	if shove:
		var body := hangers[i].lamp
		var push := Vector3(dir.x, 0, dir.z).normalized()
		body.apply_impulse(push * body.mass * 1.2, (hit["position"] as Vector3) - body.global_position)


# ---------------------------------------------------------------- input
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.is_pressed():
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			_pick(mb.position, mb.shift_pressed)
	elif event is InputEventKey and event.is_pressed() and not event.is_echo():
		var key := (event as InputEventKey).keycode
		var sel_t: RailTrolley = trolleys[selected] if selected >= 0 else null
		match key:
			KEY_1, KEY_2, KEY_3, KEY_4:
				view(key - KEY_0)
			KEY_F:
				if cam.mode == DemoCamera.Mode.FLY:
					view(1)
				else:
					cam.fly()
			KEY_TAB:
				follow_index = (follow_index + 1) % hangers.size()
				selected = follow_index
				if hangers[follow_index].lamp != null:
					cam.follow(hangers[follow_index].lamp)
			KEY_V:
				if selected < 0:
					selected = 0
				cam.ride(trolleys[selected])
			KEY_SPACE:
				var run := not trolleys[0].running
				for t in trolleys:
					t.running = run
			KEY_X:
				if sel_t:
					sel_t.running = not sel_t.running
			KEY_N:
				if sel_t:
					_next_station(sel_t)
			KEY_B:
				if selected >= 0 and hangers[selected].lamp:
					var right := cam.global_basis.x
					hangers[selected].push(right * hangers[selected].lamp.mass * 1.0)
			KEY_EQUAL, KEY_PLUS, KEY_KP_ADD:
				for t in trolleys:
					t.cruise_speed = minf(t.cruise_speed + 0.2, 4.0)
			KEY_MINUS, KEY_KP_SUBTRACT:
				for t in trolleys:
					t.cruise_speed = maxf(t.cruise_speed - 0.2, 0.2)
			KEY_R:
				for h in hangers:
					h.spawn()
			KEY_H:
				help_on = not help_on
			KEY_ESCAPE:
				selected = -1
				if cam.mode != DemoCamera.Mode.ORBIT:
					view(1)


func _next_station(t: RailTrolley) -> void:
	if t.stops.is_empty():
		return
	var best := 0
	var best_d := INF
	var r := t.get_rail()
	for i in t.stops.size():
		var d := fposmod(t.stops[i] - t.progress, r.get_length()) if r.is_loop() else absf(t.stops[i] - t.progress)
		if d > 0.05 and d < best_d:
			best = i
			best_d = d
	t.move_to(t.stops[best])


# ---------------------------------------------------------------- HUD
func _hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	hud_left = _panel(layer, Vector2(14, 14), 560)
	hud_right = _panel(layer, Vector2(-14, 14), 520, true)


func _panel(layer: CanvasLayer, pos: Vector2, width: float, right := false) -> RichTextLabel:
	var pc := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.07, 0.09, 0.72)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(12)
	pc.add_theme_stylebox_override("panel", sb)
	pc.custom_minimum_size = Vector2(width, 0)
	if right:
		pc.set_anchors_preset(Control.PRESET_TOP_RIGHT)
		pc.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	pc.position = pos
	layer.add_child(pc)
	if right:
		pc.offset_right = pos.x
		pc.offset_left = pos.x - width
		pc.offset_top = pos.y
	var rt := RichTextLabel.new()
	rt.bbcode_enabled = true
	rt.fit_content = true
	rt.scroll_active = false
	rt.custom_minimum_size = Vector2(width - 24, 0)
	rt.add_theme_font_size_override("normal_font_size", 14)
	rt.add_theme_font_size_override("bold_font_size", 15)
	rt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pc.add_child(rt)
	return rt


func _station_of(t: RailTrolley) -> String:
	var r := t.get_rail()
	var names: Array = station_names.get(r, [])
	for i in t.stops.size():
		if absf(t.stops[i] - t.progress) < 0.05 and i < names.size():
			return names[i]
	return ""


func _process(_delta: float) -> void:
	# selection ring on the floor under the selected rig
	if selected >= 0 and hangers[selected].lamp != null:
		var p := hangers[selected].lamp.global_position
		marker.visible = true
		marker.global_position = Vector3(p.x, 0.03, p.z)
	else:
		marker.visible = false

	var left := "[b]Klamp rigs · factory hall[/b]   [color=#9ab]camera: %s[/color]\n" % cam.mode_name()
	if help_on:
		left += "[color=#cde]Right-drag orbit · middle-drag pan · wheel zoom · WASD move\n"
		left += "1-4 views · F fly (hold right mouse to look) · Tab follow rig · V ride trolley\n"
		left += "Click a rig to select · Shift+click shove · B bump · N next station\n"
		left += "X stop/start selected · Space all · +/- speed · R respawn · H hide help[/color]"
	hud_left.text = left

	var t := "[table=6][cell][b]Rig  [/b][/cell][cell][b]Rail  [/b][/cell][cell][b]Speed  [/b][/cell][cell][b]Swing  [/b][/cell][cell][b]Hang  [/b][/cell][cell][b]Status[/b][/cell]"
	for i in trolleys.size():
		var tr := trolleys[i]
		var h := hangers[i]
		var swing := rad_to_deg(h.get_swing_angle())
		var col := "#8f8" if swing < 3.0 else ("#fd6" if swing < 8.0 else "#f77")
		var status := ""
		if tr.is_dwelling():
			status = "at " + _station_of(tr)
		elif tr.speed < 0.01:
			status = "stopped"
		else:
			status = "moving"
		var sel := "[color=#5cf]▶[/color] " if i == selected else "   "
		t += "[cell]%s%s  [/cell][cell]%s  [/cell][cell]%.2f m/s  [/cell][cell][color=%s]%.1f°[/color]  [/cell][cell]%s  [/cell][cell]%s[/cell]" % [
			sel, tr.name, _rail_names.get(tr.get_rail(), ""), tr.speed, col, swing,
			KlampHanger.HangMode.keys()[h.hang_mode].to_lower(), status]
	t += "[/table]"
	if selected >= 0 and hangers[selected].lamp != null:
		var info: Dictionary = hangers[selected].lamp.get_meta(KlampLampBuilder.META)
		t += "\n[b]%s[/b] on %s · %.1f kg · rope %.1f m · %d segment(s)%s" % [
			info["name"], trolleys[selected].name, hangers[selected].lamp.mass, hangers[selected].rope_length,
			hangers[selected].rope_segments, "" if trolleys[selected].running else " · [color=#fd6]held[/color]"]
	hud_right.text = t
