let config = require("../config/config.js").getConfig();
let port = config.eventstream.port != '' ? ':' + config.eventstream.port : '';
let path = config.eventstream.path != '' ? config.eventstream.path + '/' : '';

const { Sequelize } = require('sequelize');

module.exports = new class Utils {
    async insertObject(institution, db, object, adlibDatabase, correlator) {
        const version = process.env.npm_package_version ? process.env.npm_package_version : '0.0.0';
        let generatedAtTime = new Date(object["prov:generatedAtTime"]).toISOString();
        let URI = object["@id"];

        this.log(`Inserting object with URI ${URI}`, "adlib-backend/lib/utils.js:insertObject", "INFO", correlator.getId())

        await db.models.Member.create({
            URI: URI,
            version: version,
            institution: institution,
            adlibDatabase: adlibDatabase,
            generatedAtTime: generatedAtTime,
            payload: JSON.stringify(object)
        });
    }

    sendNotFound(req, res) {
        res.set({
            'Content-Type': 'text/html'
        });
        let homepage = config.eventstream.protocol + '://' + config.eventstream.hostname + port + '/' + path;
        res.status(404).send('Not data found. Discover more here: <a href="' + homepage + '">' + homepage + '</a>');
    }

    async initDb(correlator) {
        const sequelize = new Sequelize(config.database.connectionURI);
        const Member = require('./models/Member').Member;
        const memberAttributes = require('./models/Member').attributes;
        const memberOptions = {
            // Other model options go here
            sequelize, // We need to pass the connection instance
            modelName: 'Member', // We need to choose the model name,
            createdAt: 'generatedAtTime' // I want createdAt to be called generatedAtTime
        };
        await Member.init(memberAttributes, memberOptions);
        // Clean database when versioning is not enabled
        if (!process.env.npm_package_version) {
            this.log("EMPTYING DATABASE", "adlib-backend/lib/utils.js:initDb", "INFO", correlator.getId())
            await sequelize.sync({force: true});
        };
        await sequelize.sync();

        return sequelize;
    }

    getURIFromRecord(record, priref, type, database) {
        if (record) {
            for (let s in record.source) {
                const source = record.source[s].endsWith('/') ? record.source[s] : `${record.source[s]}/`
                if (source.startsWith('http') && record['term.number']) {
                    const termNumber = record['term.number'][s].toLowerCase().trim().replace(' ', '');
                    return `${source}${termNumber}`;
                }
            }
        }
        // create identifier for concept that will be published with an event stream
        const baseURI = config.mapping.baseURI.endsWith('/') ? config.mapping.baseURI : config.mapping.baseURI + '/';
        // URI template: https://stad.gent/id/{type}/{scheme-id}/{concept-ref}
        return `${baseURI}${type}/${priref}`;
    }

    getInstitutionNameFromPriref(priref) {
        const prefix = priref.substr(0,2);
        switch (prefix) {
            case '55':
                return 'stam';
            case '47':
                return 'hva';
            case '57':
                return 'industriemuseum';
            case '53':
                return 'dmg';
            // case 'todo':
            //    return 'archiefgent';
            default:
                return 'unknown';
        }
    }

    getInstitutionURIFromPrirefId(institutionId) {
        // 53 is DMG
        if (institutionId === 53) return 'http://www.wikidata.org/entity/Q1809071';
        // HVA is 47
        else if (institutionId === 47) return 'http://www.wikidata.org/entity/Q2358158';
        // STAM is 55
        else if (institutionId === 47) return 'http://www.wikidata.org/entity/Q980285';
        // Industriemuseum is 57
        else if (institutionId === 57) return 'http://www.wikidata.org/entity/Q2245203';
        // Archief Gent is ?
        else return 'http://www.wikidata.org/entity/Q41776192';
    }

    log(message, loggerName, level, correlationId) {
        let levelValue = 0;
        if (level === "INFO") levelValue = 4;
        else if (level === "ERROR") levelValue = 2;
        else if (level === "CRIT") levelValue = 1;

        console.log(`{"@timestamp":"${new Date().toISOString()}","@version":1,"message":"${message}","logger_name":"${loggerName}","level":${level}","level_value":${levelValue},"correlationId":"${correlationId}"}`);
    }
}