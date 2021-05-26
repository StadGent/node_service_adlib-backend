let Adlib = require('./lib/adlib.js');
let DmgMapper = require('./lib/mappers/dmgMapper');
let StamMapper = require('./lib/mappers/stamMapper');
const HvAMapper = require("./lib/mappers/hvaMapper");
const ArchiefGentMapper = require("./lib/mappers/archiefGentMapper");
const IndustriemuseumMapper = require("./lib/mappers/IndustriemuseumMapper");
const TermenMapper = require("./lib/mappers/termenMapper");
const Backend = require("./lib/Backend");
const Utils = require('./lib/utils.js');
const config = require("./config/config.js").getConfig();
const correlator = require("correlation-id");

let sequelize;

let cron = require('node-cron');

start();

cron.schedule(config.adlib.schedule, start);

async function start() {
    correlator.withId(async () => {
        Utils.log("Starting", "adlib-backend/lib/app.js:start", correlator.getId())

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
    })
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
    })
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
    })
}