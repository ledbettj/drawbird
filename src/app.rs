use std::{net::SocketAddr, sync::Arc, time::Duration};

use axum::{
  extract::{
    ws::{Message, WebSocket},
    State, WebSocketUpgrade,
  },
  response::IntoResponse,
  routing::{get, get_service},
  Router, Server,
};

use crate::{
  events::{ClientEvent, ServerEvent},
  room::RoomSet,
};
use futures::stream::StreamExt;
use futures::SinkExt;
use tokio::sync::Mutex;
use tower_http::services::{ServeDir, ServeFile};

pub struct App;

type AppState = Arc<Mutex<RoomSet>>;

impl App {
  pub async fn start(addr: &SocketAddr) {
    let index = get_service(ServeFile::new("./web/index.html"));
    let state = RoomSet::new();
    let app = Router::new()
      .route("/", index.clone())
      .route("/room/:room", index.clone())
      .route("/rooms/:room", index)
      .route("/api/rooms", get(App::room_list))
      .route("/ws", get(App::ws_handler))
      .with_state(Arc::new(Mutex::new(state)))
      .fallback(get_service(ServeDir::new("./web")));

    Server::bind(&addr)
      .serve(app.into_make_service())
      .await
      .expect("Failed to launch server!");
  }

  async fn room_list(State(state): State<AppState>) -> Vec<u8> {
    let s = state.lock().await;
    let rooms = s.rooms();
    println!("listing rooms");
    rmp_serde::to_vec(&rooms).unwrap()
  }

  async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(|socket| App::websocket(socket, state))
  }

  async fn websocket(stream: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = stream.split();
    let name = names::Generator::default().next().unwrap();
    let mut tx = None;
    let mut rx = None;
    let mut room_name = None;

    while let Some(Ok(Message::Binary(bin))) = receiver.next().await {
      let m = rmp_serde::from_slice::<ClientEvent>(&bin);
      if let Ok(ClientEvent::Join { id }) = m {
        let p = state.lock().await.find_or_create(&id).subscribe();
        println!("joined {}", id);
        room_name = Some(id);
        tx = Some(p.0);
        rx = Some(p.1);
        break;
      }
      return;
    }

    let tx = tx.unwrap();
    let mut rx = rx.unwrap();
    let room_name = room_name.unwrap();

    let _name = name.clone();
    let _room = room_name.clone();
    let _s = state.clone();
    let mut tx_task = tokio::spawn(async move {
      {
        let name_msg = ServerEvent::AssignedName { name: _name };
        let payload = rmp_serde::to_vec_named(&name_msg).unwrap();
        if sender.send(Message::Binary(payload)).await.is_err() {
          return;
        }
      }
      println!("name assigned");

      {
        if let Some(history) = _s.lock().await.get_history(&_room) {
          for h in history {
            let payload = rmp_serde::to_vec_named(&h).unwrap();
            if sender.send(Message::Binary(payload)).await.is_err() {
              return;
            }
          }
        }
      }

      while let Ok(msg) = rx.recv().await {
        println!("sending {:?}", msg);
        if sender
          .send(Message::Binary(rmp_serde::to_vec_named(&msg).unwrap()))
          .await
          .is_err()
        {
          break;
        }
      }
    });

    let mut rx_task = tokio::spawn(async move {
      while let Some(Ok(Message::Binary(blob))) = receiver.next().await {
        if let Ok(event) = rmp_serde::from_slice(&blob) {
          println!("received {:?}", event);

          match event {
            ClientEvent::Draw { points, style } => {
              let se = ServerEvent::Draw {
                points,
                user: name.clone(),
                style,
              };
              state.lock().await.record_history(&room_name, se.clone());
              tx.send(se).unwrap();
            }
            ClientEvent::Preview { points, style } => {
              tx.send(ServerEvent::Preview {
                points,
                user: name.clone(),
                style,
              })
              .unwrap();
            }
            ClientEvent::Erase => {
              state.lock().await.clear_history(&room_name);
              tx.send(ServerEvent::Erase { user: name.clone() }).unwrap();
            }
            m => {
              println!("unhandled message: {:?}", m);
            }
          };
        } else {
          println!("failed to deserialize: {:?}", blob);
        }
      }
    });

    tokio::select! {
      _ = (&mut tx_task) => rx_task.abort(),
      _ = (&mut rx_task) => tx_task.abort(),
    };
  }
}
