extends CharacterBody2D
class_name BaseUnit

export(int) var max_hp := 100
var hp := max_hp
export(int) var dmg := 10
export(float) var move_speed := 120.0
export(int) var attack_range := 120
export(int) var lane_id := 0

onready var aggro_area := $AggroArea
var current_target: Node = null
var is_moving := true
var velocity := Vector2.ZERO

func _ready():
    if aggro_area:
        aggro_area.connect("body_entered", self, "_on_body_entered")
        aggro_area.connect("body_exited", self, "_on_body_exited")

    # Optional: health bar setup can go here

func _physics_process(delta):
    if current_target and is_instance_valid(current_target):
        # Attack behavior: stop moving while attacking; attack via timer on target
        velocity = Vector2.ZERO
        move_and_slide(velocity)
    else:
        # Move forward along the lane towards enemy base (assumed -Y direction)
        velocity = Vector2(0, -move_speed)
        move_and_slide(velocity)

func _on_body_entered(body):
    if body.has_method("take_damage") and body != self:
        current_target = body
        # If using turret logic, the turret would be instructed to fire via a controller

func _on_body_exited(body):
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
    # Placeholder: update any HealthBar child visuals if present
    pass
