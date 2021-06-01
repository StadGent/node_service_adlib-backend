import Utils from "./utils.js";
import ObjectMapper from "./objectMapper";

export default class ArchiefGentMapper extends ObjectMapper {
    constructor(options) {
        super(options);
    }

    _transform(object, encoding, done) {
        let input = JSON.parse(object);
        let mappedObject = {};
        mappedObject["@context"] = this._context;

        try {
            let now = new Date().toISOString();
            let baseURI = this._baseURI.endsWith('/') ? this._baseURI : this._baseURI + '/';
            let objectURI = baseURI + "mensgemaaktobject" + '/' + this._institution + '/' + input["@attributes"].priref;
            let versionURI = objectURI + "/" + now;
            mappedObject["@id"] = versionURI;
            mappedObject["@type"] = "MensgemaaktObject";
            // Event stream metadata
            mappedObject["dcterms:isVersionOf"] = objectURI;
            mappedObject["prov:generatedAtTime"] = now;

            // Convenience method to make our URI dereferenceable by District09
            if (versionURI.indexOf('stad.gent/id') != -1) mappedObject["foaf:page"] = versionURI;

            // Identificatie
            Utils.mapInstelling(this._institutionURI, input, mappedObject);
            Utils.mapCollectie(input,mappedObject);
            Utils.mapObjectnummer(input, mappedObject);
            Utils.mapObjectnaam(objectURI, input, mappedObject);
            Utils.mapTitel(input, mappedObject);
            Utils.mapBeschrijving(input, mappedObject);
            Utils.mapOplage(input, mappedObject);

            // Vervaardiging | datering
            Utils.mapVervaardiging(objectURI, input, mappedObject);

            // Fysieke kenmerken
            Utils.mapFysiekeKenmerken(input, mappedObject);

            // Verwerving
            Utils.mapVerwervingDMG(objectURI, this._institutionURI, input, mappedObject);

            // Standplaats
            Utils.mapStandplaatsDMG(input, mappedObject);

            // Tentoonstellingen
            Utils.mapTentoonstelling(objectURI, input, mappedObject);

            // reproductie

        } catch (e) {
            console.error(e);
        }
        done(null, JSON.stringify(mappedObject));
    }
}
