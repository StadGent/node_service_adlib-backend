import httpntlm from 'httpntlm';
import { Readable } from 'stream';
import Config from "../config/config.js";
import Utils from './utils.js';
import { createClient } from 'redis';

const config = Config.getConfig();

const redisClient = createClient({
    url: config.redis.connectionURI
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

export default class Adlib extends Readable {
    constructor(options) {
        super({objectMode: true});

        this._adlibDatabase = options.adlibDatabase;
        this._institution = options.institution;
        this._institutionName = config[options.institution] && config[options.institution].institutionName ? config[options.institution].institutionName : "adlib";
        this._checkEuropeanaFlag = typeof options.checkEuropeanaFlag !== 'undefined' ? options.checkEuropeanaFlag : true;
        this._db = options.db;
        this._correlator = options.correlator;
        this._buffer = [];
        this.run();
    }
}

Adlib.prototype._read = async function() {
    try {
        if (this._buffer && this._buffer.length) this.push(this._buffer.pop());
        else {
            this.once('object fetched', this._read);
        }
    } catch (e) {
        console.error(e);
    }
}

Adlib.prototype.run = async function () {
    const version = process.env.npm_package_version ? process.env.npm_package_version : '0.0.0';

    var institution = this._institution;
    var adlibDatabase = this._adlibDatabase;
    let lastModifiedDate = null;
    let lastPriref = null;
    let maxGeneratedAtTime = await this._db.models.Member.max('generatedAtTime', {
        where: {
            institution: institution,
            adlibDatabase: adlibDatabase,
            version: version
        }
    });
    if (maxGeneratedAtTime) {
        const lastURI = await this._db.models.Member.max('URI', {
            where: {
                institution: institution,
                adlibDatabase: adlibDatabase,
                version: version,
                generatedAtTime: maxGeneratedAtTime
            }
        });

        let getPrirefFromURI = null;
        try {
            if (this._institution != "adlib") {
                // Priref is after the organization reference
                // e.g. https://stad.gent/id/mensgemaaktobject/hva/470034255/2021-05-21T11:33:28.745Z
                getPrirefFromURI = lastURI.split('/')[(lastURI.split('/').indexOf(this._institution)+1)];
            } else {
                // Priref is after agent or concept
                // e.g. https://stad.gent/id/agent/530000001/2021-05-21T11:33:24.061Z
                getPrirefFromURI = lastURI.split('/')[(lastURI.split('/').indexOf("id")+2)];
            }
        } catch (e) {
            Utils.log('Failed to retrieve priref from URI: ' + lastURI, "adlib-backend/lib/adlib.js", "INFO", this._correlator.getId());
        }
        if (getPrirefFromURI) lastPriref = getPrirefFromURI;
        // update lastModifiedDate
        lastModifiedDate = maxGeneratedAtTime;
    }

    let startFrom = 0;
    await this.fetchWithNTLMRecursively(lastModifiedDate, lastPriref, startFrom, config.adlib.limit);

    if (lastPriref) {
        Utils.log("All objects for institution " + this._institution + " from previous run are fetched from Adlib! Now retrieving objects starting from " + lastModifiedDate, "adlib-backend/lib/adlib.js:run", "INFO", this._correlator.getId());
        lastPriref = null; // reset
        await this.fetchWithNTLMRecursively(lastModifiedDate, lastPriref, startFrom, config.adlib.limit);
    }
    Utils.log("All objects are fetched from " + this._institution + "!", "adlib-backend/lib/adlib.js:run", "INFO", this._correlator.getId());
    this.push(null);
};

Adlib.prototype.fetchWithNTLMRecursively = async function(lastModifiedDate, lastPriref, startFrom, limit) {
    let hits = undefined;
    let nextStartFrom = startFrom + limit;
    while (!hits || (hits && nextStartFrom < hits)) {
        let querypath = "?output=json&database=" + this._adlibDatabase + "&startFrom=" + startFrom + "&limit=" + limit + "&search=";

        if (this._adlibDatabase === "personen") querypath += `name.status="approved preferred term"`;
        else if (this._adlibDatabase === "thesaurus") querypath += `term.status="approved preferred term"`;
        else if (this._adlibDatabase === "tentoonstellingen" && this._institution === "dmg") querypath += `priref Greater '530000000' And priref Smaller '540000000' And reference_number = "TE_2020*"`;
        else if (this._checkEuropeanaFlag && this._institutionName != "adlib") querypath += `webpublication=EUROPEANA AND institution.name='${this._institutionName}'`;
        else if (this._institutionName != "adlib") querypath += `institution.name='${this._institutionName}'`;
        else querypath += "all";

        // When lastPriref is not null, then we try to finalize previous run with the max generatedAtTime and priref
        if (lastPriref) {
            querypath += ` AND modification <= '${lastModifiedDate.toISOString()}' AND priref > '${lastPriref}'`;
        }
        else if (lastModifiedDate) querypath += ` AND modification > '${lastModifiedDate.toISOString()}'`;

        let objects = await this.fetchWithNTLM(querypath);
        if(objects.adlibJSON.diagnostic.hits_on_display != "0" && objects.adlibJSON.recordList) {
            for (let i in objects.adlibJSON.recordList.record) {
              // Wait for adlib.
              let timeout = process.env.ADLIB_SLEEP ? process.env.ADLIB_SLEEP : 5000;
              if (timeout > 0) {
                  await sleep(timeout);
                  while (this._buffer.length > limit) {
                      Utils.log("Waiting until buffer count (" + this._buffer.length + ") is lower than " + limit, "adlib-backend/lib/adlib.js:fetchWithNTLMRecursively", "INFO", this._correlator.getId());
                      await sleep(timeout);
                  }
              }
                Utils.log("Adding object to buffer", "adlib-backend/lib/adlib.js:fetchWithNTLMRecursively", "INFO", this._correlator.getId());
                this._buffer.push(JSON.stringify(objects.adlibJSON.recordList.record[i]));
                this.emit('object fetched');
            }
            hits = objects.adlibJSON.diagnostic.hits;
            Utils.log("number of hits: " + hits, "adlib-backend/lib/adlib.js:fetchWithNTLMRecursively", "INFO", this._correlator.getId());
            startFrom = nextStartFrom;
            nextStartFrom = startFrom + limit;
        } else {
            return;
        }
    }
};

Adlib.prototype.fetchWithNTLM = function(querypath) {
    Utils.log("fetching: " + querypath, "adlib-backend/lib/adlib.js:fetchWithNTLM", "INFO", this._correlator.getId());
    const self = this;
    return new Promise((resolve, reject) => {
        httpntlm.get({
            url: config.adlib.baseUrl + querypath,
            username: config.adlib.username,
            password: config.adlib.password
        }, function (err, res) {
            if (err) reject(err);
            try {
                if (res && res.body) resolve(JSON.parse(res.body));
                else {
                    self.fetchWithNTLM(querypath);
                }// retry
            } catch (e) {
                Utils.log(`Error: ${e.message}\n${res.headers}\n${res.body}`, "adlib-backend/lib/adlib.js:fetchWithNTLM", "ERROR", self._correlator.getId());
            }
        });
    });
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

Adlib.prototype.getURIFromPriref = async function(database, priref, type) {
    // Wait for adlib.
    let timeout = process.env.ADLIB_SLEEP_URI ? process.env.ADLIB_SLEEP_URI : 1000;
    if (timeout > 0) {
        await sleep(timeout);
    }
    let querypath = `?output=json&database=${database}&search=priref=${priref}&limit=1`;
    // Get data from Redis cache.
    let object = await redisClient.get(querypath);
    if (object) {
        object = JSON.parse(object);
    } else {
        object = await this.fetchWithNTLM(querypath);
        await redisClient.setEx(querypath, 3600, JSON.stringify(object));
    }

    if(object.adlibJSON.diagnostic.hits_on_display != "0" && object.adlibJSON.recordList && object.adlibJSON.recordList.record[0] && object.adlibJSON.recordList.record[0].source) {
        return Utils.getURIFromRecord(object.adlibJSON.recordList.record[0], priref, type, database);
    } else {
        return Utils.getURIFromRecord(null, priref, type, database);
    }
};
