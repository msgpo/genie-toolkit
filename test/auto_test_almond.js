// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

require('./polyfill');

const Almond = require('../lib/almond');

const Mock = require('./mock');

var buffer = '';
function writeLine(line) {
    //console.log(line);
    buffer += line + '\n';
}
function flushBuffer() {
    buffer = '';
}

var app = null;
function loadOneApp(code) {
    app = code;
}

class TestDelegate {
    constructor() {
    }

    send(what) {
        writeLine('>> ' + what);
        // die horribly if something does not work
        if (what.indexOf('that did not work') >= 0)
            setImmediate(() => process.exit(1));
    }

    sendPicture(url) {
        writeLine('>> picture: ' + url);
    }

    sendRDL(rdl) {
        writeLine('>> rdl: ' + rdl.displayTitle + ' ' + rdl.callback);
    }

    sendChoice(idx, what, title, text) {
        writeLine('>> choice ' + idx + ': ' + title);
    }

    sendLink(title, url) {
        writeLine('>> link: ' + title + ' ' + url);
    }

    sendButton(title, json) {
        writeLine('>> button: ' + title + ' ' + JSON.stringify(json));
    }

    sendAskSpecial(what) {
        writeLine('>> ask special ' + what);
    }
}

class MockUser {
    constructor() {
        this.id = 1;
        this.account = 'FOO';
        this.name = 'Alice Tester';
    }
}

// TEST_CASES is a list of scripts
// each script is a sequence of inputs and ouputs
// inputs are JSON objects in sempre syntax, outputs are buffered responses
// the last element of each script is the ThingTalk code that should be
// generated as a result of the script (or null if the script should not
// generate ThingTalk)

const TEST_CASES = [
    [['bookkeeping', 'special', 'special:help'],
`>> Click on one of the following buttons to start adding command.
>> choice 0: When
>> choice 1: Get
>> choice 2: Do
>> ask special generic
`,
    null],

    [
    ['now', '=>', '@com.xkcd.get_comic', '=>', '@com.twitter.post_picture'],
`>> You have multiple Twitter devices. Which one do you want to use?
>> choice 0: Twitter Account foo
>> choice 1: Twitter Account bar
>> ask special generic
`,
    ['bookkeeping', 'choice', 0],
`>> What do you want to tweet?
>> choice 0: Use the title from Xkcd
>> choice 1: Use the picture url from Xkcd
>> choice 2: Use the link from Xkcd
>> choice 3: Use the alt text from Xkcd
>> choice 4: A description of the result
>> choice 5: None of above
>> ask special generic
`,
    ['bookkeeping', 'choice', 2],
`>> Upload the picture now.
>> choice 0: Use the picture url from Xkcd
>> choice 1: None of above
>> ask special generic
`,
    ['bookkeeping', 'choice', 0],
`>> Ok, so you want me to get get an Xkcd comic and then tweet the link with an attached picture with picture url equal to the picture url. Is that right?
>> ask special yesno
`,
    ['bookkeeping', 'special', 'special:yes'],
`>> Consider it done.
>> ask special null
`,
`{
    now => @com.xkcd(id="com.xkcd-6").get_comic() => @com.twitter(id="twitter-foo").post_picture(caption=link, picture_url=picture_url);
}`],

    [
    ['now', '=>', '@com.twitter.post'],
`>> You have multiple Twitter devices. Which one do you want to use?
>> choice 0: Twitter Account foo
>> choice 1: Twitter Account bar
>> ask special generic
`,
     ['bookkeeping', 'choice', 1],
`>> What do you want to tweet?
>> ask special generic
`,
     { code: ['bookkeeping', 'answer', 'QUOTED_STRING_0'], entities: { QUOTED_STRING_0: 'lol' } },
`>> Ok, so you want me to tweet "lol". Is that right?
>> ask special yesno
`,
     ['bookkeeping', 'special', 'special:yes'],
`>> Consider it done.
>> ask special null
`,
`{
    now => @com.twitter(id="twitter-bar").post(status="lol");
}`],

    [
    ['monitor', '(', '@com.twitter.home_timeline', ')', '=>', '@com.facebook.post', 'on', 'param:status:String', '=', 'param:text:String'],
`>> You have multiple Twitter devices. Which one do you want to use?
>> choice 0: Twitter Account foo
>> choice 1: Twitter Account bar
>> ask special generic
`,
    ['bookkeeping', 'choice', 1],
`>> Ok, so you want me to post the text on Facebook when tweets from anyone you follow changes. Is that right?
>> ask special yesno
`,
    ['bookkeeping', 'special', 'special:yes'],
`>> Consider it done.
>> ask special null
`,
`{
    monitor (@com.twitter(id="twitter-bar").home_timeline()) => @com.facebook(id="com.facebook-7").post(status=text);
}`],

    [
    ['now', '=>', '@com.xkcd.get_comic', '=>', 'notify'],
`>> ask special null
`,
`{
    now => @com.xkcd(id="com.xkcd-8").get_comic() => notify;
}`],

    /*[
    { code: ['now', '=>', '@com.xkcd.get_comic', '=>', 'notify'], entities: { USERNAME_0: "mom" } },
`>> Ok, so you want me to get an Xkcd comic using Almond of Mom Corp Inc.. Is that right?
>> ask special yesno
`,
    ['bookkeeping', 'special', 'special:yes'],
`>> Sending rule to Mom Corp Inc.: get an Xkcd comic then send it to me
>> Consider it done.
>> ask special null
`,
`AlmondGenerated() {
    class @__dyn_0 extends @remote {
        trigger receive (in req __principal : Entity(tt:contact), in req __token : Entity(tt:flow_token), in req __kindChannel : Entity(tt:function), out number : Number, out title : String, out picture_url : Entity(tt:picture), out link : Entity(tt:url), out alt_text : String);
    }
    @__dyn_0.receive(__principal="mock-account:MOCK1234-phone:+1800666"^^tt:contact("Mom Corp Inc."), __token="XXX"^^tt:flow_token, __kindChannel="query:xkcd:get_comic"^^tt:function) , v_title := title, v_picture_url := picture_url, v_link := link, v_alt_text := alt_text => notify;
}`],*/

    [
    ['monitor', '(', '@security-camera.current_event', ')', '=>', '@com.twitter.post_picture'],
`>> You have multiple Security Camera devices. Which one do you want to use?
>> choice 0: Some Device 1
>> choice 1: Some Device 2
>> ask special generic
`,
    ['bookkeeping', 'choice', 0],
`>> You have multiple Twitter devices. Which one do you want to use?
>> choice 0: Twitter Account foo
>> choice 1: Twitter Account bar
>> ask special generic
`,
    ['bookkeeping', 'choice', 0],
`>> What do you want to tweet?
>> choice 0: Use the picture url from Security Camera
>> choice 1: A description of the result
>> choice 2: None of above
>> ask special generic
`,
    ['bookkeeping', 'choice', 2],
`>> What do you want to tweet?
>> ask special generic
`,
    { code: ['bookkeeping', 'answer', 'QUOTED_STRING_0'], entities: { QUOTED_STRING_0: 'lol' } },
`>> Upload the picture now.
>> choice 0: Use the picture url from Security Camera
>> choice 1: None of above
>> ask special generic
`,
    ['bookkeeping', 'choice', 0],
`>> Ok, so you want me to tweet "lol" with an attached picture with picture url equal to the picture url when the current event detected on your security camera changes. Is that right?
>> ask special yesno
`,
    ['bookkeeping', 'special', 'special:yes'],
`>> Consider it done.
>> ask special null
`,
`{
    monitor (@security-camera(id="security-camera-1").current_event()) => @com.twitter(id="twitter-foo").post_picture(caption="lol", picture_url=picture_url);
}`],

    [
    ['bookkeeping', 'special', 'special:makerule'],
`>> Click on one of the following buttons to start adding command.
>> choice 0: When
>> choice 1: Get
>> choice 2: Do
>> ask special generic
`,
    ['bookkeeping', 'choice', 0],
`>> Pick one from the following categories or simply type in.
>> button: Do it now {"code":["bookkeeping","special","special:empty"],"entities":{}}
>> button: Media {"code":["bookkeeping","category","media"],"entities":{}}
>> button: Social Networks {"code":["bookkeeping","category","social-network"],"entities":{}}
>> button: Home {"code":["bookkeeping","category","home"],"entities":{}}
>> button: Communication {"code":["bookkeeping","category","communication"],"entities":{}}
>> button: Health and Fitness {"code":["bookkeeping","category","health"],"entities":{}}
>> button: Services {"code":["bookkeeping","category","service"],"entities":{}}
>> button: Data Management {"code":["bookkeeping","category","data-management"],"entities":{}}
>> button: Back {"code":["bookkeeping","special","special:back"],"entities":{}}
>> ask special command
`,
    ['monitor', '(', '@security-camera.current_event', ')', '=>', 'notify'],
`>> Add more commands and filters or run your command if you are ready.
>> choice 0: When: when the current event detected on your security camera changes
>> choice 1: Get
>> choice 2: Do: notify me
>> choice 3: Add a filter
>> choice 4: Run it
>> ask special generic
`,
    ['bookkeeping', 'choice', 1],
`>> Pick one from the following categories or simply type in.
>> button: Media {"code":["bookkeeping","category","media"],"entities":{}}
>> button: Social Networks {"code":["bookkeeping","category","social-network"],"entities":{}}
>> button: Home {"code":["bookkeeping","category","home"],"entities":{}}
>> button: Communication {"code":["bookkeeping","category","communication"],"entities":{}}
>> button: Health and Fitness {"code":["bookkeeping","category","health"],"entities":{}}
>> button: Services {"code":["bookkeeping","category","service"],"entities":{}}
>> button: Data Management {"code":["bookkeeping","category","data-management"],"entities":{}}
>> button: Back {"code":["bookkeeping","special","special:back"],"entities":{}}
>> ask special command
`,
    ['now', '=>', '@com.xkcd.get_comic', '=>', 'notify'],
`>> Add more commands and filters or run your command if you are ready.
>> choice 0: When: when the current event detected on your security camera changes
>> choice 1: Get: get an Xkcd comic
>> choice 2: Do: notify me
>> choice 3: Add a filter
>> choice 4: Run it
>> ask special generic
`,
    ['bookkeeping', 'choice', 3],
`>> Pick the command you want to add filters to:
>> choice 0: When: when the current event detected on your security camera changes
>> choice 1: Get: get an Xkcd comic
>> choice 2: Back
>> ask special generic
`,
    ['bookkeeping', 'choice', 1],
`>> Pick the filter you want to add:
>> button: title is equal to $title {"code":["bookkeeping","filter","param:title:String","=","SLOT_0"],"entities":{},"slots":["title"],"slotTypes":{"argname":"String"}}
>> button: title is not equal to $title {"code":["bookkeeping","filter","param:title:String","!=","SLOT_0"],"entities":{},"slots":["title"],"slotTypes":{"argname":"String"}}
>> button: title contains $title {"code":["bookkeeping","filter","param:title:String","=~","SLOT_0"],"entities":{},"slots":["title"],"slotTypes":{"argname":"String"}}
>> button: picture url is equal to $picture_url {"code":["bookkeeping","filter","param:picture_url:Entity(tt:picture)","=","SLOT_0"],"entities":{},"slots":["picture_url"],"slotTypes":{"argname":"Entity(tt:picture)"}}
>> button: picture url is not equal to $picture_url {"code":["bookkeeping","filter","param:picture_url:Entity(tt:picture)","!=","SLOT_0"],"entities":{},"slots":["picture_url"],"slotTypes":{"argname":"Entity(tt:picture)"}}
>> button: link is equal to $link {"code":["bookkeeping","filter","param:link:Entity(tt:url)","=","SLOT_0"],"entities":{},"slots":["link"],"slotTypes":{"argname":"Entity(tt:url)"}}
>> button: link is not equal to $link {"code":["bookkeeping","filter","param:link:Entity(tt:url)","!=","SLOT_0"],"entities":{},"slots":["link"],"slotTypes":{"argname":"Entity(tt:url)"}}
>> button: alt text is equal to $alt_text {"code":["bookkeeping","filter","param:alt_text:String","=","SLOT_0"],"entities":{},"slots":["alt_text"],"slotTypes":{"argname":"String"}}
>> button: alt text is not equal to $alt_text {"code":["bookkeeping","filter","param:alt_text:String","!=","SLOT_0"],"entities":{},"slots":["alt_text"],"slotTypes":{"argname":"String"}}
>> button: alt text contains $alt_text {"code":["bookkeeping","filter","param:alt_text:String","=~","SLOT_0"],"entities":{},"slots":["alt_text"],"slotTypes":{"argname":"String"}}
>> button: Back {"code":["bookkeeping","special","special:back"],"entities":{}}
>> ask special generic
`,
    { code: ['bookkeeping', 'filter', 'param:title:String', '=~', 'SLOT_0'],
      slots: ['title'],
      slotTypes: { title: 'String' },
      entities: {} },
`>> What's the value of this filter?
>> ask special generic
`,
    "lol",
`>> Add more commands and filters or run your command if you are ready.
>> choice 0: When: when the current event detected on your security camera changes
>> choice 1: Get: get an Xkcd comic, title contains "lol"
>> choice 2: Do: notify me
>> choice 3: Add a filter
>> choice 4: Run it
>> ask special generic
`,
    ['bookkeeping', 'choice', 4],
`>> You have multiple Security Camera devices. Which one do you want to use?
>> choice 0: Some Device 1
>> choice 1: Some Device 2
>> ask special generic
`,
    ['bookkeeping', 'choice', 0],
`>> Ok, I'm going to notify you when the current event detected on your security camera changes and then get get an Xkcd comic if title contains "lol"
>> ask special null
`,
    `{
    (monitor (@security-camera(id="security-camera-1").current_event()) join (@com.xkcd(id="com.xkcd-9").get_comic()), (title =~ "lol")) => notify;
}`]
];

function roundtrip(input, output) {
    flushBuffer();
    return Promise.resolve().then(() => {
        if (typeof input === 'string') {
            //console.log('$ ' + input);
            return almond.handleCommand(input);
        } else if (Array.isArray(input)) {
            return almond.handleParsedCommand({ code: input, entities: {} });
        } else {
            //console.log('$ \\r ' + json);
            return almond.handleParsedCommand(input);
        }
    }).then(() => {
        if (output !== null && buffer !== output)
            throw new Error('Invalid reply from Almond: ' + buffer + '\n\nExpected: ' + output);
    });
}

function cleanToken(code) {
    if (code === null)
        return null;
    return code.replace(/__token="[a-f0-9]+"/g, '__token="XXX"');
}

let anyFailed = false;

function test(script, i) {
    console.error('Test Case #' + (i+1));

    flushBuffer();
    app = null;

    function step(j) {
        if (j === script.length-1)
            return Promise.resolve();

        return roundtrip(script[j], script[j+1]).then(() => step(j+2));
    }
    return roundtrip(['bookkeeping', 'special', 'special:nevermind'], null).then(() => step(0)).then(() => {
        var expected = script[script.length-1];
        app = cleanToken(app);
        expected = cleanToken(expected);
        if (app !== expected) {
            console.error('Test Case #' + (i+1) + ': does not match what expected');
            console.error('Expected: ' + expected);
            console.error('Generated: ' + app);
            anyFailed = true;
        } else {
            console.error('Test Case #' + (i+1) + ' passed');
        }
    }).catch((e) => {
        console.error('Test Case #' + (i+1) + ': failed with exception');
        console.error('Error: ' + e.message);
        console.error(e.stack);
        anyFailed = true;
    });
}

function promiseDoAll(array, fn) {
    function loop(i) {
        if (i === array.length)
            return Promise.resolve();

        return Promise.resolve(fn(array[i], i)).then(() => loop(i+1));
    }
    return loop(0);
}

var almond;

function main() {
    var engine = Mock.createMockEngine();
    // mock out getDeviceSetup
    engine.thingpedia.getDeviceSetup = (kinds) => {
        var ret = {};
        for (var k of kinds)
            ret[k] = {type:'none',kind:k};
        return Promise.resolve(ret);
    };
    // intercept loadOneApp
    engine.apps.loadOneApp = loadOneApp;

    var delegate = new TestDelegate();

    var sempreUrl;
    if (process.argv[2] !== undefined && process.argv[2].startsWith('--with-sempre='))
        sempreUrl = process.argv[2].substr('--with-sempre='.length);
    almond = new Almond(engine, 'test', new MockUser(), delegate,
        { debug: false, sempreUrl: sempreUrl, showWelcome: true });

    almond.start();
    flushBuffer();

    promiseDoAll(TEST_CASES, test).then(() => {
        if (anyFailed)
            process.exit(1);
    });
}
main();
