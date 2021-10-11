const {mapInhoudOnderwerpEigennaam} = require("./utils");
module.exports = {
    mapInstelling: (institutionURI, input, mappedObject) => {
        mappedObject["MaterieelDing.beheerder"] = institutionURI;
    },
    mapAfdeling: (institutionURI, input, mappedObject) => {
        if (input['administration_name'] && input['administration_name'][0]) {
            const administrationName = input['administration_name'][0];
            mappedObject["MaterieelDing.beheerder"] = {
                "@type": "OrganisatieEenheid",
                "voorkeursnaam": administrationName,
                "isEenheidVan": institutionURI
            };
        }
    },
    mapCollectie: async (input, mappedObject, adlib, baseURI) => {
        if (input["collection"] && input["collection"][0]) {
            mappedObject["MensgemaaktObject.maaktDeelUitVan"] = [];
            for (let c in input["collection"]) {
                const type = "concept";
                const collectionURI = await adlib.getURIFromPriref("thesaurus", input["collection.lref"][c], type);
                const adlibCollectionURI = `${baseURI}${type}/${input["collection.lref"][c]}`;

                let collectie = {
                    "@id": adlibCollectionURI,
                    "@type": "Collectie",
                    "Entiteit.beschrijving": input["collection"][c]
                }
                // when external URI is given, then Linked Art's typing pattern is used
                if (!collectie["Entiteit.type"]) collectie["Entiteit.type"] = [];
                if (collectionURI != adlibCollectionURI) collectie["Entiteit.type"].push({
                    "@id": collectionURI,
                    "label": {
                        "@value": input["collection"][c],
                        "@language": "nl"
                    }
                });
                collectie["Entiteit.type"].push({
                    "@id": "cest:Naam_collectie",
                    "label": "collectie"
                });

                mappedObject["MensgemaaktObject.maaktDeelUitVan"].push(collectie);
            }
        }
    },

    mapObjectnummer: (input, mappedObject, baseURI) => {
        if (input["object_number"]) {
            const id = {
                "@type": "Identificator",
                "Identificator.identificator": {
                    "@value": input["object_number"][0],
                    "@type": `${baseURI}identificatiesysteem/objectnummer`
                },
                "Entiteit.type": {
                    "@id": "cest:Waarde_objectnummer",
                    "label": "objectnummer"
                }
            };
            if (!mappedObject["Object.identificator"]) mappedObject["Object.identificator"] = [];
            mappedObject["Object.identificator"].push(id);
        }
    },

    mapAlternativeNumber: (input, mappedObject, baseURI) => {
        if (input["Alternative_number"]) {
            let an = [];
            for (let a in input["Alternative_number"]) {
                const number = input["Alternative_number"][a]['alternative_number'][0];
                const type = input["Alternative_number"][a]['alternative_number.type'][0];
                const id = {
                    "@type": "Identificator",
                    "Identificator.identificator": {
                        "@value": input["Alternative_number"],
                        "@type": `${baseURI}identificatiesysteem/${type}`
                    },
                    "Entiteit.type" : {
                        "@id": "cest:Type_alternatief_objectnummer",
                        "label": "alternatief_nummer"
                    }
                };
                an.push(id);
            }

            if (!mappedObject["Object.identificator"]) mappedObject["Object.identificator"] = [];
            mappedObject["Object.identificator"] = mappedObject["Object.identificator"].concat(an);
        }
    },

    mapRelatiesKoepelrecord: async (objectURI, input, mappedObject, adlib, baseURI) => {
        if (input['Part_of'] && input['Part_of'][0]) {
            // object - part of - dossier
            let dossiers = [];
            for (let p in input['Part_of']) {
                const title = input['Part_of'][p]['part_of.title'][0];
                const dossierPriref = input['Part_of'][p]['part_of_reference.lref'][0];
                const dossierURI = `${baseURI}dossier/${adlib._institution}/${dossierPriref}`;
                const dossier = {
                    "@id": dossierURI,
                    "@type": "GecureerdeCollectie",
                    "Collectie.naam": title
                };
                dossiers.push(dossier);
            }
            if (!mappedObject["MensgemaaktObject.maaktDeelUitVan"]) mappedObject["MensgemaaktObject.maaktDeelUitVan"] = [];
            mappedObject["MensgemaaktObject.maaktDeelUitVan"] = mappedObject["MensgemaaktObject.maaktDeelUitVan"].concat(dossiers);
        }

        if (input['Parts'] && input['Parts'][0]) {
            // dossier - has parts
            let objecten = [];
            for (let p in input['Parts']) {
                if (input['Parts'][p]['parts.title'] && input['Parts'][p]['parts.title'][0]) {
                    const title = input['Parts'][p]['parts.title'][0];
                    const objectURI = await adlib.getURIFromPriref("objecten", input['Parts'][p]['parts_reference.lref'][0], "mensgemaaktobject");
                    const object = {
                        "@id": objectURI,
                        "@type": "MensgemaaktObject",
                        "MensgemaaktObject.titel": title
                    };
                    objecten.push(object);
                }
            }
            if (!mappedObject["GecureerdeCollectie.bestaatUit"]) mappedObject["GecureerdeCollectie.bestaatUit"] = [];
            mappedObject["GecureerdeCollectie.bestaatUit"] = mappedObject["GecureerdeCollectie.bestaatUit"].concat(objecten);
        }
    },

    mapRelatiesKoepelRecordDossier: async (objectURI, input, mappedObject, adlib) => {
        // dossier = has works (stuk)
        if (input['Parts'] && input['Parts'][0]) {
            if (!mappedObject["Dossier.bestaatUit"]) mappedObject["Dossier.bestaatUit"] = [];

            // Overwrite type in URI from mensgemaaktobject to dossier
            mappedObject["@id"] = mappedObject["@id"].replace("mensgemaaktobject", "dossier");
            // Overwrite type from MensgemaaktObject to Dossier
            mappedObject["@type"] = "Dossier";

            for (let p in input['Parts']) {
                if (input['Parts'][p]['parts_reference.lref'] && input['Parts'][p]['parts_reference.lref'][0]) {
                    const naam = (input['Parts'][p]['parts.title'] && input['Parts'][p]['parts.title'][0]) ? input['Parts'][p]['parts.title'][0] : "";
                    const stukURI = await adlib.getURIFromPriref("objecten", input['Parts'][p]['parts_reference.lref'][0], "mensgemaaktobject");
                    const stuk = {
                        "@id": stukURI,
                        "@type": "Stuk",
                        "Stuk.naam": naam
                    };
                    mappedObject["Dossier.bestaatUit"].push(stuk);
                }
            }
        }
    },

    mapRecordType: (input, mappedObject) => {
        if (input["record_type"] && input["record_type"][0]) {
            const recordType = input["record_type"][0];
            mappedObject["Entiteit.type"] = {
                "@value": recordType
            }
        }
    },

    mapObjectnaam: async (objectURI, input, mappedObject, adlib) => {
        let c = [];
        for(let o in input.Object_name) {
            const objectnaamURI = await adlib.getURIFromPriref("thesaurus",input.Object_name[o]['object_name.lref'][0], "concept");

            c.push({
                "@type": "Classificatie",
                "Classificatie.getypeerdeEntiteit": objectURI,
                "Classificatie.toegekendType": {
                    "@id": objectnaamURI,
                    "skos:prefLabel": {
                        "@value": input.Object_name[o].object_name[0],
                        "@language": "nl"
                    }
                },
                "Entiteit.type" : {
                    "@id": "cest:Term_objectnaam",
                    "label": "objectnaam"
                }
            });
        }
        if (mappedObject["Entiteit.classificatie"]) mappedObject["Entiteit.classificatie"] = mappedObject["Entiteit.classificatie"].concat(c);
        else mappedObject["Entiteit.classificatie"] = c;
    },

    mapOnderdeelEnAantal: (input, mappedObject) => {
        if (input['number_of_parts'] && input['number_of_parts'][0]) {
            for (let p in input['number_of_parts']) {
                const nr = input['number_of_parts'][p];
                const part = input['part'][p];
                // todo
            }
        }
    },

    mapObjectCategorie: async (objectURI, input, mappedObject, adlib) => {
        // 	"object_category": ["decoratief object"],
        if (input["object_category"] && input["object_category"][0]) {
            let c = [];
            for (let cat in input["object_category"]) {
                let categoryName = input["object_category"][cat];
                const categoryNameURI = await adlib.getURIFromPriref("thesaurus", input["object_category.lref"][cat], "concept");

                c.push({
                    "@type": "Classificatie",
                    "Classificatie.getypeerdeEntiteit": objectURI,
                    "Classificatie.toegekendType": {
                        "@id": categoryNameURI,
                        "skos:prefLabel": {
                            "@value": categoryName,
                            "@language": "nl"
                        }
                    },
                    "Entiteit.type" : {
                        "@id": "cest:Objectcategorie",
                        "label": "object_category"
                    }
                });
            }
            if (mappedObject["Entiteit.classificatie"]) mappedObject["Entiteit.classificatie"] = mappedObject["Entiteit.classificatie"].concat(c);
            else mappedObject["Entiteit.classificatie"] = c;
        }
    },

    mapTitel: (input, mappedObject) => {
        if (input.Title && input.Title[0].title) mappedObject["MensgemaaktObject.titel"] = {
            "@value": input.Title[0].title[0],
            "@language": "nl"
        };
    },

    mapBeschrijving: (input, mappedObject) => {
        if (input.Description && input.Description[0].description) mappedObject["Entiteit.beschrijving"] = {
            "@value": input.Description[0].description[0],
            "@language": "nl"
        };
    },

    mapOplage: (input, mappedObject) => {

    },

    mapConditie: (input, mappedObject) => {
        if(input.Condition && input.Condition[0]) mappedObject["MaterieelDing.conditiebeoordeling"] = processCondition(mappedObject["dcterms:isVersionOf"], input.Condition[0]);
    },

    //todo:         ********************-----------------**************************
    //todo;         koppeling naar thesaurus >> lijst bijhouden is niet realistisch

    mapStandplaatsDMG: (input, mappedObject) => {
        const opZaalDMG = ["DMG_A00_20", "DMG_A00_21", "DMG_A00_22", "DMG_A00_23", "DMG_A00_24", "DMG_A00_25", "DMG_A00_26", "DMG_A00_27", "DMG_A00_28",
            "DMG_A00_binnentuin", "DMG_A00_V2", "DMG_A01_20", "DMG_A01_21", "DMG_A01_22", "DMG_A01_23", "DMG_A01_24", "DMG_A01_25", "DMG_A01_26", "DMG_A01_27",
            "DMG_A01_H1", "DMG_A01_H2", "DMG_A01_H5", "DMG_A01_H6", "DMG_A01_H7", "DMG_A01_23", "DMG_B00_20", "DMG_B02_20", "DMG_B-1_20"];

        if (input.Current_location && input.Current_location[0] && input.Current_location[0]["current_location.context"] && input.Current_location[0]["current_location.context"][0]) {
            const locationContext = input.Current_location[0]["current_location.context"][0];
            if (locationContext.startsWith('DMG_H') || (locationContext.startsWith('DMG_B01_20')) || (opZaalDMG.includes(locationContext))) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q1809071",
                    "label": "Design Museum Gent"
                };
            } else if (locationContext.startsWith('BELvue')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q728437",
                    "opmerking": "bruikleen: BELvue museum"
                };
            } else if (locationContext.startsWith('Hotel')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q2120186",
                    "opmerking": "bruikleen: objecten opgesteld in Hotel d'Hane Steenhuysen"
                };
            } else if (locationContext.startsWith('Museum voor Schone Kunsten')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q2365880",
                    "opmerking": "bruikleen: Museum voor Schone Kunsten (MSK)"
                };
            } else if (locationContext.startsWith('Sint-Pietersabdij')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q1170767",
                    "opmerking": "bruikleen: Sint-Pietersabdij"
                };
            } else if (locationContext.startsWith('Koninklijke Bibliotheek van België')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q383931",
                    "opmerking": "bruikleen: KBR"
                };
            } else if (locationContext.startsWith('M-Museum')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q2362660",
                    "opmerking": "bruikleen: M-leuven"
                };
            } else if (locationContext.startsWith('MAS')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q1646305",
                    "opmerking": "bruikleen: MAS"
                };
            } else if (locationContext.startsWith('STAM')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q980285",
                    "opmerking": "bruikleen: STAM"
                };
            } else if (locationContext.startsWith('Industriemuseum')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q2245203",
                    "opmerking": "bruikleen: Industriemuseum"
                };
            } else if (locationContext.startsWith('Verbeke')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q1888920",
                    "opmerking": "bruikleen: Verbeke Foundation"
                };
            } else if (locationContext.startsWith('Koninklijk Museum voor Schone Kunsten Antwerpen')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q1471477",
                    "opmerking": "bruikleen: KMSKA"
                };
            } else if (locationContext.startsWith('Nederlands Zilvermuseum Schoonhoven')) {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "@id": "https://www.wikidata.org/wiki/Q2246858",
                    "opmerking": "bruikleen: Nederlands Zilvermuseum Schoonhoven"
                };
            } else {
                mappedObject["MensgemaaktObject.locatie"] = {
                    "opmerking": "depot"
                };
            }
        }
    },

    mapVervaardiging: async (id, input, mappedObject, adlib) => {
        // Get ontwerp en uitvoering data
        let ontwerp_date = {
            "@value": "..",
            "@type": "http://id.loc.gov/datatypes/edtf/EDTF"
        };
        let productie_date = {
            "@value": "..",
            "@type": "http://id.loc.gov/datatypes/edtf/EDTF"
        };
        if (input["production.date.notes"]) {
            for (let n in input["production.date.notes"]) {
                let note = input["production.date.notes"][n];
                // we veronderstellen dat Production_date op hetzelfde niveau als de production note staat
                if (input.Production_date[n]) {
                    const p = input.Production_date[n];
                    let date = "";
                    if (p['production.date.start']) {
                        date = p['production.date.start'][0];
                        if (p['production.date.start.prec'] && p['production.date.start.prec'][0] === "circa") date += "~";
                        date += "/";
                        //todo: moeilijk om hier 1 cest veld aan toe te kennen. Eindresultaat in de stroom
                        // is een aggregaat van 4 velden in adlib. Hoe pakken we dit best aan of is het hier
                        // niet nodig om die aan te pakken?
                    } else {
                        date = "/";
                    }
                    if (p['production.date.end']) {
                        date += p['production.date.end'][0];
                        if (p['production.date.end.prec'] && p['production.date.end.prec'][0] === "circa") date += "~";
                    }

                    const ontwerpRegex = new RegExp('.*ontwerp.*');
                    const uitvoeringRegex = new RegExp('.*uitvoering.*');
                    const productieRegex = new RegExp('.*productie.*');
                    if (ontwerpRegex.test(note)) ontwerp_date["@value"] = date;
                    if (uitvoeringRegex.test(note) || productieRegex.test(note)) productie_date["@value"] = date;
                }
            }
        } else if (input["Production_date"] && input["Production_date"][0]) {
            // When no notes, use first production_date as production date
            const p = input["Production_date"][0];
            let date = "";
            if (p['production.date.start']) {
                date = p['production.date.start'][0];
                if (p['production.date.start.prec'] && p['production.date.start.prec'][0] === "circa") date += "~";
                date += '/';
                //todo: moeilijk om hier 1 cest veld aan toe te kennen. Eindresultaat in de stroom
                // is een aggregaat van 4 velden in adlib. Hoe pakken we dit best aan of is het hier
                // niet nodig om die aan te pakken?
            } else {
                date = '/';
            }
            if (p['production.date.end']) {
                date += p['production.date.end'][0];
                if (p['production.date.end.prec'] && p['production.date.end.prec'][0] === "circa") date += "~";
            }
            productie_date["@value"] = date;
        }

        // Loop over ontwerpers, uitvoerders en producenten
        let productions = [];
        for (let p in input["Production"]) {
            let pro = input["Production"][p];
            const personURI = (pro["creator.lref"] && pro["creator.lref"][0]) ? await adlib.getURIFromPriref("personen", pro["creator.lref"][0], "agent") : undefined;
            let c;
            if (pro['creator.role'] && pro['creator.role'][0] === "ontwerper") {
                // Een ontwerp is de creatie van het concept
                // Entiteit -> wordtNaarVerwezenDoor ConceptueelDing -> Creatie
                c = {
                    "@type": "Creatie",
                    "Gebeurtenis.tijd": ontwerp_date
                };
            // uitvoerder of producent
            } else if (!pro['creator.role'] || (pro['creator.role'] && pro['creator.role'][0] != "ontwerper")) {
                c = {
                    "@type": "Productie",
                    "Gebeurtenis.tijd": productie_date,
                    "Productie.product": id
                };

                // add techniques to the production event
                // part and notes are not mapped
                if (input.Technique) {
                    for (let t in input.Technique) {
                        if (input.Technique[t]["technique"] && input.Technique[t]["technique"][0]) {
                            const techniqueLabel = input.Technique[t]["technique"][0];
                            // const part = input.Technique[t]["technique.part"][0];
                            // const notes = input.Technique[t]["technique.notes"][0];
                            if (input.Technique[t]["technique.lref"] && input.Technique[t]["technique.lref"][0]) {
                                const techniqueURI = await adlib.getURIFromPriref("thesaurus", input.Technique[t]["technique.lref"][0], "concept");
                                if (!c["Activiteit.gebruikteTechniek"]) c["Activiteit.gebruikteTechniek"] = [];
                                c["Activiteit.gebruikteTechniek"].push({
                                    "@type": "TypeTechniek",
                                    "Entiteit.type": [{
                                        "@id": techniqueURI,
                                        "skos:prefLabel": {
                                            "@value": techniqueLabel,
                                            "@language": "nl"
                                        }
                                    }, {
                                        "@id": "cest:Term_techniek",
                                        "label": "techniek"
                                    }]
                                });
                            }
                        }
                    }
                }
            }

            if (personURI) {
                c["Activiteit.uitgevoerdDoor"] = {
                    "@type": "Agent",
                    "equivalent": {
                        "@id": personURI,
                        "@type": "Agent",
                        "label": {
                            "@value": pro["creator"][0],
                            "@language": "nl"
                        }
                    },
                    "Entiteit.type": {
                        "@id": "cest:Naam_vervaardiger",
                        "label": "vervaardiger"
                    }
                }
            }
            if (pro['production.place'] && pro['production.place.lref'] && pro['production.place.lref'][0] != "") {
                const placeURI = await adlib.getURIFromPriref("thesaurus", pro['production.place.lref'][0], "concept");
                c["Gebeurtenis.plaats"] = {
                    "@type": "Plaats",
                    "equivalent": {
                        "@id": placeURI,
                        "skos:prefLabel": {
                            "@value": pro['production.place'][0],
                            "@language": "nl"
                        }
                    },
                    "Entiteit.type": {
                        "@id": "cest:Naam_plaats_vervaardiging",
                        "label": "vervaardiging.plaats"
                    }
                };
            }

            if (personURI && pro['creator.role'] && pro['creator.role'][0] && pro['creator.role'][0] != "") {
                const roleLabel = pro['creator.role'][0];
                const roleURI = await adlib.getURIFromPriref("thesaurus", pro['creator.role.lref'][0], "concept");
                c["@reverse"] = {
                    "Rol.activiteit": {
                        "@type": "Rol",
                        "Rol.agent": personURI,
                        "Rol.rol": {
                            "@id": roleURI,
                            "skos:prefLabel": {
                                "@value": roleLabel,
                                "@language": "nl"
                            }
                        },
                        "Entiteit.type": {
                            "@id": "cest: Rol_vervaardiger",
                            "label": "vervaardiger.rol"
                        }
                    }
                }
            }

            if (pro['creator.role'] && pro['creator.role'][0] === "ontwerper") {
                mappedObject["Entiteit.wordtNaarVerwezenDoor"] = {
                    "@type": "ConceptueelDing",
                    "ConceptueelDing.heeftCreatie": c
                };
            } else {
                productions.push(c);
            }
        }

        if (mappedObject["MaterieelDing.productie"]) mappedObject["MaterieelDing.productie"] = mappedObject["MaterieelDing.productie"].concat(productions);
        else mappedObject["MaterieelDing.productie"] = productions;

        // when there is no Production activity, map technieken here
        if(!input.Production && input.Technique && input.Technique[0]) {
            let c = {
                "@type": "Productie",
                "Gebeurtenis.tijd": productie_date,
                "Productie.product": id,
                "Activiteit.gebruikteTechniek": []
            };
            for(let t in input.Technique) {
                if (input.Technique[t]["technique"] && input.Technique[t]["technique"][0]) {
                    const techniqueLabel = input.Technique[t]["technique"][0];
                    // const part = input.Technique[t]["technique.part"][0];
                    // const notes = input.Technique[t]["technique.notes"][0];
                    if (input.Technique[t]["technique.lref"] && input.Technique[t]["technique.lref"][0]) {
                        const techniqueURI = await adlib.getURIFromPriref("thesaurus", input.Technique[t]["technique.lref"][0], "concept");
                        c["Activiteit.gebruikteTechniek"].push({
                            "@type": "TypeTechniek",
                            "Entiteit.type": [{
                                "@id": techniqueURI,
                                "skos:prefLabel": {
                                    "@value": techniqueLabel,
                                    "@language": "nl"
                                }
                            }, {
                                "@id": "cest:Term_techniek",
                                "label": "techniek"
                            }]
                        });
                    }
                }
            }
            mappedObject["MaterieelDing.productie"].push(c);
        }
    },

    mapFysiekeKenmerken: async (objectURI, input, mappedObject, adlib) => {
        let components = {};
        // Materialen
        if(input.Material && input.Material[0]) {
            mappedObject["MensgemaaktObject.materiaal"] = [];
            for(let mat in input.Material) {
                for(let part in input.Material[mat]["material.part"]) {
                    const onderdeel = input.Material[mat]["material.part"][part];
                    for (let m in input.Material[mat]["material"]) {
                        const mate = input.Material[mat]["material"][m];
                        const materialURI = await adlib.getURIFromPriref("thesaurus", input.Material[mat]["material.lref"][m], "concept");
                        if (onderdeel != "" && onderdeel != "geheel") {
                            if (!components[onderdeel]) components[onderdeel] = {
                                "@type": "MaterieelDing"
                            };
                            if (!components[onderdeel]["Entiteit.beschrijving"]) components[onderdeel]["Entiteit.beschrijving"] = onderdeel;
                            if (!components[onderdeel]["MensgemaaktObject.materiaal"]) components[onderdeel]["MensgemaaktObject.materiaal"] = [];
                            components[onderdeel]["MensgemaaktObject.materiaal"].push({
                                "@type": "TypeMateriaal",
                                "Entiteit.type": [{
                                    "@id": "cest:Term_materiaal",
                                    "label": "materiaal"
                                }, {
                                    "@id": materialURI,
                                    "skos:prefLabel": {
                                        "@value": mate,
                                        "@language": "nl"
                                    }
                                }]
                            });
                        } else {
                            mappedObject["MensgemaaktObject.materiaal"].push({
                                "@type": "TypeMateriaal",
                                "Entiteit.type": [{
                                    "@id": materialURI,
                                    "skos:prefLabel": {
                                        "@value": mate,
                                        "@language": "nl"
                                    }
                                },{
                                    "@id": "cest:Term_materials",
                                    "label": "materiaal"
                                }]
                            });
                        }
                    }
                }
            }
        }

        // afmetingen
        if(input.Dimension && input.Dimension[0]) {
            mappedObject["MensgemaaktObject.dimensie"] = [];
            for(let d in input.Dimension) {
                let onderdeel = input.Dimension[d]["dimension.part"] ? input.Dimension[d]["dimension.part"][0] : "geheel";
                let afmeting = input.Dimension[d]["dimension.type"] ? input.Dimension[d]["dimension.type"][0] : "";
                let waarde = input.Dimension[d]["dimension.value"] ? input.Dimension[d]["dimension.value"][0] : "unknown";
                let eenheid = input.Dimension[d]["dimension.unit"] ? input.Dimension[d]["dimension.unit"][0] : "cm";

                if (onderdeel != "" && onderdeel != "geheel") {
                    if (!components[onderdeel]) components[onderdeel] = {
                        "@type": "MaterieelDing"
                    };
                    if (!components[onderdeel]["Entiteit.beschrijving"]) components[onderdeel]["Entiteit.beschrijving"] = onderdeel;
                    if (!components[onderdeel]["MensgemaaktObject.dimensie"]) components[onderdeel]["MensgemaaktObject.dimensie"] = [];
                    components[onderdeel]["MensgemaaktObject.dimensie"].push({
                        "@type": "Dimensie",
                        "Dimensie.beschrijving": "Dimensie van " + onderdeel,
                        "Dimensie.type": afmeting,
                        "Dimensie.waarde": waarde,
                        "Dimensie.eenheid": eenheid
                        //todo: hoe mappen we dit best naar CEST, ook hier vier velden. Is het nuttig om al deze velden
                        // afzonderlijk te gaan mappen?
                    });
                } else {
                    mappedObject["MensgemaaktObject.dimensie"].push({
                        "@type": "Dimensie",
                        "Dimensie.beschrijving": "Dimensie van geheel",
                        "Dimensie.type": afmeting,
                        "Dimensie.waarde": waarde,
                        "Dimensie.eenheid": eenheid
                        //todo: hoe mappen we dit best naar CEST, ook hier vier velden. Is het nuttig om al deze velden
                        // afzonderlijk te gaan mappen?
                    });
                }
            }
        }

        // Attach components to main object
        if (Object.keys(components).length > 0 && !mappedObject['MaterieelDing.bestaatUit']) mappedObject['MaterieelDing.bestaatUit'] = [];
        for (let c in components) {
            mappedObject['MaterieelDing.bestaatUit'].push(components[c]);
        }
    },

    mapVerwerving: async (objectURI, institutionURI, input, mappedObject, adlib) => {
        let v = {
            "@type": "Verwerving"
        };

        if (input["acquisition.date"]) {
            const datum = input["acquisition.date"][0];
            v["Gebeurtenis.tijd"] = {
                "@type": "Periode",
                "Periode.begin": datum,
                "Periode.einde": datum
                //todo
            };
        }

        if (input["acquisition.method"]) {
            const methode = input["acquisition.method"][0];
            const methodeURI = await adlib.getURIFromPriref("thesaurus", input["acquisition.method.lref"][0], "concept");
            v["Activiteit.gebruikteTechniek"] = {
                "@type": "TypeTechniek",
                "Entiteit.type": [{
                        "@id": methodeURI,
                        "skos:prefLabel": {
                            "@value": methode,
                            "@language": "nl"
                        }
                }, {
                    "@id": "cest:Term_verwervingsmethode",
                    "label": "verwerving.methode"
                }]
            };
        }
        if (input["acquisition.place"]) {
            const plaats = input["acquisition.place"] ? input["acquisition.place"][0] : "";
            const plaatsURI = await adlib.getURIFromPriref("thesaurus", input["acquisition.place.lref"][0], "concept");
            v["Gebeurtenis.plaats"] = {
                "@type": "Locatie",
                "Entiteit.type": [{
                    "@id": plaatsURI,
                    "skos:prefLabel": {
                        "@value": plaats,
                        "@language": "nl"
                    }
                    }, {
                    "@id": "cest:Plaats_verwervingsbron",
                    "label": "verwerving.plaats"
                }]
            };
        }

        v["Verwerving.overdrachtVan"] = objectURI;
        v["Verwerving.overgedragenAan"] = institutionURI;

        mappedObject["MaterieelDing.isOvergedragenBijVerwerving"] = v;
    },

    mapTentoonstelling: async (objectUri, input, mappedObject, adlib) => {
    if (input["Exhibition"]) {
        mappedObject["Entiteit.maaktDeelUitVan"] = [];
        for (let e in input["Exhibition"]) {
            // TODO: @id toevoegen van tentoonstelling
            let exh = {
                "@type": "Activiteit",
                "Entiteit.type": "http://vocab.getty.edu/aat/300054766" // Tentoonstelling
            };
            const exhibition = input["Exhibition"][e];
            if (exhibition["exhibition"] && exhibition["exhibition"][0]) {
                const beschrijving = exhibition["exhibition"] && exhibition["exhibition"][0] ? exhibition["exhibition"][0] : "";
                //exh["Entiteit.beschrijving"] = beschrijving;
                exh["Entiteit.beschrijving"] = {
                        "@value": beschrijving,
                        "@language": "nl"
                }
            }
            exh["Gebeurtenis.tijd"] = {
                "@value": "",
                "@type": "http://id.loc.gov/datatypes/edtf/EDTF"
            };
            // unknown period
            if (!exhibition["exhibition.date.start"] && !exhibition["exhibition.date.end"]) exh["Gebeurtenis.tijd"]["@value"] = "/";

            if (exhibition["exhibition.date.start"] && exhibition["exhibition.date.start"][0]) {
                exh["Gebeurtenis.tijd"]["@value"] = exhibition["exhibition.date.start"][0];
            }
            if (exhibition["exhibition.date.end"] && exhibition["exhibition.date.end"][0]) {
                exh["Gebeurtenis.tijd"]["@value"] += "/" + exhibition["exhibition.date.end"][0];
            }
            if (exhibition["exhibition.venue.place"] && exhibition["exhibition.venue.place"][0]) {
                const plaats = exhibition["exhibition.venue.place"][0];
                const plaatsURI = await adlib.getURIFromPriref("thesaurus", exhibition["exhibition.venue.place.lref"][0], "concept");
                exh["Gebeurtenis.plaats"] = {
                    "@id": plaatsURI,
                    "skos:prefLabel": {
                        "@value": plaats,
                        "@language": "nl"
                    }
                };
            }

            const c = {
                "@type": "Collectie",
                "gebruiktBijActiviteit": exh
            };
            mappedObject["Entiteit.maaktDeelUitVan"].push(c);
        }
    }
},


    mapTrefwoorden: async (objectURI, input, mappedObject, adlib) => {
        if (input['phys_characteristic.keyword'] && input['phys_characteristic.keyword'][0]) {
            let t = [];
            for(let k in input["phys_characteristic.keyword"]) {
                const trefwoordURI = await adlib.getURIFromPriref("thesaurus",input['phys_characteristic.keyword.lref'][k], "concept");
                const trefwoordLabel = input['phys_characteristic.keyword'][k];
                t.push({
                    "@type": "Classificatie",
                    "Classificatie.getypeerdeEntiteit": objectURI,
                    "Classificatie.toegekendType": {
                        "@id": trefwoordURI,
                        "skos:prefLabel": {
                            "@value": trefwoordLabel,
                            "@language": "nl"
                        }
                    }
                    //todo
                });
            }
            if (mappedObject["Entiteit.classificatie"]) mappedObject["Entiteit.classificatie"] = mappedObject["Entiteit.classificatie"].concat(t);
            else mappedObject["Entiteit.classificatie"] = t;
        }
    },


    mapAssociaties: async (objectURI, input, mappedObject, adlib) => {
        let informatieObject = {
            "@type": "InformatieObject",
            "InformatieObject.drager": objectURI,
            "InformatieObject.verwijstNaar": [],
            "InformatieObject.gaatOver": []
        };

        // Geass. Persoon / instelling
        if (input["Associated_person"] && input["Associated_person"][0]) {
            for (let p in input["Associated_person"]) {
                if (input["Associated_person"][p]["association.person"] && input["Associated_person"][p]["association.person"][0]) {
                    let personLabel = input["Associated_person"][p]["association.person"][0];
                    const personURI = await adlib.getURIFromPriref("personen", input["Associated_person"][p]["association.person.lref"][0], "agent");

                    informatieObject["InformatieObject.verwijstNaar"].push({
                        "@type": "Persoon",
                        "Entiteit.type": [{
                            "@id": personURI,
                            "label": personLabel
                        }, {
                            "@id": "cest:Naam_geassocieerde_persoon_of_instelling",
                            "label": "associatie.persoon"
                        }]
                    });
                }
            }
        }
        // Geass. Onderwerp
        if (input["Associated_subject"] && input["Associated_subject"][0]) {
            for (let p in input["Associated_subject"]) {
                if (input["Associated_subject"][p]["association.subject"] && input["Associated_subject"][p]["association.subject"][0]) {
                    const subjectLabel = input["Associated_subject"][p]["association.subject"][0];
                    const subjectURI = await adlib.getURIFromPriref("thesaurus", input["Associated_subject"][p]["association.subject.lref"][0], "concept");

                    informatieObject["InformatieObject.gaatOver"].push({
                        "@type": "Entiteit",
                        "Entiteit.type": [{
                            "@id": subjectURI,
                            "skos:prefLabel": {
                                "@value": subjectLabel,
                                "@language": "nl"
                            }
                        }, {
                                "@id": "cest:Naam_geassocieerd_concept",
                                "label": "associatie.onderwerp"
                            }]
                        });
                }
            }
        }
        // Geass. Periode
        if (input["Associated_period"] && input["Associated_period"][0]) {
            for (let p in input["Associated_period"]) {
                if (input["Associated_period"][p]["association.period"] && input["Associated_period"][p]["association.period"][0]) {
                    const periodLabel = input["Associated_period"][p]["association.period"][0];
                    const periodURI = await adlib.getURIFromPriref("thesaurus", input["Associated_period"][p]["association.period.lref"][0], "concept");

                    informatieObject["InformatieObject.verwijstNaar"].push({
                        "@type": "Entiteit",
                        "Entiteit.type": [{
                            "@id": periodURI,
                            "skos:prefLabel": {
                                "@value": periodLabel,
                                "@language": "nl"
                            }
                        },{
                            "@id": "cest:Periode",
                            "label": "associatie.periode"
                        }]
                    });
                }
            }
        }

        mappedObject["MensgemaaktObject.draagt"] = informatieObject;
    },

    mapBouwaanvraagArchief: async (objectURI, input, mappedObject, adlib) => {
        // vb. goedkeuring bouwaanvraag (Archief Gent)
        // steeds slechts 1 occurence!
        for (let p in input["Associated_period"]) {
            let datumStart;
            let datumEinde;
            if (input["Associated_period"][p]["association.period.date.start"] && input["Associated_period"][p]["association.period.date.start"][0])
                datumStart = input["Associated_period"][p]["association.period.date.start"][0];

            if (input["Associated_period"][p]["association.period.date.end"] && input["Associated_period"][p]["association.period.date.end"][0])
                datumEinde = input["Associated_period"][p]["association.period.date.end"][0];

            // Mapping goedkeuring bouwaanvraag
            if (input["Associated_period"][p]["association.period.assoc"] && input["Associated_period"][p]["association.period.assoc"][0] === "goedkeuring van de bouwaanvraag") {
                let b = {
                    "@type": "Activiteit", // beslissing
                    "Activiteit.naam": "goedkeuring van de bouwaanvraag"
                }
                if (datumStart) b["Activiteit.startdatum"] = datumStart;
                if (datumEinde) b["Activiteit.einddatum"] = datumEinde;

                // Goedkeuring van de bouwaanvraag moet beschreven geweest zijn in een legale verschijningsvorm (Stuk)
                // Stuk is gelinkt met het gebouw
                if(!mappedObject["Dossier.bestaatUit"]) mappedObject["Dossier.bestaatUit"] = [];
                mappedObject["Dossier.bestaatUit"].push({
                    "@type": "Stuk", // goedkeuringsdocument die gegenereerd is uit een beslissing
                    "@reverse": {
                        "Activiteit.genereert": b
                    }
                })
            }
        }
    },

    mapIconografie: async (input, mappedObject, adlib) => {
        // Content_person en Content_subject
        if (!mappedObject["Entiteit.beeldtUit"]) mappedObject["Entiteit.beeldtUit"] = [];

        if (input["Content_subject"] && input["Content_subject"][0]) {
            for (let s in input["Content_subject"]) {
                // Soortnaam, bv. huis
                if (input["Content_subject"][s]["content.subject"]) {
                    let e = {
                        "@type": "Entiteit",
                        "Entiteit.type": []
                    };
                    const subjectLabel = input["Content_subject"][s]["content.subject"][0];
                    const subjectURI = await adlib.getURIFromPriref("thesaurus", input["Content_subject"][s]["content.subject.lref"][0], "concept");

                    e["Entiteit.type"].push({
                        "@id": subjectURI,
                        "skos:prefLabel": {
                            "@value": subjectLabel,
                            "@language": "nl"
                        }
                    });
                    e["Entiteit.type"].push({
                        "@id": "cest:Naam_afgebeelde_gebeurtenis",
                        "label": "inhoud.onderwerp"
                    });
                    mappedObject["Entiteit.beeldtUit"].push(e);
                }

                // Iconografie - eigennaam, bv. Gravensteen
                if (input["Content_subject"][s]["content.subject.name"]) {
                    let e = {
                        "@type": "Entiteit",
                        "Entiteit.type": []
                    };
                    const eigennaamLabel = input["Content_subject"][s]["content.subject.name"][0];

                    e["Entiteit.type"].push({
                        "label": {
                            "@value": eigennaamLabel,
                            "@language": "nl"
                        }
                    });
                    e["Entiteit.type"].push({
                        "@id": "cest:Eigennaam_afgebeeld_onderwerp", // nog toe te voegen in CEST
                        "label": "inhoud.onderwerp.eigennaam"
                    });
                    mappedObject["Entiteit.beeldtUit"].push(e);
                }
            }
        }

        if (input["Content_person"] && input["Content_person"][0]) {
            if (!mappedObject["Entiteit.beeldtUit"]) mappedObject["Entiteit.beeldtUit"] = [];
            for (let p in input["Content_person"]) {
                if (input["Content_person"][p]["content.person.name"]) {
                    let personLabel = input["Content_person"][p]["content.person.name"][0];
                    const personURI = await adlib.getURIFromPriref("personen", input["Content_person"][p]["content.person.name.lref"][0], "agent");

                    mappedObject["Entiteit.beeldtUit"].push({
                        "@type": "Persoon",
                        "Entiteit.type": [{
                            "@id": personURI,
                            "label": {
                                "@value": personLabel,
                                "@language": "nl"
                            }
                        }, {
                            "@id": "cest:Naam_afgebeelde_persoon_of_instelling",
                            "label": "inhoud.persoon.naam"
                        }]
                    });
                }
            }
        }
    },
    mapOpschriften: (objectURI, input, mappedObject) => {
        let opschriften = [];

        if (input["Inscription"] && input["Inscription"][0]) {
            for (let i in input["Inscription"]) {
                if (input["Inscription"][i]["inscription.content"] && input["Inscription"][i]["inscription.content"][0]) {
                    let opschriftLabel = input["Inscription"][i]["inscription.content"][0];

                    opschriften.push({
                        "@type": "Taalobject",
                        // "Entiteit.beschrijving": opschriftLabel,
                        "inhoud": opschriftLabel, // wordt toegevoegd in OSLO
                        "Entiteit.classificatie": {
                            "Classificatie.getypeerdeEntiteit": objectURI,
                            "Classificatie.toegekendType": {
                                "@id": "http://vocab.getty.edu/aat/300028702",
                                "label": {
                                    "@value": "opschriften",
                                    "@language": "nl"
                                }
                            }
                        },
                        "Entiteit.type": {
                            "@id": "cest:Inhoud_opschrift",
                            "label": "inscriptie.inhoud"
                        }
                    });
                }
            }

            mappedObject["MensgemaaktObject.draagt"] = opschriften;
        }
    },
    mapMerken: (input, mappedObject) => {
        //console.log(input)
    }
};


// Draft
function processCondition(id, condition) {
    let c = {
        "@type": "Conditiebeoordeling",
        "conditie_van": id
    };
    if (condition["condition"]) {
        c["Conditiebeoordeling.vastgesteldeStaat"] = {
            "@type": "Conditie",
            "Conditie.nota": condition["condition"][0]
        };
    }

    if (condition["condition.date"] && condition["condition.date"][0] != "") {
        c["Conditie.periode"] = {
            "@type": "Periode",
            "Periode.begin": condition["condition.date"][0].begin,
            "Periode.einde": condition["condition.date"][0].end
        };
    }
    return c;
}
