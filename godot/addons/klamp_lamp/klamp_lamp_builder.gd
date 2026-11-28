@tool
class_name KlampLampBuilder
extends RefCounted
## Turns a Klamp Studio .glb (menu → "Export for Godot") into a RigidBody3D.
##
## The .glb is in metres, Y up, with its origin at the hang point. Besides the mesh it holds
## empty helper nodes:
##   HangPoint, CenterOfMass, Attach_1..n   points (Attach_* are the top corners, for slings)
##   Collision/CYL_*   a cylinder: the node's basis scale is (radius, height, radius)
##   Collision/SPH_*   a sphere: the node's basis scale is (radius, radius, radius)
## and glTF extras (imported by Godot 4.3+ as metadata "extras") with the estimated weight.

const META := &"klamp"
## Used only when the file has no weight in it: Size 7 (1-1/4") steel pipe and an average fitting.
const FALLBACK_KG_PER_M := 3.14
const FALLBACK_FITTING_KG := 0.42


## Returns a RigidBody3D holding `source` (an instance of the imported .glb) as its visual,
## with collision shapes, mass and centre of mass set. Its metadata "klamp" is a Dictionary:
##   name, mass_kg, hang_point (Vector3), center_of_mass (Vector3), attach_points (Array of Vector3),
##   bounds (AABB of the mesh)
## all in the body's local space. If `source` was already built (for example by the
## post-import script) it is returned unchanged.
static func build(source: Node, use_capsules := false) -> RigidBody3D:
	if source is RigidBody3D and source.has_meta(META):
		return source as RigidBody3D

	var body := RigidBody3D.new()
	body.name = source.name
	body.add_child(source)

	var extras := find_extras(source)
	var estimated_kg := 0.0
	var shape_count := 0

	var col_root := source.find_child("Collision", true, false)
	if col_root != null:
		for helper in col_root.get_children():
			if not (helper is Node3D):
				continue
			var hname := String(helper.name)
			var t := xform_to(helper, body)
			var s := t.basis.get_scale().abs()
			var cs := CollisionShape3D.new()
			cs.name = hname
			if hname.begins_with("CYL"):
				if use_capsules:
					var cap := CapsuleShape3D.new()
					cap.radius = s.x
					cap.height = s.y + 2.0 * s.x
					cs.shape = cap
				else:
					var cyl := CylinderShape3D.new()
					cyl.radius = s.x
					cyl.height = s.y
					cs.shape = cyl
				if hname.begins_with("CYL_pipe"):
					estimated_kg += s.y * FALLBACK_KG_PER_M
			elif hname.begins_with("SPH"):
				var sph := SphereShape3D.new()
				sph.radius = s.x
				cs.shape = sph
				estimated_kg += FALLBACK_FITTING_KG
			else:
				cs.free()
				continue
			cs.transform = Transform3D(t.basis.orthonormalized(), t.origin)
			body.add_child(cs)
			shape_count += 1
		col_root.get_parent().remove_child(col_root)
		col_root.free()

	if shape_count == 0:
		# Not a Klamp Studio export: fall back to one convex hull around the first mesh.
		var mi := _first_mesh(source)
		if mi != null and mi.mesh != null:
			push_warning("KlampLampBuilder: '%s' has no collision helpers, using a convex hull." % source.name)
			var cs := CollisionShape3D.new()
			cs.name = "ConvexHull"
			cs.shape = mi.mesh.create_convex_shape(true, true)
			cs.transform = xform_to(mi, body)
			body.add_child(cs)

	body.mass = maxf(float(extras.get("mass_kg", estimated_kg)), 0.1)

	var attach: Array = []
	var i := 1
	while true:
		var a := source.find_child("Attach_%d" % i, true, false)
		if a == null:
			break
		attach.append(xform_to(a, body).origin)
		i += 1

	var com_node := source.find_child("CenterOfMass", true, false)
	var com: Vector3 = xform_to(com_node, body).origin if com_node != null else Vector3.ZERO
	if com_node != null:
		body.center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
		body.center_of_mass = com

	var bounds := AABB()
	var mesh_node := _first_mesh(source)
	if mesh_node != null:
		bounds = xform_to(mesh_node, body) * mesh_node.get_aabb()

	var hang_node := source.find_child("HangPoint", true, false)
	body.set_meta(META, {
		"name": String(extras.get("name", source.name)),
		"mass_kg": body.mass,
		"hang_point": xform_to(hang_node, body).origin if hang_node != null else Vector3.ZERO,
		"center_of_mass": com,
		"attach_points": attach,
		"bounds": bounds,
	})
	return body


## The "klamp" block of the glTF extras, or {} if the importer did not keep them.
static func find_extras(node: Node) -> Dictionary:
	if node.has_meta(&"extras"):
		var e = node.get_meta(&"extras")
		if e is Dictionary and e.has("klamp") and e["klamp"] is Dictionary:
			return e["klamp"]
	for c in node.get_children():
		var r := find_extras(c)
		if not r.is_empty():
			return r
	return {}


## Transform of `node` relative to `ancestor`. Works whether or not they are in the scene tree.
static func xform_to(node: Node, ancestor: Node) -> Transform3D:
	var t := Transform3D.IDENTITY
	var n := node
	while n != null and n != ancestor:
		if n is Node3D:
			t = (n as Node3D).transform * t
		n = n.get_parent()
	return t


static func _first_mesh(node: Node) -> MeshInstance3D:
	if node is MeshInstance3D:
		return node
	for c in node.get_children():
		var r := _first_mesh(c)
		if r != null:
			return r
	return null
