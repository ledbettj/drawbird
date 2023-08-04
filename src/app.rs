use std::{net::SocketAddr, sync::Arc};

use axum::{
  extract::{
    ws::{Message, WebSocket},
    ConnectInfo, State, WebSocketUpgrade,
  },
  response::IntoResponse,
  routing::{get, get_service},
  Router, Server,
};
use futures::stream::StreamExt;
use futures::SinkExt;
use tokio::sync::Mutex;
use tower_http::services::{ServeDir, ServeFile};
use tracing::{debug, error, info};

use crate::{
  events::{ClientEvent, ServerEvent},
  room::RoomSet,
};

pub struct App;

type AppState = Arc<Mutex<RoomSet>>;

const BIRDS: &[&str] = &include_lines::include_lines!("birds.txt");

impl App {
  pub async fn start(addr: &SocketAddr) {
    let index = get_service(ServeFile::new("./web/index.html"));
    let state = RoomSet::new();
    let app = Router::new()
      .route("/", index.clone())
      .route("/room/:room", index.clone())
      .route("/rooms/:room", index)
      .route("/ws", get(App::ws_handler))
      .with_state(Arc::new(Mutex::new(state)))
      .fallback(get_service(ServeDir::new("./web")));

    info!("Server starting on {:?}", addr);

    Server::bind(&addr)
      .serve(app.into_make_service_with_connect_info::<SocketAddr>())
      .await
      .expect("Failed to launch server!");
  }

  async fn ws_handler(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<AppState>,
  ) -> impl IntoResponse {
    info!("{:?} websocket connection initiated", addr);
    ws.on_upgrade(move |socket| App::websocket(socket, state, addr))
  }

  async fn websocket(stream: WebSocket, state: AppState, addr: SocketAddr) {
    let (mut sender, mut receiver) = stream.split();
    let name = names::Generator::new(names::ADJECTIVES, BIRDS, names::Name::Plain)
      .next()
      .unwrap();
    let mut tx = None;
    let mut rx = None;
    let mut room_name = None;

    while let Some(Ok(Message::Binary(bin))) = receiver.next().await {
      let m = rmp_serde::from_slice::<ClientEvent>(&bin);
      if let Ok(ClientEvent::Join { id }) = m {
        let p = state.lock().await.find_or_create(&id).subscribe();
        info!("{:?} joined room '{}'", addr, id);
        room_name = Some(id);
        tx = Some(p.0);
        rx = Some(p.1);
        break;
      }
      info!("{:?} failed to join, disconnecting.", addr);
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
        let name_msg = ServerEvent::AssignedName {
          name: _name.clone(),
        };
        let payload = rmp_serde::to_vec_named(&name_msg).unwrap();
        if sender.send(Message::Binary(payload)).await.is_err() {
          return;
        }
      }
      info!("{:?} assigned name: '{}'", addr, _name);
      {
        if let Some(history) = _s.lock().await.get_history(&_room) {
          for h in history {
            let payload = rmp_serde::to_vec_named(&h).unwrap();
            if sender.send(Message::Binary(payload)).await.is_err() {
              info!("{:?} [{}] could not send, disconnecting", addr, _name);
              return;
            }
          }
        }
        info!(
          "{:?} [{}] replayed room history for '{}'",
          addr, _name, _room
        );
      }

      while let Ok(msg) = rx.recv().await {
        debug!("{:?} [{}] sending {:?}", addr, _name, msg);

        if sender
          .send(Message::Binary(rmp_serde::to_vec_named(&msg).unwrap()))
          .await
          .is_err()
        {
          info!("{:?} [{}] could not send, disconnecting", addr, _name);
          break;
        }
      }
    });

    let mut rx_task = tokio::spawn(async move {
      while let Some(Ok(Message::Binary(blob))) = receiver.next().await {
        if let Ok(event) = rmp_serde::from_slice(&blob) {
          debug!("{:?} [{}] sent {:?}", addr, name, event);

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
              error!("{:?} [{}] sent unhandled message: {:?}", addr, name, m);
            }
          };
        } else {
          error!("{:?} [{}] sent unknown message: {:?}", addr, name, blob);
        }
      }
    });

    tokio::select! {
      _ = (&mut tx_task) => rx_task.abort(),
      _ = (&mut rx_task) => tx_task.abort(),
    };

    info!("{:?} disconnected", addr);
  }
}
