use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Point {
  pub x: usize,
  pub y: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Style {
  pub color: String,
  pub line_width: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum ClientEvent {
  Join { id: String },
  Draw { points: Vec<Point>, style: Style },
  Preview { points: Vec<Point>, style: Style },
  Erase,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum ServerEvent {
  AssignedName {
    name: String,
  },
  Draw {
    user: String,
    points: Vec<Point>,
    style: Style,
  },
  Preview {
    user: String,
    points: Vec<Point>,
    style: Style,
  },
  Erase {
    user: String,
  },
}
