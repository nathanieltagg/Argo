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
    eval( "var element_settings_obj = { " + element_settings + '};');; // override from 'settings' attribute of html object.
    // console.log(element_settings, element_settings_obj);
    $.extend(true,this,element_settings_obj); // Change default settings by provided overrides.
  }

  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");  
}

EventInfo.prototype.NewRecord = function()
{
  
  var h = "";
  if(!gRecord) {
    $(this.element).html("No data retrieved!");
    return;
  }

  h += "<table class='eventinfo'>";
  var a = "<tr><td class='eventinfo-key'>";
  var b = "</td><td class='eventinfo-val'>";
  var c = "</td></tr>";


  if(gRecord.header){
    h += a + "Run"    + b + gRecord.header.run + c;
    h += a + "SubRun" + b + gRecord.header.subrun + c;
    h += a + "Event"  + b + gRecord.header.event + c;
    // h += a + "Experiment" + b + gRecord.header.experimentType + c;
    h += a + "Data Type" + b + (gRecord.header.isRealData?"Real":"MC") + c;  
  }
  if(gRecord.source){
    // h += a + "File"    + b + gRecord.source.file + c;
    h += a + "Entry"    + b + gRecord.source.entry + "/" + gRecord.source.numEntriesInFile + c;    
  }

  var t = "";
  for(var i in gRecord.raw) { t += i.replace(/^[^_]*_/,"") + "<br/>";}
  h += a + "Raw Wires" + b + (t.length?t:"Not present") + c;

  t="";
  for(var i in gRecord.cal) { t += i.replace(/^[^_]*_/,"") + "<br/>";}
  h += a + "Cal Wires" + b + (t.length?t:"Not present") + c;

  t="";  
  for(var i in gRecord.hits) { t += gRecord.hits[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  h += a + "Hits" + b + (t.length?t:"Not present") + c;

  t="";
  for(var i in gRecord.clusters) { t += gRecord.clusters[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  h += a + "Clusters" + b +  (t.length?t:"Not present") + c;

  t="";
  for(var i in gRecord.spacepoints) { t += gRecord.spacepoints[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  h += a + "SpacePoints" + b + (t.length?t:"Not present") + c;

  t="";
  for(var i in gRecord.tracks) { t += gRecord.tracks[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  h += a + "Tracks" + b + (t.length?t:"Not present") + c;
  
  t="";
  for(var i in gRecord.oppulses) { t += gRecord.oppulses[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  h += a + "Optical Pulses" + b + (t.length?t:"Not present") + c;

  t="";
  for(var i in gRecord.ophits) { t += gRecord.ophits[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  h += a + "Optical Hits" + b + (t.length?t:"Not present") + c;

  t="";
  for(var i in gRecord.opflashes) { t += gRecord.opflashes[i].length + "&nbsp;" + i.replace(/^[^_]*_/,"") + "<br/>";}
  h += a + "Optical Flashes" + b + (t.length?t:"Not present") + c;
  
  h+= "</table>";
  $(this.element).html(h);
}



