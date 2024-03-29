import { Transform } from 'stream';
import Config from "../../config/config.js";

const config = Config.getConfig();

export default class ObjectMapper extends Transform {
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
                "conforms_to": {
                    "@id": "dcterms:conformsTo",
                    "@type": "@id",
                    "@container": "@set"
                },
                "equivalent": {
                    "@id": "la:equivalent",
                    "@type": "@id"
                },
                "dig": "http://www.ics.forth.gr/isl/CRMdig/",
                "DigitalObject": {
                    "@id": "dig:D1_Digital_Object"
                },
                "kwalificatie": {
                    "@id": "http://purl.org/ontology/af/confidence"
                }
            }
        ];
        this._id = options.id;
        this._adlibDatabase = options.adlibDatabase;
        this._institution = options.institution;
        this._institutionURI = config[options.institution].institutionURI;

        this._baseURI = config.mapping.baseURI.endsWith('/') ? config.mapping.baseURI : config.mapping.baseURI + '/';

        this._adlib = options.adlib;
        this._correlator = options.correlator;
    }
}
