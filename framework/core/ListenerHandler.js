
var ListenerHandler = function(){
    var listeners = new Array();
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
        for(var key in listeners){
            var listener = listeners[key];
            if(!listener.callback || !listener.scope)
                continue;
            
            fkts[key] = listener.callback;
            scopes[key] = listener.scope;
            // use setTimeout to resume for
            with({key: key}){
                /*
                 * we cant use scopes within a setTimeout
                 * but with provides use a similar functionality
                 */
                setTimeout(function(){
                    fkts[key].apply(scopes[key], [params]);
                }, 0);   
            }
        }
    };
}

exports.ListenerHandler = ListenerHandler;