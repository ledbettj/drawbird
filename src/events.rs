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
  Join { uuid: String, id: String,  },
  Draw { uuid: String, points: Vec<Point>, style: Style },
  Preview { uuid: String, points: Vec<Point>, style: Style },
  Hover { uuid: String, point: Point },
  Erase { uuid: String },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum ServerEvent {
  AssignedName {
    name: String,
  },
  Draw {
    uuid: String,
    user: String,
    points: Vec<Point>,
    style: Style,
  },
  Preview {
    uuid: String,
    user: String,
    points: Vec<Point>,
    style: Style,
  },
  Hover {
    uuid: String,
    user: String,
    point: Point,
  },
  Erase {
    uuid: String,
    user: String,
  },
  Connect {
    user: String,
  },
  Disconnect {
    user: String,
  },
}


impl ServerEvent {
  pub fn from(value: ClientEvent, user: &str) -> Self {
    match value {
      ClientEvent::Join { .. } => ServerEvent::Connect { user: user.to_string() },
      ClientEvent::Draw { uuid, points, style } => ServerEvent::Draw { uuid, points, style, user: user.to_string() },
      ClientEvent::Preview { uuid, points, style } => ServerEvent::Preview { uuid, points, style, user: user.to_string() },
      ClientEvent::Hover { uuid, point } => ServerEvent::Hover { uuid, point, user: user.to_string() },
      ClientEvent::Erase { uuid } => ServerEvent::Erase { uuid, user: user.to_string() },
    }
  }
}
