var http = require('http');
var url = require('url');
var startStopDaemon = require('start-stop-daemon');
var mysql = require('mysql');
var querystring = require('querystring');

var JaSAmApp = require('../JaSAm/JaSAmApp.js').JaSAmApp;
var Exception = require('../JaSAm/messages/Exception.js').Exception;
var Task = require('../JaSAm/tasks/Task.js').Task;
var Originate = require('../JaSAm/tasks/Originate.js').Originate;
var DNDOn = require('../JaSAm/tasks/DNDOn.js').DNDOn;
var DNDOff = require('../JaSAm/tasks/DNDOff.js').DNDOff;
var AsteriskEvent = require('../JaSAm/tasks/AsteriskEvent.js').AsteriskEvent;
var CallDetailRecord = require('../JaSAm/tasks/CallDetailRecord.js').CallDetailRecord;
var Tunnel = require('../JaSAm/tasks/Tunnel.js').Tunnel;
var NodeAjaxCall = require("./core/NodeAjaxCall.js").NodeAjaxCall;

var jaSAmApp = null;
var httpServer = null;
var options = {
    daemonFile: "log/nodeServer.dmn", 
    outFile: "log/nodeServer.out",
    errFile: "log/nodeServer.err",    
    onCrash: function(e){
        console.info("server crashed! Closing httpserver and restarting nodeServer now ...");
        httpServer.close();
        this.crashRestart();
    }
};

startStopDaemon(options, function() {

    jaSAmApp = new JaSAmApp("testmanager", "sehrsehrgeheim");
    var config = {};
    config[JaSAmApp.Configuration.baseUrl] =  "http://localhost:8088/asterisk/mxml";
    config[JaSAmApp.Configuration.autoLogin] =  true;
    config[JaSAmApp.Configuration.autoQueryEntities] =  true;
    config[JaSAmApp.Configuration.enableEventlistening] =  true;
    config[JaSAmApp.Configuration.enableEventBuffering] =  true;
    jaSAmApp.setConfiguration(config);

    var parser = require("libxml");
    jaSAmApp.getAsteriskManager().setParser(parser);

    var ajaxCall = new NodeAjaxCall();
    jaSAmApp.getAsteriskManager().setAjaxCall(ajaxCall);
    jaSAmApp.start(startServer, this);

});

function startServer(isSuccess){
    var now = new Date();
    if(!isSuccess){
        console.info(now.toString() + ": Fehler beim Starten der JaSAmApp!");
        return;
    }
    console.info(now.toString() + ": start server ...");
    httpServer = http.createServer(function (request, httpResponse) {
        try{

            var params = url.parse(request.url, true);
        
            var token = params['query']['token'];
            if(token === undefined || token != 123456)
                throw new Error("Access denied.");
        
            var extension = params['query']['extension'];
                        
            if(params['pathname'] == "/originateCall"){
            
                var remoteNumber = params['query']['remoteNumber'];
                if(remoteNumber === undefined)
                    throw new Error("Param remoteNumber is missing.");

                if(extension === undefined)
                    throw new Error("Param extension is missing.");
            
                execute(Originate, httpResponse, {
                    extension: extension, 
                    remoteNumber: remoteNumber
                });
            }else if(params['pathname'] == "/doNotDisturbOn"){
                if(extension === undefined)
                    throw new Error("Param extension is missing.");

                execute(DNDOn, httpResponse, {
                    extension: extension
                });
            }else if(params['pathname'] == "/doNotDisturbOff"){
                if(extension === undefined)
                    throw new Error("Param extension is missing.");

                execute(DNDOff, httpResponse, {
                    extension: extension
                });
            }else if(params['pathname'] == "/asteriskEvent"){
                var lastResponseTime = params['query']['lastResponseTime'];
                execute(AsteriskEvent, httpResponse, {
                    lastResponseTime: lastResponseTime
                });
            }else if(params['pathname'] == "/tunnel"){
                var urlParams = params['query'];
                var ajaxCall = new NodeAjaxCall();
                execute(Tunnel, httpResponse, {
                    urlParams: urlParams,
                    ajaxCall: ajaxCall
                });
            }else if(params['pathname'] == "/callDetailRecord"){
                request.setEncoding("utf8");
                request.addListener("data", function(postDataChunk) {
                    var postData = querystring.parse(postDataChunk);

                    var start = postData.start;
                    var limit = postData.limit;
                    var extension = postData.extension;
                    if(start === undefined)
                       start = 0;
                    if(limit === undefined)
                        limit = 20;
                    
                    execute(CallDetailRecord, httpResponse, {
                        extension: extension,
                        start: start,
                        limit: limit,
                        mysql: mysql
                    });
                });
            }else{
                throw new Error("Requested url not found. (404)");
            }
        
        }catch(exc){
            now = new Date();
            console.info(now.toString() + ": " + request.url +' Error: ' + exc.message);
            httpResponse.writeHead(500, {
                'Content-Type': 'text/plain'
            });
            httpResponse.end('Error\n' + exc.message);
        }
    
    }).listen(5859);
    console.log('Server running at http://anyway:5859/');    
        
}

function execute(Task, httpResponse, args){
    (new Task(args, function(responseObj){
        var httpstatus = 200;
        var responseText = "";
        
        if(responseObj instanceof Exception){
            httpstatus = 500;
            responseText = responseObj.getMessage();
        }else if(responseObj){
            responseText = responseObj.toString();
        }
        
        httpResponse.writeHead(httpstatus, {
            'Content-Type': 'text/plain'
        });
        httpResponse.end(responseText);
    }, this, jaSAmApp.getAsteriskManager())).run();
}
