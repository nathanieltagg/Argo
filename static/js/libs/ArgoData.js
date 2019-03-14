//
// Functions to handle micrboone json data.
//

$(function(){
  gStateMachine.Bind('preNewPiece',SetHV);
});


var gPageStartTime=Date.now();

function RecieveData(o)
{
  console.warn("RecieveData",Object.keys(o));
  if("progress" in o) {
    $('.progress-status').text(o.state);
    $('table.progress-log').append("<tr><td>"+((Date.now()-gPageStartTime)/1000).toFixed(1)+" s</td><td>"+o.state+"</td></tr>")
    console.log("onmessage PROGRESS",o);
    // $('#main-circleprogress').circleProgress('value', o.progress*100);
    // $('#main-circleprogress strong').html(o.state+"<br/>"+parseInt(o.progress*100)+'%');
    
  }
  else if("piece" in o) {
    console.warn("piece with components",Object.keys(o.piece));
    gServing = o;
    GotPiece(o);
    // $('#main-circleprogress').circleProgress('value', 0);
    // $('#main-circleprogress strong').html("Moving data over network"+"<br/>"+0+'%');
  }else if("record" in o) {
    console.warn("full record",Object.keys(o.record));
    gServing = o;
    GotRecord(o);
    // $('#main-circleprogress').circleProgress('value', 0);
    // $('#main-circleprogress strong').html("Moving data over network"+"<br/>"+0+'%');
  }else if("error" in o) {
      $('#status').attr('class', 'status-error');
      $("#status").text('serve-event error: '+o.error);
  }else {
    console.error("UNKNOWN MESSAGE TYPE",event.data,o)
  }
};


function indexArraysIn(o,owner,name) {
  var has_list = false;
  if(name && name[0]=='_') return false;
  if(o instanceof Object){
    var j;
    // console.log ('recursing',name);
    if(o instanceof Array) {        
      for(j=0;j<o.length;j++) if(o[j] instanceof Object) {o[j]._idx = j; o[j]._owner = name;}
    } else {
      for(j in o){
        has_list |= indexArraysIn(o[j],name,j);  
      }
    }
  }
  return has_list;
}


function GotRecord(o) 
{
  if(o.record.error) { 
    $('#status').attr('class', 'status-error');
    $("#status").text('serve-event error: '+o.record.error);
    return;
  }
  
  gRecord = {event_descriptor:o.event_descriptor};
  gStateMachine.Trigger('newRecord');
  indexArraysIn(o.record);
  gRecord = o.record;
  gStateMachine.Trigger('preNewPiece'); // Special trigger for those objects that need to fire first.  
  gStateMachine.Trigger('newPiece');
  
}

function GotPiece(o)
{
  // NB Oliver Steele pattern for nested objects
  // const name = ((user || {}).personalInfo || {}).name;
  console.log("GotPiece",o);
  if(!o.event_descriptor) console.error("No event description in piece",o);
  if(!o.piece) console.error("No piece in piece!");
  gRecord = gRecord || {};
  if(gRecord.event_descriptor != o.event_descriptor) {
    console.warn("New event seen!",gRecord,o);
    gRecord = {event_descriptor:o.event_descriptor};
    gStateMachine.Trigger('newRecord');
    
  }
  indexArraysIn(o.piece);
    
  for(n1 in o.piece) {
    gRecord[n1] = gRecord[n1] || {}
    for(n2 in o.piece[n1]) {
      console.log("GotPiece",n1,n2);
      gRecord[n1][n2] = o.piece[n1][n2];
    }
  }
  // gStateMachine.Trigger('newPiece',o.piece); // Add the piece to the trigger call, so that consumers can look to see if they need to change.
  gStateMachine.Trigger('newPiece');
  
  
}


function SetHV()
{
  AutoFitHitTrackOffsets();
 
  if(gRecord.hv && gRecord.hv.avg) {
    $('#ctl-high-voltage').val(gRecord.hv.avg/1000.);
  }
  var hv = parseFloat($('#ctl-high-voltage').val()) || 128.0;
  gGeo.SetHV(hv);
  
}

function AutoFitHitTrackOffsets()
{
  // attempt to figure out the high voltage setting, and hit/track offsets from the data.
  console.warn('AutoFitHitTrackOffsets');

  console.time("AutoFitHitTrackOffsets");
  
  // Requires hits
  var max_all_tdc = -1e99;
  if(gRecord.hits) {
    for( hitname in gRecord.hits ) {
      for(var i=0;i<gRecord.hits[hitname].length; i++) {
        var hit = gRecord.hits[hitname][i];
        if(hit.t>max_all_tdc) max_all_tdc = hit.t;
      }
    }    
  }
  // Judgement call: if the hit list doesn't extend all the way to 9600, this is probably a processed reco file, and there's a 2400 tick offset.
  if(max_all_tdc < 6401) 
    $('#ctl-shift-hits-value').val(2400);
  else  
    $('#ctl-shift-hits-value').val(0);

  // Requires tracks.
  var slopes = [];
  var offsets = [];
  if(gRecord.tracks && gRecord.associations) {
    for( trkname in gRecord.tracks ) {
      console.warn(trkname);
      if( gRecord.associations[trkname]) {
        var types = Object.keys(gRecord.associations[trkname]);
        var hitname = types.find(function(name){return name.match(/recob::Hits_/);});
        if(hitname) {
          var hitlist = gRecord.hits[hitname];
          var max_all_tdc = 0;
          for(var i=0;i<hitlist.length;i++) {
            var hit = hitlist[i];
            if(hit.t>max_all_tdc) max_all_tdc = hit.t;
          }
          
          console.warn(hitname);
          for(var itrk = 0; itrk<gRecord.tracks[trkname].length; itrk++) {
            trk = gRecord.tracks[trkname][itrk];
            var min_x = 1e99;
            var max_x = -1e99;
            for(var ipt = 0;ipt<trk.points.length; ipt++) {
              var x = trk.points[ipt].x;
              if(x<min_x) min_x = x;
              if(x>max_x) max_x = x;
            }
            var start =  trk.points[0];
            var end   =  trk.points[trk.points.length-1];
          
            // Attempt auto-fit HV and track-to-hit offset.
            var hitids  = gRecord.associations[trkname][hitname][itrk];
            // find min/max tdc.
            var min_tdc = 1e99;
            var max_tdc = -1e99;
            var min_x = (start.x<end.x)?start.x:end.x;
            var max_x = (start.x<end.x)?end.x:start.x;
            if(max_x - min_x < 20) continue;
            for(var i=0;i<hitids.length;i++) { 
              var hit = hitlist[hitids[i]];
              if(hit.t < min_tdc) min_tdc = hit.t;
              if(hit.t > max_tdc) max_tdc = hit.t;
            }
            // now interpolate.      
            console.log("min_tdc",min_tdc,'min_x',min_x);
            console.log("max_tdc",max_tdc,'max_x',max_x);
            var slope = (max_tdc-min_tdc)/(max_x-min_x);
            var offset = min_tdc - slope*min_x;
            if(slope>10 && slope < 30 && offset>0) {
              slopes.push(slope);
              offsets.push(offset);
                
            }
            // t = mx + b
            // t1 = m x1 + b
            console.log("slope = ",slope, 'hv gives',1./gGeo.drift_cm_per_tick);
            console.log("offset = ",offset,"tdc");
          }
        }
      }
    }
  }
  console.log(slopes,offsets);
  if(slopes.length>0) {
    // var avgslope = slopes.reduce((a,b)=>{return a+b;},0) / slopes.length;
    // var avgoffset = offsets.reduce((a,b)=>{return a+b;},0) / offsets.length;
    // console.log("averages:",avgslope,avgoffset);
    var medslope = slopes[parseInt(slopes.length/2)];
    var medoffset = offsets[parseInt(offsets.length/2)];
    console.log("medians:",medslope,medoffset);
    gGeo.drift_cm_per_tick = 1.0/medslope;  
    $('#ctl-track-shift-value').val(parseInt($('#ctl-shift-hits-value').val())+parseInt(medoffset));
  }
  console.timeEnd("AutoFitHitTrackOffsets");
  
}