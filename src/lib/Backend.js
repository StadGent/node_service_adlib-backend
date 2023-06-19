import { Writable } from 'stream';
import Utils from './utils.js';

class Backend extends Writable {
    constructor(options) {
        super();

        this._id = options.id;
        this._adlibDatabase = options.adlibDatabase;
        this._institution = options.institution;
        this._db = options.db;
        this._correlator = options.correlator;
    }
}

Backend.prototype._write = function (chunk, encoding, done) {
    // write object to file
    let db = this._adlibDatabase;

    // hack to split virtual db (is merged in one but are seperate dbs.).
    if (this._id === "dmg-archief") {
        db = "archief";

    }
    let object = JSON.parse(chunk);
    Utils.insertObject(this._institution, this._db, object, db, this._correlator);
    done();
};

module.exports = Backend;
