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
  gStateMachine.BindObj('recordChange',this,"NewRecord");  
}

EventInfo.prototype.NewRecord = function()
{
  // Note that this code will fill all values on the entire page, not just the element given.
  
  // Fill with default values.
  if(this.element) $(".eventinfo .val",this.element).html("?");

  if(!gRecord) {
    return; // leave defaults    
  }

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
    
    
  }

  // var t = gRecord.header.seconds*1000 + gRecord.header.nanoSeconds*1e-6;
  var date = new Date(gRecord.header.eventTime);
  $(".event-date").text(date.toLocaleDateString());
  $(".event-time").text(date.toLocaleTimeString());

  $(".event-age").html(CreateTimeAgoElement(gRecord.header.eventTime));
  
  if(gRecord.source) {
    if("file" in gRecord.source)  $(".event-file").text(gRecord.source.file);
    if("entry" in gRecord.source) $(".event-entry").text(gRecord.source.entry);
    if("numEntriesInFile" in gRecord.source) $(".event-numEntriesInFile").text(gRecord.source.numEntriesInFile);
  }
  
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

  var t = "";
  for(i in gRecord.raw) { t += i.replace(/^[^_]*_/,"") + "<br/>";}
  $(".event-raw-wire-names").html(t.length?t:"Not present");
  
  t="";
  for(i in gRecord.cal) { t += i.replace(/^[^_]*_/,"") + "<br/>";}
  $(".event-cal-wire-names").html(t.length?t:"Not present");

  t="";  
  for(i in gRecord.hits) { t += gRecord.hits[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  $(".event-hit-names").html(t.length?t:"Not present");

  t="";
  for(i in gRecord.clusters) { t += gRecord.clusters[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  $(".event-cluster-names").html(t.length?t:"Not present");

  t="";
  for(i in gRecord.spacepoints) { t += gRecord.spacepoints[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  $(".event-spacepoint-names").html(t.length?t:"Not present");

  t="";
  for(i in gRecord.tracks) { t += gRecord.tracks[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  $(".event-track-names").html(t.length?t:"Not present");
  
  t="";
  for(i in gRecord.showers) { t += gRecord.showers[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  $(".event-track-showers").html(t.length?t:"Not present");
  

  t="";
  for(i in gRecord.oppulses) { t += gRecord.oppulses[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  $(".event-oppulse-names").html(t.length?t:"Not present");

  t="";
  for(i in gRecord.ophits) { t += gRecord.ophits[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  $(".event-ophit-names").html(t.length?t:"Not present");

  t="";
  for(i in gRecord.opflashes) { t += gRecord.opflashes[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  $(".event-opflash-names").html(t.length?t:"Not present");
  
  var hv = "unknown";
  if(gRecord.hv && gRecord.hv.avg) {
    var val = gRecord.hv.avg/1000;
    var err = gRecord.hv.rms/1000;
    hv = val.toFixed(2) + "&pm;" + err.toFixed(2) + " kV";
  }
  $(".event-hv").html(hv);
  
};


