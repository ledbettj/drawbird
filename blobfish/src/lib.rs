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

fn color_rgb(color: &str) -> Option<RGBA> {
  if !color.starts_with("#") {
    return None;
  }

  let value = u32::from_str_radix(&color[1..], 16).ok();

  value.map(|v| RGBA {
    r: (v >> 16) as u8,
    g: (v >> 8) as u8,
    b: (v >> 0) as u8,
    a: 0xFF,
  })
}

fn point_to_addr(p: &Point, width: isize) -> usize {
  ((p.y * width + p.x) * 4) as usize
}

#[wasm_bindgen]
pub fn flood_fill(ctx: CanvasRenderingContext2d, p: Point, color: &str) {
  let rgb = color_rgb(color);
  log(&format!("Filling at {:?}", p));
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
  let target_color = RGBA::from_slice(&pixel_data, point_to_addr(&p, width));

  if target_color == fill_color {
    return;
  }

  let mut stack = VecDeque::new();

  stack.push_back(p);

  let offsets = [(-1, 0), (1, 0), (0, -1), (0, 1)];

  while let Some(next) = stack.pop_front() {
    let Point { x, y } = next;
    let addr = point_to_addr(&next, width);

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
