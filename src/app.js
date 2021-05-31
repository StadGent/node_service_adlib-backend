import Adlib from './lib/adlib.js';
import DmgMapper from './lib/mappers/dmgMapper';
import StamMapper from './lib/mappers/stamMapper';
import HvAMapper from "./lib/mappers/hvaMapper";
import ArchiefGentMapper from "./lib/mappers/archiefGentMapper";
import IndustriemuseumMapper from "./lib/mappers/IndustriemuseumMapper";
import TermenMapper from "./lib/mappers/termenMapper";
import Backend from "./lib/Backend";
import Utils from './lib/utils.js';
import Config from "./config/config.js";
import correlator from "correlation-id";
import http from 'http';
import createError from 'http-errors';
import path from 'path';
import correlatorExpress from 'express-correlation-id';
import express from 'express';

const config = Config.getConfig();

var server;

let sequelize;

const cron = require('node-cron');

start();
startHealthcheckAPI();

cron.schedule(config.adlib.schedule, start);

async function start() {
    correlator.withId(async () => {
        Utils.log("Starting", "adlib-backend/lib/app.js:start", "INFO", correlator.getId());

        sequelize = await Utils.initDb(correlator);

        startHva();
        startDmg();
        startIndustriemuseum();
        //startArchiefgent();
        startStam();

        startThesaurus();
        startPersonen();
    });
}

function startHva() {
    correlator.withId(async () => {
        let options = {
            "institution": "hva", // to retrieve name and URI from config
            "adlibDatabase": "objecten",
            "db": sequelize,
            "checkEuropeanaFlag": true,
            "correlator": correlator
        };
        const backend = new Backend(options);
        let objectAdlib = new Adlib(options);
        options["adlib"] = objectAdlib;
        let objectMapper = new HvAMapper(options);
        objectAdlib.getStream().pipe(objectMapper).pipe(backend);
    });
}

function startDmg() {
    correlator.withId(async () => {
        let options = {
            "institution": "dmg", // to retrieve name and URI from config
            "adlibDatabase": "objecten",
            "db": sequelize,
            "checkEuropeanaFlag": true,
            "correlator": correlator
        };
        // Create eventstream "objects" of Design Museum Ghent
        const backend = new Backend(options);
        let objectAdlib = new Adlib(options);
        options["adlib"] = objectAdlib;
        let objectMapper = new DmgMapper(options);
        objectAdlib.getStream().pipe(objectMapper).pipe(backend);
    });
}

function startIndustriemuseum() {
    correlator.withId(async () => {
        let options = {
            "institution": "industriemuseum", // to retrieve name and URI from config
            "adlibDatabase": "objecten",
            "db": sequelize,
            "checkEuropeanaFlag": true,
            "correlator": correlator
        };
        // Create eventstream "personen" of Industriemuseum
        const backend = new Backend(options);
        let objectAdlib = new Adlib(options);
        options["adlib"] = objectAdlib;
        let objectMapper = new IndustriemuseumMapper(options);
        objectAdlib.getStream().pipe(objectMapper).pipe(backend);
    });
}

function startArchiefgent() {
    correlator.withId(async () => {
        let options = {
            "institution": "archiefgent", // to retrieve name and URI from config
            "adlibDatabase": "objecten",
            "db": sequelize,
            "checkEuropeanaFlag": true,
            "correlator": correlator
        };
        // Create eventstream "personen" of Archief Gent
        const backend = new Backend(options);
        let objectAdlib = new Adlib(options);
        options["adlib"] = objectAdlib;
        let objectMapper = new ArchiefGentMapper(options);
        objectAdlib.getStream().pipe(objectMapper).pipe(backend);
    });
}

function startStam() {
    correlator.withId(async () => {
        let options = {
            "institution": "stam", // to retrieve name and URI from config
            "adlibDatabase": "objecten",
            "db": sequelize,
            "checkEuropeanaFlag": true,
            "correlator": correlator
        };
        // Create eventstream "personen" of Stam
        const backend = new Backend(options);
        let objectAdlib = new Adlib(options);
        options["adlib"] = objectAdlib;
        let objectMapper = new StamMapper(options);
        objectAdlib.getStream().pipe(objectMapper).pipe(backend);
    });
}

function startThesaurus() {
    correlator.withId(async () => {
        let options = {
            "institution": "adlib", // one thesaurus for all institutions
            "adlibDatabase": "thesaurus",
            "type": "concept",
            "db": sequelize,
            "checkEuropeanaFlag": false,
            "correlator": correlator
        };
        const backend = new Backend(options);
        const objectAdlib = new Adlib(options);
        options["adlib"] = objectAdlib;
        const thesaurusMapper = new TermenMapper(options);
        objectAdlib.getStream().pipe(thesaurusMapper).pipe(backend);
    });
}

function startPersonen() {
    correlator.withId(async () => {
        let options = {
            "institution": "adlib", // one thesaurus for all institutions
            "adlibDatabase": "personen",
            "type": "agent",
            "db": sequelize,
            "checkEuropeanaFlag": false,
            "correlator": correlator
        };
        const backend = new Backend(options);
        const objectAdlib = new Adlib(options);
        options["adlib"] = objectAdlib;
        const thesaurusMapper = new TermenMapper(options);
        objectAdlib.getStream().pipe(thesaurusMapper).pipe(backend);
    });
}

function startHealthcheckAPI() {
    const app = express();
    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'pug');
    app.use(correlatorExpress());

    app.get('/status/am-i-up', (req, res) => {
        res.setHeader("Content-Type", "application/text");
        res.send("OK");
        res.end();
        Utils.log("GET /status/am-i-up", "app.js:startHealthcheckAPI", "INFO", req.correlationId());
    });

    app.get('/status/db', async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        let status;
        try {
            await sequelize.authenticate();
            Utils.log('Connection has been established successfully.', "adlib-backend:app.js:startHealthcheckAPI", "INFO", req.correlationId());
            status = ["OK"];
        } catch (error) {
            Utils.log(`Unable to connect to the database: ${error}`, "adlib-backend:app.js:startHealthcheckAPI", "CRIT", req.correlationId());
            status = [
                "CRIT",
                {
                    "description": "database check failed",
                    "result": "CRIT",
                    "details": "Failed to connect"
                }
            ];
        }
        res.send(status);
        res.end();
    });

    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
        next(createError(404));
    });

    // error handler
    app.use(function (err, req, res, next) {
        // set locals, only providing error in development
        res.locals.message = err.message;
        res.locals.error = req.app.get('env') === 'development' ? err : {};

        // render the error page
        res.status(err.status || 500);
        res.render('error');
    });

    /**
     * Get port from environment and store in Express.
     */

    var port = normalizePort(process.env.PORT || '3000');
    app.set('port', port);

    /**
     * Create HTTP server.
     */

    server = http.createServer(app);

    /**
     * Listen on provided port, on all network interfaces.
     */

    server.listen(port);
    server.on('error', onError);
    server.on('listening', onListening);
}

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            Utils.log(bind + ' requires elevated privileges', "adlib-backend/app.js:onError", "ERROR", null);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            Utils.log(bind + ' is already in use', "adlib-backend/app.js:onError", "ERROR", null);
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    Utils.log("Listening on " + bind, "adlib-backend:app.js:onListening", "INFO", null);
}
