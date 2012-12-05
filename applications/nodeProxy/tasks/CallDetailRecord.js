var CallbackCollector = require('../../../framework/utils/CallbackCollector.js').CallbackCollector;
var Task = require('../../../framework/tasks/Task.js').Task;
var mysql = require('mysql');

var CallDetailRecord = function(args, callbackParam, scopeParam, asteriskManagerParam){
    
    var callback = callbackParam;
    var scope = scopeParam;
    
    var agentId = 'SIP/' + args['extension'];
    var extension = args['extension'];
    var start = args['start'];
    var limit = args['limit'];
    var since = args['since'];
    var mysqlLogin = args['mysqlLogin'];
    
    var client;
    
    this.run = function (){
        client = mysql.createClient(mysqlLogin);
        client.query('USE asteriskcdrdb');
        
        /*
         * build sqlquery depending on given params
         * 
         * also read the extendedcdr
         * there are two reasons:
         *   a) the the caller calls a direct number and gets redirected to a 
         *      queue
         *   b) the the caller calls a queue and hangs up during a ringing 
         * if none of this is true, the fields will be null
         */
        var query = 'SELECT SQL_CALC_FOUND_ROWS '+
                ' `cdr`.`calldate`, ' +
                ' UNIX_TIMESTAMP(`cdr`.`calldate`) + `cdr`.`duration` ' +
                '    AS `callenddate`, ' +
                ' `cdr`.`duration`, ' +
                ' `cdr`.`dst`, ' +
                ' `cdr`.`src`, ' +
                ' `cdr`.`channel`, ' +
                ' `cdr`.`dstchannel`, ' +
                ' `cdr`.`lastapp`, ' +
                ' `cdr`.`lastdata`, ' +
                ' `cdr`.`disposition`, ' +
                ' `cdr`.`dcontext`, ' +
                ' `ecdr`.`extension` AS `dstextension`, ' +
                ' `ecdr`.`calledExtension` AS `calledextension`, ' +
                ' `ecdr`.`uniteTimestamp` AS `unitetimestamp` ' +
            ' FROM `cdr` ' + 
            ' LEFT OUTER JOIN `extendedcdr` AS `ecdr`' + 
            ' ON ( `ecdr`.`uniqueid` = `cdr`.`uniqueid` AND ' + 
            '      `ecdr`.`channel` = `cdr`.`channel` AND ' + 
            '     ( ' + 
            '        (`ecdr`.`extension` IS NOT NULL AND ' +
            '        `ecdr`.`uniteTimestamp` IS NOT NULL AND ' +
            '        `ecdr`.`calledExtension` IS NOT NULL )' +
            '        OR ' + 
            '        (`cdr`.`dstchannel` = \'\' AND ' +
            '        `cdr`.`dcontext` = \'ext-queues\' )' +
            '     )' +
            '    )' +
            '';
        query += ' WHERE 1 ';
        if(since !== undefined)
            query += " AND UNIX_TIMESTAMP(`calldate`)+`duration` >= " + since;
        if(extension !== undefined)
            query += ' AND ( ' +
                    ' `src` = "'+extension + '" OR' +
                    ' `dst` = "'+extension + '" OR' +
                    ' `channel` LIKE "'+agentId + '%" OR' +
                    ' `dstchannel` LIKE "'+agentId + '%"' + 
                ' ) ';
        query += ' ORDER BY UNIX_TIMESTAMP(`calldate`)+`duration` DESC';
        if(start !== undefined && limit !== undefined)
            query +=' LIMIT ' + start + ', ' + limit;
        
        client.query(
            query,
            function selectCb(err, results, fields) {
                if (err) {
                    result = {
                        "success": false,
                        "errorInfo": err
                    };
                    applyCallback(result);
                    return;
                }
                fixUnspecificCdrs(results);
            }
        );
    };

    var fixUnspecificCdrs = function(cdrs){
        var collector = new CallbackCollector(function(){
            var result = {
                "success": false,
                "data": cdrs
            };
            applyCallback(result);
        }, this);

        for(var i in cdrs){
            if(cdrs[i].dstchannel !== "" || cdrs[i].dstextension !== null)
                continue;

            /*
             * Calldetailrecord is a missed call without a specific extension
             * this appears if the external caller hangsup the phone ..
             *    //- while the extension is ringing and he is calling a queue
             *    - during a announcement
             *  if the solution of the first problem doesnt work we get here with
             *  dst == "s"
             */ 
             
            var scope = {
                currentI: i
            };
            if(/*cdrs[i].dst !== "s" &&*/
                    cdrs[i].dcontext.indexOf("app-announcement-") === 0){
                /*
                 * the external caller hangsup the phone during an announcement
                 * 
                 * There are two possible solutions:
                 *   - the announcement is specific and we can read the dst out of it
                 *   - the announcement is unspecific and we have a big problem.
                 */
                var announcementId = cdrs[i].dcontext.replace("app-announcement-", "");
                var query = "SELECT" + 
                    " `description` " + 
                    " FROM `asterisk`.`announcement` " +
                    " WHERE `announcement_id` = " + announcementId;
                client.query(query, collector.createCallback(function(err, results, fields) {
                    //ignore error and empty results
                    if(err || results.length === 0)
                        return;
                    
                    //use the index defined in scope, otherwise the closure will mess up
                    var i = this.currentI;
                    cdrs[i].extensionName = undefined;
                    cdrs[i].queueName = undefined;
                    cdrs[i].queueWelcome = false;
                    cdrs[i].queueFull = false;
                    cdrs[i].queueOpeninghours = false;

                    var announcement = results[0].description;
                    if(announcement.indexOf("Ext-") === 0 &&
                        announcement.indexOf("-Willkommen") !== -1){
                        /*
                         * Extension-Welcome Announcement
                         */
                        cdrs[i].extensionName = 
                            announcement.replace("Ext-", "")
                                        .replace("-Willkommen", "");
                   }else if(announcement.indexOf("Queue-") === 0){
                        /*
                         * Queue [welcome|not during opening hours
                         *          |queue full] Announcement 
                         */
                        announcement = announcement.replace("Queue-", "");
                        var tmp = announcement.split("-");
                        cdrs[i].queueName = tmp[0];
                        if(tmp.length === 1)
                            cdrs[i].queueWelcome = true;
                        else if(tmp[1] === "Voll")
                            cdrs[i].queueFull = true;
                        else if(tmp[1] === "Nicht")
                            cdrs[i].queueOpeninghours = true;
                    }
                }, scope));
            }
        }
        collector.createCallback()();
    };

    var applyCallback = function(result){
        callback.apply(scope, [JSON.stringify(result)]);
        client.end();
    };
};
CallDetailRecord.prototype = new Task();

exports.CallDetailRecord = CallDetailRecord;