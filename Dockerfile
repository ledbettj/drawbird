FROM rust:latest as rustbuilder

WORKDIR /usr/src/app
COPY . .

# Will build and cache the binary and dependent crates in release mode
RUN --mount=type=cache,target=/usr/local/cargo,from=rust:latest,source=/usr/local/cargo \
    --mount=type=cache,target=target \
    cargo build --release && mv ./target/release/drawbird ./drawbird

FROM node:20.4.0-slim as nodebuilder

WORKDIR /usr/src/app

COPY peacock .

RUN yarn install
RUN yarn build


FROM debian:bullseye-slim

RUN useradd -ms /bin/bash app

USER app
WORKDIR /app

COPY --from=rustbuilder /usr/src/app/drawbird /app/drawbird
COPY --from=nodebuilder /usr/src/app/build /app/web

EXPOSE 3500

CMD /app/drawbird
