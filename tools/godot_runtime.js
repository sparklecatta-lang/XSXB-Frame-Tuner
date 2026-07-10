const fs = require("node:fs");
const path = require("node:path");
const { reslash } = require("./project_store");

const GODOT_SYNC_ROOT = "xsxb_frame_tuner";

function validGodotProjectRoot(project) {
  const projectRoot = project?.projectRoot ? path.resolve(String(project.projectRoot)) : "";
  if (!projectRoot || !fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) return "";
  return projectRoot;
}

function firstRuntimeTarget(manifest) {
  for (const profile of Array.isArray(manifest?.profiles) ? manifest.profiles : []) {
    const animations = Array.isArray(profile.animations) ? profile.animations : [];
    if (!animations.length) continue;
    return {
      profileId: String(profile.id || "profile"),
      animationId: String(animations[0].id || animations[0].name || "idle"),
    };
  }
  return { profileId: "profile", animationId: "idle" };
}

function writeIfChanged(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === content) return false;
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

function gdString(value) {
  return JSON.stringify(String(value || ""));
}

function runtimeScript(projectId) {
  return `extends CharacterBody2D

signal animation_finished(animation_name: String)

const XSXB_PROJECT_ID: String = ${gdString(projectId)}
const FRAME_AUDIO_POOL_SIZE: int = 8

@export var frame_project_id: String = XSXB_PROJECT_ID
@export var frame_profile_id: String = ""
@export var frame_animation: String = ""
@export var autoplay: bool = true
@export var loop_animation: bool = true
@export var facing: int = 1
@export var source_faces_left: bool = false
@export var fallback_visual_scale: float = 1.0
@export var fallback_visual_offset: Vector2 = Vector2.ZERO
@export var use_frame_boxes: bool = true

var _animations: Dictionary = {}
var _tuning_values: Dictionary = {}
var _scene_settings: Dictionary = {}
var _frame_visual_overrides: Dictionary = {}
var _frame_playback_overrides: Dictionary = {}
var _frame_box_overrides: Dictionary = {}
var _frame_audio_bindings: Dictionary = {}
var _frame_image_attachments: Dictionary = {}
var _texture_cache: Dictionary = {}
var _current_animation: String = ""
var _current_frame: int = 0
var _frame_clock: float = 0.0
var _runtime_ready: bool = false
var _animation_finished: bool = false
var _last_audio_key: String = ""
var _frame_visit_serial: int = 0
var _frame_audio_players: Array = []
var _frame_audio_cursor: int = 0
var _entered_hitbox_snapshots: Array = []

@onready var _visual_owner: Node2D = get_node_or_null("VisualOwner") as Node2D
@onready var _frame_sprite: Sprite2D = get_node_or_null("VisualOwner/FrameSprite") as Sprite2D
@onready var _attachments_below: Node2D = get_node_or_null("VisualOwner/AttachmentsBelow") as Node2D
@onready var _attachments_above: Node2D = get_node_or_null("VisualOwner/AttachmentsAbove") as Node2D
@onready var _body_collision: CollisionShape2D = get_node_or_null("CollisionShape2D") as CollisionShape2D
@onready var _hurtbox_area: Area2D = get_node_or_null("Hurtbox") as Area2D
@onready var _hurtbox_collision: CollisionShape2D = get_node_or_null("Hurtbox/CollisionShape2D") as CollisionShape2D
@onready var _hitbox_area: Area2D = get_node_or_null("Hitbox") as Area2D
@onready var _hitbox_collision: CollisionShape2D = get_node_or_null("Hitbox/CollisionShape2D") as CollisionShape2D
@onready var _frame_audio_player: AudioStreamPlayer = get_node_or_null("FrameAudioPlayer") as AudioStreamPlayer


func _ready() -> void:
	_ensure_runtime_nodes()
	_load_frame_runtime()
	if autoplay and _runtime_ready:
		play_frame_animation(frame_animation if frame_animation != "" else _first_animation_id(), loop_animation)


func _process(delta: float) -> void:
	if not _runtime_ready or _current_animation == "":
		return
	_frame_clock += delta
	while _frame_clock >= _current_frame_duration():
		_frame_clock -= _current_frame_duration()
		_current_frame += 1
		var frames: Array = _current_frames()
		if _current_frame >= frames.size():
			if loop_animation:
				_current_frame = 0
			else:
				_current_frame = max(0, frames.size() - 1)
				if not _animation_finished:
					_animation_finished = true
					animation_finished.emit(_current_animation)
		_frame_visit_serial += 1
		_record_entered_hitbox_snapshot()
		_play_current_frame_audio()
	_apply_frame_visual()


func play_frame_animation(animation_name: String, should_loop: bool = true, restart: bool = false) -> void:
	if not _animations.has(animation_name):
		return
	if _current_animation == animation_name and not restart:
		loop_animation = should_loop
		_apply_frame_visual()
		return
	_current_animation = animation_name
	_current_frame = 0
	_frame_clock = 0.0
	loop_animation = should_loop
	_animation_finished = false
	_last_audio_key = ""
	_entered_hitbox_snapshots.clear()
	_frame_visit_serial += 1
	_record_entered_hitbox_snapshot()
	_apply_frame_visual()


func restart_frame_animation(animation_name: String, should_loop: bool = true) -> void:
	play_frame_animation(animation_name, should_loop, true)


func animation_duration(animation_name: String) -> float:
	if not _animations.has(animation_name):
		return 0.0
	var animation: Dictionary = _animations.get(animation_name, {})
	var frames: Array = animation.get("frames", []) as Array
	var duration_units: float = 0.0
	for index in range(frames.size()):
		var playback: Dictionary = _frame_playback_overrides.get(_frame_key(animation_name, index), {})
		if playback.get("disabled", false) == true:
			continue
		var frame_value: Variant = frames[index]
		var frame_duration: float = 1.0
		if frame_value is Dictionary:
			frame_duration = float(frame_value.get("duration", 1.0))
		duration_units += maxf(0.001, float(playback.get("duration", frame_duration)))
	return maxf(0.001, duration_units / _animation_fps(animation_name))


func current_animation_duration() -> float:
	return animation_duration(_current_animation)


func scene_scale() -> float:
	return maxf(0.001, _scene_scale_for_current_scene())


func render_facing() -> int:
	var logical_facing: int = -1 if facing < 0 else 1
	var source_sign: int = -1 if source_faces_left else 1
	return logical_facing * source_sign


func current_box_enabled(box_name: String, fallback_enabled: bool = true) -> bool:
	var box: Dictionary = _current_box(box_name)
	return not box.is_empty() and _box_is_enabled(box, fallback_enabled)


func current_box_size(box_name: String, fallback: Vector2 = Vector2(40.0, 90.0), fallback_enabled: bool = true) -> Vector2:
	var box: Dictionary = _current_box(box_name)
	if box.is_empty() or not _box_is_enabled(box, fallback_enabled):
		return Vector2.ZERO
	var transform: Dictionary = _combined_visual_transform(_current_animation, _current_frame)
	var runtime_scale: float = _character_scale() * scene_scale()
	return _box_actor_size(box, transform, runtime_scale, fallback)


func current_box_position(box_name: String, fallback_enabled: bool = true) -> Vector2:
	var box: Dictionary = _current_box(box_name)
	if box.is_empty() or not _box_is_enabled(box, fallback_enabled):
		return Vector2.ZERO
	var transform: Dictionary = _combined_visual_transform(_current_animation, _current_frame)
	var runtime_scale: float = _character_scale() * scene_scale()
	return _box_actor_position(box, transform, runtime_scale)


func current_box_rotation_degrees(box_name: String, fallback_enabled: bool = true) -> float:
	var box: Dictionary = _current_box(box_name)
	if box.is_empty() or not _box_is_enabled(box, fallback_enabled):
		return 0.0
	var transform: Dictionary = _combined_visual_transform(_current_animation, _current_frame)
	return (float(transform.get("rotation", 0.0)) + float(box.get("rotation", 0.0))) * float(render_facing())


func current_collision_box_enabled() -> bool:
	return current_box_enabled("collisionbox")


func current_collision_box_size() -> Vector2:
	return current_box_size("collisionbox", Vector2(40.0, 90.0))


func current_collision_box_position() -> Vector2:
	var box: Dictionary = _current_box("collisionbox")
	if box.is_empty() or not _box_is_enabled(box):
		return Vector2.ZERO
	var transform: Dictionary = _combined_visual_transform(_current_animation, _current_frame)
	var runtime_scale: float = _character_scale() * scene_scale()
	return _collision_box_actor_position(box, transform, runtime_scale)


func current_grounded_collision_box_position() -> Vector2:
	return current_collision_box_position()


func current_collision_box_rotation_degrees() -> float:
	return 0.0


func current_hurtbox_enabled() -> bool:
	return current_box_enabled("hurtbox")


func current_hurtbox_size() -> Vector2:
	return current_box_size("hurtbox", Vector2(44.0, 90.0))


func current_hurtbox_position() -> Vector2:
	return current_box_position("hurtbox")


func current_hurtbox_rotation_degrees() -> float:
	return current_box_rotation_degrees("hurtbox")


func current_hitbox_enabled() -> bool:
	return current_box_enabled("hitbox", false)


func current_hitbox_size() -> Vector2:
	return current_box_size("hitbox", Vector2(80.0, 40.0), false)


func current_hitbox_position() -> Vector2:
	return current_box_position("hitbox", false)


func current_hitbox_rotation_degrees() -> float:
	return current_box_rotation_degrees("hitbox", false)


func consume_entered_hitbox_snapshots() -> Array:
	var snapshots: Array = _entered_hitbox_snapshots.duplicate(true)
	_entered_hitbox_snapshots.clear()
	return snapshots


func _scene_scale_for_current_scene() -> float:
	if _scene_settings.has("scale"):
		return float(_scene_settings.get("scale", 1.0))
	var scene_path: String = _current_scene_path()
	var settings: Dictionary = {}
	if scene_path != "":
		var scene_value: Variant = _scene_settings.get(scene_path, {})
		if scene_value is Dictionary:
			settings = scene_value
	if settings.is_empty():
		var default_value: Variant = _scene_settings.get("default", {})
		if default_value is Dictionary:
			settings = default_value
	return float(settings.get("scale", 1.0)) if not settings.is_empty() else 1.0


func _current_scene_path() -> String:
	var tree: SceneTree = get_tree()
	if tree != null:
		var current_scene: Node = tree.current_scene
		if current_scene != null and current_scene.scene_file_path != "":
			return current_scene.scene_file_path
	var node: Node = self
	while node != null:
		if node.scene_file_path != "":
			return node.scene_file_path
		node = node.get_parent()
	return ""


func _ensure_runtime_nodes() -> void:
	if _visual_owner == null:
		_visual_owner = Node2D.new()
		_visual_owner.name = "VisualOwner"
		add_child(_visual_owner)
	if _attachments_below == null:
		_attachments_below = Node2D.new()
		_attachments_below.name = "AttachmentsBelow"
		_visual_owner.add_child(_attachments_below)
	if _frame_sprite == null:
		_frame_sprite = Sprite2D.new()
		_frame_sprite.name = "FrameSprite"
		_visual_owner.add_child(_frame_sprite)
	if _attachments_above == null:
		_attachments_above = Node2D.new()
		_attachments_above.name = "AttachmentsAbove"
		_visual_owner.add_child(_attachments_above)
	if _body_collision == null:
		_body_collision = CollisionShape2D.new()
		_body_collision.name = "CollisionShape2D"
		add_child(_body_collision)
	if _hurtbox_area == null:
		_hurtbox_area = Area2D.new()
		_hurtbox_area.name = "Hurtbox"
		_hurtbox_area.monitoring = false
		_hurtbox_area.monitorable = true
		add_child(_hurtbox_area)
	if _hurtbox_collision == null:
		_hurtbox_collision = CollisionShape2D.new()
		_hurtbox_collision.name = "CollisionShape2D"
		_hurtbox_area.add_child(_hurtbox_collision)
	if _hitbox_area == null:
		_hitbox_area = Area2D.new()
		_hitbox_area.name = "Hitbox"
		add_child(_hitbox_area)
	if _hitbox_collision == null:
		_hitbox_collision = CollisionShape2D.new()
		_hitbox_collision.name = "CollisionShape2D"
		_hitbox_area.add_child(_hitbox_collision)
	if _frame_audio_player == null:
		_frame_audio_player = AudioStreamPlayer.new()
		_frame_audio_player.name = "FrameAudioPlayer"
		add_child(_frame_audio_player)
	_ensure_frame_audio_players()


func _ensure_frame_audio_players() -> void:
	_frame_audio_players.clear()
	if _frame_audio_player != null:
		_frame_audio_players.append(_frame_audio_player)
	for index in range(1, FRAME_AUDIO_POOL_SIZE):
		var player_name: String = "FrameAudioPlayer%d" % index
		var player: AudioStreamPlayer = get_node_or_null(player_name) as AudioStreamPlayer
		if player == null:
			player = AudioStreamPlayer.new()
			player.name = player_name
			add_child(player)
		_frame_audio_players.append(player)


func _load_frame_runtime() -> void:
	_animations.clear()
	_tuning_values.clear()
	_scene_settings.clear()
	_frame_visual_overrides.clear()
	_frame_playback_overrides.clear()
	_frame_box_overrides.clear()
	_frame_audio_bindings.clear()
	_frame_image_attachments.clear()
	_texture_cache.clear()
	_runtime_ready = false

	var data_dir: String = "res://xsxb_frame_tuner/data/projects/%s" % frame_project_id
	var manifest: Dictionary = _read_json_dict("%s/animation_manifest.json" % data_dir)
	var tuning: Dictionary = _read_json_dict("%s/animation_tuning.json" % data_dir)
	var profile: Dictionary = _select_profile(manifest)
	if profile.is_empty():
		return
	if frame_profile_id == "":
		frame_profile_id = String(profile.get("id", ""))
	_load_profile_animations(profile)
	_tuning_values = _dict_from(tuning.get("values", {}))
	_scene_settings = _dict_from(tuning.get("scene_settings", {}))
	_frame_visual_overrides = _dict_from(tuning.get("frame_visual_overrides", {}))
	_frame_playback_overrides = _dict_from(tuning.get("frame_playback_overrides", {}))
	_frame_box_overrides = _dict_from(tuning.get("frame_box_overrides", {}))
	_load_frame_audio_bindings("%s/frame_audio_bindings.json" % data_dir)
	_load_frame_image_attachments("%s/frame_image_attachments.json" % data_dir)
	_runtime_ready = not _animations.is_empty()


func _read_json_dict(file_path: String) -> Dictionary:
	if not FileAccess.file_exists(file_path):
		return {}
	var file: FileAccess = FileAccess.open(file_path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if parsed is Dictionary else {}


func _read_json_array(file_path: String) -> Array:
	if not FileAccess.file_exists(file_path):
		return []
	var file: FileAccess = FileAccess.open(file_path, FileAccess.READ)
	if file == null:
		return []
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if parsed is Array else []


func _dict_from(value: Variant) -> Dictionary:
	return value if value is Dictionary else {}


func _select_profile(manifest: Dictionary) -> Dictionary:
	var profiles: Array = manifest.get("profiles", []) as Array
	for profile_value in profiles:
		if profile_value is Dictionary and (frame_profile_id == "" or String(profile_value.get("id", "")) == frame_profile_id):
			return profile_value
	return {}


func _load_profile_animations(profile: Dictionary) -> void:
	var animations: Array = profile.get("animations", []) as Array
	for animation_value in animations:
		if not animation_value is Dictionary:
			continue
		var animation: Dictionary = animation_value
		var animation_id: String = String(animation.get("id", animation.get("name", "")))
		if animation_id == "":
			continue
		var frames: Array = []
		for frame_value in animation.get("frames", []) as Array:
			if not frame_value is Dictionary:
				continue
			var frame: Dictionary = frame_value
			var texture_path: String = _res_path(String(frame.get("path", "")))
			var texture: Texture2D = _load_texture(texture_path)
			if texture == null:
				continue
			frames.append({
				"texture": texture,
				"duration": float(frame.get("duration", 1.0)),
				"width": float(frame.get("width", texture.get_width())),
				"height": float(frame.get("height", texture.get_height())),
			})
		if frames.is_empty():
			continue
		_animations[animation_id] = {
			"fps": float(animation.get("fps", 12.0)),
			"anchor_mode": String(animation.get("anchorMode", "canvas_bottom_center")),
			"frames": frames,
		}


func _res_path(raw_path: String) -> String:
	if raw_path.begins_with("res://"):
		return raw_path
	return "res://%s" % raw_path.trim_prefix("/")


func _load_texture(file_path: String) -> Texture2D:
	if _texture_cache.has(file_path):
		var cached_texture: Texture2D = _texture_cache.get(file_path) as Texture2D
		if cached_texture != null:
			return cached_texture
	if ResourceLoader.exists(file_path, "Texture2D"):
		var texture: Texture2D = ResourceLoader.load(file_path, "Texture2D") as Texture2D
		if texture != null:
			_texture_cache[file_path] = texture
			return texture
	var disk_path: String = ProjectSettings.globalize_path(file_path) if file_path.begins_with("res://") else file_path
	var image: Image = Image.new()
	var error: int = image.load(disk_path)
	if error != OK:
		return null
	var image_texture: ImageTexture = ImageTexture.create_from_image(image)
	_texture_cache[file_path] = image_texture
	return image_texture


func _load_frame_audio_bindings(file_path: String) -> void:
	for binding_value in _read_json_array(file_path):
		if not binding_value is Dictionary:
			continue
		var binding: Dictionary = binding_value
		var key: String = _stable_binding_key(binding)
		var stream_path: String = _res_path(String(binding.get("path", binding.get("file", ""))))
		if key == "" or stream_path == "res://":
			continue
		var stream: AudioStream = ResourceLoader.load(stream_path, "AudioStream") as AudioStream
		if stream != null:
			_frame_audio_bindings[key] = stream


func _load_frame_image_attachments(file_path: String) -> void:
	for attachment_value in _read_json_array(file_path):
		if not attachment_value is Dictionary:
			continue
		var attachment: Dictionary = attachment_value
		var key: String = _stable_binding_key(attachment)
		if key == "":
			continue
		if not _frame_image_attachments.has(key):
			_frame_image_attachments[key] = []
		_frame_image_attachments[key].append(attachment)


func _stable_binding_key(binding: Dictionary) -> String:
	if binding.has("key"):
		return String(binding.get("key", ""))
	var animation: String = String(binding.get("animation", ""))
	var profile_id: String = String(binding.get("profileId", frame_profile_id))
	if animation != "" and not animation.contains("/"):
		animation = "%s/%s" % [profile_id, animation]
	if animation == "":
		return ""
	return "%s:%d" % [animation, int(binding.get("frame", 0))]


func _first_animation_id() -> String:
	for key in _animations.keys():
		return String(key)
	return ""


func _current_frames() -> Array:
	var animation: Dictionary = _animations.get(_current_animation, {})
	return animation.get("frames", []) as Array


func _current_frame_data() -> Dictionary:
	var frames: Array = _current_frames()
	if frames.is_empty():
		return {}
	return frames[clampi(_current_frame, 0, frames.size() - 1)] as Dictionary


func _current_frame_duration() -> float:
	var frame_data: Dictionary = _current_frame_data()
	if _frame_is_disabled(_current_animation, _current_frame):
		return 0.001
	var playback: Dictionary = _frame_playback_overrides.get(_frame_key(_current_animation, _current_frame), {})
	return maxf(0.001, float(playback.get("duration", frame_data.get("duration", 1.0))) / _animation_fps(_current_animation))


func _frame_is_disabled(animation_name: String, frame_index: int) -> bool:
	var playback: Dictionary = _frame_playback_overrides.get(_frame_key(animation_name, frame_index), {})
	return playback.get("disabled", false) == true


func _animation_fps(animation_name: String) -> float:
	var animation: Dictionary = _animations.get(animation_name, {})
	var group_playback: Dictionary = _frame_playback_overrides.get(_group_playback_key(animation_name), {})
	return maxf(0.001, float(group_playback.get("fps", animation.get("fps", 12.0))))


func _frame_key(animation_name: String, frame_index: int) -> String:
	return "%s/%s:%d" % [frame_profile_id, animation_name, frame_index]


func _group_playback_key(animation_name: String) -> String:
	return "%s/%s:__group" % [frame_profile_id, animation_name]


func _current_box(box_name: String) -> Dictionary:
	if _current_animation == "":
		return {}
	return _box_for_frame(_frame_key(_current_animation, _current_frame), box_name)


func _box_snapshot(box_name: String, fallback: Vector2, fallback_enabled: bool = true) -> Dictionary:
	var box: Dictionary = _current_box(box_name)
	if box.is_empty() or not _box_is_enabled(box, fallback_enabled):
		return {}
	var transform: Dictionary = _combined_visual_transform(_current_animation, _current_frame)
	var runtime_scale: float = _character_scale() * scene_scale()
	return {
		"position": _box_actor_position(box, transform, runtime_scale),
		"size": _box_actor_size(box, transform, runtime_scale, fallback),
		"rotation": (float(transform.get("rotation", 0.0)) + float(box.get("rotation", 0.0))) * float(render_facing()),
	}


func _record_entered_hitbox_snapshot() -> void:
	var snapshot: Dictionary = _box_snapshot("hitbox", Vector2(80.0, 40.0), false)
	if not snapshot.is_empty():
		_entered_hitbox_snapshots.append(snapshot)


func _apply_frame_visual() -> void:
	if _frame_sprite == null or _visual_owner == null:
		return
	var frame_data: Dictionary = _current_frame_data()
	var texture: Texture2D = frame_data.get("texture") as Texture2D
	if texture == null:
		return
	var animation: Dictionary = _animations.get(_current_animation, {})
	var frame_size: Vector2 = Vector2(float(frame_data.get("width", texture.get_width())), float(frame_data.get("height", texture.get_height())))
	var transform: Dictionary = _combined_visual_transform(_current_animation, _current_frame)
	var runtime_scale: float = _character_scale() * scene_scale()
	var sprite_scale_x: float = runtime_scale * float(transform.get("scale_x", 1.0))
	var sprite_scale_y: float = runtime_scale * float(transform.get("scale_y", 1.0))
	var visual_offset: Vector2 = transform.get("offset", Vector2.ZERO)
	var anchor: Vector2 = _source_anchor(String(animation.get("anchor_mode", "canvas_bottom_center")), frame_size)
	var render_facing_value: float = float(render_facing())

	_visual_owner.position = Vector2(
		(visual_offset.x * runtime_scale * render_facing_value) + ((frame_size.x * 0.5 - anchor.x) * sprite_scale_x * render_facing_value),
		(visual_offset.y * runtime_scale) + ((frame_size.y * 0.5 - anchor.y) * sprite_scale_y)
	)
	_visual_owner.scale = Vector2(render_facing_value * sprite_scale_x, sprite_scale_y)
	_visual_owner.rotation_degrees = float(transform.get("rotation", 0.0)) * render_facing_value
	_frame_sprite.texture = texture
	_frame_sprite.centered = true
	_frame_sprite.visible = true

	var frame_key: String = _frame_key(_current_animation, _current_frame)
	_play_current_frame_audio()
	_apply_frame_image_attachments(frame_key)
	if use_frame_boxes:
		_apply_frame_collision_box(frame_key, transform, runtime_scale)
		_apply_frame_hurtbox(frame_key, transform, runtime_scale)
		_apply_frame_hitbox(frame_key, transform, runtime_scale)


func _source_anchor(anchor_mode: String, frame_size: Vector2) -> Vector2:
	if anchor_mode == "canvas_left_bottom":
		return Vector2(0.0, frame_size.y)
	if anchor_mode == "canvas_bottom_center":
		return Vector2(frame_size.x * 0.5, frame_size.y)
	return Vector2(frame_size.x * 0.5, frame_size.y)


func _combined_visual_transform(animation_name: String, frame_index: int) -> Dictionary:
	var character_scale: float = _character_scale()
	var character_scale_vector: Vector2 = _scale_vector_from_value(_tuning_values.get("profiles.%s.character.visual_scale" % frame_profile_id, {}), Vector2(character_scale, character_scale))
	var axis: Vector2 = Vector2.ONE
	if character_scale != 0.0:
		axis = character_scale_vector / character_scale

	var group_base: String = "profiles.%s.groups.%s" % [frame_profile_id, animation_name]
	var group_scale: float = float(_tuning_values.get("%s.visual_size" % group_base, 1.0))
	var group_scale_vector: Vector2 = _scale_vector_from_value(_tuning_values.get("%s.visual_scale" % group_base, {}), Vector2(group_scale, group_scale))
	var group_offset: Vector2 = _vector_from_value(_tuning_values.get("%s.offset" % group_base, {}), Vector2.ZERO)
	var group_rotation: float = float(_tuning_values.get("%s.rotation" % group_base, 0.0))

	var frame_override: Dictionary = _frame_visual_overrides.get(_frame_key(animation_name, frame_index), {})
	if not frame_override.is_empty():
		group_scale = float(frame_override.get("visual_size", group_scale))
		group_scale_vector = _scale_vector_from_value(frame_override.get("visual_scale", {}), group_scale_vector)
		group_offset = _vector_from_value(frame_override.get("offset", group_offset), group_offset)
		group_rotation = float(frame_override.get("rotation", group_rotation))

	return {
		"scale_x": group_scale_vector.x * axis.x,
		"scale_y": group_scale_vector.y * axis.y,
		"offset": _character_offset() + group_offset,
		"rotation": _character_rotation() + group_rotation,
	}


func _character_scale() -> float:
	return maxf(0.001, float(_tuning_values.get("profiles.%s.character.visual_size" % frame_profile_id, fallback_visual_scale)))


func _character_offset() -> Vector2:
	return _vector_from_value(_tuning_values.get("profiles.%s.character.offset" % frame_profile_id, {}), fallback_visual_offset)


func _character_rotation() -> float:
	return float(_tuning_values.get("profiles.%s.character.rotation" % frame_profile_id, 0.0))


func _box_for_frame(frame_key: String, box_name: String) -> Dictionary:
	var entry: Variant = _frame_box_overrides.get(frame_key, {})
	if not entry is Dictionary:
		return {}
	var box: Variant = entry.get(box_name, {})
	return box if box is Dictionary else {}


func _box_is_enabled(box: Dictionary, fallback: bool = true) -> bool:
	return bool(box.get("enabled", fallback))


func _box_actor_position(box: Dictionary, transform: Dictionary, runtime_scale: float) -> Vector2:
	var visual_offset: Vector2 = transform.get("offset", Vector2.ZERO)
	var box_offset: Vector2 = _vector_from_value(box.get("offset", {}), Vector2.ZERO)
	var sprite_scale_x: float = runtime_scale * float(transform.get("scale_x", 1.0))
	var sprite_scale_y: float = runtime_scale * float(transform.get("scale_y", 1.0))
	var render_facing_value: float = float(render_facing())
	var anchor_offset: Vector2 = Vector2(visual_offset.x * runtime_scale * render_facing_value, visual_offset.y * runtime_scale)
	var local_offset: Vector2 = Vector2(box_offset.x * sprite_scale_x * render_facing_value, box_offset.y * sprite_scale_y)
	return anchor_offset + local_offset.rotated(deg_to_rad(float(transform.get("rotation", 0.0)) * render_facing_value))


func _collision_box_actor_position(box: Dictionary, transform: Dictionary, runtime_scale: float) -> Vector2:
	var box_position: Vector2 = _box_actor_position(box, transform, runtime_scale)
	var box_size: Vector2 = _box_actor_size(box, transform, runtime_scale, Vector2(40.0, 90.0))
	return Vector2(box_position.x, -box_size.y * 0.5)


func _box_actor_size(box: Dictionary, transform: Dictionary, runtime_scale: float, fallback: Vector2) -> Vector2:
	var size: Vector2 = _vector_from_value(box.get("size", {}), fallback)
	var sprite_scale_x: float = absf(runtime_scale * float(transform.get("scale_x", 1.0)))
	var sprite_scale_y: float = absf(runtime_scale * float(transform.get("scale_y", 1.0)))
	return Vector2(maxf(1.0, absf(size.x) * sprite_scale_x), maxf(1.0, absf(size.y) * sprite_scale_y))


func _ensure_rectangle_shape(collision: CollisionShape2D) -> RectangleShape2D:
	var rect_shape: RectangleShape2D = collision.shape as RectangleShape2D
	if rect_shape == null:
		rect_shape = RectangleShape2D.new()
		collision.shape = rect_shape
	return rect_shape


func _apply_frame_collision_box(frame_key: String, transform: Dictionary, runtime_scale: float) -> void:
	if _body_collision == null:
		return
	var box: Dictionary = _box_for_frame(frame_key, "collisionbox")
	if box.is_empty() or not _box_is_enabled(box):
		_body_collision.disabled = true
		return
	var rect_shape: RectangleShape2D = _ensure_rectangle_shape(_body_collision)
	rect_shape.size = _box_actor_size(box, transform, runtime_scale, Vector2(40.0, 90.0))
	_body_collision.position = _collision_box_actor_position(box, transform, runtime_scale)
	_body_collision.rotation_degrees = 0.0
	_body_collision.disabled = false


func _apply_frame_hurtbox(frame_key: String, transform: Dictionary, runtime_scale: float) -> void:
	if _hurtbox_area == null or _hurtbox_collision == null:
		return
	var box: Dictionary = _box_for_frame(frame_key, "hurtbox")
	if box.is_empty() or not _box_is_enabled(box):
		_hurtbox_area.monitorable = false
		_hurtbox_collision.disabled = true
		return
	var rect_shape: RectangleShape2D = _ensure_rectangle_shape(_hurtbox_collision)
	rect_shape.size = _box_actor_size(box, transform, runtime_scale, Vector2(44.0, 90.0))
	_hurtbox_collision.position = _box_actor_position(box, transform, runtime_scale)
	_hurtbox_collision.rotation_degrees = (float(transform.get("rotation", 0.0)) + float(box.get("rotation", 0.0))) * float(render_facing())
	_hurtbox_collision.disabled = false
	_hurtbox_area.monitorable = true


func _apply_frame_hitbox(frame_key: String, transform: Dictionary, runtime_scale: float) -> void:
	if _hitbox_area == null or _hitbox_collision == null:
		return
	var box: Dictionary = _box_for_frame(frame_key, "hitbox")
	if box.is_empty() or not _box_is_enabled(box, false):
		_hitbox_area.monitoring = false
		_hitbox_collision.disabled = true
		return
	var rect_shape: RectangleShape2D = _ensure_rectangle_shape(_hitbox_collision)
	rect_shape.size = _box_actor_size(box, transform, runtime_scale, Vector2(80.0, 40.0))
	_hitbox_collision.position = _box_actor_position(box, transform, runtime_scale)
	_hitbox_collision.rotation_degrees = (float(transform.get("rotation", 0.0)) + float(box.get("rotation", 0.0))) * float(render_facing())
	_hitbox_collision.disabled = false
	_hitbox_area.monitoring = true


func _play_frame_audio(frame_key: String) -> void:
	var trigger_key: String = "%s#%d" % [frame_key, _frame_visit_serial]
	if trigger_key == _last_audio_key:
		return
	_last_audio_key = trigger_key
	if not _frame_audio_bindings.has(frame_key):
		return
	var stream: AudioStream = _frame_audio_bindings.get(frame_key) as AudioStream
	if stream == null:
		return
	var player: AudioStreamPlayer = _next_frame_audio_player()
	if player == null:
		return
	player.stream = stream
	player.play()


func _next_frame_audio_player() -> AudioStreamPlayer:
	if _frame_audio_players.is_empty():
		return _frame_audio_player
	for offset in range(_frame_audio_players.size()):
		var index: int = (_frame_audio_cursor + offset) % _frame_audio_players.size()
		var player: AudioStreamPlayer = _frame_audio_players[index] as AudioStreamPlayer
		if player != null and not player.playing:
			_frame_audio_cursor = (index + 1) % _frame_audio_players.size()
			return player
	var fallback: AudioStreamPlayer = _frame_audio_players[_frame_audio_cursor] as AudioStreamPlayer
	_frame_audio_cursor = (_frame_audio_cursor + 1) % _frame_audio_players.size()
	return fallback


func _play_current_frame_audio() -> void:
	if _current_animation == "" or _frame_is_disabled(_current_animation, _current_frame):
		return
	_play_frame_audio(_frame_key(_current_animation, _current_frame))


func _apply_frame_image_attachments(frame_key: String) -> void:
	_clear_children(_attachments_below)
	_clear_children(_attachments_above)
	if not _frame_image_attachments.has(frame_key):
		return
	var attachments: Array = []
	for attachment_value in _frame_image_attachments.get(frame_key, []):
		if attachment_value is Dictionary:
			attachments.append(attachment_value)
	attachments.sort_custom(Callable(self, "_sort_frame_image_attachment"))
	for attachment_value in attachments:
		if attachment_value is Dictionary:
			_add_frame_image_attachment(attachment_value)


func _sort_frame_image_attachment(a: Variant, b: Variant) -> bool:
	var attachment_a: Dictionary = a if a is Dictionary else {}
	var attachment_b: Dictionary = b if b is Dictionary else {}
	return _frame_image_attachment_layer_order(attachment_a) < _frame_image_attachment_layer_order(attachment_b)


func _frame_image_attachment_layer_order(attachment: Dictionary) -> float:
	if attachment.has("layerOrder"):
		var order: float = float(attachment.get("layerOrder", 1.0))
		if absf(order) > 0.0001:
			return order
	return -1.0 if String(attachment.get("layer", "above")) == "below" else 1.0


func _add_frame_image_attachment(attachment: Dictionary) -> void:
	var image_path: String = _res_path(String(attachment.get("path", "")))
	var texture: Texture2D = _load_texture(image_path)
	if texture == null:
		return
	var sprite: Sprite2D = Sprite2D.new()
	sprite.texture = texture
	sprite.centered = true
	var local: Dictionary = attachment.get("transform", {}) if attachment.get("transform", {}) is Dictionary else {}
	sprite.position = _vector_from_value(local.get("offset", {}), Vector2.ZERO)
	sprite.scale = _scale_vector_from_value(local.get("visual_scale", local.get("scale", {})), Vector2.ONE)
	sprite.rotation_degrees = float(local.get("rotation", 0.0))
	var layer_order: float = _frame_image_attachment_layer_order(attachment)
	if layer_order < 0.0 and _attachments_below != null:
		_attachments_below.add_child(sprite)
	elif _attachments_above != null:
		_attachments_above.add_child(sprite)


func _clear_children(node: Node) -> void:
	if node == null:
		return
	for child in node.get_children():
		child.queue_free()


func _vector_from_value(value: Variant, fallback: Vector2) -> Vector2:
	if value is Dictionary:
		return Vector2(float(value.get("x", fallback.x)), float(value.get("y", fallback.y)))
	if value is Vector2:
		return value
	if typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT:
		return Vector2(float(value), float(value))
	return fallback


func _scale_vector_from_value(value: Variant, fallback: Vector2) -> Vector2:
	if value is Dictionary:
		var x: float = float(value.get("x", fallback.x))
		var y: float = float(value.get("y", fallback.y))
		if x == 0.0 and y == 0.0:
			return fallback
		return Vector2(maxf(0.001, x), maxf(0.001, y))
	if typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT:
		var scalar: float = maxf(0.001, float(value))
		return Vector2(scalar, scalar)
	return fallback
`;
}

function actorScene(projectId, target) {
  return `[gd_scene load_steps=5 format=3]

[ext_resource type="Script" path="res://xsxb_frame_tuner/runtime/xsxb_frame_actor.gd" id="1_script"]

[sub_resource type="RectangleShape2D" id="RectangleShape2D_body"]
size = Vector2(40, 90)

[sub_resource type="RectangleShape2D" id="RectangleShape2D_hurtbox"]
size = Vector2(44, 90)

[sub_resource type="RectangleShape2D" id="RectangleShape2D_hitbox"]
size = Vector2(80, 40)

[node name="XSXBFrameActor" type="CharacterBody2D"]
script = ExtResource("1_script")
frame_project_id = ${gdString(projectId)}
frame_profile_id = ${gdString(target.profileId)}
frame_animation = ${gdString(target.animationId)}

[node name="VisualOwner" type="Node2D" parent="."]

[node name="AttachmentsBelow" type="Node2D" parent="VisualOwner"]

[node name="FrameSprite" type="Sprite2D" parent="VisualOwner"]

[node name="AttachmentsAbove" type="Node2D" parent="VisualOwner"]

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
shape = SubResource("RectangleShape2D_body")

[node name="Hurtbox" type="Area2D" parent="."]
monitoring = false
monitorable = true

[node name="CollisionShape2D" type="CollisionShape2D" parent="Hurtbox"]
shape = SubResource("RectangleShape2D_hurtbox")

[node name="Hitbox" type="Area2D" parent="."]
monitoring = false
monitorable = false

[node name="CollisionShape2D" type="CollisionShape2D" parent="Hitbox"]
shape = SubResource("RectangleShape2D_hitbox")
disabled = true

[node name="FrameAudioPlayer" type="AudioStreamPlayer" parent="."]
`;
}

function testScene() {
  return `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://xsxb_frame_tuner/runtime/xsxb_frame_actor.tscn" id="1_actor"]

[node name="XSXBRuntimeTest" type="Node2D"]

[node name="XSXBFrameActor" parent="." instance=ExtResource("1_actor")]
position = Vector2(640, 640)
`;
}

function ensureGodotRuntime(root, project, options = {}) {
  const projectRoot = validGodotProjectRoot(project);
  if (!projectRoot) return { wroteRuntime: false, runtimeFiles: [] };
  const target = firstRuntimeTarget(options.manifest);
  const runtimeDir = path.join(projectRoot, GODOT_SYNC_ROOT, "runtime");
  const files = [
    {
      path: path.join(runtimeDir, "xsxb_frame_actor.gd"),
      content: runtimeScript(project.id),
    },
    {
      path: path.join(runtimeDir, "xsxb_frame_actor.tscn"),
      content: actorScene(project.id, target),
    },
    {
      path: path.join(runtimeDir, "xsxb_runtime_test.tscn"),
      content: testScene(),
    },
  ];
  const runtimeFiles = [];
  for (const file of files) {
    if (writeIfChanged(file.path, file.content)) {
      runtimeFiles.push(reslash(path.relative(projectRoot, file.path)));
    }
  }
  return {
    wroteRuntime: runtimeFiles.length > 0,
    runtimeFiles,
  };
}

module.exports = {
  ensureGodotRuntime,
  runtimeScript,
};
