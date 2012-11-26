var http = require('http');
var fs = require('fs');
var WebSocketServer = require('websocket').server;
var startStopDaemon = require('start-stop-daemon');
var jsonParser = require("xml2json");

var configuration = require('./configuration');

var JaSAmApp = require('../../framework/JaSAmApp.js').JaSAmApp;
var Exception = require('../../framework/messages/Exception.js').Exception;
var NodeAjaxCall = require("./core/NodeAjaxCall.js").NodeAjaxCall;
var ClassicWorker = require("./worker/ClassicWorker.js").ClassicWorker;
var SocketWorker = require("./worker/SocketWorker.js").SocketWorker;
var PushCallDetailRecord = require('./tasks/PushCallDetailRecord.js').PushCallDetailRecord;
var ExtendCallDetailRecord = require('./tasks/ExtendCallDetailRecord.js').ExtendCallDetailRecord;
var PushUserMessage = require('../../framework/tasks/PushUserMessage.js').PushUserMessage;


var jaSAmApp = null;

var classicHttpServer = null;
var socketHttpServer = null;
var socketServer = null;
var socketServerWorker = new Array();

var options = {
    daemonFile: "log/nodeServer.dmn", 
    outFile: "log/nodeServer.out",
    errFile: "log/nodeServer.err",    
    onCrash: function(e){
        console.info("server crashed! Closing httpserver and restarting nodeServer now ...", e);
        classicHttpServer.close();
        socketHttpServer.close();
        this.crashRestart();
    }
};

startStopDaemon(options, function() {

    // initialize JaSAmApp
    console.info((new Date()) + ': initialize JaSAmApp');
    jaSAmApp = new JaSAmApp(configuration.username, configuration.password);
    var config = {};
    config[JaSAmApp.Configuration.baseUrl] =  configuration.baseUrl;
    config[JaSAmApp.Configuration.autoLogin] =  true;
    config[JaSAmApp.Configuration.autoQueryEntities] =  true;
    config[JaSAmApp.Configuration.enableEventlistening] =  true;
    config[JaSAmApp.Configuration.enableEventBuffering] =  true;
    config[JaSAmApp.Configuration.enableKeepalive] = true;
    jaSAmApp.setConfiguration(config);

    
    jaSAmApp.getAsteriskManager().setJsonParser(jsonParser);

    var ajaxCall = new NodeAjaxCall();
    jaSAmApp.getAsteriskManager().setTransport(ajaxCall);
    
    // start JaSAmApp - when done, startServer!
    jaSAmApp.start(startServer, this);

});

function startServer(isSuccess){
    // if JaSAmApp successfully startet, start server!

    if(!isSuccess){
        console.info((new Date()) + ": Error! Could not start JaSAmApp!");
        return;
    }
    
    console.info((new Date()) + ": start server ...");

    startClassicHttpServer();
    startSocketServer();
    startCDRPushing();
    sartCDRFixing();
}

function startClassicHttpServer(){
    var worker = new ClassicWorker(jaSAmApp, configuration.classicHttpServer.token, configuration.classicHttpServer.mysqlLogin);
    classicHttpServer = http.createServer(worker.work);
    classicHttpServer.listen(configuration.classicHttpServer.port);
    console.info((new Date()) + ": ClassicHttpServer listening on port " + configuration.classicHttpServer.port);
}

function startSocketServer(){
    socketHttpServer = http.createServer();
    socketHttpServer.listen(configuration.socketServer.port);
    socketServer = new WebSocketServer({
        httpServer: socketHttpServer
    });
    socketServer.on('request', function(request) {
        // accept incoming request, add message worker!

        var connection = request.accept(null, request.origin);
        var worker = new SocketWorker(jaSAmApp, connection, configuration.socketServer.token);
        var workerPosition = socketServerWorker.length;
        socketServerWorker.push(worker);
        
        connection.on('message', worker.work);
        connection.on('close', function(connection) {
            // delete worker from array
            socketServerWorker.splice(workerPosition, 1);
        });
    });    
    console.info((new Date()) + ": SocketHttpServer listening on port " + configuration.socketServer.port);    
}

function startCDRPushing(){
    var lastCallEndDate = undefined;
    var lastEventTime = undefined;
    /*
     * Lade lastCallEndDate aus Textdatei, wenn vorhanden
     */
    fs.readFile('lastCallEndDate', "utf-8", function (err, data) {
        if(err){
            console.log("Reading lastCallEndDate out of file lastCallEndDate failed: ", err);
            return;
        }
        /*
         * speichere lastCallEndDate aus Datei in lokale Variable
         */
        lastCallEndDate = data;
    });

    /*
     * listen on closing channels,
     * once a channel is closed:
     * load all CDR Entries since lastCallEndDate and send them to foreign server
     * then push UserMessage to force reloading cdr-lists
     */
    jaSAmApp.getAsteriskManager().entityManager.channelManager.addListener(function(event){
        if(event[0].type === 'remove' && event[0].entity){
            var channel = event[0].entity;
            if(channel.getPeer() === null || channel.getPeer() === undefined)
                return;
            var extension = channel.getPeer().getExtension().getBasicExtension();

            var channels = extension.getPeer().getChannels();
            if(channels.length > 0)
                return;
            
            var now = Math.floor((new Date()).getTime()/10);
            if(lastEventTime !== undefined && lastEventTime === now){
                /*
                 * Suppress multiple calls in 1/100 secound
                 */
                return;
            }
            lastEventTime = now;
            
            /*
             * Channel is closed => push new cdrs
             */
            var pushCallDetailRecordParams = {
                lastCallEndDate: lastCallEndDate,
                mysqlLogin: configuration.classicHttpServer.mysqlLogin,
                token: configuration.cdrPush.token,
                url: configuration.cdrPush.url
            };
            var pushCallDetailRecordCallback = function(error, lastCallEndDateParam,
                                                            affectedExtensions){
                if(error){
                    console.log(error);
                }else{
                    lastCallEndDate = lastCallEndDateParam;

                    /*
                    * Pushing new CDRs worked
                    * if any extension is affected:
                    *  1. inform changed extensions to update their own-cdrlists
                    *  2. inform all extensions to update their all-cdrlist
                    */
                   if(affectedExtensions){
                        var taskParams = {
                            type: "cmd",
                            content: "reloadCdr",
                            extensions: affectedExtensions
                        };
                        var taskCallback = function(){};
                        var task = new PushUserMessage(
                                            taskParams, taskCallback, this,
                                            jaSAmApp.getAsteriskManager());
                        task.run();
                        
                        taskParams = {
                            type: "cmd",
                            content: "reloadCdr"
                        };
                        task = new PushUserMessage(
                                            taskParams, taskCallback, this,
                                            jaSAmApp.getAsteriskManager());
                        task.run();
                   }
                   
                   /*
                    * write lastCallEndDate to textfile
                    * if server shuts down, it will be read on startup
                    */
                   fs.writeFile("lastCallEndDate", lastCallEndDate,
                        function(err) {
                            if(err){
                                console.log("Saving the var lastCallEndDate to file named lastCallEndDate failed: ", err);
                            }
                    });
               }
            };
            var task = new PushCallDetailRecord(pushCallDetailRecordParams, 
                                pushCallDetailRecordCallback, this, 
                                jaSAmApp.getAsteriskManager());
            task.run();

        }
    }, this);
}

function sartCDRFixing(){
    var incomingChannels = new Object();
    var incomingQueueChannels = new Object();
    
    var channelManager = jaSAmApp.getAsteriskManager().entityManager.channelManager;
    channelManager.addListener(function(event){
        if(!event[0].entity)
            return;
        var channel = event[0].entity;
        
        /*
         * add new channels to incomingChannels, if context is "custom-qscincoming"
         */
        if(event[0].type === 'new'){
            if(channel.context === "custom-qscincoming"){
                incomingChannels[channel.id] = channel;
            }
        
        }else if(event[0].type === 'update'){
            /*
             * check if the updated channel is an incomingChannel 
             * or the one which will be bridged
             */
            if(channel.context === "app-announcement-19"){
                /*
                 * This channel was a direct Call and is going to be
                 * redirected to a queue and an extension
                 * this is the same like, if you call the queue direkt except:
                 * the channels property connectedlinenum is set
                 * Its the number with has been Called
                 */
                incomingQueueChannels[channel.id] = channel;
                
            }else if(incomingChannels[channel.id]){
                /*
                 * channel is incomingChannel
                 * check if exten not during an announcement and calling a queue
                 */
                if(channel.exten !== "s" && configuration.queues[channel.exten]){
                    /*
                     * channel is incoming call
                     * and its a call to a queue
                     * save channel for futher research
                     */
                    delete incomingChannels[channel.id];
                    incomingQueueChannels[channel.id] = channel;
                }
            }else{
                /*
                 * checks if channel is ringing extension 
                 * which will be bridged to a incoming queue-call 
                 */
                for(var key in incomingQueueChannels){
                    var c = incomingQueueChannels[key];
                    if(c.calleridnum === channel.connectedlinenum){
                        /*
                        * This is the channel of the ringing extension
                        * save the extensionId, because asteriskcdr does not
                        * 
                        * if the call was forwarded after a direct call the param
                        * c.connectedlinenum is not null
                        * 
                        */
                       var params = {
                            uniqueid: c.uniqueid,
                            channelid: c.id,
                            extension: channel.calleridnum,
                            calledExtension: c.connectedlinenum,
                            mysqlLogin: configuration.classicHttpServer.mysqlLogin
                        };
                        var exdrCallback = function(result) {
                            if (!result.success)
                                console.log("Error setting ExtendedCallDetailRecord. " +
                                        result.errorInfo);
                        };
                        var task = new ExtendCallDetailRecord(params, 
                                        exdrCallback, {}, 
                                        jaSAmApp.getAsteriskManager());
                        task.run();
                        
                        delete incomingQueueChannels[c.id];
                        break;
                    }
                }
            }
        }else if(event[0].type === 'remove'){
            /*
             * if channel is closed: remove from object
             */
            if(incomingQueueChannels[channel.id])
                delete incomingQueueChannels[channel.id];
            if(incomingChannels[channel.id])
                delete incomingChannels[channel.id];
        }
    }, this);
}