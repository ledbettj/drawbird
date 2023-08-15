use std::net::SocketAddr;

use serde::{Deserialize, Serialize};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "event")]
enum ClientEvent {
  Join { id: String },
}

mod app;
mod events;
mod room;

use app::App;

#[tokio::main]
async fn main() {
  tracing_subscriber::registry()
    .with(tracing_subscriber::EnvFilter::from_env("LOG"))
    .with(tracing_subscriber::fmt::layer())
    .init();

  let addr = SocketAddr::from(([0, 0, 0, 0], 3500));
  App::start(&addr).await;
}
