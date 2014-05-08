
var gOmStatus = null;

$(function(){
  $('div.A-OmStatus').each(function(){
    gOmStatus = new OmStatus(this);
  });  
});

/// Save configuration.
function AutoSaveConfig()
{
  slot="default";
  // Cookie expiration date.
  expdate = new Date();
  expdate.setFullYear(2040);
    
   // Save misc. configuration boxes.
  $(".ctl-autosave").each(function(){
    val = $(this).val();
    if($(this).is(":checkbox")) val = $(this).is(":checked");
    $.cookie(slot+":"+this.id,val);
    console.log("saving ",this.id,val);
  });
    
  console.log("cookies saved.");
}

$(function(){
  // Set up autosave callback.
  $(".ctl-autosave").on("change",AutoSaveConfig);

  // Load autoconfig.
  var slot = "default";
  $(".ctl-autosave").each(function(){
    var val = $.cookie(slot+":"+this.id);
    if(val!=null){
      // console.log("restoring:",this.id,val);
      var changed = false;
      if($(this).is(':checkbox')){
        if( (val=='true') != $(this).is(':checked')) changed = true;
        $(this).attr('checked',val=='true');
      } else {
        if( val != $(this).val() ) changed = true;
        $(this).val(val);
      } 
      if(changed) $(this).trigger('change'); // Just in case
     }
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
  $(".ctl-low-resolution",this.element).click(function(){gOmData.get()});
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
  var cycle = gOmData.getCycle();
  var refcycle = gRefData.getCycle();
  
  var filename    = cycle    ? (   cycle.filename) : gOmData.file;
  var reffilename = refcycle ? (refcycle.filename) : gRefData.file;
  h="";

  // hidden form for 'post' data.
  h+="<form id='omform' method='post' action='"+gOmData.myurl+"'>";
  for(i in gOmData.param ) {
    h+="<input type='hidden' name='"+i+"' value='" + gOmData.param[i] + "' />";    
  }
  h+="</form>";

  h+= "<table class='omstatus'><tr>";
  h+= "<tr><th>Source</th><th>Status</th><th>File</th><th>JSON data</th></tr>";
  h+= "<tr>"
  h+= " <td><b>Monitor</b></td>";
  h+= " <td>" + gOmData.status + "</td>";
  h+=  "<td>" + filename  + "</td>"
  // h+=  "<td><a href='" + gOmData.myurl + '?' + gOmData.param + "'>last call</a></td>"
  h+=  "<td><a href='#' id='omLastCallClick'>last call</a></td>";
  
  
  h+= "</tr><tr>";
  h+= " <td><b>Reference</b></td>";
  h+= " <td>" + gRefData.status + "</td>";
  h+=  "<td>" + filename   + "</td>"
  h+=  "<td><a href='" + gRefData.myurl + '?' + gRefData.param + "'>last call</a></td>"
  h+= "</table>";

  if(cycle) {
    h += "Last event seen: " + cycle.run + "|" + cycle.subrun + "|" +cycle.event + "<br/>";
    var t = new Date(cycle.updateTime);
    h += "File update time " + t + "(" + deltaTimeString(t) + " ago)<br/>";
    t = new Date(cycle.firstEventTime);
    h += "First Event: " + t + "(" + deltaTimeString(t) + " ago)<br/>";
    t = new Date(cycle.lastEventTime);
    h += "Last Event: " + t + "(" + deltaTimeString(t) + " ago)<br/>";
    
  }
  $(".statusinfo",this.element).html(h);
  $("#omLastCallClick").click(function(){
    $('form#omform').submit();
  });
}

