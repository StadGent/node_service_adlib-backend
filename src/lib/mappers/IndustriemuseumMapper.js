import Utils from "./utils.js";
import MainUtils from "../utils.js";
import ObjectMapper from "./objectMapper";

export default class IndustriemuseumMapper extends ObjectMapper {
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
        MainUtils.log("Mapping object " + priref, "adlib-backend/lib/mappers/industriemuseumMapper.js:doMapping", "INFO", this._correlator.getId());

        try {
            let versionURI = objectURI + "/" + now;
            mappedObject["@id"] = versionURI;
            mappedObject["@type"] = "MensgemaaktObject";
            // Event stream metadata
            mappedObject["dcterms:isVersionOf"] = objectURI;
            mappedObject["prov:generatedAtTime"] = now;

            // Convenience method to make our URI dereferenceable by District09
            if (versionURI.indexOf('stad.gent/id') != -1) mappedObject["foaf:page"] = versionURI.replace("/id", "/data");

            // Identificatie
            Utils.mapPriref(input, mappedObject, this._baseURI);
            Utils.mapInstelling(this._institutionURI, input, mappedObject);
            await Utils.mapCollectie(input,mappedObject, this._adlib, this._baseURI);
            Utils.mapObjectnummer(input, mappedObject, this._baseURI);
            await Utils.mapObjectCategorie(objectURI, input, mappedObject, this._adlib);
            await Utils.mapObjectnaam(objectURI, input, mappedObject, this._adlib);
            Utils.mapTitel(input, mappedObject);
            Utils.mapBeschrijving(input, mappedObject);

            // Vervaardiging | datering
            await Utils.mapVervaardiging(objectURI, input, mappedObject, this._adlib, false);

            // Fysieke kenmerken
            await Utils.mapFysiekeKenmerken(objectURI, input, mappedObject, this._adlib);

            // opschriften
            Utils.mapOpschriften(objectURI, input, mappedObject);

            // Associaties
            await Utils.mapAssociaties(objectURI, input, mappedObject, this._adlib);

            // reproductie
            await Utils.mapIIIFManifest(input, mappedObject, MainUtils);

            done(null, JSON.stringify(mappedObject));
        } catch (e) {
            console.error(e);
            console.error('Error mapping priref ' + priref);
            done();
        }
    }
}
