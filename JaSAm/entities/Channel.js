
var Channel = function(){
    
    this.type = Entity.Types.Channel;

    // this.id = null
    this.uniqueid = null;
    this.context = null;
    this.extension = null;
    this.priority = null;
    this.channelstate = null;
    this.channelstatedesc = null;
    this.calleridnum = null;
    this.calleridname = null;
    this.duration = null;
    
};
Channel.prototype = new Entity();