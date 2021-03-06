import Config from "../config/config.js";
import { Sequelize } from 'sequelize';

const config = Config.getConfig();
const port = config.eventstream.port != '' ? ':' + config.eventstream.port : '';
const path = config.eventstream.path != '' ? config.eventstream.path + '/' : '';
const version = process.env.npm_package_version ? process.env.npm_package_version : '0.0.0';

export default class Utils {
    static async insertObject(institution, db, object, adlibDatabase, correlator) {
        const version = process.env.npm_package_version ? process.env.npm_package_version : '0.0.0';
        let generatedAtTime = new Date(object["prov:generatedAtTime"]).toISOString();
        let URI = object["@id"];

        this.log(`Inserting object with URI ${URI}`, "adlib-backend/lib/utils.js:insertObject", "INFO", correlator.getId());

        await db.models.Member.create({
            URI: URI,
            version: version,
            institution: institution,
            adlibDatabase: adlibDatabase,
            generatedAtTime: generatedAtTime,
            payload: JSON.stringify(object)
        });
    }

    static sendNotFound(req, res) {
        res.set({
            'Content-Type': 'text/html'
        });
        let homepage = config.eventstream.protocol + '://' + config.eventstream.hostname + port + '/' + path;
        res.status(404).send('Not data found. Discover more here: <a href="' + homepage + '">' + homepage + '</a>');
    }

    static async initDb(correlator) {
        const sequelize = new Sequelize(config.database.connectionURI);
        const Member = require('./models/Member').Member;
        const memberAttributes = require('./models/Member').attributes;
        const memberOptions = {
            // Other model options go here
            sequelize, // We need to pass the connection instance
            modelName: 'Member', // We need to choose the model name,
            createdAt: 'generatedAtTime', // I want createdAt to be called generatedAtTime
            indexes: require('./models/Member').indexes
        };
        await Member.init(memberAttributes, memberOptions);
        const pattern = /\d+\.\d+\.\d+/g;
        const versionRegex = new RegExp(pattern);
        // Clean database when versioning is not enabled or not three digits separated with dots pattern
        if (!process.env.npm_package_version || !versionRegex.test(process.env.npm_package_version)) {
            this.log("EMPTYING DATABASE", "adlib-backend/lib/utils.js:initDb", "INFO", correlator.getId());
            await sequelize.sync({force: true});
        }
        await sequelize.sync();

        return sequelize;
    }

    static getURIFromRecord(record, priref, type) {
        if (record) {
            for (let s in record.source) {
                const source = record.source[s].trim().endsWith('/') ? record.source[s].trim() : `${record.source[s].trim()}/`;
                if (source.startsWith('http') && record['term.number'] && record['term.number'][s]) {
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

    static getInstitutionNameFromPriref(priref) {
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
            case '67':
                return 'archiefgent';
            default:
                return 'unknown';
        }
    }

    static getInstitutionURIFromPrirefId(institutionId) {
        // 53 is DMG
        if (institutionId === 53) return 'http://www.wikidata.org/entity/Q1809071';
        // HVA is 47
        else if (institutionId === 47) return 'http://www.wikidata.org/entity/Q2358158';
        // STAM is 55
        else if (institutionId === 55) return 'http://www.wikidata.org/entity/Q980285';
        // Industriemuseum is 57
        else if (institutionId === 57) return 'http://www.wikidata.org/entity/Q2245203';
        // Archief Gent is ?
        else if (institutionId === 67) return 'http://www.wikidata.org/entity/Q41776192';
    }

    static log(message, loggerName, level, correlationId) {
        let entry = {
            '@timestamp': new Date().toISOString(),
            '@version': version,
            message: message,
            log: {
                level: level,
                logger: loggerName,
            },
            d09: {
                correlationId: correlationId,
                subcel: 'web'
            },
            memory: {
                total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100}MB`,
                used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100}MB`,
                buffer: `${Math.round(process.memoryUsage().arrayBuffers / 1024 / 1024 * 100) / 100}MB`
            }
        };
        console.log(JSON.stringify(entry));
    }
}
