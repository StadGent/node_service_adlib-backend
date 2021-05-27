import { Transform } from 'stream';
import Config from "../../config/config.js";
import Utils from "../utils.js";

const config = Config.getConfig();

export default class TermenMapper extends Transform {
    constructor(options) {
        super({objectMode: true});

        this._context = [
            "https://data.vlaanderen.be/context/persoon-basis.jsonld",
            "https://data.vlaanderen.be/doc/applicatieprofiel/cultureel-erfgoed-object/kandidaatstandaard/2020-07-17/context/cultureel-erfgoed-object-ap.jsonld",
            {
               "skos": "http://www.w3.org/2004/02/skos/core#",
                "owl": "http://www.w3.org/2002/07/owl#"
            }
        ];
        this._adlibDatabase = options.adlibDatabase;
        this._institution = options.institution;
        this._institutionURI = config[options.institution] ? config[options.institution].institutionURI : "";

        this._baseURI = config.mapping.baseURI.endsWith('/') ? config.mapping.baseURI : `${config.mapping.baseURI}/` ;

        this._type = options.type ? options.type : "";
        this._adlib = options.adlib;

        this._conceptscheme = `${this._baseURI}conceptscheme/${this._type}`;

        this._correlator = options.correlator;
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
            let baseURI = this._baseURI.endsWith('/') ? this._baseURI : this._baseURI + '/';
            const priref = input["@attributes"].priref;

            // URI template: https://stad.gent/id/{type}/{scheme-id}/{concept-ref}
            let objectURI = baseURI + this._type + "/" + priref;
            let versionURI = objectURI + "/" + now;

            let isVervaardiger = false;
            let isPersoon = false;
            let isInstelling = false;
            for (let p in input['name.type']) {
                if (input['name.type'][p]['value'].includes('vervaardiger')) isVervaardiger = true;
                if (input['name.type'][p]['value'].includes('persoon')) isPersoon = true;
                if (input['name.type'][p]['value'].includes('instelling')) isInstelling = true;
            }

            const institution = Utils.getInstitutionNameFromPriref(priref);

            // Only process terms from "thesaurus" with status === "descriptor"
            // or personen/instellingen from "personen"
            if ((input['term.status'] && input['term.status'][0].value[2] === "descriptor")
                || (
                    // Design Museum Gent + STAM + Industriemuseum
                    ( (institution === 'dmg' || institution === 'stam' || institution === 'industriemuseum')
                        && (input['name.status'] && input['name.status'][0].value[2] === "descriptor")
                        && ((isVervaardiger && isPersoon) || (isVervaardiger && isInstelling))
                    )
                    ||
                    // Huis van Alijn
                    ( (institution === 'hva')
                        && (input['name.status'] && input['name.status'][0].value[2] === "descriptor")
                        && ((isVervaardiger || isPersoon) || (isVervaardiger || isInstelling))
                    )
                    ||
                    // Archief Gent
                    ( (institution === 'archiefgent')
                        && (input['name.status'] && input['name.status'][0].value[2] === "descriptor")
                        && (isPersoon) || (isInstelling)
                    )
                )
            ) {
                mappedObject["@id"] = versionURI;
                if (this._adlibDatabase === "personen") mappedObject["@type"] = "Agent";
                else mappedObject["@type"] = "skos:Concept";
                // Event stream metadata
                mappedObject["dcterms:isVersionOf"] = objectURI;
                mappedObject["prov:generatedAtTime"] = now;

                const uri = Utils.getURIFromRecord(input, priref, this._type, this._adlibDatabase);

                // External URI found
                if (uri != objectURI) mappedObject["owl:sameAs"] = uri;

                if (input['scope_note']) mappedObject["skos:scopeNote"] = input['scope_note'][0];
                if (input['biography'] && input['biography'][0]) mappedObject["skos:note"] = input['biography'][0];

                if (input['term']) {
                    mappedObject["skos:prefLabel"] = {
                        "@value": input['term'][0],
                        "@language": "nl"
                    };
                }

                mappedObject["skos:inscheme"] = this._conceptscheme;

                if (input['broader_term.lref'] && input['broader_term.lref'][0]) {
                    mappedObject["skos:broader"] = [];
                    for (let b in input['broader_term.lref']) {
                        const broaderPriref = input['broader_term.lref'][b];
                        const broaderTerm = input['broader_term'][b];
                        const broaderURI = Utils.getURIFromRecord(null, broaderPriref, 'concept', this._adlibDatabase);
                        mappedObject["skos:broader"].push({
                            "@id": broaderURI,
                            "skos:prefLabel": {
                                "@value": broaderTerm,
                                "@language": "nl"
                            }
                        });
                    }
                }

                if (input['narrower_term.lref'] && input['narrower_term.lref'][0]) {
                    mappedObject["skos:narrower"] = [];
                    for (let b in input['narrower_term.lref']) {
                        const narrowerPriref = input['narrower_term.lref'][b];
                        const narrowerTerm = input['narrower_term'][b];
                        const narrowerURI = Utils.getURIFromRecord(null, narrowerPriref, 'concept', this._adlibDatabase);
                        mappedObject["skos:narrower"].push({
                            "@id": narrowerURI,
                            "skos:prefLabel": {
                                "@value": narrowerTerm,
                                "@language": "nl"
                            }
                        });
                    }
                }

                // Aanduiden waarvoor term gebruikt wordt (objectnaam - plaats - onderwerp - ...)
                if (input['term.type'] && input['term.type'][0]) {
                    mappedObject["skos:note"] = [];
                    for (let t in input['term.type']) {
                        const termTypeNl = input['term.type'][t]['value'][2];
                        mappedObject["skos:note"].push({
                            "@value": termTypeNl,
                            "@language": "nl"
                        });
                        const termTypeEn = input['term.type'][t]['value'][1];
                        mappedObject["skos:note"].push({
                            "@value": termTypeEn,
                            "@language": "en"
                        });
                    }
                }

                // scopenote
                if (input['scope.note'] && input['scope.note'][0]) {
                    mappedObject["skos:scopeNote"] = input['scope.note'][0];
                }

                if (this._adlibDatabase === "personen") {
                    // Code naar instelling voor agents
                    const institutionId = parseInt(priref.substr(0, 2));
                    const institutionURI = Utils.getInstitutionURIFromPrirefId(institutionId);
                    mappedObject["prov:wasAttributedTo"] = {
                        "@id": institutionURI
                    };

                    // geboortedatum
                    if (input['birth.date.start'] && input['birth.date.start'][0]) {
                        mappedObject['heeftGeboorte'] = {
                            "@type": "Geboorte",
                            "datum": input['birth.date.start'][0]
                        };
                    }
                    // geboorteplaats
                    if (input['birth.place'] && input['birth.place'][0]) {
                        if (!mappedObject["heeftGeboorte"]) mappedObject["heeftGeboorte"] = {
                            "@type": "Geboorte"
                        };
                        const birthPlaceLabel = input["birth.place"][0];
                        //if (input['birth.place.lref'] && input['birth.place.lref'][0]) {
                        const birthPlaceURI = await this._adlib.getURIFromPriref("thesaurus", input["birth.place.lref"][0], "concept");
                        //}
                        mappedObject["heeftGeboorte"]["plaats"] = {
                            "@id": birthPlaceURI,
                            "@type": "Plaats",
                            "label": {
                                "@value": birthPlaceLabel,
                                "@language": "nl"
                            }
                        };
                    }

                    // sterftedatum
                    if (input['death.date.start'] && input['death.date.start'][0]) {
                        mappedObject['heeftOverlijden'] = {
                            "@type": "Overlijden",
                            "datum": input['death.date.start'][0]
                        };
                    }

                    // sterfteplaats
                    if (input['death.place'] && input['death.place'][0]) {
                        if (!mappedObject["heeftOverlijden"]) mappedObject["heeftOverlijden"] = {
                            "@type": "Overlijden"
                        };
                        const deathPlaceLabel = input["death.place"][0];
                        //if (input['death.place.lref'] && input['death.place.lref'][0]) {
                        const deathPlaceURI = await this._adlib.getURIFromPriref("thesaurus", input["death.place.lref"][0], "concept");
                        //}
                        mappedObject["heeftOverlijden"]["plaats"] = {
                            "@id": deathPlaceURI,
                            "@type": "Plaats",
                            "label": {
                                "@value": deathPlaceLabel,
                                "@language": "nl"
                            }
                        };
                    }

                    if (input['forename'] || input['surname']) {
                        // voornamen
                        if (input['forename'] && input['forename'][0]) {
                            mappedObject["voornaam"] = [];
                            for (const f in input['forename'])
                                mappedObject["voornaam"].push(input['forename'][f]);
                        }

                        // achternaam
                        if (input['surname'] && input['surname'][0]) {
                            let achternaam = "";
                            for (const f in input['forename'])
                                achternaam += input['surname'][f];
                            mappedObject["achternaam"] = achternaam;
                        }
                        // volledige naam
                        if (input['name'] && input['name'][0]) {
                            mappedObject["volledigeNaam"] = input['name'][0];
                        }
                    } else {
                        if (input['name'] && input['name'][0]) {
                            mappedObject["label"] = {
                                "@value": input['name'][0],
                                "@language": "nl"
                            };
                        }

                        // geslacht
                        if (input['gender'] && input['gender'][0]) {
                            if (input['gender'][0]["value"].contains('man')) mappedObject["geslacht"] = "http://publications.europa.eu/resource/authority/human-sex/MALE";
                            else if (input['gender'][0]["value"].contains('vrouw')) mappedObject["geslacht"] = "http://publications.europa.eu/resource/authority/human-sex/FEMALE";
                            else mappedObject["geslacht"] = "http://publications.europa.eu/resource/authority/human-sex/NKN";
                        }

                        // relatie naar andere bron
                        if (input['Source'] && input['Source'][0]) {
                            mappedObject["owl:sameAs"] = [];
                            for (const f in input['Source']) {
                                const bron = input['Source'][f]["source"] + input['Source'][f]["source.number"];
                                mappedObject["owl:sameAs"].push(bron);
                            }
                        }

                        // relatie (use)
                        if (input['use'] && input['use'][0]) {
                            mappedObject["skos:related"] = [];
                            for (const f in input['use']) {
                                const useLabel = input['use'][f];
                                const useURI = await this._adlib.getURIFromPriref("thesaurus", input["use.lref"][f], "concept");
                                mappedObject["skos:related"].push({
                                    "@id": useURI,
                                    "Entiteit.beschrijving": {
                                        "@value": useLabel,
                                        "@language": "nl"
                                    }
                                });
                            }
                        }

                        // relatie used_for
                        if (input['used_for'] && input['used_for'][0]) {
                            if (!mappedObject["skos:related"]) mappedObject["skos:related"] = [];
                            for (const f in input['used_for']) {
                                const usedForLabel = input['used_for'][f];
                                const usedForURI = await this._adlib.getURIFromPriref("thesaurus", input["used_for.lref"][f], "concept");
                                mappedObject["skos:related"].push({
                                    "@id": usedForURI,
                                    "Entiteit.beschrijving": {
                                        "@value": usedForLabel,
                                        "@language": "nl"
                                    }
                                });
                            }
                        }

                        // beroep
                        if (input['occupation'] && input['occupation'][0]) {
                            mappedObject["Agent.voerdeUit"] = [];
                            for (const f in input['occupation']) {
                                const occupationLabel = input['occupation'][f];
                                const occupationURI = await this._adlib.getURIFromPriref("thesaurus", input["occupation.lref"][f], "concept");
                                mappedObject["Agent.voerdeUit"].push({
                                    "@type": "Activiteit",
                                    "Entiteit.type": occupationURI,
                                    "Entiteit.beschrijving": {
                                        "@value": occupationLabel,
                                        "@language": "nl"
                                    }
                                });
                            }
                        }

                        // nationaliteit
                        if (input['nationality'] && input['nationality'][0]) {
                            mappedObject["heeftNationaliteit"] = {
                                "@type": "Nationaliteit",
                                "Entiteit.beschrijving": {
                                    "@value": input['nationality'][0],
                                    "@language": "nl"
                                }
                            };
                        }
                    }
                }
                done(null, JSON.stringify(mappedObject));
            }
        } catch (e) {
            console.error(e);
        }
    }
}