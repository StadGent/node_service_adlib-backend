import Utils, {mapPriref} from "./utils.js";
import MainUtils from "../utils.js"
import ObjectMapper from "./objectMapper";

export default class DmgArchiefMapper extends ObjectMapper  {
    constructor(options) {
        super(options);
    }

    _transform(object, encoding, done) {
        let input = JSON.parse(object);
        this.doMapping(input, done)
    }

    async doMapping(input, done){
        let mappedObject = {};
        mappedObject["@context"] = this._context

        let now = new Date().toISOString();
        const priref = input["@attributes"].priref
        let objectURI = this._baseURI + "mensgemaaktobject" + '/' + this._institution + '/' + priref

        try {
            let versionURI = objectURI + "/" + now;
            mappedObject["@id"] = versionURI;
            mappedObject["@type"] = "MensgemaaktObject";
            // event stream metadata
            mappedObject["dcterms:isVersionOf"]  = objectURI
            mappedObject["prov:generatedAtTime"] = now

            // Convenience method to make our URI dereferenceable by District09
            if (versionURI.indexOf('stad.gent/id') != -1) mappedObject["foaf:page"] = versionURI.replace("/id", "/data");

            //identificatie
            Utils.mapPriref(input, mappedObject, this._baseURI);
            Utils.mapInstelling(this._institutionURI, input, mappedObject);
            Utils.mapObjectnummer(input, mappedObject, this._baseURI);
            Utils.mapTitel(input, mappedObject);
            Utils.mapOpschriften(objectURI, input, mappedObject)

            await Utils.mapVervaardiging(objectURI, input, mappedObject, this._adlib, true)
            await Utils.mapFysiekeKenmerken(objectURI, input, mappedObject, this._adlib)
            await Utils.mapTentoonstelling(objectURI, input, mappedObject, this._adlib);

            await Utils.mapIIIFManifest(input, mappedObject, MainUtils);

            done(null, JSON.stringify(mappedObject));
        }

        catch(e) {
            if (process.env.NODE_ENV ==='test') {
                throw(e)
            }
            console.log(e)
            console.log("Error mapping priref "+ priref)
        }

    }

}


