var ListenerHandler = require('../core/ListenerHandler.js').ListenerHandler;
var EntityEvent = require('../entities/EntityEvent.js').EntityEvent;
var Extension = require('../entities/Extension.js').Extension;
var Action = require('../messages/Action.js').Action;
var CallbackCollector = require('../utils/CallbackCollector.js').CallbackCollector;

var ExtensionManager = function(asteriskManagerParam){
    var asteriskManager = asteriskManagerParam;
    
    this.extensions = {};
    
    this.handleEvent = function(responseItem){
        var extension = null;
        var eventType = EntityEvent.Types.unknown;
        var id;
        if(responseItem.name == 'ExtensionStatus'){
            id = responseItem.content.exten;
            if(!this.extensions[id]){
                this.extensions[id] = new Extension(id, asteriskManager);
                eventType = EntityEvent.Types.New;
            }else{
                eventType = EntityEvent.Types.Update;
            }

            extension = this.extensions[id];
            extension.status = Extension.StateTranslations[responseItem.content.status];
            //extension.hint = responseItem.content.hint;
            extension.context = responseItem.content.context;

        }else{
            BasicManager.print('unknown extension state' , responseItem.name);
        }
        var event = new EntityEvent(eventType, extension);
        asteriskManager.entityManager.handleCollectedEvents(event);
        this.propagate(event);
    };
    
    this.queryExtensions = function(callback, scope){
               
        var callbackCollector = new CallbackCollector(function(){
            callback.apply(scope, []);
        }, this);        
        
        var action = new Action(asteriskManager);
        action.name = 'sippeers';        
        action.execute(callbackCollector.createCallback(function(response){
            for(var peerentryKey in response.body){
                if(peerentryKey == "remove")
                    continue;
                var peerentry = response.body[peerentryKey].content;

                var id = peerentry.objectname;
                if(!this.extensions[id]){
                     this.extensions[id] = new Extension(id, asteriskManager);
                }                

                var extension = this.extensions[id];
                extension.hint = peerentry.channeltype + '/' + peerentry.objectname;

                // Query Extension-State
                var actionExtensionState = new Action(asteriskManager);
                actionExtensionState.name = 'extensionstate';
                actionExtensionState.params = {
                    exten: id
                };
                actionExtensionState.execute(callbackCollector.createCallback(function(response){
                    var extension = this.extensions[response.head.exten];
                    extension.status = Extension.StateTranslations[response.head.status];
                }, this), this);
                
            }
            
        }, this), this);
    };
    
}
ExtensionManager.prototype = new ListenerHandler();

exports.ExtensionManager = ExtensionManager;
