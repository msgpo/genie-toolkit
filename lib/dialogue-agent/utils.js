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

const ThingTalk = require('thingtalk');
const Ast = ThingTalk.Ast;

async function tryGetCurrentLocation(dlg) {
    const gps = dlg.manager.platform.getCapability('gps');
    if (gps === null)
        return null;
    const location = await gps.getCurrentLocation();
    if (location === null) {
        console.log('GPS location not available');
        return null;
    } else {
        return new Ast.Value.Location(new Ast.Location.Absolute(location.latitude, location.longitude, location.display||null));
    }
}

module.exports = {
    tryGetCurrentLocation
};
