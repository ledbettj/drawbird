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
use tokio::sync::{
  mpsc::{unbounded_channel, UnboundedSender},
  Mutex
};
use tower_http::services::{ServeDir, ServeFile};
use tracing::{debug, error, info};

use crate::{
  events::{ClientEvent, ServerEvent},
  room::RoomSet,
};

use redis::AsyncCommands;

pub struct App;

struct AppState {
  rooms: Mutex<RoomSet>,
  hist_tx: UnboundedSender<(String, ServerEvent)>,
}

const BIRDS: &[&str] = &include_lines::include_lines!("birds.txt");

impl App {
  pub async fn start(addr: &SocketAddr) {
    let index = get_service(ServeFile::new("./web/index.html"));
    let (hist_tx, mut hist_rx) = unbounded_channel::<(String, ServerEvent)>();
    let state = Arc::new(AppState {
      rooms: Mutex::new(RoomSet::new()),
      hist_tx,
    });

    let app = Router::new()
      .route("/", index.clone())
      .route("/room/:room", index.clone())
      .route("/rooms/:room", index)
      .route("/ws", get(App::ws_handler))
      .with_state(state.clone())
      .fallback(get_service(ServeDir::new("./web")));

    info!("Server starting on {:?}", addr);

    let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL missing!");
    let client = redis::Client::open(redis_url).expect("Failed to connect to redis!");

    tokio::spawn(async move {
      while let Some((room, event)) = hist_rx.recv().await {
        let mut con = client
          .get_async_connection()
          .await
          .expect("Failed to get connection");
        debug!("received history {:?}, {:?}", room, event);

        if let ServerEvent::Erase { .. } = event {
          let _: () = con.del(&room).await.unwrap();
        } else {
          let _: () = con.rpush(&room, &event).await.unwrap();
          let _: () = con.expire(&room, 60 * 60 * 24 * 7).await.unwrap();
        }
      }
    });

    Server::bind(&addr)
      .serve(app.into_make_service_with_connect_info::<SocketAddr>())
      .await
      .expect("Failed to launch server!");
  }

  async fn ws_handler(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
  ) -> impl IntoResponse {
    info!("{:?} websocket connection initiated", addr);
    ws.on_upgrade(move |socket| App::websocket(socket, state, addr))
  }

  async fn websocket(stream: WebSocket, state: Arc<AppState>, addr: SocketAddr) {
    let (mut sender, mut receiver) = stream.split();
    let name = names::Generator::new(names::ADJECTIVES, BIRDS, names::Name::Plain)
      .next()
      .unwrap();
    let mut tx = None;
    let mut rx = None;
    let mut room_name = None;

    while let Some(Ok(Message::Binary(bin))) = receiver.next().await {
      let m = rmp_serde::from_slice::<ClientEvent>(&bin);
      if let Ok(ClientEvent::Join { id, .. }) = m {
        let p = state.rooms.lock().await.find_or_create(&id).subscribe();
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
    let misc_tx = tx.clone();
    let final_tx = tx.clone();
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
        let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL missing!");
        let client = redis::Client::open(redis_url).expect("Failed to connect to redis!");
        let mut con = client
          .get_async_connection()
          .await
          .expect("Failed to get redis connection");
        let history: Vec<ServerEvent> = con.lrange(&_room, 0, -1).await.unwrap();
        for h in history {
          let payload = rmp_serde::to_vec_named(&h).unwrap();
          if sender.send(Message::Binary(payload)).await.is_err() {
            info!("{:?} [{}] could not send, disconnecting", addr, _name);
            return;
          }
        }
        info!(
          "{:?} [{}] replayed room history for '{}'",
          addr, _name, _room
        );
      }

      misc_tx
        .send(ServerEvent::Connect {
          user: _name.clone(),
        })
        .unwrap();

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

    let again_name = name.clone();
    let mut rx_task = tokio::spawn(async move {
      while let Some(Ok(Message::Binary(blob))) = receiver.next().await {
        if let Ok(event) = rmp_serde::from_slice(&blob) {
          debug!("{:?} [{}] sent {:?}", addr, name, event);

          match event {
            ClientEvent::Draw { .. } | ClientEvent::Fill { .. } | ClientEvent::Erase { .. } => {
              let se = ServerEvent::from(event, &name);
              state.hist_tx.send((room_name.clone(), se.clone())).unwrap();
              tx.send(se).unwrap();
            }
            ClientEvent::Preview { .. } | ClientEvent::Hover { .. } => {
              let se = ServerEvent::from(event, &name);
              tx.send(se).unwrap();
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

    final_tx
      .send(ServerEvent::Disconnect {
        user: again_name.clone(),
      })
      .unwrap();
    info!("{:?} disconnected", addr);
  }
}
