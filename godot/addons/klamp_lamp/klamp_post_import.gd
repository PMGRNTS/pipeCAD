@tool
extends EditorScenePostImport
## Optional import script. In the Import dock for a Klamp Studio .glb, set
## "Import Script" to this file and click Reimport: the scene then imports as a ready-made
## RigidBody3D (collision shapes, mass, centre of mass) that you can drop into any level.
## KlampHanger works with either the raw .glb or one imported this way.

const Builder := preload("res://addons/klamp_lamp/klamp_lamp_builder.gd")


func _post_import(scene: Node) -> Object:
	var body: RigidBody3D = Builder.build(scene)
	_own(body, body)
	return body


func _own(node: Node, owner_node: Node) -> void:
	for c in node.get_children():
		c.owner = owner_node
		_own(c, owner_node)
