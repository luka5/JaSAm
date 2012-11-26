
var ListenerHandler = function(){
    var listeners = new Array();
    
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
    };
    
    this.removeListener = function(callback){
        for(var key in listeners){
            var listener = listeners[key];
            if(listener.callback === callback){
                /*
                 * remove 1 element at index key
                 */
                listeners.splice(key, 1);
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
                 * but with provides a similar functionality
                 * seems like: key = this.key, if with(this) is set
                 */
                setTimeout(function(){
                    fkts[key].apply(scopes[key], [params]);
                }, 0);   
            }
        }
    };
}

exports.ListenerHandler = ListenerHandler;