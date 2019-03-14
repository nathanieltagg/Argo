//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals used by this.

gEventInfo = null;

// Constants
// UBOONE
var kTriggerNames = ["Beam" // "PMT 0 (Beam)"
                    ,"Cosmic" // "PMT 1 (Cosmic)"
                    ,"PMT 2"
                    ,"PMT 3"
                    ,"PMT 4"
                    ,"PMT 5"
                    ,"PMT 6"
                    ,"PMT 7"
                    ,"PC"
                    ,"External"
                    ,"Active"
                    ,"BNB"
                    ,"Gate1"
                    ,"LASER" // daq sez "veto" but that's not right
                    ,"Calib"
                    ,"bit16" //Phase0"
                    ,"bit17" //Phase1"
                    ,"GateFake"
                    ,"BeamFake"
                    ,"MuCS (Spare1)"
,"bit21"
,"bit22"
,"bit23"
,"bit24"
,"bit25"
,"bit26"
,"bit27"
,"bit28"
,"bit29"
,"bit30"
,"bit31"
            ];


// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-EventInfo').each(function(){
    gEventInfo = new EventInfo(this);
  });  
});

function EventInfo( element  )
{
  this.element = element;
  var settings = {
  };
  $.extend(true,this,settings);
  
  // Merge in options from element
  var element_settings = $(element).attr('settings');
  var element_settings_obj={};
  if(element_settings) {
    eval( "var element_settings_obj = { " + element_settings + '};'); // override from 'settings' attribute of html object.
    // console.log(element_settings, element_settings_obj);
    $.extend(true,this,element_settings_obj); // Change default settings by provided overrides.
  }

  var self=this;
  
  gStateMachine.Bind('newRecord',this.NewRecord.bind(this));  
  gStateMachine.Bind('newPiece',this.NewPiece.bind(this));  
}

EventInfo.prototype.NewRecord = function()
{
  this.newrec = true;
}

EventInfo.prototype.NewPiece = function()
{
  if(!this.newrec || !gRecord.source || !gRecord.manifest || !gRecord.header) return;
  this.newrec = false;
  // Note that this code will fill all values on the entire page, not just the element given.
  
  // Fill with default values.
  if(this.element) $(".eventinfo .val",this.element).html("?");

  if(gRecord.header){
    $(".event-run").text(gRecord.header.run);
    $(".event-subrun").text(gRecord.header.subrun);
    $(".event-event").text(gRecord.header.event);
    $(".event-datatype").text(gRecord.header.isRealData?"Real":"MC"); 
    
    if(gRecord.header.trigger) {
      var trig = gRecord.header.trigger;
      if(trig.triggerword) {
        $(".event-triggerword").text(trig.triggerword+' 0x'+trig.triggerword.toString(16));
        var trignames  = [];
        for(var i = 0;i<kTriggerNames.length;i++) {
          var bit = 1 << i;
          // console.warn("TRIG",i,bit,trig.triggerword,(trig.triggerword & bit)!=0,kTriggerNames[i]);
          if(((trig.triggerword & bit) !=0) && kTriggerNames[i].length )trignames.push(kTriggerNames[i]);
        }
        $(".event-triggernames").text(trignames.join(", "));
      }
      if(trig.sw_triggers) {
        $(".event-swtriggernames").text(trig.sw_triggers.join(","));
      }
    }
    $(".event-daqversion").text(gRecord.header.DAQVersionLabel + gRecord.header.DAQVersionQualifiers); 
    

    // var t = gRecord.header.seconds*1000 + gRecord.header.nanoSeconds*1e-6;
    var date = new Date(gRecord.header.eventTime);
    $(".event-date").text(date.toLocaleDateString());
    $(".event-time").text(date.toLocaleTimeString());

    $(".event-age").html("(" + CreateTimeAgoElement(gRecord.header.eventTime)+")");
    
  }

  
  if(gRecord.source) {
    if("file" in gRecord.source){  $(".event-file").text(gRecord.source.file);
                                   $(".event-basefilename").text(gRecord.source.file.split('/').pop()); }
    if("entry" in gRecord.source) $(".event-entry").text(gRecord.source.entry);
    if("numEntriesInFile" in gRecord.source) $(".event-numEntriesInFile").text(gRecord.source.numEntriesInFile);
  }
  
  
  for(_type of ['wireimg','hits','clusters','tracks','spacepoints','tracks','showers','oppulses','ophits','opflashes']) {
    var txt = "";
    if(gRecord.manifest[_type]) {
      for(_name in gRecord.manifest[_type]) {
        var count = ((gRecord[_type]||{})[_name] || []).length;
        if(count==0) count = gRecord.manifest[_type][_name];
        if(count==true) count = "&#10003;";
        txt += count +"&nbsp;";
        txt += _name.replace(/^[^_]*_/,"") + "<br/>"
      }
    }
    if(txt.length==0) txt = "Not present";
    $(`.event-${_type}-names`).html(txt);
    console.log(`.event-${_type}-names`,txt);
  }
  
  // Specialty:
  if(gRecord.laser) {
    var txt = "";
    for(i in gRecord.laser) {
      var data = gRecord.laser[i];
      txt += "<h4 class='laser-info'>Laser " + i + ":</h4>";
      txt += "<table class='laser-info'>";
      for( a in data ) {
        txt += "<tr><td>"+a+"</td><td>"+data[a]+"</td></tr>";
      }
      txt+="</table>";
    }
    $(".event-laser-info").html(txt);
  }
  
  var hv = "unknown";
  if(gRecord.hv && gRecord.hv.avg) {
    var val = gRecord.hv.avg/1000;
    var err = gRecord.hv.rms/1000;
    hv = val.toFixed(2) + "&pm;" + err.toFixed(2) + " kV";
  }
  $(".event-hv").html(hv);
  
};



