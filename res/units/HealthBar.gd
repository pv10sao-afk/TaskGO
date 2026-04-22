extends Control
class_name HealthBar

@export var width := 60
@export var height := 8
@export var bar_color: Color = Color(0.0, 1.0, 0.0)
var _hp_ratio := 1.0

func set_hp_ratio(ratio: float):
    _hp_ratio = clamp(ratio, 0.0, 1.0)
    update()

func _draw():
    var fill_w = width * _hp_ratio
    draw_rect(Rect2(Vector2.ZERO, Vector2(fill_w, height)), bar_color)
    draw_rect(Rect2(Vector2.ZERO, Vector2(width, height)), Color(0,0,0,0.3))
