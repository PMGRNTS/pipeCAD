extends Node3D
## Builds the demo factory hall from primitives: a steel portal-frame building with roof trusses,
## skylights, cladding, roller doors, an office on a mezzanine, racking, work cells and lighting.
##
## Walls and roof are one-sided panels facing inwards, so from outside you look straight in
## (a "dollhouse" cutaway) while from inside the building is closed. They still cast shadows
## from both sides, so sunlight only gets in through the skylights.
##
## Coordinates: X along the hall, Z across it, Y up, metres. Floor at y = 0.

const LENGTH := 40.0 # x from -20 to 20
const WIDTH := 24.0 # z from -12 to 12
const EAVES := 7.5 # underside of the roof trusses
const RIDGE := 9.0
const BAY := 5.0 # portal frame spacing
const DOOR_Z: Array[float] = [-4.0, 8.0] # roller doors in the east wall

var mats := {}


func build() -> void:
	_materials()
	_haze()
	_ground()
	_walls()
	_frames()
	_roof()
	_ceiling_grid()
	_doors()
	_office()
	_racking()
	_dispatch_area()
	_high_bay_lights()
	_safety()


# ---------------------------------------------------------------- materials
func _mat(key: String, color: Color, rough := 0.8, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	mats[key] = m
	return m


func _materials() -> void:
	var concrete := _mat("floor", Color(0.62, 0.62, 0.6), 0.9)
	var noise := FastNoiseLite.new()
	noise.frequency = 0.02
	noise.fractal_octaves = 5
	var tex := NoiseTexture2D.new()
	tex.noise = noise
	tex.seamless = true
	tex.width = 512
	tex.height = 512
	tex.color_ramp = Gradient.new()
	tex.color_ramp.set_color(0, Color(0.78, 0.78, 0.76))
	tex.color_ramp.set_color(1, Color(1, 1, 1))
	concrete.albedo_texture = tex
	concrete.uv1_triplanar = true
	concrete.uv1_scale = Vector3(0.12, 0.12, 0.12)
	_mat("asphalt", Color(0.16, 0.17, 0.18), 0.95)
	_mat("plinth", Color(0.36, 0.37, 0.38), 0.9)
	_mat("cladding", Color(0.78, 0.8, 0.82), 0.7, 0.2)
	_mat("roof", Color(0.5, 0.53, 0.56), 0.6, 0.3)
	_mat("frame", Color(0.17, 0.3, 0.52), 0.55, 0.4) # painted steel, blue
	_mat("steel", Color(0.45, 0.47, 0.5), 0.5, 0.6)
	_mat("yellow", Color(0.95, 0.72, 0.08), 0.55)
	_mat("orange", Color(0.92, 0.45, 0.1), 0.55)
	_mat("red", Color(0.78, 0.1, 0.08), 0.5)
	_mat("green", Color(0.15, 0.55, 0.3), 0.6)
	_mat("dark", Color(0.12, 0.13, 0.14), 0.6, 0.3)
	_mat("wood", Color(0.62, 0.48, 0.3), 0.9)
	_mat("cardboard", Color(0.66, 0.52, 0.34), 0.95)
	_mat("bench", Color(0.3, 0.33, 0.36), 0.6, 0.4)
	_mat("door", Color(0.66, 0.68, 0.7), 0.5, 0.5)
	var hazard := _mat("hazard", Color(1, 1, 1), 0.7)
	hazard.albedo_texture = _stripes(Color(0.95, 0.75, 0.05), Color(0.08, 0.08, 0.08))
	hazard.uv1_triplanar = true
	hazard.uv1_scale = Vector3(1.4, 1.4, 1.4)
	var walkway := _mat("walkway", Color(0.2, 0.52, 0.32), 0.8)
	walkway.uv1_triplanar = true
	var line := _mat("line", Color(0.96, 0.8, 0.1), 0.7)
	line.uv1_triplanar = true
	var glass := _mat("glass", Color(0.62, 0.78, 0.9, 0.35), 0.05, 0.1)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.cull_mode = BaseMaterial3D.CULL_DISABLED
	var skylight := _mat("skylight", Color(0.7, 0.82, 0.92, 0.3), 0.05, 0.1)
	skylight.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA # one-sided: see in from above
	var rail_paint := _mat("rail", Color(0.95, 0.68, 0.06), 0.45, 0.3)
	rail_paint.emission_enabled = true # a touch of glow so the rails read against the roof
	rail_paint.emission = Color(0.95, 0.68, 0.06)
	rail_paint.emission_energy_multiplier = 0.15
	var window := _mat("window", Color(0.65, 0.8, 0.95), 0.1)
	window.emission_enabled = true
	window.emission = Color(0.55, 0.72, 0.95)
	window.emission_energy_multiplier = 0.9
	var lamp := _mat("lamp", Color(1, 1, 1))
	lamp.emission_enabled = true
	lamp.emission = Color(1.0, 0.97, 0.9)
	lamp.emission_energy_multiplier = 4.0
	var exit := _mat("exit", Color(0.1, 0.8, 0.3))
	exit.emission_enabled = true
	exit.emission = Color(0.1, 0.9, 0.35)
	exit.emission_energy_multiplier = 2.0


func _stripes(a: Color, b: Color) -> ImageTexture:
	var img := Image.create(64, 64, false, Image.FORMAT_RGB8)
	for y in 64:
		for x in 64:
			img.set_pixel(x, y, a if ((x + y) / 16) % 2 == 0 else b)
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


# ---------------------------------------------------------------- building blocks
## A box mesh, optionally with a static collision box. Returns the MeshInstance3D.
func box(size: Vector3, pos: Vector3, mat_key: String, solid := false, parent: Node = null,
		rot := Vector3.ZERO) -> MeshInstance3D:
	if parent == null:
		parent = self
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	bm.material = mats[mat_key]
	mi.mesh = bm
	if solid:
		var body := StaticBody3D.new()
		body.position = pos
		body.rotation = rot
		var cs := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = size
		cs.shape = shape
		body.add_child(cs)
		body.add_child(mi)
		parent.add_child(body)
	else:
		mi.position = pos
		mi.rotation = rot
		parent.add_child(mi)
	return mi


## A beam of square-ish section `t` from a to b.
func member(a: Vector3, b: Vector3, t: float, mat_key: String, parent: Node = null) -> MeshInstance3D:
	if parent == null:
		parent = self
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(t, a.distance_to(b), t)
	bm.material = mats[mat_key]
	mi.mesh = bm
	mi.transform = Transform3D(KlampRope.basis_along(b - a), (a + b) * 0.5)
	parent.add_child(mi)
	return mi


func cyl(radius: float, height: float, pos: Vector3, mat_key: String, parent: Node = null,
		rot := Vector3.ZERO, sides := 16) -> MeshInstance3D:
	if parent == null:
		parent = self
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = radius
	cm.bottom_radius = radius
	cm.height = height
	cm.radial_segments = sides
	cm.rings = 1
	cm.material = mats[mat_key]
	mi.mesh = cm
	mi.position = pos
	mi.rotation = rot
	parent.add_child(mi)
	return mi


## A one-sided flat polygon (convex, points in order). It is visible from the side the points
## wind counter-clockwise towards, and casts shadows from both sides unless `shadow` is false.
func panel(points: PackedVector3Array, mat_key: String, shadow := true) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := (points[1] - points[0]).cross(points[2] - points[0]).normalized()
	for i in range(1, points.size() - 1):
		for p in [points[0], points[i + 1], points[i]]: # Godot's front faces wind clockwise
			st.set_normal(n)
			st.add_vertex(p)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mats[mat_key]
	mi.cast_shadow = (GeometryInstance3D.SHADOW_CASTING_SETTING_DOUBLE_SIDED if shadow
		else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF)
	add_child(mi)
	return mi


## A rectangle facing `facing` (unit axis vector), centred at c, with the given width along
## `along` and height along Y.
func wall_rect(c: Vector3, along: Vector3, width: float, height: float, facing: Vector3,
		mat_key: String, shadow := true) -> void:
	var a := along * width * 0.5
	var up := Vector3.UP * height * 0.5
	var pts := PackedVector3Array([c - a - up, c + a - up, c + a + up, c - a + up])
	if (pts[1] - pts[0]).cross(pts[2] - pts[0]).dot(facing) < 0.0:
		pts.reverse()
	panel(pts, mat_key, shadow)


func label(text: String, pos: Vector3, size := 64, color := Color.WHITE, rot := Vector3.ZERO,
		billboard := false) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.004
	l.modulate = color
	l.outline_size = 12
	l.outline_modulate = Color(0, 0, 0, 0.85)
	l.position = pos
	l.rotation = rot
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED if billboard else BaseMaterial3D.BILLBOARD_DISABLED
	l.double_sided = true
	add_child(l)
	return l


# ---------------------------------------------------------------- shell
## A little dust in the air inside the hall, so sunlight through the skylights shows as shafts.
## Only visible with the Forward+ renderer and volumetric fog enabled in the Environment.
func _haze() -> void:
	if RenderingServer.get_current_rendering_method() != "forward_plus":
		return
	var fog := FogVolume.new()
	fog.size = Vector3(LENGTH, RIDGE + 0.5, WIDTH)
	fog.position = Vector3(0, (RIDGE + 0.5) * 0.5, 0)
	var fm := FogMaterial.new()
	fm.density = 0.012
	fm.albedo = Color(0.92, 0.9, 0.86)
	fm.edge_fade = 0.05
	fog.material = fm
	add_child(fog)


func _ground() -> void:
	var hx := LENGTH * 0.5
	var hz := WIDTH * 0.5
	# Collision slab for the whole site, the outside yard and the hall floor.
	var body := StaticBody3D.new()
	body.name = "Ground"
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(160, 1, 160)
	cs.shape = shape
	cs.position.y = -0.5
	body.add_child(cs)
	add_child(body)
	panel(PackedVector3Array([Vector3(-80, -0.02, 80), Vector3(80, -0.02, 80),
		Vector3(80, -0.02, -80), Vector3(-80, -0.02, -80)]), "asphalt", false)
	panel(PackedVector3Array([Vector3(-hx, 0, hz), Vector3(hx, 0, hz), Vector3(hx, 0, -hz),
		Vector3(-hx, 0, -hz)]), "floor", false)
	# Painted walkways along both long walls and a crossing in the middle.
	for z in [-10.6, 10.6]:
		box(Vector3(LENGTH - 1.0, 0.004, 1.2), Vector3(0, 0.002, z), "walkway")
		for e in [-0.65, 0.65]:
			box(Vector3(LENGTH - 1.0, 0.005, 0.08), Vector3(0, 0.003, z + e), "line")
	box(Vector3(1.6, 0.004, WIDTH - 3.4), Vector3(-17.5, 0.002, 0), "walkway")


func _walls() -> void:
	var hx := LENGTH * 0.5
	var hz := WIDTH * 0.5
	for side in [-1.0, 1.0]:
		var z: float = side * hz
		var inward := Vector3(0, 0, -side)
		wall_rect(Vector3(0, 0.6, z), Vector3.RIGHT, LENGTH, 1.2, inward, "plinth")
		wall_rect(Vector3(0, 0.6 + EAVES * 0.5 + 0.3, z), Vector3.RIGHT, LENGTH, EAVES - 0.6, inward, "cladding")
		# a band of windows in every bay
		for i in int(LENGTH / BAY):
			var x := -hx + BAY * (i + 0.5)
			wall_rect(Vector3(x, 5.0, z - side * 0.02), Vector3.RIGHT, BAY - 1.0, 1.1, inward, "window", false)
		var x_end: float = side * hx
		var in_x := Vector3(-side, 0, 0)
		wall_rect(Vector3(x_end, 0.6, 0), Vector3.BACK, WIDTH, 1.2, in_x, "plinth")
		wall_rect(Vector3(x_end, 0.6 + EAVES * 0.5 + 0.3, 0), Vector3.BACK, WIDTH, EAVES - 0.6, in_x, "cladding")
		var gable := PackedVector3Array([Vector3(x_end, EAVES + 0.9, -hz), Vector3(x_end, EAVES + 0.9, hz),
			Vector3(x_end, RIDGE + 0.4, 0)])
		if (gable[1] - gable[0]).cross(gable[2] - gable[0]).dot(in_x) < 0.0:
			gable.reverse()
		panel(gable, "cladding")
	# fill between the top of the wall and the roof line
	for side in [-1.0, 1.0]:
		wall_rect(Vector3(0, EAVES + 0.45, side * hz), Vector3.RIGHT, LENGTH, 0.9, Vector3(0, 0, -side), "cladding")
		wall_rect(Vector3(side * hx, EAVES + 0.45, 0), Vector3.BACK, WIDTH, 0.9, Vector3(-side, 0, 0), "cladding")
	# invisible collision for the walls, so rigs can't swing through them
	for side in [-1.0, 1.0]:
		_wall_collider(Vector3(LENGTH, EAVES, 0.4), Vector3(0, EAVES * 0.5, side * (hz + 0.2)))
		_wall_collider(Vector3(0.4, EAVES, WIDTH), Vector3(side * (hx + 0.2), EAVES * 0.5, 0))


## Invisible collision on physics layer 2, so clicks from outside the building pass through.
func _wall_collider(size: Vector3, pos: Vector3) -> void:
	var body := StaticBody3D.new()
	body.collision_layer = 2
	body.collision_mask = 0
	body.position = pos
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	cs.shape = shape
	body.add_child(cs)
	add_child(body)


## Portal frames: I-section columns and a pitched truss every BAY metres.
func _frames() -> void:
	var hx := LENGTH * 0.5
	var hz := WIDTH * 0.5
	var count := int(LENGTH / BAY) + 1
	for i in count:
		var x := clampf(-hx + i * BAY, -hx + 0.35, hx - 0.35) # end frames sit inside the walls
		for side in [-1.0, 1.0]:
			var z: float = side * (hz - 0.3)
			_column(Vector3(x, 0, z), EAVES + 0.3)
			# fire extinguisher on every other column
			if i % 2 == 1:
				cyl(0.08, 0.5, Vector3(x + 0.25, 1.0, z - side * 0.15), "red")
		# truss: bottom chord, top chords, posts and diagonals
		var y0 := EAVES
		var l := Vector3(x, y0 + 0.3, -hz + 0.3)
		var r := Vector3(x, y0 + 0.3, hz - 0.3)
		var top := Vector3(x, RIDGE, 0)
		member(Vector3(x, y0, -hz + 0.3), Vector3(x, y0, hz - 0.3), 0.16, "frame")
		member(l, top, 0.18, "frame")
		member(top, r, 0.18, "frame")
		var panels := 8
		for k in range(1, panels):
			var f := float(k) / panels
			var zk := lerpf(-hz + 0.3, hz - 0.3, f)
			var roof_y := lerpf(y0 + 0.3, RIDGE, 1.0 - absf(zk) / (hz - 0.3))
			var bottom := Vector3(x, y0, zk)
			member(bottom, Vector3(x, roof_y, zk), 0.07, "frame")
			var zn := lerpf(-hz + 0.3, hz - 0.3, float(k + (1 if zk < 0.0 else -1)) / panels)
			var roof_n := lerpf(y0 + 0.3, RIDGE, 1.0 - absf(zn) / (hz - 0.3))
			member(bottom, Vector3(x, roof_n, zn), 0.06, "frame")


func _column(base: Vector3, h: float) -> void:
	var w := 0.3
	var d := 0.4
	var t := 0.025
	box(Vector3(w, h, t), base + Vector3(0, h * 0.5, d * 0.5 - t * 0.5), "frame")
	box(Vector3(w, h, t), base + Vector3(0, h * 0.5, -d * 0.5 + t * 0.5), "frame")
	box(Vector3(0.018, h, d), base + Vector3(0, h * 0.5, 0), "frame")
	box(Vector3(0.5, 0.05, 0.6), base + Vector3(0, 0.025, 0), "steel") # base plate
	_wall_collider(Vector3(w, h, d), base + Vector3(0, h * 0.5, 0))


## Roof sheets on both slopes with a skylight strip in every other bay, plus purlins.
func _roof() -> void:
	var hx := LENGTH * 0.5
	var hz := WIDTH * 0.5
	var bays := int(LENGTH / BAY)
	var lift := 0.22 # sheets sit on top of the top chords
	for side in [-1.0, 1.0]:
		var eave := Vector3(0, EAVES + 0.3 + lift, side * hz)
		var ridge := Vector3(0, RIDGE + lift, 0)
		var down := Vector3.DOWN
		for b in bays:
			var x0 := -hx + b * BAY
			var x1 := x0 + BAY
			var cuts: Array[float] = [0.0, 1.0]
			if b % 2 == 0:
				cuts = [0.0, 0.35, 0.7, 1.0] # sheet, skylight, sheet
			for c in cuts.size() - 1:
				var p0 := eave.lerp(ridge, cuts[c])
				var p1 := eave.lerp(ridge, cuts[c + 1])
				var pts := PackedVector3Array([Vector3(x0, p0.y, p0.z), Vector3(x1, p0.y, p0.z),
					Vector3(x1, p1.y, p1.z), Vector3(x0, p1.y, p1.z)])
				var n := (pts[1] - pts[0]).cross(pts[2] - pts[0])
				if n.dot(down) < 0.0:
					pts.reverse()
				var skylight := cuts.size() == 4 and c == 1
				panel(pts, "skylight" if skylight else "roof", not skylight)
		# purlins along the hall
		for k in range(1, 7):
			var p := eave.lerp(ridge, k / 7.0)
			member(Vector3(-hx, p.y - 0.12, p.z), Vector3(hx, p.y - 0.12, p.z), 0.1, "steel")


## Longitudinal steel at truss level for the rail hangers to hang from.
func _ceiling_grid() -> void:
	var hx := LENGTH * 0.5
	for z in [-9.0, -6.0, -3.0, 0.0, 3.0, 6.0, 9.0]:
		member(Vector3(-hx, EAVES + 0.05, z), Vector3(hx, EAVES + 0.05, z), 0.12, "frame")


func _doors() -> void:
	var hx := LENGTH * 0.5
	# two roller doors in the east end wall
	for z in DOOR_Z:
		var c := Vector3(hx - 0.03, 2.6, z)
		wall_rect(c, Vector3.BACK, 4.2, 5.2, Vector3.LEFT, "door")
		for k in 13:
			box(Vector3(0.02, 0.03, 4.2), Vector3(hx - 0.05, 0.25 + k * 0.4, z), "steel")
		for e in [-2.2, 2.2]:
			box(Vector3(0.16, 5.4, 0.16), Vector3(hx - 0.1, 2.7, z + e), "hazard")
		box(Vector3(0.3, 0.45, 4.6), Vector3(hx - 0.2, 5.45, z), "dark") # roller housing
		box(Vector3(2.0, 0.004, 4.4), Vector3(hx - 1.1, 0.003, z), "hazard")
	# personnel door with an exit sign
	wall_rect(Vector3(hx - 0.03, 1.05, 2.0), Vector3.BACK, 1.0, 2.1, Vector3.LEFT, "green")
	box(Vector3(0.05, 0.2, 0.45), Vector3(hx - 0.06, 2.4, 2.0), "exit")
	label("EXIT", Vector3(hx - 0.1, 2.4, 2.0), 40, Color.WHITE, Vector3(0, -PI * 0.5, 0))
	label("GOODS IN", Vector3(hx - 0.1, 6.0, DOOR_Z[0]), 150, Color(1, 0.85, 0.2), Vector3(0, -PI * 0.5, 0))
	label("DISPATCH", Vector3(hx - 0.1, 6.0, DOOR_Z[1]), 150, Color(1, 0.85, 0.2), Vector3(0, -PI * 0.5, 0))


## Two-storey office in the west corner: steel deck on posts, glazed office on top, stairs,
## and a handrail built Kee Klamp style (pipes and fittings).
func _office() -> void:
	var x0 := -19.6
	var x1 := -15.2
	var z0 := -11.6
	var z1 := -4.0
	var deck := 3.0
	var cx := (x0 + x1) * 0.5
	var cz := (z0 + z1) * 0.5
	box(Vector3(x1 - x0, 0.2, z1 - z0), Vector3(cx, deck - 0.1, cz), "steel", true)
	for x in [x0 + 0.2, x1 - 0.2]:
		for z in [z0 + 0.2, cz, z1 - 0.2]:
			box(Vector3(0.2, deck - 0.2, 0.2), Vector3(x, (deck - 0.2) * 0.5, z), "yellow", true)
	# office box: solid back, glazed front and end
	var oh := 2.6
	var ox1 := x1 - 0.9 # leave a walkway in front
	box(Vector3(ox1 - x0, 0.15, z1 - z0), Vector3((x0 + ox1) * 0.5, deck + oh, cz), "cladding", true)
	box(Vector3(0.1, oh, z1 - z0), Vector3(x0 + 0.05, deck + oh * 0.5, cz), "cladding")
	var glass_front := box(Vector3(0.04, oh - 0.9, z1 - z0 - 0.3), Vector3(ox1, deck + 0.9 + (oh - 0.9) * 0.5, cz), "glass")
	glass_front.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	box(Vector3(0.1, 0.9, z1 - z0), Vector3(ox1, deck + 0.45, cz), "cladding")
	box(Vector3(ox1 - x0, oh, 0.1), Vector3((x0 + ox1) * 0.5, deck + oh * 0.5, z0 + 0.05), "cladding")
	var glass_end := box(Vector3(ox1 - x0 - 1.2, oh - 0.9, 0.04), Vector3((x0 + ox1) * 0.5 - 0.6, deck + 0.9 + (oh - 0.9) * 0.5, z1), "glass")
	glass_end.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	box(Vector3(ox1 - x0, 0.9, 0.1), Vector3((x0 + ox1) * 0.5, deck + 0.45, z1), "cladding")
	box(Vector3(0.9, 2.1, 0.06), Vector3(ox1 - 0.6, deck + 1.05, z1), "dark") # door
	# desks and screens inside
	for z in [-10.4, -8.0, -5.6]:
		box(Vector3(0.8, 0.05, 1.6), Vector3(x0 + 1.4, deck + 0.75, z), "wood")
		box(Vector3(0.05, 0.4, 0.6), Vector3(x0 + 1.1, deck + 1.0, z), "dark")
	var light := OmniLight3D.new()
	light.position = Vector3(cx - 0.5, deck + oh - 0.3, cz)
	light.omni_range = 6.0
	light.light_energy = 1.2
	light.light_color = Color(1.0, 0.95, 0.85)
	add_child(light)
	label("CONTROL", Vector3(ox1 + 0.03, deck + oh + 0.35, cz), 120, Color(0.9, 0.95, 1.0), Vector3(0, PI * 0.5, 0))
	# stairs down to the floor along the front, heading +z
	var steps := 15
	for s in steps:
		var y := deck - (s + 1) * deck / steps
		box(Vector3(1.0, 0.05, 0.3), Vector3(x1 + 0.55, y + 0.025, z1 + 0.3 + s * 0.28), "steel")
	member(Vector3(x1 + 0.05, deck, z1), Vector3(x1 + 0.05, 0, z1 + steps * 0.28 + 0.3), 0.06, "yellow")
	member(Vector3(x1 + 1.05, deck, z1), Vector3(x1 + 1.05, 0, z1 + steps * 0.28 + 0.3), 0.06, "yellow")
	# handrail along the deck edge: posts and two rails with fittings at the joints
	var rail_pts: Array[Vector3] = [Vector3(x1, deck, z0 + 0.2), Vector3(x1, deck, z1)]
	var n := 6
	for k in n + 1:
		var p := rail_pts[0].lerp(rail_pts[1], float(k) / n)
		cyl(0.021, 1.1, p + Vector3(0, 0.55, 0), "yellow", self, Vector3.ZERO, 10)
		for h in [0.55, 1.1]:
			var fit := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radius = 0.035
			sm.height = 0.07
			sm.material = mats["steel"]
			fit.mesh = sm
			fit.position = p + Vector3(0, h, 0)
			add_child(fit)
	for h in [0.55, 1.1]:
		member(rail_pts[0] + Vector3(0, h, 0), rail_pts[1] + Vector3(0, h, 0), 0.042, "yellow")
	# under the deck: parts storage
	for z in [-10.5, -8.0]:
		_shelf(Vector3(-18.6, 0, z), 2.0, 0.6, 2.2, 4)


## Pallet racking along the north wall: blue uprights, orange beams, pallets of boxes.
func _racking() -> void:
	var z := -10.8
	var bay_w := 2.7
	var x := -13.0
	for b in 9:
		var xa := x + b * bay_w
		for e in [0.0, bay_w]:
			for dz in [-0.5, 0.5]:
				box(Vector3(0.09, 5.0, 0.07), Vector3(xa + e, 2.5, z + dz), "frame", true)
		for level in [0.15, 1.75, 3.35]:
			for dz in [-0.5, 0.5]:
				box(Vector3(bay_w, 0.12, 0.06), Vector3(xa + bay_w * 0.5, level + 0.06, z + dz), "orange")
			for p in 2:
				var px := xa + 0.7 + p * 1.3
				if (b * 3 + int(level) + p) % 5 == 4:
					continue # a few empty slots
				_pallet(Vector3(px, level + 0.12, z), b + p + int(level * 3))
	label("STORES  A1–A9", Vector3(-1.0, 5.4, z + 0.6), 140, Color(1, 1, 1), Vector3.ZERO)


func _pallet(base: Vector3, seed_value: int) -> void:
	for k in 3:
		box(Vector3(1.2, 0.1, 0.1), base + Vector3(0, 0.05, -0.4 + k * 0.4), "wood")
	box(Vector3(1.2, 0.03, 1.0), base + Vector3(0, 0.115, 0), "wood")
	var rows := 1 + seed_value % 3
	for r in rows:
		for c in 2:
			var h := 0.32
			box(Vector3(0.56, h, 0.46), base + Vector3(-0.29 + c * 0.58, 0.13 + h * 0.5 + r * h, -0.24 + 0.48 * float(r % 2)), "cardboard")


func _shelf(base: Vector3, w: float, d: float, h: float, levels: int) -> void:
	for e in [-w * 0.5, w * 0.5]:
		for f in [-d * 0.5, d * 0.5]:
			box(Vector3(0.04, h, 0.04), base + Vector3(e, h * 0.5, f), "steel")
	for l in levels:
		var y := 0.1 + l * (h - 0.15) / (levels - 1)
		box(Vector3(w, 0.03, d), base + Vector3(0, y, 0), "steel")
		if l < levels - 1:
			for k in 3:
				box(Vector3(0.4, 0.22, 0.35), base + Vector3(-w * 0.33 + k * w * 0.33, y + 0.13, 0), "cardboard" if (k + l) % 2 == 0 else "frame")


## Dispatch lane along the south wall to the roller doors: pallets and a parked forklift.
func _dispatch_area() -> void:
	box(Vector3(26.0, 0.004, 2.4), Vector3(4.0, 0.003, 8.5), "line")
	box(Vector3(25.8, 0.005, 2.2), Vector3(4.0, 0.004, 8.5), "floor")
	label("DISPATCH LANE", Vector3(-6.0, 0.02, 8.5), 220, Color(0.96, 0.8, 0.1), Vector3(-PI * 0.5, 0, 0))
	for k in 4:
		_pallet(Vector3(10.0 + k * 1.6, 0, 8.5), k)
	_forklift(Vector3(15.5, 0, 3.0), deg_to_rad(-70))
	for k in 3:
		cyl(0.29, 0.88, Vector3(-12.0 + k * 0.62, 0.44, 10.4), "frame" if k != 1 else "red")


func _forklift(pos: Vector3, yaw: float) -> void:
	var fl := Node3D.new()
	fl.position = pos
	fl.rotation.y = yaw
	add_child(fl)
	box(Vector3(1.1, 0.7, 2.0), Vector3(0, 0.6, 0), "yellow", false, fl)
	box(Vector3(1.0, 0.5, 0.6), Vector3(0, 1.15, 0.6), "dark", false, fl) # counterweight
	box(Vector3(0.5, 0.1, 0.5), Vector3(0, 1.0, -0.1), "dark", false, fl) # seat
	for x in [-0.5, 0.5]:
		member(Vector3(x, 0.95, 0.3), Vector3(x, 2.15, -0.5), 0.06, "dark", fl) # overhead guard
		member(Vector3(x, 0.95, -0.9), Vector3(x, 2.15, -0.5), 0.06, "dark", fl)
		box(Vector3(0.1, 2.6, 0.12), Vector3(x * 0.8, 1.3, -1.1), "dark", false, fl) # mast
		box(Vector3(0.12, 0.05, 1.1), Vector3(x * 0.5, 0.12, -1.7), "steel", false, fl) # forks
		for z in [-0.65, 0.6]:
			cyl(0.28, 0.22, Vector3(x * 1.1, 0.28, z), "dark", fl, Vector3(0, 0, PI * 0.5))
	box(Vector3(1.1, 0.04, 1.3), Vector3(0, 2.17, -0.3), "dark", false, fl) # guard roof


## High-bay light fittings hanging under the trusses, each with a spot light.
func _high_bay_lights() -> void:
	var hx := LENGTH * 0.5
	for b in int(LENGTH / BAY):
		var x := -hx + BAY * (b + 0.5)
		for z in [-9.0, -1.5, 1.5, 9.0]:
			var p := Vector3(x, EAVES - 0.6, z)
			member(Vector3(x, EAVES, z), p + Vector3(0, 0.2, 0), 0.015, "dark")
			var housing := MeshInstance3D.new()
			var cone := CylinderMesh.new()
			cone.top_radius = 0.12
			cone.bottom_radius = 0.28
			cone.height = 0.25
			cone.material = mats["dark"]
			housing.mesh = cone
			housing.position = p + Vector3(0, 0.08, 0)
			add_child(housing)
			cyl(0.26, 0.02, p - Vector3(0, 0.05, 0), "lamp")
			var spot := SpotLight3D.new()
			spot.position = p - Vector3(0, 0.1, 0)
			spot.rotation.x = -PI * 0.5
			spot.spot_range = 10.0
			spot.spot_angle = 55.0
			spot.spot_attenuation = 0.8
			spot.light_energy = 2.2
			spot.light_color = Color(1.0, 0.96, 0.9)
			add_child(spot)


func _safety() -> void:
	# bollards at the office corner and the racking end
	for p in [Vector3(-14.7, 0, -3.5), Vector3(-14.7, 0, -11.0), Vector3(12.0, 0, -9.6), Vector3(-13.6, 0, -9.6)]:
		cyl(0.08, 1.1, p + Vector3(0, 0.55, 0), "yellow")
		cyl(0.085, 0.12, p + Vector3(0, 0.85, 0), "dark")
