shader_type canvas_item;
render_mode unshaded, blend_mix;

uniform sampler2D trail_texture : source_color, filter_linear_mipmap, repeat_disable;
uniform sampler2D trail_gradient : source_color, filter_linear, repeat_disable;
uniform vec4 trail_color : source_color = vec4(0.85, 0.15, 0.22, 1.0);
uniform bool use_original_color = false;
uniform bool use_gradient = false;
uniform float alpha_gain : hint_range(0.0, 3.0, 0.01) = 1.0;
uniform float tail_fade_start : hint_range(0.0, 0.95, 0.01) = 0.6;

void fragment() {
	vec4 source = texture(trail_texture, UV);
	if (use_original_color) {
		COLOR = source;
	} else {
		float luma = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
		float detail = mix(0.52, 1.0, luma);
		// The editor's gradient runs left-to-right as texture bottom-to-top.
		vec4 tint = use_gradient ? texture(trail_gradient, vec2(1.0 - UV.y, 0.5)) : trail_color;
		COLOR = vec4(tint.rgb * detail, tint.a * source.a * clamp(luma * alpha_gain, 0.0, 1.0));
	}
	float fade_u = clamp((UV.x - tail_fade_start) / max(0.001, 1.0 - tail_fade_start), 0.0, 1.0);
	float tail_alpha = 1.0 - pow(fade_u, 2.2);
	COLOR.a *= tail_alpha;
}
