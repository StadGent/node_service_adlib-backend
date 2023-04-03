import ObjectMapper from "./objectMapper";
import MainUtils from "../utils.js"
import Utils from "./utils.js";

export default class WvkMapper extends ObjectMapper {
    constructor(options) {
        super(options);
    }

    _transform(object, encoding, done) {
        let input = JSON.parse(object);
        this.doMapping(input, done);
    }

    async doMapping(input, done) {
        let mappedObject = {};
        mappedObject["@context"] = this._context;

        let now = new Date().toISOString();
        const priref = input ["@attributes"].priref;
        let objectURI = this._baseURI = "mensgemaaktobject" + "/" + this._institution + "/" + priref;
        MainUtils.log("Mapping object " + priref, "adlib-backend/lib/mappers/wvkMapper.js:doMapping", "INFO", this._correlator.getId());

        try{

            let versionURI = objectURI  + "/" + now;
            mappedObject["@id"] = versionURI;
            mappedObject["@type"] = "MensgemaaktObject";
            // Event stream metadata
            mappedObject["dcterms:isVersonOf"] = objectURI;
            // mappedObject["prov:generatedAtTime"] = new Date(input["@attributes"].modification).toISOString();
            mappedObject["prov:generatedAtTime"] = now;

            // Convenience method to make our URI dereferenceable by District09
            if (versionURI.indexOf('stad.gent/id') != -1) mappedObject["foaf:page"] = versionURI.replace("/id", "/data");

            //identificatie
            Utils.mapPriref(input, mappedObject, this._baseURI);
            Utils.mapInstelling(this._institutionURI, input, mappedObject);
            await Utils.mapCollectie(input, mappedObject, this._adlib, this._baseURI);
            Utils.mapObjectnummer(input, mappedObject, this._baseURI);
            await Utils.mapObjectnaam(objectURI, input, mappedObject, this._adlib);
            Utils.mapTitel(input, mappedObject);
            Utils.mapBeschrijving(input, mappedObject);

            // Vervaardiging | Datering
            await Utils.mapVervaardiging(objectURI, input, mappedObject, this._adlib, false);

            // Fysieke kenmerken
            await Utils.mapFysiekeKenmerken(objectURI, input, mappedObject, this._adlib);

            done(null, JSON.stringify(mappedObject));

        } catch(e) {
            if(process.env.NODE_ENV === 'test') {
                throw(e);
            }
            console.log(e);
            console.log('Error mapping priref' + priref);
            done();

        }

    }
}
