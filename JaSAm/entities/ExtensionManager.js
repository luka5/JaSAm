
var ExtensionManager = function(asteriskManagerParam){
    var asteriskManager = asteriskManagerParam;
    
    this.extensions = {};
    
    this.handleEvent = function(responseItem){
        var extension = null;
        var eventType = EntityEvent.Types.unknown;
        if(responseItem.name == 'ExtensionStatus'){
            var id = responseItem.content.exten;
            if(!this.extensions[id]){
                this.extensions[id] = new Extension(id, asteriskManager);
                eventType = EntityEvent.Types.New;
            }else{
                eventType = EntityEvent.Types.Update;
            }

            extension = this.extensions[id];
            extension.status = Extension.StateTranslations[responseItem.content.status];
            extension.hint = responseItem.content.hint;
            extension.context = responseItem.content.context;
        }else{
            BasicManager.print('unknown extension state' , responseItem.name);
        }
        var event = new EntityEvent(eventType, extension);
        asteriskManager.entityManager.handleCollectedEvents(event);
        this.propagate(event);
    };
    
    this.queryExtensions = function(callback, scope){
        var action = new Action(asteriskManager);
        action.name = 'sippeers';        
        action.execute(function(response){
            for(var peerentryKey in response.body){
                var peerentry = response.body[peerentryKey].content;

                var id = peerentry.objectname;
                var status = peerentry.status;
                if(status.indexOf("OK") >= 0)
                    status = 'available';
                status = status.toLowerCase();
                
                if(!this.extensions[id]){
                     this.extensions[id] = new Extension(id, asteriskManager);
                }                

                var extension = this.extensions[id];
                extension.status = Extension.State[status];
                extension.hint = peerentry.channeltype + '/' + peerentry.objectname;

                var action2 = new Action(asteriskManager);
                action2.name = 'dbget';
                action2.params = {
                    family: 'DND',
                    key: id
                };
                action2.execute(function(response){
                    if(response && response.body && response.body[0] && response.body[0].content && response.body[0].content.val == "YES"){
                        var extension = this.extensions[response.body[0].content.key];
                        extension.doNotDisturb = true;

                        var event = new EntityEvent(EntityEvent.Types.Update, extension);
                        asteriskManager.entityManager.handleCollectedEvents(event);
                        this.propagate(event);                        
                    }                        
                }, this);

            }
            
            callback.apply(scope, []);
        }, this);
    };
    
}
ExtensionManager.prototype = new ListenerHandler();