var Action = require('../messages/Action.js').Action;
var Exception = require('../messages/Exception.js').Exception;
var Task = require('./Task.js').Task;

var PushUserMessage = function(args, callbackParam, scopeParam, asteriskManagerParam){
    
    var type = args['type'];
    var content = args['content'];
    var extensions = args['extensions'];
    var callback = callbackParam;
    var scope = scopeParam;
    var asteriskManager = asteriskManagerParam;
    
    this.run = function (){

        var header1 = JSON.stringify({
            "type": type,
            "content": content,
            "extensions": extensions
        });
        var action = asteriskManager.commander.createAction('UserEvent');
        action.params = {
            UserEvent: 'message',
            Header1: header1
        };
        action.execute(pushUserMessageCallback, this);
    };
    
    var pushUserMessageCallback = function(response){
        if(response.isSuccess()){
            callback.apply(scope, []);
        }else{
            callback.apply(scope, [new Exception("Error: " + response.head.message)]);            
        }
    
    };

};
PushUserMessage.prototype = new Task();

exports.PushUserMessage = PushUserMessage;
