use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use serde::{Serialize, Deserialize};

pub(crate) use axum::{
  extract::{
    ws::{Message, WebSocket},
    WebSocketUpgrade,
    State,
  },
  response::IntoResponse,
  routing::{get, get_service},
  Router, Server,
};
use futures::SinkExt;
use futures::stream::StreamExt;
use tokio::sync::broadcast;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use tower_http::services::{ServeDir, ServeFile};

struct Room {
  name: String,
  events: Vec<Event>,
  tx: broadcast::Sender<Event>,
}

struct RoomSet {
  rooms: HashMap<String, Room>,
}


#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "event")]
enum Event {
  Join { id: String }
}

type AppState = Arc<Mutex<RoomSet>>;

#[tokio::main]
async fn main() {
  tracing_subscriber::registry()
    .with(tracing_subscriber::EnvFilter::from_env("LOG"))
    .with(tracing_subscriber::fmt::layer())
    .init();

  let app_state = Arc::new(Mutex::new(RoomSet { rooms: HashMap::new() }));

  let addr = SocketAddr::from(([127, 0, 0, 1], 3500));
  let index = get_service(ServeFile::new("./app/index.html"));
  let app = Router::new()
    .route("/", index.clone())
    .route("/room/:room", index)
    .route("/ws", get(ws_handler))
    .fallback(get_service(ServeDir::new("./app")))
    .with_state(app_state);

  Server::bind(&addr)
    .serve(app.into_make_service())
    .await
    .expect("Failed to launch server!");
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
  ws.on_upgrade(|socket| websocket(socket, state))
}

async fn websocket(stream: WebSocket, state: AppState) {
  let (mut sender, mut receiver) = stream.split();

  let mut rx = None;

  while let Some(Ok(msg)) = receiver.next().await {
    if let Message::Text(payload) = msg {
      if let Ok(Event::Join { id }) = serde_json::from_str(&payload) {
        let mut rooms = state.lock().unwrap();
        let (ctx, _crx) = broadcast::channel(256);
        let entry = rooms
          .rooms
          .entry(id.clone())
          .or_insert(Room { name: id.clone(), events: vec![], tx: ctx });

        rx = Some(entry.tx.subscribe());
      }
      break;
    } else {
      break;
    }
  };

  if rx.is_none() {
    return
  }

  let mut rx = rx.unwrap();

  let mut tx_task = tokio::spawn(async move {
    while let Ok(msg) = rx.recv().await {
      if sender.send(Message::Text(serde_json::to_string(&msg).unwrap())).await.is_err() {
        break;
      }
    }
  });

  let mut rx_task = tokio::spawn(async move {
    while let Some(Ok(Message::Text(text))) = receiver.next().await {
      if let Ok(event) = serde_json::from_str::<Event>(&text) {
        match event {
          Event::Join { id } => println!("JOIN={}", id),
        };
      }
    }
  });

  tokio::select! {
    _ = (&mut tx_task) => rx_task.abort(),
    _ = (&mut rx_task) => tx_task.abort(),
  };
}
