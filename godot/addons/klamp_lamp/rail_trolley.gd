@tool
class_name RailTrolley
extends AnimatableBody3D
## A carriage that runs along a CeilingRail (its parent, or the node set in `rail`).
## Anything hung under it with a KlampHanger swings as it speeds up, brakes and takes bends.
##
## On a looped rail it goes round; on an open rail it shuttles between the ends.
## With `stops` set it halts at each one for `dwell_time`. move_to() sends it to one place.

## Emitted when the trolley comes to rest at a stop. `stop_index` is the index in `stops`,
## or -1 for a move_to() target or the end of an open rail.
signal arrived(stop_index: int)
## Emitted when it sets off again after dwelling at a stop.
signal departed(stop_index: int)

const GROUP := &"rail_trolleys"

@export var rail: CeilingRail: set = _set_rail
## Distance along the rail in metres.
@export_range(0.0, 1000.0, 0.01, "or_greater", "suffix:m") var progress := 0.0: set = _set_progress
@export_range(0.0, 20.0, 0.01, "or_greater", "suffix:m/s") var cruise_speed := 1.2
@export_range(0.01, 20.0, 0.01, "or_greater", "suffix:m/s²") var acceleration := 0.5
@export_range(0.01, 20.0, 0.01, "or_greater", "suffix:m/s²") var braking := 0.6
## When false the trolley brakes to a stop and waits (move_to() still works).
@export var running := true
## Travel towards decreasing distance.
@export var reverse := false
## Distances along the rail to stop at, in metres.
@export var stops: PackedFloat32Array = PackedFloat32Array()
@export_range(0.0, 600.0, 0.1, "or_greater", "suffix:s") var dwell_time := 3.0
## How far the trolley's origin sits below the rail's centre line. Put a KlampHanger at or below the origin.
@export_range(0.0, 2.0, 0.01, "suffix:m") var drop := 0.2: set = _set_drop
## Keep at least this far behind the next trolley on the same rail (0 = no spacing).
@export_range(0.0, 50.0, 0.1, "or_greater", "suffix:m") var min_gap := 2.5
## Build a simple carriage mesh and collision box if this node has none of its own.
@export var build_visual := true

## Current speed in m/s (always >= 0; `reverse` gives the direction).
var speed := 0.0
var _target := -1.0
var _target_stop := -1
var _dwell := 0.0


func _ready() -> void:
	if not Engine.is_editor_hint():
		add_to_group(GROUP)
	if build_visual:
		_build_visual()
	var r := get_rail()
	if Engine.is_editor_hint() and r != null and not r.curve_changed.is_connected(_place):
		r.curve_changed.connect(_place)
	_place()


func get_rail() -> CeilingRail:
	if rail != null:
		return rail
	return get_parent() as CeilingRail


## Send the trolley to `distance` metres along the rail. It brakes to a stop there and emits
## arrived(-1). On an open rail it turns round if the target is behind it.
func move_to(distance: float) -> void:
	var r := get_rail()
	if r == null:
		return
	_dwell = 0.0
	_target_stop = -1
	_target = _wrap(distance, r)
	if not r.is_loop():
		reverse = _target < progress


## Stop going to a move_to() target; the trolley carries on with its normal run (or brakes if not running).
func cancel_move() -> void:
	_target = -1.0
	_target_stop = -1


## True while the trolley is standing still at a stop.
func is_dwelling() -> bool:
	return _dwell > 0.0


func _physics_process(delta: float) -> void:
	if Engine.is_editor_hint():
		return
	var r := get_rail()
	if r == null:
		return
	var length := r.get_length()
	if length <= 0.0:
		return

	if _dwell > 0.0:
		_dwell -= delta
		if _dwell <= 0.0:
			var s := _target_stop
			_target = -1.0
			_target_stop = -1
			departed.emit(s)
		return

	if _target < 0.0 and running and stops.size() > 0:
		_pick_next_stop(r)

	var dir := -1.0 if reverse else 1.0
	var want := cruise_speed if (running or _target >= 0.0) else 0.0
	var room := INF # distance left before we must be stopped
	if _target >= 0.0:
		room = _distance_ahead(_target, r)
	elif not r.is_loop():
		room = progress if reverse else length - progress
	if room < INF:
		want = minf(want, sqrt(2.0 * braking * room))
	var gap := _room_behind_next(r)
	if gap < INF:
		want = minf(want, sqrt(2.0 * braking * gap))

	var rate := acceleration if want > speed else braking
	speed = move_toward(speed, want, rate * delta)
	var step := minf(speed * delta, minf(room, gap))
	progress = _wrap(progress + step * dir, r)

	if room < INF and room - step < 0.001:
		# Arrived: at a stop, a move_to() target, or the end of an open rail.
		speed = 0.0
		if _target >= 0.0:
			progress = _target
			var s := _target_stop
			if s >= 0:
				_dwell = maxf(dwell_time, 0.001)
			else:
				_target = -1.0
			arrived.emit(s)
		else:
			reverse = not reverse
			_dwell = maxf(dwell_time, 0.001)
			arrived.emit(-1)


## Free track before the minimum gap to the next trolley ahead on the same rail, or INF.
func _room_behind_next(r: CeilingRail) -> float:
	if min_gap <= 0.0:
		return INF
	var best := INF
	for n in get_tree().get_nodes_in_group(GROUP):
		var o := n as RailTrolley
		if o == null or o == self or o.get_rail() != r:
			continue
		var d := (o.progress - progress) * (-1.0 if reverse else 1.0)
		if r.is_loop():
			d = fposmod(d, r.get_length())
		elif d <= 0.0:
			continue
		best = minf(best, maxf(d - min_gap, 0.0))
	return best


func _pick_next_stop(r: CeilingRail) -> void:
	var best := -1
	var best_d := INF
	for _attempt in 2:
		for i in stops.size():
			var t := _wrap(stops[i], r)
			if not r.is_loop() and (t - progress) * (-1.0 if reverse else 1.0) < 0.0:
				continue
			var d := _distance_ahead(t, r)
			if d > 0.01 and d < best_d:
				best = i
				best_d = d
		if best >= 0 or r.is_loop():
			break
		reverse = not reverse # nothing ahead on an open rail: turn round
	if best >= 0:
		_target_stop = best
		_target = _wrap(stops[best], r)


func _distance_ahead(t: float, r: CeilingRail) -> float:
	var d := (t - progress) * (-1.0 if reverse else 1.0)
	if r.is_loop():
		return fposmod(d, r.get_length())
	return maxf(d, 0.0)


func _wrap(d: float, r: CeilingRail) -> float:
	var length := r.get_length()
	if length <= 0.0:
		return 0.0
	return fposmod(d, length) if r.is_loop() else clampf(d, 0.0, length)


func _place() -> void:
	var r := get_rail()
	if r == null or not is_inside_tree() or not r.is_inside_tree() or r.get_length() <= 0.0:
		return
	var t := r.sample(progress)
	var xf := Transform3D(t.basis, t.origin + Vector3.DOWN * drop)
	if Engine.is_in_physics_frame() or Engine.is_editor_hint():
		global_transform = xf
	else:
		# Outside the physics step an AnimatableBody3D that syncs to physics keeps its old
		# transform until the next step and then sweeps across as a move, dragging anything
		# jointed to it. A placement from here is a teleport, so switch syncing off for it.
		var sync := sync_to_physics
		sync_to_physics = false
		global_transform = xf
		PhysicsServer3D.body_set_state(get_rid(), PhysicsServer3D.BODY_STATE_TRANSFORM, xf)
		sync_to_physics = sync


func _set_progress(v: float) -> void:
	progress = v
	_place()


func _set_rail(v: CeilingRail) -> void:
	rail = v
	_place()


func _set_drop(v: float) -> void:
	drop = v
	_place()


func _build_visual() -> void:
	for c in get_children():
		if c is MeshInstance3D or c is CollisionShape3D:
			return
	# Local space: the origin is the lifting eye; the rail's centre line is `drop` above it.
	var r := get_rail()
	var bw := r.beam_width if r != null else 0.1
	var bh := r.beam_height if r != null else 0.14
	var web := r.web_thickness if r != null else 0.008
	var ft := r.flange_thickness if r != null else 0.012
	var paint := StandardMaterial3D.new()
	paint.albedo_color = Color(0.93, 0.68, 0.1)
	paint.roughness = 0.5
	var steel := StandardMaterial3D.new()
	steel.albedo_color = Color(0.2, 0.21, 0.22)
	steel.metallic = 0.7
	steel.roughness = 0.4

	var under := drop - bh * 0.5 # underside of the beam
	var block_top := minf(under - 0.015, 0.09)
	var block_bottom := 0.03
	var block_h := maxf(block_top - block_bottom, 0.03)
	var plate_x := bw * 0.5 + 0.02
	var plate_bottom := block_bottom + block_h * 0.5
	var plate_h := maxf(drop + bh * 0.25 - plate_bottom, 0.05)
	for side in [-1.0, 1.0]:
		_box("Plate", Vector3(0.012, plate_h, 0.22), Vector3(side * plate_x, plate_bottom + plate_h * 0.5, 0), paint)
		for z in [-0.065, 0.065]:
			var wheel := MeshInstance3D.new()
			var cyl := CylinderMesh.new()
			cyl.top_radius = 0.035
			cyl.bottom_radius = 0.035
			cyl.height = 0.02
			cyl.material = steel
			wheel.mesh = cyl
			wheel.rotation = Vector3(0, 0, PI * 0.5)
			wheel.position = Vector3(side * (web * 0.5 + 0.022), under + ft + 0.035, z)
			wheel.name = "Wheel"
			add_child(wheel)
	_box("Block", Vector3(plate_x * 2.0 + 0.012, block_h, 0.22), Vector3(0, block_bottom + block_h * 0.5, 0), paint)
	var eye := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.012
	torus.outer_radius = 0.024
	torus.material = steel
	eye.mesh = torus
	eye.rotation = Vector3(PI * 0.5, 0, 0)
	eye.position = Vector3(0, 0.012, 0)
	eye.name = "Eye"
	add_child(eye)
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(plate_x * 2.0 + 0.012, block_h, 0.22)
	cs.shape = box
	cs.position = Vector3(0, block_bottom + block_h * 0.5, 0)
	add_child(cs)


func _box(n: String, size: Vector3, pos: Vector3, mat: Material) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	bm.material = mat
	mi.mesh = bm
	mi.position = pos
	mi.name = n
	add_child(mi)
