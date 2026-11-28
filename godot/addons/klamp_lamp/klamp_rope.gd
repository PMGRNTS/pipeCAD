class_name KlampRope
extends Node3D
## A rope or cable made of short rigid segments joined with pin joints, hanging between two
## physics bodies. Use KlampRope.create() once both bodies are in the scene at their start positions.
##
## One segment gives a taut cable (the most stable choice for heavy loads). More segments let
## the rope bend and whip, at some cost in stability. Rope bodies do not collide by default.

## The segment bodies, top (body_a end) first.
var segments: Array[RigidBody3D] = []
var joints: Array[PinJoint3D] = []
var body_a: PhysicsBody3D
var body_b: PhysicsBody3D
## Rest length in metres.
var length := 0.0


## Builds a rope under `parent` from `point_a` on `a` to `point_b` on `b` (global positions).
static func create(parent: Node, a: PhysicsBody3D, point_a: Vector3, b: PhysicsBody3D, point_b: Vector3,
		segment_count := 4, radius := 0.006, segment_mass := 0.2, material: Material = null,
		collision_layer := 0, collision_mask := 0) -> KlampRope:
	var rope := KlampRope.new()
	rope.name = "Rope"
	rope.top_level = true
	parent.add_child(rope, true)
	rope.global_transform = Transform3D.IDENTITY
	rope._build(a, point_a, b, point_b, maxi(1, segment_count), radius, segment_mass,
		material if material != null else default_material(), collision_layer, collision_mask)
	return rope


static func default_material() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.16, 0.17, 0.18)
	m.metallic = 0.6
	m.roughness = 0.45
	return m


## Basis whose Y axis points along `dir`.
static func basis_along(dir: Vector3) -> Basis:
	var y := dir.normalized()
	var ref := Vector3.FORWARD if absf(y.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT
	var x := ref.cross(y).normalized()
	return Basis(x, y, x.cross(y))


## Global position of the rope's top end (where it meets body_a).
func top_point() -> Vector3:
	return segments[0].global_transform * Vector3(0, -length / segments.size() * 0.5, 0)


## Global position of the rope's bottom end (where it meets body_b).
func bottom_point() -> Vector3:
	return segments[segments.size() - 1].global_transform * Vector3(0, length / segments.size() * 0.5, 0)


func _build(a: PhysicsBody3D, point_a: Vector3, b: PhysicsBody3D, point_b: Vector3, n: int,
		radius: float, segment_mass: float, material: Material, layer: int, mask: int) -> void:
	body_a = a
	body_b = b
	length = point_a.distance_to(point_b)
	var dir := (point_b - point_a) / maxf(length, 1e-6)
	var seg_len := length / n
	var basis := basis_along(dir)

	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = seg_len + radius * 2.0
	mesh.radial_segments = 8
	mesh.rings = 1
	mesh.material = material
	var knot := SphereMesh.new()
	knot.radius = radius * 1.2
	knot.height = radius * 2.4
	knot.radial_segments = 8
	knot.rings = 4
	knot.material = material
	var shape := SphereShape3D.new()
	shape.radius = maxf(radius, 0.01)
	# Thin rods spin too easily about their long axis; give every axis the rod's end-over-end inertia.
	var inertia := maxf(segment_mass * seg_len * seg_len / 12.0, 1e-4)

	var prev: PhysicsBody3D = a
	for i in n:
		var seg := RigidBody3D.new()
		seg.name = "Segment%d" % i
		seg.mass = segment_mass
		seg.inertia = Vector3.ONE * inertia
		seg.collision_layer = layer
		seg.collision_mask = mask
		seg.linear_damp = 0.05
		seg.angular_damp = 0.5
		seg.can_sleep = false
		var cs := CollisionShape3D.new()
		cs.shape = shape
		seg.add_child(cs)
		var mi := MeshInstance3D.new()
		mi.mesh = mesh
		seg.add_child(mi)
		var k := MeshInstance3D.new()
		k.mesh = knot
		k.position = Vector3(0, -seg_len * 0.5, 0)
		seg.add_child(k)
		add_child(seg)
		seg.global_transform = Transform3D(basis, point_a + dir * seg_len * (i + 0.5))
		segments.append(seg)
		_pin(prev, seg, point_a + dir * seg_len * i)
		prev = seg
	_pin(prev, b, point_b)


func _pin(x: PhysicsBody3D, y: PhysicsBody3D, at: Vector3) -> void:
	var j := PinJoint3D.new()
	j.name = "Pin%d" % joints.size()
	add_child(j)
	j.global_position = at
	j.node_a = j.get_path_to(x)
	j.node_b = j.get_path_to(y)
	joints.append(j)
