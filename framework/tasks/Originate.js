var Action = require('../messages/Action.js').Action;
var Exception = require('../messages/Exception.js').Exception;
var Task = require('./Task.js').Task;

var Originate = function(args, callbackParam, scopeParam, asteriskManagerParam){
    
    var remoteNumber = args['remoteNumber'];
    var localUser = args['extension'];
    var originatorNumber = args['originatorNumber'];
    var originatorName = args['originatorName'];
    var callback = callbackParam;
    var scope = scopeParam;
    var asteriskManager = asteriskManagerParam;
    
    this.run = function (){
        if(originatorNumber === undefined)
            originatorNumber = localUser;
        if(originatorName === undefined)
            originatorName = originatorNumber;
        
       /*
        * Modify remotenumber:
        * - delete whitespaces at front and end
        * - change (0) to 0, if its first char
        * - change all + to 00
        * - delete all (0)
        * - delete all NaNs
        * ==> +49 (0) 123 - 45 /6 ==> 0049123456
        *     und  (0) 123 - 45 /6 ==> 0123456
        */
       remoteNumber = remoteNumber.trim();
       if(remoteNumber.indexOf("(0)") === 0){
           remoteNumber = 
               remoteNumber.replace("(0)", "0");
       }
       remoteNumber = remoteNumber
                           .replace(/\+/g, "00")
                           .replace("(0)", "")
                           .replace(/[^\d.]/g, "");
        var action = asteriskManager.commander.createAction('originate');
        action.params = {
            Exten: remoteNumber,
            channel: 'SIP/' + localUser,
            context: 'from-internal',
            priority: 1,
            callerid:  originatorName + ' <' + originatorNumber + '>',
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
