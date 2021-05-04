# node_service_adlib-backend

adlib-backend extracts, transforms and loads from an Adlib API into a database.
This database is then used by [eventstream-api](https://github.com/StadGent/node_service_eventstream-api) that exposes [event streams*](https://github.com/TREEcg/specification/tree/master/examples/eventstreams).

\* an event stream is a collection of versioned objects (a version is like an event) and can be updated anytime at their own pace (slow and fast data). This way, consumers can easily discover and harvest the latest changes.

## Install

```
git clone https://github.com/StadGent/node_service_adlib-backend.git
cd node_service_adlib-backend
npm install
```

## Configuration

Fill in `config.tml` with the password of the Adlib API you want to use.

adlib-backend uses an ORM (Sequelize) to support following databases: Postgres, MySQL, MariaDB, SQLite and Microsoft SQL Server.
Fill in the connection URI in `config.tml` of the database you want to use. For example: `'sqlite://./eventstream.db'` or `'postgresql://postgres:yourPassword@127.0.0.1:5432'` or `'postgresql://postgres:yourPassword@yourDockerContainer:5432'`

Adapt the block `[institution]` with the name (or abbreviation) of the institution that will have its data published and fill in:
* `institutionName` with the exact spelling (`institution.name` field) used in Adlib
* `institutionURI` with a URI of the organization

`[institution]` will be used as a subpath of the Web API.

Create a new `start` function inside `adlib2backend.js` for your dataset and adapt the option object so that the value of `institution` matches with `[institution]` of the configuration file.

## Run

### CLI

Run following command to start harvesting the Adlib API:

```
npm start
```

When no `Members` table exists in the database, it will create a new table.
When the table is empty, it will harvest all Adlib objects.
When the table is not empty (e.g. when you run it as a cronjob), it will look up when the last object was harvested and start fetching Adlib from that point on.

## Cronjob

You can configure in `config.tml` when to periodically run `app.js`.
Fill in `schedule` following the cron syntax, for example every day at midnight (`* * 0 * * *`)


## Clean data

If you want to clean up your database (e.g. you updated the mapping of the event stream), then you need to clean the Members table of the database manually.
This can be configured in the future if preferred.
