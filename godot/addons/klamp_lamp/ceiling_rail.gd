@tool
class_name CeilingRail
extends Path3D
## An overhead I-beam rail that follows this path, with drop rods up to the ceiling.
## Add RailTrolley nodes as children to run carriages along it.
##
## Draw the path at the height of the beam's centre line. Give corners curve handles: a sharp
## corner turns a trolley instantly and makes its load jump.
## For a closed loop, put the last point on top of the first: trolleys then go round and round.
## Otherwise trolleys shuttle back and forth between the two ends.

const _GENERATED := &"_ceiling_rail_generated"

@export_group("Beam")
@export_range(0.02, 1.0, 0.001, "suffix:m") var beam_width := 0.10: set = _set_beam_width
@export_range(0.02, 1.0, 0.001, "suffix:m") var beam_height := 0.14: set = _set_beam_height
@export_range(0.002, 0.1, 0.001, "suffix:m") var flange_thickness := 0.012: set = _set_flange
@export_range(0.002, 0.1, 0.001, "suffix:m") var web_thickness := 0.008: set = _set_web
@export var beam_material: Material: set = _set_beam_material
@export_group("Ceiling hangers")
## Distance between drop rods. 0 turns them off.
@export_range(0.0, 20.0, 0.01, "suffix:m") var hanger_spacing := 2.0: set = _set_hanger_spacing
## From the top of the beam to the ceiling.
@export_range(0.0, 10.0, 0.01, "suffix:m") var hanger_length := 0.4: set = _set_hanger_length

var _pending := false


func _ready() -> void:
	if not curve_changed.is_connected(_queue_rebuild):
		curve_changed.connect(_queue_rebuild)
	_rebuild()


## Length of the rail in metres.
func get_length() -> float:
	return curve.get_baked_length() if curve != null else 0.0


## True when the path's last point sits on its first, so trolleys go round and round.
func is_loop() -> bool:
	if curve == null or curve.point_count < 3:
		return false
	return curve.get_point_position(0).distance_to(curve.get_point_position(curve.point_count - 1)) < 0.05


## Global transform at `distance` metres along the rail: origin on the beam's centre line,
## -Z pointing along the rail (direction of increasing distance), Y straight up.
func sample(distance: float) -> Transform3D:
	var length := get_length()
	if length <= 0.0:
		return global_transform
	var d := fposmod(distance, length) if is_loop() else clampf(distance, 0.0, length)
	var p := curve.sample_baked(d, true)
	var ahead := d + 0.05
	var behind := d - 0.05
	if is_loop():
		ahead = fposmod(ahead, length)
		behind = fposmod(behind, length)
	else:
		ahead = minf(ahead, length)
		behind = maxf(behind, 0.0)
	var fwd := global_transform.basis * (curve.sample_baked(ahead, true) - curve.sample_baked(behind, true))
	fwd.y = 0.0
	if fwd.length_squared() < 1e-10:
		fwd = -global_transform.basis.z
	return Transform3D(Basis.looking_at(fwd.normalized(), Vector3.UP), global_transform * p)


func _queue_rebuild() -> void:
	if _pending or not is_inside_tree():
		return
	_pending = true
	_rebuild.call_deferred()


func _rebuild() -> void:
	_pending = false
	for c in get_children():
		if c.has_meta(_GENERATED):
			remove_child(c)
			c.queue_free()
	if curve == null or curve.point_count < 2:
		return

	var mat := beam_material
	if mat == null:
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.32, 0.36, 0.4)
		m.metallic = 0.7
		m.roughness = 0.45
		mat = m

	var beam := CSGPolygon3D.new()
	beam.name = "Beam"
	beam.set_meta(_GENERATED, true)
	beam.polygon = _profile()
	beam.mode = CSGPolygon3D.MODE_PATH
	beam.path_interval_type = CSGPolygon3D.PATH_INTERVAL_DISTANCE
	beam.path_interval = 0.1
	beam.path_rotation = CSGPolygon3D.PATH_ROTATION_PATH
	beam.path_local = true
	beam.path_joined = is_loop()
	beam.smooth_faces = false
	beam.material = mat
	add_child(beam)
	beam.path_node = beam.get_path_to(self)

	if hanger_spacing > 0.0 and hanger_length > 0.0:
		var hangers := Node3D.new()
		hangers.name = "Hangers"
		hangers.set_meta(_GENERATED, true)
		add_child(hangers)
		var rod := CylinderMesh.new()
		rod.top_radius = 0.012
		rod.bottom_radius = 0.012
		rod.height = hanger_length
		rod.radial_segments = 8
		rod.material = mat
		var plate := BoxMesh.new()
		plate.size = Vector3(0.16, 0.012, 0.16)
		plate.material = mat
		var length := get_length()
		var count := maxi(1, int(floor(length / hanger_spacing)))
		for i in count:
			var d := (i + 0.5) * length / count
			var p := curve.sample_baked(d, true)
			var mi := MeshInstance3D.new()
			mi.mesh = rod
			mi.position = p + Vector3.UP * (beam_height * 0.5 + hanger_length * 0.5)
			hangers.add_child(mi)
			var pl := MeshInstance3D.new()
			pl.mesh = plate
			pl.position = p + Vector3.UP * (beam_height * 0.5 + hanger_length - 0.006)
			hangers.add_child(pl)


## I-beam cross-section, centred on the path.
func _profile() -> PackedVector2Array:
	var w := beam_width * 0.5
	var h := beam_height * 0.5
	var t := flange_thickness
	var web := web_thickness * 0.5
	return PackedVector2Array([
		Vector2(-w, h), Vector2(w, h), Vector2(w, h - t), Vector2(web, h - t),
		Vector2(web, -h + t), Vector2(w, -h + t), Vector2(w, -h), Vector2(-w, -h),
		Vector2(-w, -h + t), Vector2(-web, -h + t), Vector2(-web, h - t), Vector2(-w, h - t),
	])


func _set_beam_width(v: float) -> void:
	beam_width = v
	_queue_rebuild()


func _set_beam_height(v: float) -> void:
	beam_height = v
	_queue_rebuild()


func _set_flange(v: float) -> void:
	flange_thickness = v
	_queue_rebuild()


func _set_web(v: float) -> void:
	web_thickness = v
	_queue_rebuild()


func _set_beam_material(v: Material) -> void:
	beam_material = v
	_queue_rebuild()


func _set_hanger_spacing(v: float) -> void:
	hanger_spacing = v
	_queue_rebuild()


func _set_hanger_length(v: float) -> void:
	hanger_length = v
	_queue_rebuild()
