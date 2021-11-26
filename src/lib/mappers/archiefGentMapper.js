import Utils from "./utils.js";
import MainUtils from "../utils.js";
import ObjectMapper from "./objectMapper";

export default class ArchiefGentMapper extends ObjectMapper {
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

        try {
            let now = new Date().toISOString();
            let objectURI = this._baseURI + "mensgemaaktobject" + '/' + this._institution + '/' + input["@attributes"].priref;
            MainUtils.log("Mapping object " + input["@attributes"].priref, "adlib-backend/lib/mappers/archiefGentMapper.js:doMapping", "INFO", this._correlator.getId());
            let versionURI = objectURI + "/" + now;
            mappedObject["@id"] = versionURI;
            mappedObject["@type"] = "MensgemaaktObject";
            // Event stream metadata
            mappedObject["dcterms:isVersionOf"] = objectURI;
            mappedObject["prov:generatedAtTime"] = now;

            // Convenience method to make our URI dereferenceable by District09
            if (versionURI.indexOf('stad.gent/id') != -1) mappedObject["foaf:page"] = versionURI;

            // Identificatie
            Utils.mapPriref(input, mappedObject, this._baseURI);
            Utils.mapInstelling(this._institutionURI, input, mappedObject);
            Utils.mapAfdeling(this._institutionURI, input, mappedObject);
            await Utils.mapCollectie(input,mappedObject, this._adlib, this._baseURI);
            Utils.mapObjectnummer(input, mappedObject, this._baseURI);
            Utils.mapRecordType(input, mappedObject);
            await Utils.mapObjectCategorie(objectURI, input, mappedObject, this._adlib);
            await Utils.mapObjectnaam(objectURI, input, mappedObject, this._adlib);
            // Utils.mapOnderdeelEnAantal(input, mappedObject);
            Utils.mapTitel(input, mappedObject);
            Utils.mapBeschrijving(input, mappedObject);

            // Vervaardiging, datering
            await Utils.mapVervaardiging(objectURI, input, mappedObject, this._adlib);

            // Associaties
            await Utils.mapAssociaties(objectURI, input, mappedObject, this._adlib);

            await Utils.mapTrefwoorden(objectURI, input, mappedObject, this._adlib);

            await Utils.mapIconografie(input, mappedObject, this._adlib);

            // Fysieke kenmerken
            await Utils.mapFysiekeKenmerken(objectURI, input, mappedObject, this._adlib);

            Utils.mapAlternativeNumber(input, mappedObject, this._baseURI);

            // Relatie met andere objecten (koepelrecord of object)
            await Utils.mapRelatiesKoepelrecord(objectURI, input, mappedObject, this._adlib, this._baseURI);

            // Dossier bestaat uit werken (koepelrecord of object)
            await Utils.mapRelatiesKoepelRecordDossier(objectURI, input, mappedObject, this._adlib);

            // werk resulteert in dossier (koepelrecord)
            await Utils.mapBouwaanvraagArchief(objectURI, input, mappedObject, this._adlib);

            // Verwerving
            await Utils.mapVerwerving(objectURI, this._institutionURI, input, mappedObject, this._adlib);

        } catch (e) {
            console.error(e);
        }
        done(null, JSON.stringify(mappedObject));
    }
}
