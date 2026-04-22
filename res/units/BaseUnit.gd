extends CharacterBody2D
class_name BaseUnit

@export var max_hp: int = 100
@export var dmg: int = 10
@export var move_speed: float = 120.0
@export var attack_range: int = 120
@export var lane_id: int = 0

var hp: int = max_hp
var current_target: Node = null
var is_moving: bool = true

func _ready():
	var aggro_area = get_node_or_null("AggroArea")
	if aggro_area:
		aggro_area.body_entered.connect(_on_body_entered)
		aggro_area.body_exited.connect(_on_body_exited)

func _physics_process(_delta: float):
	if current_target and is_instance_valid(current_target):
		velocity = Vector2.ZERO
	else:
		velocity = Vector2(0, -move_speed)
	move_and_slide()

func _on_body_entered(body: Node):
	if body.has_method("take_damage") and body != self:
		current_target = body

func _on_body_exited(body: Node):
	if body == current_target:
		current_target = null

func take_damage(amount: int):
	hp -= amount
	if hp <= 0:
		die()
	else:
		_update_health_bar()

func die():
	queue_free()

func _update_health_bar():
	pass