use std::collections::HashMap;
use tokio::sync::broadcast;

use crate::events::ServerEvent;

#[derive(Debug)]
pub struct Room {
  tx: broadcast::Sender<ServerEvent>,
}

pub struct RoomSet {
  rooms: HashMap<String, Room>,
}

impl Room {
  pub fn new() -> Self {
    let (tx, _) = broadcast::channel(256);
    Self { tx }
  }

  pub fn subscribe(
    &self,
  ) -> (
    broadcast::Sender<ServerEvent>,
    broadcast::Receiver<ServerEvent>,
  ) {
    (self.tx.clone(), self.tx.subscribe())
  }
}

impl RoomSet {
  pub fn new() -> Self {
    Self {
      rooms: HashMap::new(),
    }
  }

  pub fn find_or_create(&mut self, name: &str) -> &Room {
    self.rooms.entry(name.into()).or_insert_with(|| Room::new())
  }
}
