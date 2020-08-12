// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Genie
//
// Copyright 2019-2020 The Board of Trustees of the Leland Stanford Junior University
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
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
"use strict";

const fs = require('fs');
const Stream = require('stream');
const csvparse = require('csv-parse');
const csvstringify = require('csv-stringify');

const StreamUtils = require('../lib/utils/stream-utils');
const I18n = require('../lib/i18n');

const { maybeCreateReadStream, } = require('./lib/argutils');

class TokenizerStream extends Stream.Transform {
    constructor(options) {
        super({ objectMode: true });

        this._tokenizer = I18n.get(options.locale).getTokenizer();
    }

    _transform(row, encoding, callback) {
        if (row.length < 1 || !row[0]) {
            callback();
            return;
        }

        let value, preprocessed, weight;
        if (row.length === 1) {
            value = row[0];
            weight = 1.0;
        } else if (row.length === 2) {
            if (isFinite(+row[1])) {
                value = row[0];
                weight = row[1];
            } else {
                value = row[0];
                preprocessed = row[1];
                weight = 1.0;
            }
        } else {
            value = row[0];
            preprocessed = row[1];
            weight = parseFloat(row[2]) || 1.0;
        }
        if (!(weight > 0.0))
            weight = 1.0;

        if (preprocessed !== undefined) {
            callback(null, [value, preprocessed, weight]);
        } else {
            const result = this._tokenizer.tokenize(value);
            // ignore lines with uppercase (entity) tokens
            if (result.tokens.some((t) => /[A-Z]/.test(t)))
                callback(null);
            else
                callback(null, [value, result.tokens.join(' '), weight]);
        }
    }

    _flush(callback) {
        process.nextTick(callback);
    }
}

module.exports = {
    initArgparse(subparsers) {
        const parser = subparsers.addParser('preprocess-string-dataset', {
            addHelp: true,
            description: "Preprocess (tokenize) a string value dataset."
        });
        parser.addArgument(['-l', '--locale'], {
            required: false,
            defaultValue: 'en-US',
            help: `BGP 47 locale tag of the language to use for tokenization (defaults to 'en-US', English)`
        });
        parser.addArgument(['-o', '--output'], {
            required: true,
            type: fs.createWriteStream
        });
        parser.addArgument('input_file', {
            nargs: '+',
            type: maybeCreateReadStream,
            help: 'Input string datasets to tokenize (in TSV format); use - for standard input'
        });
    },

    async execute(args) {
        await StreamUtils.waitFinish(StreamUtils.chain(args.input_file, {})
            .pipe(csvparse({ delimiter: '\t', relax: true }))
            .pipe(new TokenizerStream(args))
            .pipe(csvstringify({ delimiter: '\t' }))
            .pipe(args.output));
    },
};
