var Task = require('../../../framework/tasks/Task.js').Task;
var mysql = require('mysql');

var ExtendCallDetailRecord = function(args, callbackParam, scopeParam, asteriskManagerParam){
    
    var callback = callbackParam;
    var scope = scopeParam;
    
    var uniqueid = args['uniqueid'];
    var channelid = args['channelid'];
    var extension = args['extension'];
    var calledExtension = args['calledExtension'];
    var uniteTimestamp = args['uniteTimestamp'];
    var mysqlLogin = args['mysqlLogin'];
    
    var client;
    
    this.run = function (){
        client = mysql.createClient(mysqlLogin);
        client.query('USE asteriskcdrdb');
        
        /*
         * build sql insert
         */
        var insertQuery = "INSERT INTO  `asteriskcdrdb`.`extendedcdr` (" + 
            "`uniqueid` ," +
            "`channel` ," +
            (calledExtension ? "`calledExtension`," : "") +
            (uniteTimestamp ? "`uniteTimestamp`," : "") +
            "`extension`" +
        ")" + 
        "VALUES (" +
            "'" + uniqueid + "',  '" + channelid + "', " + 
            (calledExtension ? " '" + calledExtension + "', " : "") +
            (uniteTimestamp ? " " + uniteTimestamp + ", " : "") +
            "'" + extension + "' "+
        ")";
        client.query(
            insertQuery,
            function selectCb(err, results, fields) {
                var result = {
                    "success": true
                };
                if (err) {
                    result = {
                        "success": false,
                        "errorInfo": err
                    };
                }
                callback.apply(scope, [result]);
                client.end();
            }
        );
    };
};
ExtendCallDetailRecord.prototype = new Task();

exports.ExtendCallDetailRecord = ExtendCallDetailRecord;