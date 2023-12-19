import Utils from "./utils.js";
import MainUtils from "../utils.js";
import ObjectMapper from "./objectMapper";

export default class DmgMapper extends ObjectMapper {
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
        MainUtils.log("Mapping object " + priref, "adlib-backend/lib/mappers/dmgMapper.js:doMapping", "INFO", this._correlator.getId());

        try {
            let versionURI = objectURI + "/" + now;
            mappedObject["@id"] = versionURI;
            mappedObject["@type"] = "MensgemaaktObject";
            // Event stream metadata
            mappedObject["dcterms:isVersionOf"] = objectURI;
            // mappedObject["prov:generatedAtTime"] = new Date(input["@attributes"].modification).toISOString();
            mappedObject["prov:generatedAtTime"] = now;

            // Convenience method to make our URI dereferenceable by District09
            if (versionURI.indexOf('stad.gent/id') != -1) mappedObject["foaf:page"] = versionURI.replace("/id", "/data");

            // Identificatie
            Utils.mapPriref(input, mappedObject, this._baseURI);
            Utils.mapInstelling(this._institutionURI, input, mappedObject);
            await Utils.mapCollectie(input,mappedObject, this._adlib, this._baseURI);
            Utils.mapObjectnummer(input, mappedObject, this._baseURI);
            await Utils.mapObjectnaam(objectURI, input, mappedObject, this._adlib);
            Utils.mapTitel(input, mappedObject);
            Utils.mapBeschrijving(input, mappedObject);
            Utils.mapOplage(input, mappedObject);

            // Koepelrecord (uit nummers en relaties)
            await Utils.mapRelatiesKoepelrecord(objectURI, input, mappedObject, this._adlib, this._baseURI)

            // Koepelrecord (afgeleid uit objectnummer)
            await Utils.mapRelatiesKoepelrecordDMG(objectURI, input, mappedObject, this._adlib, this._institutionURI);

            // Vervaardiging | datering
            await Utils.mapVervaardiging(objectURI, input, mappedObject, this._adlib, true);

            // Fysieke kenmerken
            await Utils.mapFysiekeKenmerken(objectURI, input, mappedObject, this._adlib);

            // Verwerving
            await Utils.mapVerwerving(objectURI, this._institutionURI, input, mappedObject, this._adlib);

            // Associaties
            await Utils.mapAssociaties(objectURI, input, mappedObject, this._adlib, true, false, false, true, true, false);

            // Standplaats
            Utils.mapStandplaatsDMG(input, mappedObject);

            // Tentoonstellingen
            await Utils.mapTentoonstelling(objectURI, input, mappedObject, this._adlib);

            // reproductie
            await Utils.mapIIIFManifest(input, mappedObject, MainUtils);

            done(null, JSON.stringify(mappedObject));
        } catch (e) {
            if (process.env.NODE_ENV === 'test') {
                throw(e);
            }
            console.error(e);
            console.error('Error mapping priref ' + priref);
            done();
        }
    }
}
