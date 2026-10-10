# stashly-postgres with pgvector added. Stashly's migrations run
# `CREATE EXTENSION vector`, and the stock flyio/postgres-flex image lacks it
# (it ships postgres, contrib, repmgr and PostGIS only).
#
# PG_FLEX_TAG must be the tag the cluster already runs (`fly image show --app
# stashly-postgres`): a different Postgres major can't open the existing data
# volume. postgres-flex is Ubuntu 24.04 with the apt.postgresql.org repository
# already configured, so pgvector is the package for the tag's major (18.1 ->
# postgresql-18-pgvector): no compiler in the image.
ARG PG_FLEX_TAG
FROM flyio/postgres-flex:${PG_FLEX_TAG}
ARG PG_FLEX_TAG
RUN apt-get update \
  && apt-get install -y --no-install-recommends "postgresql-${PG_FLEX_TAG%%.*}-pgvector" \
  && rm -rf /var/lib/apt/lists/*
