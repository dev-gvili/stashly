# PgBouncer for Stashly — deployed as a standalone Fly.io app that fronts
# Postgres with transaction pooling. Config is supplied entirely through
# environment variables / Fly secrets (see fly.toml + README.md), so no
# credentials live in the image.
#
# edoburu/pgbouncer generates pgbouncer.ini + userlist.txt from env at start.
# Pin to a current tag — check https://hub.docker.com/r/edoburu/pgbouncer/tags
FROM edoburu/pgbouncer:v1.23.1-p3

# Transaction pooling listens here; reached privately at
# stashly-pgbouncer.flycast:6432 (never published to the internet).
EXPOSE 6432
