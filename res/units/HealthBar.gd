extends Control
class_name HealthBar

@export var width: float = 60.0
@export var height: float = 8.0
@export var bar_color: Color = Color.GREEN

var _hp_ratio: float = 1.0

func set_hp_ratio(ratio: float):
	_hp_ratio = clamp(ratio, 0.0, 1.0)
	queue_redraw()

func _draw():
	var fill_w: float = width * _hp_ratio
	draw_rect(Rect2(Vector2.ZERO, Vector2(fill_w, height)), bar_color)
	draw_rect(Rect2(Vector2.ZERO, Vector2(width, height)), Color(0, 0, 0, 0.3))