# stashly-postgres with pgvector added. Stashly's migrations run
# `CREATE EXTENSION vector`, and the stock flyio/postgres-flex image lacks it
# (it ships postgres, contrib, repmgr and PostGIS only).
#
# PG_FLEX_TAG must be the tag the cluster already runs (`fly image show --app
# stashly-postgres`): a different Postgres major can't open the existing data
# volume. postgres-flex is Ubuntu 24.04 with the apt.postgresql.org repository
# already configured and PG_MAJOR_VERSION set, so pgvector is a package matched
# to that major: no compiler in the image.
ARG PG_FLEX_TAG
FROM flyio/postgres-flex:${PG_FLEX_TAG}
RUN apt-get update \
  && apt-get install -y --no-install-recommends "postgresql-${PG_MAJOR_VERSION}-pgvector" \
  && rm -rf /var/lib/apt/lists/*
