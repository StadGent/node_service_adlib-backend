import MainUtils from "../utils.js";
import Utils from "../mappers/utils.js";
import ObjectMapper from "./objectMapper";

export default class StamMapper extends ObjectMapper {
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
        const priref = input["@attributes"].priref;
        let objectURI = this._baseURI + "mensgemaaktobject" + '/' + this._institution + '/' + priref;
        MainUtils.log("Mapping object " + priref, "adlib-backend/lib/mappers/stamMapper.js:doMapping", "INFO", this._correlator.getId());

        try {
            let versionURI = objectURI + "/" + now;
            mappedObject["@id"] = versionURI;
            mappedObject["@type"] = "MensgemaaktObject";
            // Event stream metadata
            mappedObject["dcterms:isVersionOf"] = objectURI;
            // mappedObject["prov:generatedAtTime"] = new Date(input["@attributes"].modification).toISOString();
            mappedObject["prov:generatedAtTime"] = now;

            // Convenience method to make our URI dereferenceable by District09
            if (versionURI.indexOf('stad.gent/id') != -1) mappedObject["foaf:page"] = versionURI;

            // Identificatie
            Utils.mapPriref(input, mappedObject, this._baseURI);
            Utils.mapInstelling(this._institutionURI, input, mappedObject);
            Utils.mapObjectnummer(input, mappedObject, this._baseURI);
            await Utils.mapObjectnaam(objectURI, input, mappedObject, this._adlib);
            Utils.mapTitel(input, mappedObject);
            Utils.mapBeschrijving(input, mappedObject);

            // Vervaardiging | datering
            await Utils.mapVervaardiging(objectURI, input, mappedObject, this._adlib);

            // Fysieke kenmerken
            await Utils.mapFysiekeKenmerken(objectURI, input, mappedObject, this._adlib);

            // Verwerving
            await Utils.mapVerwerving(objectURI, this._institutionURI, input, mappedObject, this._adlib);

            done(null, JSON.stringify(mappedObject));
        } catch (e) {
            console.error(e);
            console.error('Error mapping priref ' + priref);
            done();
        }
    }
}
