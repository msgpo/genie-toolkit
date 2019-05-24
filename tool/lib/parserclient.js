// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Almond
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const ThingTalk = require('thingtalk');
const Tp = require('thingpedia');
const qs = require('qs');

const TokenizerService = require('../../lib/tokenizer');
const Predictor = require('../../lib/predictor');
const Utils = require('../../lib/utils');

class LocalParserClient {
    constructor(modeldir, locale) {
        this._locale = locale;
        this._tokenizer = TokenizerService.get('local');
        this._predictor = new Predictor('local', modeldir);
    }

    async start() {
        await this._predictor.start();
    }
    async stop() {
        await this._predictor.stop();
        await this._tokenizer.end();
    }

    async tokenize(utterance, contextEntities) {
        const tokenized = await this._tokenizer.tokenize(this._locale, utterance);
        Utils.renumberEntities(tokenized, contextEntities);
        return tokenized;

    }
    async sendUtterance(utterance, tokenized, contextCode, contextEntities) {
        let tokens, entities;
        if (tokenized) {
            tokens = utterance.split(' ');
            entities = {};
            Object.assign(entities, contextEntities);
        } else {
            const tokenized = await this._tokenizer.tokenize(this._locale, utterance);
            Utils.renumberEntities(tokenized, contextEntities);
            tokens = tokenized.tokens;
        }

        const candidates = await this._predictor.predict(tokens, contextCode);
        return { tokens, candidates, entities };
    }
}

class RemoteParserClient {
    constructor(baseUrl, locale) {
        this._locale = locale;
        this._baseUrl = baseUrl + '/' + this._locale;
    }

    async start() {}
    async stop() {}

    tokenize(utterance) {
        const data = {
            q: utterance,
        };

        let url = `${this._baseUrl}/tokenize?${qs.stringify(data)}`;

        return Tp.Helpers.Http.get(url).then((data) => {
            var parsed = JSON.parse(data);

            if (parsed.error)
                throw new Error('Error received from Genie-Parser server: ' + parsed.error);

            return parsed;
        });
    }

    async sendUtterance(utterance, tokenized, contextCode, contextEntities) {
        const data = {
            q: utterance,
            store: 'no',
            thingtalk_version: ThingTalk.version,
            tokenized: tokenized ? '1' : '',
            skip_typechecking: '1'
        };

        let response;
        if (contextCode !== undefined) {
            data.context = contextCode.join(' ');
            data.entities = contextEntities;

            response = await Tp.Helpers.Http.post(`${this._baseUrl}/query`, qs.stringify(data), {
                dataContentType: 'application/x-www-form-urlencoded'
            });
        } else {


            let url = `${this._baseUrl}/query?${qs.stringify(data)}`;
            response = await Tp.Helpers.Http.get(url);
        }

        const parsed = JSON.parse(response);
        if (parsed.error)
            throw new Error('Error received from Genie-Parser server: ' + parsed.error);

        return parsed;
    }
}

module.exports = {
    get(url, locale) {
        if (url.startsWith('file://'))
            return new LocalParserClient(url.substring('file://'.length), locale);
        else
            return new RemoteParserClient(url, locale);
    }
};
