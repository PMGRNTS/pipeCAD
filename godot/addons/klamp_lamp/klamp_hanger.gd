@tool
class_name KlampHanger
extends Marker3D
## Hangs a Klamp Studio structure (.glb from "Export for Godot") from this point on a physics rope.
##
## Put it under a RailTrolley so the rope travels with the trolley, or under any other
## PhysicsBody3D. On its own (no physics body above it) it hangs from a fixed point.
## The lamp and rope are created when the game starts; in the editor you see a preview.

## Emitted after the lamp and its rope(s) have been created.
signal spawned(lamp: RigidBody3D)

enum HangMode {
	SINGLE, ## One rope to the hang point chosen at export (balance point or a joint).
	BRIDLE, ## One rope from here to each top corner (Attach_1..n), like a sling.
}

## The exported .glb (or a scene imported with klamp_post_import.gd).
@export var lamp_scene: PackedScene: set = _set_lamp_scene
## Vertical distance from this point down to the lamp's hang point.
@export_range(0.05, 30.0, 0.01, "or_greater", "suffix:m") var rope_length := 1.5: set = _set_rope_length
@export var hang_mode := HangMode.SINGLE: set = _set_hang_mode
## Turns the structure about the vertical, relative to this node (and the trolley's direction).
@export_range(-180.0, 180.0, 1.0, "suffix:°") var lamp_yaw := 0.0: set = _set_lamp_yaw
@export var spawn_on_ready := true

@export_group("Rope")
## 1 gives a taut cable (most stable). More segments let the rope bend.
@export_range(1, 32) var rope_segments := 3
@export_range(0.002, 0.05, 0.001, "suffix:m") var rope_radius := 0.006
## Weight of all rope segments as a fraction of the lamp's weight. Real cable is lighter, but
## chains of very light bodies under a heavy load stretch and jitter; 0.05 to 0.2 works well.
@export_range(0.01, 1.0, 0.01) var rope_mass_ratio := 0.1
@export var rope_material: Material
@export_flags_3d_physics var rope_collision_layer := 0
@export_flags_3d_physics var rope_collision_mask := 0

@export_group("Lamp")
## Light fittings, cables and anything else not in the pipe model, added to the pipe weight.
@export_range(0.0, 500.0, 0.1, "or_greater", "suffix:kg") var extra_mass := 0.0
## Capsules instead of cylinders for the pipe collision shapes.
@export var use_capsules := false
@export_flags_3d_physics var lamp_collision_layer := 1
@export_flags_3d_physics var lamp_collision_mask := 1
## Air resistance. Raise it to make swinging die down faster.
@export_range(0.0, 5.0, 0.01) var lamp_linear_damp := 0.05
@export_range(0.0, 5.0, 0.01) var lamp_angular_damp := 0.2

## The physics body of the hanging structure, once spawned.
var lamp: RigidBody3D
var ropes: Array[KlampRope] = []
var _sim: Node3D
var _preview: Node3D


func _ready() -> void:
	if Engine.is_editor_hint():
		_update_preview()
	elif spawn_on_ready:
		spawn.call_deferred() # after parent trolleys have placed themselves


## Creates the lamp and its rope(s) hanging straight down from here. Calls despawn() first.
func spawn() -> void:
	despawn()
	if lamp_scene == null:
		push_warning("KlampHanger '%s': no lamp_scene set." % name)
		return
	lamp = KlampLampBuilder.build(lamp_scene.instantiate(), use_capsules)
	lamp.mass += extra_mass
	lamp.collision_layer = lamp_collision_layer
	lamp.collision_mask = lamp_collision_mask
	lamp.linear_damp = lamp_linear_damp
	lamp.angular_damp = lamp_angular_damp
	lamp.can_sleep = false
	var info: Dictionary = lamp.get_meta(KlampLampBuilder.META)
	var hang: Vector3 = info["hang_point"]

	# Rigid bodies must not inherit the moving trolley's transform, so they live under a top-level node.
	_sim = Node3D.new()
	_sim.name = "Simulation"
	_sim.top_level = true
	add_child(_sim)
	_sim.global_transform = Transform3D.IDENTITY

	var anchor := global_position
	var yaw := Basis(Vector3.UP, global_rotation.y + deg_to_rad(lamp_yaw))
	_sim.add_child(lamp)
	lamp.global_transform = Transform3D(yaw, anchor + Vector3.DOWN * rope_length - yaw * hang)

	var holder := _holder_body()
	var points: Array = [hang]
	var attach: Array = info["attach_points"]
	if hang_mode == HangMode.BRIDLE and attach.size() > 0:
		points = attach
	var seg_mass := maxf(lamp.mass * rope_mass_ratio / (rope_segments * points.size()), 0.02)
	for p in points:
		var end: Vector3 = lamp.global_transform * (p as Vector3)
		ropes.append(KlampRope.create(_sim, holder, anchor, lamp, end, rope_segments, rope_radius,
			seg_mass, rope_material, rope_collision_layer, rope_collision_mask))
	spawned.emit(lamp)


## Removes the lamp and rope(s).
func despawn() -> void:
	if _sim != null:
		_sim.queue_free()
	_sim = null
	lamp = null
	ropes.clear()


## Angle in radians between straight down and the line from this point to the lamp's hang point.
func get_swing_angle() -> float:
	if lamp == null:
		return 0.0
	var info: Dictionary = lamp.get_meta(KlampLampBuilder.META)
	var p: Vector3 = lamp.global_transform * (info["hang_point"] as Vector3)
	return (p - global_position).angle_to(Vector3.DOWN)


## Pushes the lamp, for example from a player bumping into it. `at` is a global position.
func push(impulse: Vector3, at := Vector3.INF) -> void:
	if lamp == null:
		return
	if at == Vector3.INF:
		lamp.apply_central_impulse(impulse)
	else:
		lamp.apply_impulse(impulse, at - lamp.global_position)


func _holder_body() -> PhysicsBody3D:
	var n := get_parent()
	while n != null:
		if n is PhysicsBody3D:
			return n as PhysicsBody3D
		n = n.get_parent()
	var fixed := StaticBody3D.new()
	fixed.name = "FixedPoint"
	fixed.collision_layer = 0
	fixed.collision_mask = 0
	_sim.add_child(fixed)
	fixed.global_position = global_position
	return fixed


func _get_configuration_warnings() -> PackedStringArray:
	var w := PackedStringArray()
	if lamp_scene == null:
		w.append("Set lamp_scene to a .glb exported from Klamp Studio with \"Export for Godot\".")
	return w


# ---------------------------------------------------------------- editor preview
func _update_preview() -> void:
	if not Engine.is_editor_hint() or not is_inside_tree():
		return
	if _preview != null:
		_preview.queue_free()
		_preview = null
	if lamp_scene == null:
		return
	_preview = Node3D.new()
	_preview.name = "_Preview"
	add_child(_preview)
	var inst := lamp_scene.instantiate()
	if inst is Node3D:
		_preview.add_child(inst)
		var hang := Vector3.ZERO
		var attach: Array = []
		if inst.has_meta(KlampLampBuilder.META):
			var info: Dictionary = inst.get_meta(KlampLampBuilder.META)
			hang = info["hang_point"]
			attach = info["attach_points"]
		else:
			var hp := inst.find_child("HangPoint", true, false)
			if hp != null:
				hang = KlampLampBuilder.xform_to(hp, inst).origin
			var i := 1
			while inst.find_child("Attach_%d" % i, true, false) != null:
				attach.append(KlampLampBuilder.xform_to(inst.find_child("Attach_%d" % i, true, false), inst).origin)
				i += 1
		var turn := Basis(Vector3.UP, deg_to_rad(lamp_yaw))
		var node3d := inst as Node3D
		node3d.transform = Transform3D(turn, Vector3.DOWN * rope_length - turn * hang)
		var ends: Array = [hang]
		if hang_mode == HangMode.BRIDLE and attach.size() > 0:
			ends = attach
		for e in ends:
			_preview_line(Vector3.ZERO, node3d.transform * (e as Vector3))
	else:
		inst.queue_free()


func _preview_line(a: Vector3, b: Vector3) -> void:
	var dist := a.distance_to(b)
	if dist < 1e-4:
		return
	var mi := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = rope_radius
	cyl.bottom_radius = rope_radius
	cyl.height = dist
	cyl.radial_segments = 6
	cyl.rings = 1
	mi.mesh = cyl
	mi.transform = Transform3D(KlampRope.basis_along(b - a), (a + b) * 0.5)
	_preview.add_child(mi)


func _set_lamp_scene(v: PackedScene) -> void:
	lamp_scene = v
	_update_preview()
	update_configuration_warnings()


func _set_rope_length(v: float) -> void:
	rope_length = v
	_update_preview()


func _set_hang_mode(v: HangMode) -> void:
	hang_mode = v
	_update_preview()


func _set_lamp_yaw(v: float) -> void:
	lamp_yaw = v
	_update_preview()
