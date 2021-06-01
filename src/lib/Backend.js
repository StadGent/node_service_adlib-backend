import { Writable } from 'stream';
import Utils from './utils.js';

class Backend extends Writable {
    constructor(options) {
        super();

        this._adlibDatabase = options.adlibDatabase;
        this._institution = options.institution;
        this._db = options.db;
        this._correlator = options.correlator;
    }
}

Backend.prototype._write = function (chunk, encoding, done) {
    // write object  to file
    let object = JSON.parse(chunk);
    Utils.insertObject(this._institution, this._db, object, this._adlibDatabase, this._correlator);
    done();
};

module.exports = Backend;
