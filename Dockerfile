FROM lukemathwalker/cargo-chef:latest-rust-1 AS chef

WORKDIR /usr/src/app

FROM chef as planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef as builder
COPY --from=planner /usr/src/app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release

FROM node:20.4.0-slim as nodebuilder

WORKDIR /usr/src/app

COPY peacock .

RUN yarn install
RUN yarn build


FROM debian:bullseye-slim AS runtime

RUN useradd -ms /bin/bash app

USER app
WORKDIR /app

COPY --from=builder /usr/src/app/target/release/drawbird /app/drawbird
COPY --from=nodebuilder /usr/src/app/build /app/web

EXPOSE 3500

ENTRYPOINT ["/app/drawbird"]

