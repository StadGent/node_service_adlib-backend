import { Transform } from 'stream';
import MainUtils from "../utils.js";
import Config from "../../config/config";

const config = Config.getConfig();

export default class TentoonstellingMapper extends Transform {
    constructor(options) {
        super({objectMode: true});

        this._context = ["https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-object-ap.jsonld",
            "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/persoon-basis.jsonld",
            "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/cultureel-erfgoed-event-ap.jsonld",
            "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/organisatie-basis.jsonld",
            "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/generiek-basis.jsonld",
            "https://apidg.gent.be/opendata/adlib2eventstream/v1/context/dossier.jsonld",
            {
                "dcterms:isVersionOf": {
                    "@type": "@id"
                },
                "cidoc": "http://www.cidoc-crm.org/cidoc-crm/",
                "prov": "http://www.w3.org/ns/prov#",
                "skos": "http://www.w3.org/2004/02/skos/core#",
                "label": "http://www.w3.org/2000/01/rdf-schema#label",
                "opmerking": "http://www.w3.org/2004/02/skos/core#note",
                "foaf": "http://xmlns.com/foaf/0.1/",
                "foaf:page": {
                    "@type": "@id"
                },
                "cest": "https://www.projectcest.be/wiki/Publicatie:Invulboek_objecten/Veld/",
                "inhoud": "http://www.cidoc-crm.org/cidoc-crm/P190_has_symbolic_content",
                "la": "https://linked.art/ns/terms/",
                "equivalent": {
                    "@id": "la:equivalent",
                    "@type": "@id"
                }
            }
        ];

        this._adlibDatabase = options.adlibDatabase;
        //this._institutionID = options.institutionID;
        this._institution = options.institution;
        this._institutionURI = config[options.institution] ? config[options.institution].institutionURI : "";
        this._baseURI = config.mapping.baseURI.endsWith('/') ? config.mapping.baseURI : `${config.mapping.baseURI}/` ;

        this._type = options.type ? options.type : "";
        this._adlib = options.adlib;

        this._correlator = options.correlator;
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
        let baseURI = this._baseURI.endsWith('/') ? this._baseURI : this._baseURI + '/';
        MainUtils.log("Mapping object " + priref, "adlib-backend/lib/mappers/tentoonstellingMapper.js:doMapping", "INFO", this._correlator.getId());
        const ref_number = input["reference_number"]

        try {
            //URI template: https://stad.gent/id/{type}/{scheme-id}/{concept-ref}
            let objectURI = baseURI + "tentoonstelling" + '/' + priref;
            let versionURI = objectURI + "/" + now;

            //only process terms from database "tentoonstelling" with institution === "dmg" (53)
            //&& reference_number .starswith("TE")

            //if ((institution === 'dmg') && (input['reference_number'].startsWith("TE_")))
            //{
            mappedObject["@id"] = versionURI;
            mappedObject["@type"] = "Activiteit";
            mappedObject["Entiteit.type"] = {
                "@id": "http://vocab.getty.edu/aat/300417531",
                "skos.prefLabel": {
                    "@value": "tentoonstelling",
                    "@language": "nl"
                }
            }
            // Event stream metadata
            mappedObject["dcterms:isVersionOf"] = objectURI;
            mappedObject["prov:generatedAtTime"] = now;

            // Convenience method to make our URI dereferenceable by District09
            if (versionURI.indexOf('stad.gent/id') != -1) mappedObject["foaf:page"] = versionURI.replace("/id", "/data");

            // referentienummer
            if (!mappedObject["Object.identificator"]) mappedObject["Object.identificator"] = [];
            if (input['reference_number'] && input['reference_number'][0]) {
                const id = {
                    "@type": "Identificator",
                    "@id": `${this._baseURI}identificatiesysteem/${priref}/${input["reference_number"][0]}/${now}`,
                    "Identificator.identificator": {
                        "@value": input["reference_number"][0],
                        "@type": `${this._baseURI}identificatiesysteem/referentienummer`
                    }
                }
                    mappedObject["Object.identificator"].push(id);
            }

            // priref
            const prirefIdentificator = {
                "@type": "Identificator",
                "@id": `${this._baseURI}identificatiesysteem/${priref}/${priref}/${now}`,
                "Identificator.identificator": {
                    "@value": priref,
                    "@type": `${this._baseURI}identificatiesysteem/priref`
                }
            };
            mappedObject["Object.identificator"].push(prirefIdentificator);

            // tentoonstellings titel.
            if (input['title'] && input['title'][0]) {
                mappedObject["cidoc:P1_is_identified_by"] = {
                    "@type": "cidoc:E33_E41_Linguistic_Appellation",
                    "@id": `${this._baseURI}identificatiesysteem/${priref}/${input['title'][0]}/${now}`,
                    "inhoud": {
                        "@value": input['title'][0],
                        "@language": "nl"
                    }
                };
            }

            // todo: alternatieve titel.

            // startdatum + einddatum tentoonstelling.
            if (input['date.start'] && input['date.end']) mappedObject["Gebeurtenis.tijd"] = {
                "@value": input["date.start"] + "/" + input["date.end"],
                "@type": "http://id.loc.gov/datatypes/edtf/EDTF"
            }

            // locatie waar de tentoonstelling ploatsvindt.
            if (input.venue[0]['venue'] && input.venue[0]['venue.lref']) {
                const placeURI = await this._adlib.getURIFromPriref("personen", input.venue[0]["venue.lref"][0], "concept");
                const placeLabel = input.venue[0]['venue'][0];
                mappedObject["Gebeurtenis.plaats"] = {
                    "@type": "Plaats",
                    "@id": `${this._baseURI}identificatiesysteem/${priref}/plaats/${now}`,
                    "equivalent": {
                        "@id": placeURI,
                        "skos:prefLabel": {
                            "@value": placeLabel,
                            "@language": "nl"
                        }
                    }
                }
            }

            // organisator van de tentoonstelling
            if (input.organiser && input.organiser[0]["organiser"] && input.organiser[0]["organiser.lref"]) {
                const placeURI = await this._adlib.getURIFromPriref("personen", input.organiser[0]["organiser.lref"][0], "concept");
                const placeLabel = input.organiser[0]["organiser"][0];
                mappedObject["uitgevoerdDoor"] = {
                    "@type": "Organisatie",
                    "equivalent": {
                        "@id": placeURI,
                        "skos:prefLabel": {
                            "@value": placeLabel,
                            "@language": "nl"
                        }
                    }
                }
            }

            // objecten tentoongesteld in tentoonstelling (obejctnummer + titel) //todo: if published; add URI.
            if (input.Object && input.Object[0]) {
                let objecten = [];
                for (let p in input.Object) {
                    if (input.Object[p]['object.object_number'] && input.Object[p]['object.object_number'][0]) {
                        const obj_number = input.Object[p]['object.object_number'][0];
                        const obj_title = input.Object[p]['object.title'][0];
                        const obj_priref = input.Object[p]['object.object_number.lref'][0];
                        const obj_uri = await this._adlib.getURIFromPriref("objecten", obj_priref, "mensgemaaktobject", "dmg");

                        const object = {
                            "@type": "MensgemaaktObject",
                            "@id": obj_uri,
                            "MensgemaaktObject.titel": obj_title
                        };

                        const objectnummer_identificator = {
                            "@type": "Identificator",
                            "@id": `${this._baseURI}identificatiesysteem/${priref}/${obj_number}/${now}`,
                            "Identificator.identificator": {
                                "@value": obj_number,
                                "@type": `${this._baseURI}identificatiesysteem/objectnummer`
                            }
                        };

                        const priref_identificator = {
                            "@type": "Identificator",
                            "@id": `${this._baseURI}identificatiesysteem/${priref}/${obj_priref}/${now}`,
                            "Identificator.identificator": {
                                "@value": obj_priref,
                                "@type": `${this._baseURI}identificatiesysteem/priref`
                            }
                        };
                        object["Object.identificator"] = [];
                        object["Object.identificator"].push(objectnummer_identificator);
                        object["Object.identificator"].push(priref_identificator);


                        objecten.push(object);
                    }
                }
                if (!mappedObject["Activiteit.gebruiktObject"]) mappedObject["Activiteit.gebruiktObject"] = [];
                mappedObject["Activiteit.gebruiktObject"] = mappedObject["Activiteit.gebruiktObject"].concat(objecten);
            }
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



