// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of Genie
//
// Copyright 2019 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Mehrad Moradshahi <mehrad@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const DefaultLanguagePack = require('./default');

module.exports = class TagalogLanguagePack extends DefaultLanguagePack {
    isGoodWord(word) {
        // filter out words that cannot be in the dataset,
        // because they would be either tokenized/preprocessed out or
        // they are unlikely to be used with voice
        return /^([A-Za-zÑñʒɲŋ0-9][A-Za-zÑñʒɲŋ0-9.-]*|\u060C|\u061F)$/.test(word);
    }

    isGoodSentence(sentence) {
        if (sentence.length < 3)
            return false;
        if (['.', '\u060C', '\u061F', '!', ' '].includes(sentence[0]))
            return false;
        // (for|me|and|or|that|this|in|with|from|on|before|after)$
        return !/^(o|ako|at|o|na|ito|in|with|mula|on|bago|pagkatapos)$/.test(sentence);
    }

    isGoodNumber(number) {
        // [English numbers| Persian numbers]
        return /^([A-Za-z]*[0-9|\u0660-\u0669]+)$/.test(number);
    }

    isGoodPersonName(word) {
        return this.isGoodWord(word) || /^([A-Za-zÑñʒɲŋ]+\s[A-Za-zÑñʒɲŋ]+\s?\.?)$/.test(word);
    }
};