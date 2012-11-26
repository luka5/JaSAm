var request = require('request');
var Task = require('../../../framework/tasks/Task.js').Task;
var CallDetailRecord = require('./CallDetailRecord.js').CallDetailRecord;

var PushCallDetailRecord = function(args, callbackParam, scopeParam, asteriskManagerParam){
    var lastCallEndDate = args['lastCallEndDate'];
    var mysqlLogin = args['mysqlLogin'];
    var token = args['token'];
    var url = args['url'];
    var callback = callbackParam;
    var scope = scopeParam;
    var asteriskManager = asteriskManagerParam;

    this.run = function(){

        var taskParams = {
            mysqlLogin: mysqlLogin,
            since: lastCallEndDate,
            start: 0,
            limit: 1000
        };
        var taskCallback = function(response){
            /*
             * check if new cdrs are available
             */
            var responseObj = JSON.parse(response);
            if(!responseObj.data || responseObj.data.length === 0)
                return;

            /*
             * New CDRs found, save lastCallEndDate calldate
             */
            lastCallEndDate = responseObj.data[0].callenddate;

            /*
             * push new CDRs to foreign server
             */
            var data = {
                token: token,
                cdrs: JSON.stringify(responseObj.data)
            };
            request.post(url, {form:data}, function(error, response, body){
                /*
                 * new CDRs pushed to server
                 * check whether its successful or not
                 * call callback and apply error message, lastCallEndDate and 
                 * the affected Extensions (if given)
                 */
                var affectedExtensions;
                if(!error){
                    if(!body){
                        error = "No body defined";
                    }else{
                        var responseObj = JSON.parse(body);
                        if(responseObj.success === false){
                            error = responseObj.errorInfo;
                        }else{
                            if(responseObj.affectedExtensions.length > 0){
                                affectedExtensions = responseObj.affectedExtensions;
                            }
                        }
                        if(responseObj.output && responseObj.output !== "")
                            console.log("Non cirtical Error while pushing Cdrs: ",
                                        responseObj.output);
                    }
                }
                callback.apply(scope, [error, lastCallEndDate, affectedExtensions]);
            });     
        };
        var task = new CallDetailRecord(taskParams, taskCallback, this, asteriskManager);
        task.run();
    
    };    
};
PushCallDetailRecord.prototype = new Task();

exports.PushCallDetailRecord = PushCallDetailRecord;