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
        super({objectMode: true, highWaterMark: 10});

        this._id = options.id;
        this._adlibDatabase = String(options.adlibDatabase);
        this._institution = String(options.institution);
        this._institutionName = String(config[options.institution] && config[options.institution].institutionName ? config[options.institution].institutionName : "adlib");
        this._checkEuropeanaFlag = typeof options.checkEuropeanaFlag !== 'undefined' ? options.checkEuropeanaFlag : true;
        this._db = options.db;
        this._correlator = options.correlator;
        this._version = String(process.env.npm_package_version ? process.env.npm_package_version : '0.0.0');
        this.run();
    }
}

Adlib.prototype._read = async function() {
    // Called every time this.push() is run
    // to control whether to fetch new objects
    // Here, control is implemented in function fetchWithNTLMRecursively
}

Adlib.prototype.updateLastRecordWithDone = async function () {
    const maxGeneratedAtTime = await this._db.models.Member.max('generatedAtTime', {
        where: {
            institution: this._institution,
            adlibDatabase: this._adlibDatabase,
            version: this._version
        }
    });
    const lastURI = await this._db.models.Member.max('URI', {
        where: {
            institution: this._institution,
            adlibDatabase: this._adlibDatabase,
            version: this._version,
            generatedAtTime: maxGeneratedAtTime
        }
    });
    const lastObject = await this._db.models.Member.findOne({
        where: {
            URI: String(lastURI),
            version: this._version
        }
    });
    if (lastObject) {
        lastObject.done = true;
        await lastObject.save();
    }
}
Adlib.prototype.run = async function () {
    const version = this._version;

    var institution = this._institution;
    var adlibDatabase = this._adlibDatabase;
    let lastModifiedDate = null;
    let lastPriref = null;
    let lastWasDone = false;
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
        const lastObject = await this._db.models.Member.findOne({
            where: {
                URI: lastURI
            }
        });
        if (lastObject.done) lastWasDone = true;

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
            Utils.log('Failed to retrieve priref for institution ' + this._institution + ' from database '  + this._adlibDatabase + ' from URI: ' + lastURI, "adlib-backend/lib/adlib.js", "INFO", this._correlator.getId());
        }
        if (getPrirefFromURI) lastPriref = getPrirefFromURI;
        // update lastModifiedDate
        lastModifiedDate = maxGeneratedAtTime;
    }

    if (lastWasDone) lastPriref = null; // don't repeat previous run to prevent duplicates
    let startFrom = 1;
    await this.fetchWithNTLMRecursively(lastModifiedDate, lastPriref, startFrom, config.adlib.limit);

    if (lastPriref) {
        Utils.log("All objects for institution " + this._institution + " from database "  + this._adlibDatabase + " from previous run are fetched from Adlib! Now retrieving objects starting from " + lastModifiedDate, "adlib-backend/lib/adlib.js:run", "INFO", this._correlator.getId());
        lastPriref = null; // reset
        await this.fetchWithNTLMRecursively(lastModifiedDate, lastPriref, startFrom, config.adlib.limit);
    }
    this.push(null);
    Utils.log("All objects are fetched for " + this._adlibDatabase + " from " + this._institution + "!", "adlib-backend/lib/adlib.js:run", "INFO", this._correlator.getId());
};

Adlib.prototype.fetchWithNTLMRecursively = async function(lastModifiedDate, lastPriref, startFrom, limit) {
    let hits = undefined;
    let processed = 0;
    let nextStartFrom = startFrom + limit;
    while (!hits || (hits && (startFrom <= hits))) {
        // Hack to split virtual db (is merged in one db in Adlib but are seperate dbs.).
        let db = this._adlibDatabase === 'archief' ? 'objecten' : this._adlibDatabase;
        let querypath = "?output=json&database=" + db + "&startFrom=" + startFrom + "&limit=" + limit + "&search=";

        if (this._adlibDatabase === "personen") querypath += `name.status="approved preferred term"`;
        else if (this._adlibDatabase === "thesaurus") querypath += `term.status="approved preferred term"`;
        else if (this._adlibDatabase === "tentoonstellingen" && this._institution === "dmg") querypath += `priref Greater '530000000' And priref Smaller '540000000' And reference_number = "TE_*"`;
        else if (this._checkEuropeanaFlag && this._id === "dmg-archief") querypath += `webpublication=EUROPEANA AND priref Greater "536000000" AND priref Smaller "537000000"`;
        else if (this._checkEuropeanaFlag && this._institutionName != "adlib" && this._id != "dmg-archief") querypath += `webpublication=EUROPEANA AND institution.name='${this._institutionName}'`;
        else if (!this._checkEuropeanaFlag && this._institutionName != "adlib" && this._id != "dmg-archief") querypath += `webpublication<>EUROPEANA AND institution.name='${this._institutionName}'`;
        else if (this._institutionName != "adlib" && this._id != "dmg-archief") querypath += `institution.name='${this._institutionName}'`;
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
                await sleep(timeout);

                while (this.readableLength > limit) {
                    Utils.log("Waiting until buffer count (" + this.readableLength + ") is lower than " + limit, "adlib-backend/lib/adlib.js:fetchWithNTLMRecursively", "INFO", this._correlator.getId());
                    await sleep(timeout);
                }

                Utils.log("Adding object " + objects.adlibJSON.recordList.record[i]["@attributes"].priref + " to buffer", "adlib-backend/lib/adlib.js:fetchWithNTLMRecursively", "INFO", this._correlator.getId());
                this.push(JSON.stringify(objects.adlibJSON.recordList.record[i]));
                if (process.env.ADLIB_DEBUG) {
                    console.log("Debug: readableLength " + this.readableLength);
                }
            }
            hits = parseInt(objects.adlibJSON.diagnostic.hits);
            processed = startFrom - 1 + parseInt(objects.adlibJSON.diagnostic.hits_on_display);
            Utils.log("Processed " + processed + " / " + hits + " for institution " + this._institution + " from database "  + this._adlibDatabase, "adlib-backend/lib/adlib.js:fetchWithNTLMRecursively", "INFO", this._correlator.getId());
            startFrom = nextStartFrom;
            nextStartFrom = startFrom + limit;
        } else {
            Utils.log("No more results for institution " + this._institution + " from database "  + this._adlibDatabase, "adlib-backend/lib/adlib.js:fetchWithNTLMRecursively", "INFO", this._correlator.getId());
            return;
        }
        // End test process for this institution.
        if (process.env.NODE_ENV === 'test') {
            Utils.log("End test first page for institution " + this._institution + " from database "  + this._adlibDatabase, "adlib-backend/lib/adlib.js:fetchWithNTLMRecursively", "INFO", this._correlator.getId());
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
    if (process.env.ADLIB_DEBUG) {
        console.log('Debug: Sleeping ' + ms + 'ms');
    }
    return new Promise(resolve => setTimeout(resolve, ms));
}

Adlib.prototype.getURIFromPriref = async function(database, priref, type) {
    let querypath = `?output=json&database=${database}&search=priref=${priref}&limit=1`;
    // Try to get data from Redis cache.
    let object = await redisClient.get(querypath);
    if (object) {
        object = JSON.parse(object);
    } else {
        // Wait for Adlib.
        let timeout = process.env.ADLIB_SLEEP_URI ? process.env.ADLIB_SLEEP_URI : 1000;
        await sleep(timeout);

        // Get data from Adlib.
        object = await this.fetchWithNTLM(querypath);
        await redisClient.setEx(querypath, 3600, JSON.stringify(object));
    }

    if(object.adlibJSON.diagnostic.hits_on_display != "0" && object.adlibJSON.recordList && object.adlibJSON.recordList.record[0] && object.adlibJSON.recordList.record[0].source) {
        return Utils.getURIFromRecord(object.adlibJSON.recordList.record[0], priref, type, database);
    } else {
        return Utils.getURIFromRecord(null, priref, type, database);
    }
};

Adlib.prototype.getPrirefFromObjectNumber = async function(database, objectNumber) {
    let querypath = `?output=json&database=${database}&search=object_number="${objectNumber}"&limit=1`;
    // Try to get data from Redis cache.
    let object = await redisClient.get(querypath);
    if (object) {
        object = JSON.parse(object);
    } else {
        // Wait for Adlib.
        let timeout = process.env.ADLIB_SLEEP_URI ? process.env.ADLIB_SLEEP_URI : 1000;
        await sleep(timeout);

        // Get data from Adlib.
        object = await this.fetchWithNTLM(querypath);
        await redisClient.setEx(querypath, 3600, JSON.stringify(object));
    }

    if(object.adlibJSON.diagnostic.hits_on_display != "0" && object.adlibJSON.recordList && object.adlibJSON.recordList.record[0]) {
        return object.adlibJSON.recordList.record[0]["@attributes"]["priref"];
    } else {
        return "";
    }
};
