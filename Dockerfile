FROM lukemathwalker/cargo-chef:latest-rust-1 AS chef

WORKDIR /usr/src/app

FROM chef as planner
COPY turkey .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef as builder
COPY --from=planner /usr/src/app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY turkey .
COPY birds.txt .
RUN cargo build --release

FROM chef as blobfish
COPY blobfish .
RUN cargo install wasm-pack
RUN wasm-pack build --release --target web

FROM node:20.4.0-slim as nodebuilder

WORKDIR /usr/src/app

COPY peacock .
COPY --from=blobfish /usr/src/app/pkg public/pkg
RUN yarn install
RUN yarn build


FROM debian:bullseye-slim AS runtime

RUN useradd -ms /bin/bash app

USER app
WORKDIR /app

COPY --from=builder /usr/src/app/target/release/drawbird /app/drawbird
COPY --from=nodebuilder /usr/src/app/build /app/web
COPY --from=blobfish /usr/src/app/pkg /app/web/pkg

EXPOSE 3500

ENTRYPOINT ["/app/drawbird"]

