// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Genie
//
// Copyright 2020 The Board of Trustees of the Leland Stanford Junior University
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Author: Silei Xu <silei@cs.stanford.edu>
"use strict";

const fs = require('fs');
const assert = require('assert');
const ThingTalk = require('thingtalk');
const Ast = ThingTalk.Ast;
const Type = ThingTalk.Type;

const StreamUtils = require('../../../lib/utils/stream-utils');
const { clean } = require('../../../lib/utils/misc-utils');
const { cleanEnumValue, snakecase } = require('../lib/utils');
const genBaseCanonical = require('../lib/base-canonical-generator');
const {
    getPropertyList,
    getItemLabel,
    getPropertyLabel,
    getValueTypeConstraint,
    getOneOfConstraint,
    getAllowedUnits,
    getRangeConstraint
} = require('./utils');

const {
    PROPERTY_TYPE_OVERRIDE
} = require('./manual-annotations');

class SchemaProcessor {
    constructor(domains, propertiesByDomain, requiredPropertiesByDomain, output) {
        this._domains = domains;
        this._propertiesByDomain = propertiesByDomain;
        this._requiredPropertiesByDomain = requiredPropertiesByDomain;
        this._output = output;
    }

    async _getType(domain, property) {
        if (property in PROPERTY_TYPE_OVERRIDE)
            return PROPERTY_TYPE_OVERRIDE[property];

        const enumEntries = await getOneOfConstraint(property);
        if (enumEntries.length > 0)
            return Type.Enum(enumEntries.map(cleanEnumValue));

        const label = await getPropertyLabel(property);
        if (label.startsWith('date of'))
            return Type.Date;

        const units = await getAllowedUnits(property);
        if (units.length > 0) {
            if (units.includes('kilogram'))
                return Type.Measure('kg');
            if (units.includes('metre'))
                return Type.Measure('m');
            if (units.includes('second'))
                return Type.Measure('ms');
            if (units.includes('degree Celsius'))
                return Type.Measure('C');
            if (units.includes('metre per second'))
                return Type.Measure('mps');
            throw new TypeError('Unsupported measurement type with unit ' + units[0]);
        }

        const range = await getRangeConstraint(property);
        if (range)
            return Type.Number;

        const types = await getValueTypeConstraint(property);
        // FIXME: choose based on examples in domain when multiple types available
        if (types.length > 0) {
            // human type: Q5: human, Q215627: person
            if (types.some((type) => type.label === 'human' || type.label === 'person'))
                return Type.Entity(`org.wikidata:human`);

            // location type: Q618123: geographic object, Q2221906: geographic location
            if (types.some((type) => type.label === 'geographical object' || type.label === 'geographical location'))
                return Type.Location;

            return Type.Entity(`org.wikidata:${snakecase(types[0].label)}`);
        }

        return Type.String;

    }

    async _getCanonical(property, type) {
        const label = await getPropertyLabel(property);
        const canonical = {};
        genBaseCanonical(canonical, label, type);
        return canonical;
    }

    async run() {
        const queries = {};
        const actions = {};

        for (let domain of this._domains) {
            const domainLabel = await getItemLabel(domain);
            const properties = this._propertiesByDomain[domain];
            const args = [
                new Ast.ArgumentDef(
                    null,
                    Ast.ArgDirection.OUT,
                    'id',
                    Type.Entity(`org.wikidata:${snakecase(domainLabel)}`), {
                    nl: { canonical: { base: ['name'], passive_verb: ['named', 'called'] } }
                })
            ];
            for (let property of properties) {
                const type = await this._getType(domain, property);
                const annotations = {
                    nl: { canonical: await this._getCanonical(property, type) }
                };
                args.push(new Ast.ArgumentDef(null, Ast.ArgDirection.OUT, property, type, annotations));
            }
            const qualifiers = { is_list: true, is_monitorable: false };
            const annotations = {
                nl: { canonical: clean(domainLabel), confirmation: clean(domainLabel) },
                impl: { wikidata_subject: new Ast.Value.String(domain) }
            };
            if (domain in this._requiredPropertiesByDomain) {
                annotations.impl.required_properties = new Ast.Value.Array(
                    this._requiredPropertiesByDomain[domain].map((p) => new Ast.Value.String(p))
                );
            }

            queries[domain] = new Ast.FunctionDef(
                null, 'query', null, domain, null, qualifiers, args, annotations);


        }

        const imports = [
            new Ast.ImportStmt.Mixin(null, ['loader'], 'org.thingpedia.v2', []),
            new Ast.ImportStmt.Mixin(null, ['config'], 'org.thingpedia.config.none', [])
        ];

        const classdef = new Ast.ClassDef(null, 'org.wikidata', null,
            { imports, queries, actions }, {
                nl: {
                    name: `Wikidata for domain ${this._domains.join(', ')}`,
                    description: 'Natural language dialogues over Wikidata knowledge base.'
                },
            }, {
                is_abstract: false
            });

        this._output.end(classdef.prettyprint());
        await StreamUtils.waitFinish(this._output);
    }
}


module.exports = {
    initArgparse(subparsers) {
        const parser = subparsers.addParser('wikidata-process-schema', {
            addHelp: true,
            description: "Generate schema.tt given a list of domains. "
        });
        parser.addArgument(['-o', '--output'], {
            required: true,
            type: fs.createWriteStream
        });
        parser.addArgument('--domains', {
            required: true,
            help: 'domains (by item id) to include in the schema, split by comma (no space)'
        });
        parser.addArgument('--properties', {
            nargs: '+',
            required: false,
            help: 'properties to include for each domain, properties are split by comma (no space);\n' +
                'use "default" to include properties included in P1963 (properties of this type);\n' +
                'exclude a property by placing a minus sign before its id (no space)'
        });
        parser.addArgument('--required-properties', {
            nargs: '+',
            required: false,
            help: 'the subset of properties that are required to be non-empty.'
        });
    },

    async execute(args) {
        const domains = args.domains.split(',');
        const requiredPropertiesByDomain = {};
        if (args.required_properties) {
            for (let i = 0; i < domains.length; i++) {
                const domain = domains[i];
                requiredPropertiesByDomain[domain] = args.required_properties[i].split(',');
            }
        }

        const propertiesByDomain = {};
        if (args.properties) {
            // if provided, property lists should match the number of domains
            assert(Array.isArray(args.properties) && args.properties.length === domains.length);
            for (let i = 0; i < domains.length; i++) {
                const domain = domains[i];
                const properties = args.properties[i].split(',');
                propertiesByDomain[domain] = properties.includes('default') ? await getPropertyList(domain) : [];
                for (let property of properties) {
                    if (property === 'default')
                        continue;
                    if (property.startsWith('-')) {
                        property = property.slice(1);
                        let index = propertiesByDomain[domain].indexOf(property);
                        if (index > -1)
                            propertiesByDomain[domain].splice(index, 1);
                    } else if (!propertiesByDomain[domain].includes(property)) {
                        propertiesByDomain[domain].push(property);
                    }
                }
            }
        } else {
            for (let domain of domains)
                propertiesByDomain[domain] = await getPropertyList(domain);
        }
        const schemaProcessor = new SchemaProcessor(domains, propertiesByDomain, requiredPropertiesByDomain, args.output);
        schemaProcessor.run();
    }
};
