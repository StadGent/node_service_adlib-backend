# Adlib backend

The adlib-backend extracts, transforms and loads from an Adlib API into a database.
This database is then used by [eventstream-api](https://github.com/StadGent/node_service_eventstream-api) that exposes [event streams*](https://github.com/TREEcg/specification/tree/master/examples/eventstreams).

\* an event stream is a collection of versioned objects (a version is like an event) and can be updated anytime at their own pace (slow and fast data). This way, consumers can easily discover and harvest the latest changes.

## Prerequisites

This project requires the [installation of a redis memory store](https://redis.io/docs/getting-started/installation/).

```
docker pull redis
docker run --rm --name local-redis -p 6379:6379 -d redis
```

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

## How to add a mapping

1) Add a new block to `config.tml` with the abbrevation of the institution/dataset, for example ['dmg'] with dmg = Design Museum Ghent.
This abbreviation will be used for the creation of URIs and as namespace for the event stream in the Web API. Fill in:
* `institutionName` with the exact spelling (`institution.name` field) used in Adlib
* `institutionURI` with a URI of the organization

2) Create a new `start...` function inside `app.js` for your dataset/institution. Copy one of the start functions (e.g. `startDmg`) and rename it with your abbreviation.
3) Add the new `start...` function inside the `start` function of `app.js` 
4) Adapt the option object so that the value of `institution` matches with abbreviation used in the configuration file.
5) Adapt the option object so that the value of `adlibDatabase` matches with the database name in Adlib that needs to be harvested
6) Adapt the option object so that the value of `checkEuropeanaFlag` whether the `EUROPEANA` field of a record needs to be "checked" in order to be published.
7) Create a specific mapper (for example: `TestMapper.js`) in the folder `mappers` for your dataset. Copy (e.g. `dmgMapper.js`) and rename an existing mapper to do this.
8) Import your mapper in `app.js` by adding an import statement, for example `import TestMapper from './lib/mappers/TestMapper';` Also, rename the mapper in the `start...` function
9) To add new mapping functions for your mapper, create a new function in `mappers/utils.js` in a similar way as the existing functions.

## Run

### CLI

Run following command to start harvesting the Adlib API:

```
npm start
```

By running with the NPM command above, versioning is enabled by default using environment variable `npm_package_version` created from `package.json`.
If you want to run with `node app.js`,then you need to manually set environment variable `npm_package_version` to enable versioning:
```
npm_package_version=0.0.1 node app.js
```

When `npm_package_version` is not defined, then the `Members` table will be emptied and all objects from Adlib will be harvested again.
When `npm_package_version` is updated, all objects from Adlib will be harvested BUT the already harvested objects will still be maintained (append to the event stream).

## Cronjob

You can configure in `config.tml` when to periodically run `app.js`.
Fill in `schedule` following the cron syntax, for example every day at midnight (`0 0 * * *`)


## Clean data

If you want to clean up your database (e.g. you updated the mapping of the event stream), then you need to clean the Members table of the database manually.

This can be configured in the future if preferred.
