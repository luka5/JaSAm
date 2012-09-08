var Action = require('../messages/Action.js').Action;
var Exception = require('../messages/Exception.js').Exception;
var Task = require('./Task.js').Task;

var Originate = function(args, callbackParam, scopeParam, asteriskManagerParam){
    
    var remoteNumber = args['remoteNumber'];
    var localUser = args['extension'];
    var originatorNumber = args['originatorNumber'];
    var callback = callbackParam;
    var scope = scopeParam;
    var asteriskManager = asteriskManagerParam;
    
    this.run = function (){
        if(originatorNumber === undefined)
            originatorNumber = localUser;
        remoteNumber = remoteNumber.replace(/ /g, "").replace(/\//g, "").replace(/\-/g, "").replace(/\+/g, "00");
        var action = asteriskManager.commander.createAction('originate');
        action.params = {
            Exten: remoteNumber,
            channel: 'LOCAL/' + localUser,
            context: 'from-internal',
            priority: 1,
            callerid:  originatorNumber,
            timeout: 10000
        };
        action.execute(originateCallback, this);
    };
    
    var originateCallback = function(response){
        if(response.isSuccess()){
            callback.apply(scope, []);
        }else{
            callback.apply(scope, [new Exception("Error: " + response.head.message)]);            
        }        
    };

};
Originate.prototype = new Task();

exports.Originate = Originate;