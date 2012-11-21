
var ListenerHandler = function(){
    var listeners = new Object();
    var counter = 0;
    
    this.addListener = function(callback, scope){
        for(var key in listeners){
            var listener = listeners[key];
            if(listener.callback === callback){
                // listener already registered
                return;
            }
        }
        // add new listener
        listeners.push({callback: callback, scope: scope});
        counter++;
    };
    
    this.removeListener = function(callback){
        for(var key in listeners){
            var listener = listeners[key];
            if(listener.callback === callback){
                    delete listeners[key];
                    counter--;
            }
        }
    };

    this.propagate = function(){
        var fkts = new Object();
        var scopes = new Object();
        var params = arguments;
        var i = 0;
        for(var key in listeners){
            var listener = listeners[key];
            if(!listener.callback || !listener.scope)
                continue;
            
            fkts[key] = listener.callback;
            scopes[key] = listener.scope;
            // use setTimeout to resume for
            setTimeout(function(){ fkts[i].apply(scopes[i], [params]); i++;}, 0);
        }
    };
}

exports.ListenerHandler = ListenerHandler;