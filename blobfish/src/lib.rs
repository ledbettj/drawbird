use js_sys::Reflect;
use std::collections::VecDeque;
use std::panic;
use wasm_bindgen::{prelude::*, Clamped};
use web_sys::{CanvasRenderingContext2d, ImageData};

#[wasm_bindgen]
extern "C" {
  #[wasm_bindgen(js_namespace = console)]
  fn log(s: &str);
}

#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub struct Point {
  x: isize,
  y: isize,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct RGBA {
  r: u8,
  g: u8,
  b: u8,
  a: u8,
}

#[wasm_bindgen]
impl Point {
  #[wasm_bindgen(constructor)]
  pub fn new(x: isize, y: isize) -> Self {
    Point { x, y }
  }

  pub fn to_addr(&self, width: isize) -> usize {
    ((self.y * width + self.x) * 4) as usize
  }

  pub fn from_js_value(value: &JsValue, x_prop: &JsValue, y_prop: &JsValue) -> Self {
    Self {
      x: Reflect::get(value, x_prop)
        .unwrap()
        .as_f64()
        .unwrap() as isize,
      y: Reflect::get(value, y_prop)
        .unwrap()
        .as_f64()
        .unwrap() as isize,
    }
  }
}

impl RGBA {
  pub fn from_slice(slice: &[u8], index: usize) -> Self {
    Self {
      r: slice[index],
      g: slice[index + 1],
      b: slice[index + 2],
      a: slice[index + 3],
    }
  }

  pub fn try_from_str(color: &str) -> Option<Self> {
    if !color.starts_with("#") {
      return None;
    }

    let value = u32::from_str_radix(&color[1..], 16).ok();

    value.map(|v| Self {
      r: (v >> 16) as u8,
      g: (v >> 8) as u8,
      b: (v >> 0) as u8,
      a: 0xFF,
    })
  }

  pub fn equals_at_slice(&self, slice: &[u8], index: usize) -> bool {
    self.r == slice[index]
      && self.g == slice[index + 1]
      && self.b == slice[index + 2]
      && self.a == slice[index + 3]
  }
}

#[wasm_bindgen(start)]
pub fn setup() {
  panic::set_hook(Box::new(console_error_panic_hook::hook));
}

#[wasm_bindgen(js_name = strokeLine)]
pub fn stroke_line(
  ctx: CanvasRenderingContext2d,
  points: js_sys::Array,
  color: &JsValue,
  line_width: f64,
  badge: &JsValue,
) {
  if points.length() == 0 {
    return;
  }

  ctx.save();
  ctx.set_line_width(line_width);
  ctx.set_line_cap("round");
  ctx.set_line_join("round");
  ctx.set_stroke_style(color);
  ctx.set_fill_style(color);

  ctx.begin_path();

  let x_prop = JsValue::from_str("x");
  let y_prop = JsValue::from_str("y");

  let first = Point::from_js_value(&points.get(0), &x_prop, &y_prop);
  let last = Point::from_js_value(&points.get(points.length() - 1), &x_prop, &y_prop);

  ctx.move_to(first.x as f64, first.y as f64);

  if points.length() <= 3 {
    points.for_each(&mut |point, _index, _| {
      let point = Point::from_js_value(&point, &x_prop, &y_prop);
      ctx.line_to(point.x as f64, point.y as f64);
    });
  } else {
    for i in 1..(points.length() - 2) {
      let point = Point::from_js_value(&points.get(i), &x_prop, &y_prop);
      let next = Point::from_js_value(&points.get(i + 1), &x_prop, &y_prop);
      let xc = (point.x + next.x) as f64 / 2.0;
      let yc = (point.y + next.y) as f64 / 2.0;
      ctx.quadratic_curve_to(point.x as f64, point.y as f64, xc, yc);
    }
    let point = Point::from_js_value(&points.get(points.length() - 2), &x_prop, &y_prop);
    ctx.quadratic_curve_to(point.x as f64, point.y as f64, last.x as f64, last.y as f64);
  }

  ctx.stroke();

  if !badge.is_undefined() {
    let b = badge.as_string().unwrap();
    let _ = ctx.fill_text(&b, last.x as f64 + 10.0, last.y as f64 + 10.0);
  };

  ctx.close_path();
  ctx.restore();
}

#[wasm_bindgen(js_name = floodFill)]
pub fn flood_fill(ctx: CanvasRenderingContext2d, p: Point, color: &str) {
  let rgb = RGBA::try_from_str(color);

  if rgb.is_none() {
    return;
  }

  let fill_color = rgb.unwrap();
  let canvas = ctx.canvas().unwrap();
  let width = canvas.width() as isize;
  let height = canvas.height() as isize;

  let pixels = ctx
    .get_image_data(0.0, 0.0, canvas.width().into(), canvas.height().into())
    .unwrap();
  let mut pixel_data = pixels.data();
  let target_color = RGBA::from_slice(&pixel_data, p.to_addr(width));

  if target_color == fill_color {
    return;
  }

  let mut stack = VecDeque::new();

  stack.push_back(p);

  let offsets = [(-1, 0), (1, 0), (0, -1), (0, 1)];

  while let Some(next) = stack.pop_front() {
    let Point { x, y } = next;
    let addr = next.to_addr(width);

    if target_color.equals_at_slice(&pixel_data, addr) {
      pixel_data[addr] = fill_color.r;
      pixel_data[addr + 1] = fill_color.g;
      pixel_data[addr + 2] = fill_color.b;
      pixel_data[addr + 3] = fill_color.a;

      offsets
        .iter()
        .map(|(dx, dy)| Point::new(x + dx, y + dy))
        .filter(|p| p.x >= 0 && p.x < width && p.y >= 0 && p.y < height)
        .for_each(|p| stack.push_back(p));
    }
  }
  let data = ImageData::new_with_u8_clamped_array_and_sh(
    Clamped(&pixel_data.0),
    width as u32,
    height as u32,
  )
  .unwrap();
  let _ = ctx.put_image_data(&data, 0.0, 0.0);
}
