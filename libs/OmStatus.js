
var gOmStatus = null;

$(function(){
  $('div.A-OmStatus').each(function(){
    gOmStatus = new OmStatus(this);
  });  
});

// Subclass of Pad.
OmStatus.prototype = new ABoundObject(null);           

function OmStatus( element )
{
  if(element==null) return;
  this.element = element;
  ABoundObject.call(this, this.element, {}); // Give settings to Pad contructor.

  var self = this;  
  this.mynamespace= "mns" + this.gUniqueIdCounter;
  $(document).on("OmDataChangeState."+this.mynamespace, function(){return self.UpdateData()});
  $(this.element).on("remove."+this.mynamespace, function(){return self.Remove()});  

  $(".refresh",this.element).click(function(){gOmData.get()});
  $(".ctl-auto-refresh",this.element).click(function(){
    var checked = $(this).is(":checked");
    if(checked) self.auto_refresh_timer = setInterval(function(){$(".refresh",self.element).click();},30000);
    else        clearInterval(self.auto_refresh_timer);
  });
  
} 

OmStatus.prototype.Remove = function()
{
  $(document).off("OmDataRecieved."+this.mynamespace);
}

function deltaTimeString(t)
{
  
  var now = new Date();
  var delta = (now.getTime() - t.getTime())/1000.;
  var unit = "seconds";
  if(delta > 100) {
    delta /= 60.;
    unit = "minutes";
    if(delta > 60) {
      delta /= 60;
      unit = "hours";
      if(delta >= 24) {
        delta /= 24;
        unit = "days";
      }
    }
  }
  return delta.toPrecision(4) + " " + unit ;
}

OmStatus.prototype.UpdateData = function()
{
  var h = "<a href='" + gOmData.myurl + '?' + gOmData.param + "'>Last URL</a><br/>"
        + gOmData.status + "<br/>";
        ;
  if(gOmData.data && gOmData.data.record) {
    for(var key in gOmData.data.record) {
      if(gOmData.data.record[key].cycle) {
        var cycle = gOmData.data.record[key].cycle;
        h += "Last event seen: " + cycle.run + "|" + cycle.subrun + "|" +cycle.event + "<br/>";
        var t = new Date(cycle.updateTime);
        h += "File update time " + t + "(" + deltaTimeString(t) + " ago)<br/>";
        t = new Date(cycle.firstEventTime);
        h += "First Event: " + t + "(" + deltaTimeString(t) + " ago)<br/>";
        t = new Date(cycle.lastEventTime);
        h += "Last Event: " + t + "(" + deltaTimeString(t) + " ago)<br/>";
      }
      break; // just do one cycle.
    }
  }
  $(".statusinfo",this.element).html(h);
}

