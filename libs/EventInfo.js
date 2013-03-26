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

  h += "<table class='.eventinfo'>";
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
  
  h += a + "Raw Wires" + b + (gRecord.raw?"Present":"Not present") + c;
  h += a + "Cal Wires" + b + (gRecord.cal?"Present":"Not present") + c;
  h += a + "Hits" + b + (gRecord.hits?gRecord.hits.hits.length:0) + c;
  h += a + "Clusters" + b + (gRecord.clusters?gRecord.clusters.length:0) + c;
  h += a + "SpacePoints" + b + (gRecord.spacepoints?gRecord.spacepoints.length:0) + c;
  h += a + "Tracks" + b + (gRecord.tracks?gRecord.tracks.length:0) + c;
  h += a + "Optical Flashes" + b + (gRecord.opflashes?gRecord.opflashes.length:0) + c;
  h += a + "Optical Hits" + b + (gRecord.ophits?gRecord.ophits.length:0) + c;
  
  h+= "</table>";
  console.log(h);
  $(this.element).html(h);
}



