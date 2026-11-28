extends Camera3D
## Demo camera with four modes:
##   ORBIT   right-drag to orbit, middle-drag (or Shift+right-drag) to pan, wheel to zoom,
##           W A S D to slide the focus point around the floor
##   FLY     hold right mouse to look, W A S D to move, Q / E down / up, Shift for speed
##   FOLLOW  orbits a moving node (a rig)
##   RIDE    rides behind a trolley, looking down at its rig

enum Mode { ORBIT, FLY, FOLLOW, RIDE }

var mode := Mode.ORBIT
var focus := Vector3(0, 2, 0)
var yaw := 0.0
var pitch := -0.4
var distance := 20.0
var target: Node3D
## Keep the camera above the floor.
var min_height := 0.4

var _smooth_focus := Vector3.ZERO
var _fly_pos := Vector3.ZERO


func _ready() -> void:
	_smooth_focus = focus
	_apply(1.0)


func orbit(new_focus: Vector3, new_yaw: float, new_pitch: float, new_distance: float, instant := false) -> void:
	mode = Mode.ORBIT
	focus = new_focus
	yaw = new_yaw
	pitch = new_pitch
	distance = new_distance
	target = null
	if instant:
		_smooth_focus = focus
		_apply(1.0)


func follow(node: Node3D) -> void:
	mode = Mode.FOLLOW
	target = node
	distance = minf(distance, 8.0)


func ride(node: Node3D) -> void:
	mode = Mode.RIDE
	target = node


func fly() -> void:
	mode = Mode.FLY
	_fly_pos = global_position
	var e := global_basis.get_euler()
	yaw = e.y
	pitch = e.x
	target = null


func mode_name() -> String:
	return Mode.keys()[mode].capitalize()


func _process(delta: float) -> void:
	if mode == Mode.FLY:
		var dir := Vector3(
			float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A)),
			float(Input.is_key_pressed(KEY_E)) - float(Input.is_key_pressed(KEY_Q)),
			float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W)))
		var speed := 12.0 if Input.is_key_pressed(KEY_SHIFT) else 4.0
		var b := Basis.from_euler(Vector3(pitch, yaw, 0))
		_fly_pos += (b.x * dir.x + Vector3.UP * dir.y + Vector3(b.z.x, 0, b.z.z).normalized() * dir.z) * speed * delta
		_fly_pos.y = maxf(_fly_pos.y, min_height)
		global_transform = Transform3D(b, _fly_pos)
		return
	if mode == Mode.ORBIT:
		var move := Vector2(
			float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A)),
			float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W)))
		if move != Vector2.ZERO:
			var fwd := Vector3(sin(yaw), 0, cos(yaw))
			var right := Vector3(cos(yaw), 0, -sin(yaw))
			focus += (right * move.x + fwd * move.y) * distance * 0.6 * delta
	if (mode == Mode.FOLLOW or mode == Mode.RIDE) and not is_instance_valid(target):
		mode = Mode.ORBIT
	if mode == Mode.FOLLOW:
		focus = target.global_position + Vector3(0, -0.3, 0)
	if mode == Mode.RIDE:
		var t := target.global_transform
		var eye := t * Vector3(0.0, -0.35, 3.2)
		var look := t * Vector3(0.0, -2.4, -1.5)
		global_transform = global_transform.interpolate_with(
			Transform3D(Basis.looking_at(look - eye, Vector3.UP), eye), minf(1.0, delta * 6.0))
		return
	_apply(minf(1.0, delta * 8.0))


func _apply(weight: float) -> void:
	_smooth_focus = _smooth_focus.lerp(focus, weight)
	var b := Basis.from_euler(Vector3(pitch, yaw, 0))
	var pos := _smooth_focus + b.z * distance
	pos.y = maxf(pos.y, min_height)
	global_transform = Transform3D(Basis.looking_at(_smooth_focus - pos, Vector3.UP), pos)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		var right := (mm.button_mask & MOUSE_BUTTON_MASK_RIGHT) != 0
		var middle := (mm.button_mask & MOUSE_BUTTON_MASK_MIDDLE) != 0
		if mode == Mode.FLY:
			if right:
				yaw -= mm.relative.x * 0.004
				pitch = clampf(pitch - mm.relative.y * 0.004, -1.5, 1.5)
			return
		if middle or (right and mm.shift_pressed):
			if mode == Mode.ORBIT:
				var b := global_basis
				focus += (-b.x * mm.relative.x + b.y * mm.relative.y) * distance * 0.0012
		elif right:
			yaw -= mm.relative.x * 0.006
			pitch = clampf(pitch - mm.relative.y * 0.006, -1.5, 0.6)
	elif event is InputEventMouseButton and event.is_pressed():
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			distance = maxf(1.5, distance * 0.9)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			distance = minf(90.0, distance * 1.1)
