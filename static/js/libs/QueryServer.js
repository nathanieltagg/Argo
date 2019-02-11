//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Configuration
kTooManyHits = 10000;


// Global variables.
gFile = "";
gEntry = 0;

gFileReader = null;
gjqXHR = null;    
gServing = null;   // Data element from server, including wrapper with possible error messages.
gRecord = null;    // This is the core data element
var gUrlToThisEvent = null;
var gUrlToLastEvent = null;

// Profiling
var gServerRequestTime;
var gServerResponseTime;
var gClientParseTime;
var gFinishedDrawTime;
var gSocket=0;

var gEventsLoadedThisSession = 0;

$.circleProgress.defaults.setValue = function(newValue) {
    if (this.animation) {
        var canvas = $(this.canvas),
            q = canvas.queue();
        
        if (q[0] == 'inprogress') {
            canvas.stop(true, true);
        }
        
        this.animationStartValue = this.lastFrameValue;
    }
    
    this.value = newValue;
    this.draw();
};

// Get optimal tilesize.
// Create openGL engine.
var kMaxTileSize = 3048;
var testGLcanvas = document.createElement('canvas');
var testGL = testGLcanvas.getContext('webgl');
if(testGL) kMaxTileSize = testGL.getParameter(testGL.MAX_TEXTURE_SIZE);
testGL = null;
testGLcanvas = null;
  

// Add debugging.
function logGLCall(functionName, args) {   
   console.log("gl." + functionName + "(" + 
      WebGLDebugUtils.glFunctionArgsToString(functionName, args) + ")");   
} 
this.gl = WebGLDebugUtils.makeDebugContext(this.gl, undefined, logGLCall);
  

$(function(){
  $('#main-circleprogress').circleProgress({
      value: 0,
      thickness: 8,
      size: $('#main-circleprogress').width(),
      fill: {
          gradient: ["white","orange","red"]
        , gradientAngle: Math.PI / 2 
      }
  });
})


function ChangeEvent(  )
{
  var par = $.deparam.fragment(true);
  console.log("ChangeEvent",par);
  
  if(par.reload) {  window.location.reload(); return; };// Force a reload! 
  
  // Clear all selection targets.
  $("input").blur();

  // // User feedback that we are querying
  // $.blockUI.defaults.themedCSS.top = '25%';
  // $.blockUI({
  //           theme:     true,
  //           title:    'Please wait',
  //           message:    $('#MOTD')
  //       });
  
  
  
  
  if     ( par.localFile ) ReadLocalFile(par);
  else if( par.serverfile) QueryServer(par,par.serverfile);
  else if( par.filename  ) QueryServerStream(par,  "/server/serve_event.cgi");
  else if( par.what      ) QueryServer(par,  "/server/serve_event.cgi");
  else if( gPageName == 'live' || par.live ) QueryServer(par,"server/serve_live.cgi");
  else QueryServer(par,"server/default_event.json");
}

function ReadLocalFile( par )
{
  console.log("ReadLocalFile",par);
  var files = $('#inLocalFile').get(0).files;
  if(files.length<1) { 
    console.warn("no local file");
    $.unblockUI(); 
    $('#status').attr('class', 'status-error').html("Need to re-select your input file.");
    return;
  }
  var file = files[0];
  console.log("reading local file ",file);
  gFileReader = new FileReader();
  gFileReader.onload = ReadLocalFileSuccess;
  gFileReader.readAsText(file);
}
  
function ReadLocalFileSuccess()
{
  var obj;
  try {
    obj = JSON.parse(gFileReader.result);
  } catch (e) { 
    $.unblockUI();
    $('#status').attr('class', 'status-error').html("The file you loaded could not be parsed as json:</br>"+e);
    return;
  }
  console.log("Got it:",obj);
  QuerySuccess(obj,null,null);
}


function QueryServerStream( par, myurl )
{
    gTimeStats_StartQuery = performance.now();
    console.log("QueryServer",par,myurl);
    $("input").blur();
    
    var data = {};
    var opts = "";
    if (!$(".show-wireimg").is(":checked")) {
      opts += "_NORAW__NOCAL_";
      $('#loading_feedback').html("<i>Not loading RawDigit or Wire data for speed.</i><br/>");
    } else {
      $('#loading_feedback').html("<b>Loading RawDigit or Wire data.. may be slower! Uncheck \"Show Wires\" to disable.</b></br/>");
    }
    
    var tilesize = 2400;
    if(kMaxTileSize < tilesize) tilesize = kMaxTileSize;
    opts+= "_tilesize" + tilesize + "_";


    // Default: do file-and-entry read from parameters. Should check for other options first.
    data = $.extend({},par)
    if(data.filename) data.filename = encodeURIComponent(par.filename);
    if(!data.options) data.options = opts;
    data.piece = "/hits/*";
        
    var param = $.param(data);
    
    $('#status').attr('class', 'status-transition');
    $("#status").text("Querying server for event data...");
    $('#main-circleprogress').circleProgress('value', 0);
    $('#main-circleprogress strong').text('Building');
    
    
    console.log("requesting "+myurl+"?"+param);
    $("#debuglinks").html(
      "Link to json data: <a href=\""+myurl+"?"+param+"\">"+myurl+"?"+param+"</a>"
    );
    $('#download-this-event').html('<a href="'+myurl+'?'+param+'&download">Download this event</a>');
    
    // Modify the "URL to the json data file" link with the actual query.
    $('#inXmlUrl').val(myurl+"?"+param);

    // gLastQueryType = querytype;
    gServerRequestTime = (new Date()).getTime();

    // Modify the cursor to show we're fetching.
    document.body.style.cursor='wait';

    console.log("Starting AJAX calls:",myurl,param);

    var wsurl = 'ws://localhost:4590/server/stream-event'+'?'+param;
    gSocket = new WebSocket(wsurl);
    gSocket.onopen =  function (event) {
      console.log("opened websocket");
    };
    gSocket.onmessage = function(event) {
      console.log("onmessage",event.timeStamp,event.data.length);
      try {
        var o = JSON.parse(event.data);
      } catch {
        console.log("onmessage Caught socket issue",event);
        QueryError(o,"BAD",event);
        return false;
      }
      console.warn("msg with components",Object.keys(o));
      if("record" in o) {
        console.log("onmessage message not progress, assuming done.");
        if(event.data.length<200) console.log("onmessage data:",event.data,o);
        QuerySuccess(o,"OK-WS",event);
        gSocket.close();
      }
      else if("progress" in o) {
        console.log("onmessage PROGRESS",o);
        $('#main-circleprogress').circleProgress('value', o.progress*100);
        $('#main-circleprogress strong').html(o.state+"<br/>"+parseInt(o.progress*100)+'%');
        
      }
      else if("piece" in o) {
        console.warn("piece with components",Object.keys(o.piece));
        
        GotPiece(o);
        // $('#main-circleprogress').circleProgress('value', 0);
        // $('#main-circleprogress strong').html("Moving data over network"+"<br/>"+0+'%');
      }else if("composer" in o) { // skip - fix this later
        
      }else if("error" in o) {
          $('#status').attr('class', 'status-error');
          $("#status").text('serve-event error: '+o.error);
      }else {
        console.error("UNKNOWN MESSAGE TYPE",o)
      }
    };
    
  console.log("ws Query made!")
  return false;
}

function QueryServer( par, myurl )
{
    gTimeStats_StartQuery = performance.now();
    console.log("QueryServer",par,myurl);
    $("input").blur();
    
    var data = {};
    // Used for next/prev increment buttons.
    // if(querytype == 'last_query_type') querytype = gLastQueryType;
    // console.log("QueryServer("+querytype+")");
    var opts = "";

    // look at reco only:
    // if(/fast/.test(window.location.pathname)) opts+= "_NORAW__NOCAL_";
    // // Are we looking at wires? If not, don't request them.
    // if(par.loadwires) { // eval to true if parameter exists and set to non-false non-zero
    //   if(par.loadwires === "false" || par.loadwires === "no" || par.loadwires==="0") {opts += "_NORAW__NOCAL_";}
    //
    //   // load wires: normal operation.
    // } else {
    //   opts += "_NORAW__NOCAL_";
    // }
    
    
    if (!$(".show-wireimg").is(":checked")) {
      opts += "_NORAW__NOCAL_";
      $('#loading_feedback').html("<i>Not loading RawDigit or Wire data for speed.</i><br/>");
    } else {
      $('#loading_feedback').html("<b>Loading RawDigit or Wire data.. may be slower! Uncheck \"Show Wires\" to disable.</b></br/>");
    }
    
    var tilesize = 2400;
    if(kMaxTileSize < tilesize) tilesize = kMaxTileSize;
    opts+= "_tilesize" + tilesize + "_";


    // Default: do file-and-entry read from parameters. Should check for other options first.
    data = $.extend({},par)
    if(data.filename) data.filename = encodeURIComponent(par.filename);
    if(!data.options) data.options = opts;
    
        
    var param = $.param(data);
    
    $('#status').attr('class', 'status-transition');
    $("#status").text("Querying server for event data...");
    $('#main-circleprogress').circleProgress('value', 0);
    $('#main-circleprogress strong').text('Building');
    
    
    console.log("requesting "+myurl+"?"+param);
    $("#debuglinks").html(
      "Link to json data: <a href=\""+myurl+"?"+param+"\">"+myurl+"?"+param+"</a>"
    );
    $('#download-this-event').html('<a href="'+myurl+'?'+param+'&download">Download this event</a>');
    
    // Modify the "URL to the json data file" link with the actual query.
    $('#inXmlUrl').val(myurl+"?"+param);

    // gLastQueryType = querytype;
    gServerRequestTime = (new Date()).getTime();

    // Modify the cursor to show we're fetching.
    document.body.style.cursor='wait';

    console.log("Starting AJAX calls:",myurl,param);

    // JQuery call for compatibility.
    $.ajax({
            type: "GET",
            url: myurl,
            data: param,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            async: true,
            dataFilter: QueryFilter,
            error:    QueryError,
            success:  QuerySuccess,
            xhrFields: {
              onprogress : function(evt){
                // console.log("progress",parseFloat(evt.loaded)/parseFloat(evt.total));
                 var val = 0;
                 if(evt.loaded>0) val = (0.2+evt.loaded)/(0.2+evt.total);
                 $('#main-circleprogress').circleProgress('value', val);
                 $('#main-circleprogress strong').html("Network<br/>"+parseInt(evt.loaded/evt.total*100)+'%');
                 $('#main-circleprogress').circleProgress();

               }

            }
            // xhr: function(){
 //                 // get the native XmlHttpRequest object
 //                 var xhr = $.ajaxSettings.xhr() ;
 //                 // set the onprogress event handler
 //                 xhr.upload.onprogress = function(evt){ console.warn('upload.progress', evt.loaded/evt.total*100); } ;
 //                 // set the onload event handler
 //                 xhr.onprogress = function(evt){ console.warn('progress', evt.loaded/evt.total*100); } ;
 //                 // return the customized object
 //                 return xhr ;
 //             }
          });
    // QueryRecievedData is called via callback when this is done.
    
    // Issue a google analytics request
    // if(typeof _gat !== 'undefined'){
    //   var pageTracker = _gat._getTracker("UA-32019205-1");
    //   pageTracker._trackPageview("/Arachne"+myurl+"?"+param);
    // }

    
    return false;
}


function GotPiece(o)
{
  // NB Oliver Steele pattern for nested objects
  // const name = ((user || {}).personalInfo || {}).name;
  console.log("GotPiece",o);
  if(!o.event_descriptor) console.error("No event description in piece");
  if(!o.piece) console.error("No piece in piece!");
  gRecord = gRecord || {};
  if(gRecord.event_descriptor != o.event_descriptor) {
    console.warn("New event seen!",gRecord,o);
    gRecord = {event_descriptor:o.event_descriptor};
  }
    
  for(n1 in o.piece) {
    gRecord[n1] = gRecord[n1] || {}
    for(n2 in o.piece[n1]) {
      gRecord[n1][n2] = o.piece[n1][n2];
    }
  }
  StartEvent();
  
}

function QueryFilter(data, type)
{
  // This function is called before processing, I think: it might be used to do timing.
  gServerResponseTime = (new Date()).getTime();
  return data;
}

function QueryError(jqxhr, textStatus, errorThrown )
{ 
  $.unblockUI();
  gServing = null;
  gRecord = null;
  
  document.body.style.cursor='auto';
  
  gjqXHR = jqxhr;
  console.log("QueryError! Result:",gjqXHR);
  $('#status').attr('class', 'status-error');

  if(textStatus == 'error') {
    $("#status").text("Server gave error "+textStatus+": \""+errorThrown+"\" ");      
  } else {
    $("#status").text("Problem with data: \""+textStatus+"\"");    
  }
  //window.document.title = "Argo (error)";
}

function QuerySuccess(data,textStatus,jqxhr)
{
  gTimeStats_QuerySuccess = performance.now();
  
  console.log("QuerySuccess");
  document.body.style.cursor='auto';
  $.unblockUI();
  gClientParseTime = (new Date()).getTime();
  
  gjqXHR = jqxhr;
  gServing = null;
  gRecord = null;
  
  gServing = data;
  UpdateHeartbeatStatus();
  if(gServing.error) { 
    $('#status').attr('class', 'status-error');
    $("#status").text('serve-event error: '+gServing.error);
    //window.document.title = "Argo (error)";
    return;
  }
  
  console.log( "serve-event log:", gServing.serve_event_log );
  $("#debuglog").html(gServing.serve_event_log );

  if(gServing.record) {

    if(gServing.record.error) { 
      $('#status').attr('class', 'status-error');
      $("#status").text('serve-event error: '+gServing.record.error);
      //window.document.title = "Argo (error)";
      return;
    }
    gRecord = gServing.record;
    StartEvent();
    gFinishedDrawTime = (new Date()).getTime();
    DoPerformanceStats();
  } 
}

function StartEvent()
{
  $("#status").text("StartEvent (Drawing)...");
  if(gRecord.source) {
    // Get some basic info.  
    if(gRecord.source.file)  gFile   = gRecord.source.file;
    if(gRecord.source.entry) gEntry  = gRecord.source.entry;
// Fill the title bar.
    var file_short = gFile.replace(/^.*\/|\.[^.]*$/g, '');
    window.document.title = "Argo: event "+gEntry + " in "+file_short;

  } else {
    $('#status').attr('class', 'status-error');
    $("#status").text("Problem with data: " + gRecord.error);
    // window.document.title = "Argo (error)";
    
  }
  console.log(gRecord);
  gEventsLoadedThisSession +=1;

  
  // Populate data from header, when that's available.

  // Update the input forms with up-to-date data.
  $("#inFeEntry").val(gEntry);
  if($('#inEntryOrEvent').val()=="Event" && gRecord.header.event) $("#inFeEntry").val(gRecord.header.event);
  $('#inFilename').val(gFile);
  
  if(gRecord.source) {
    if(gRecord.source.run)   $(".inRun").val(gRecord.source.run);
    if(gRecord.source.subrun)$(".inSubrun").val(gRecord.source.subrun);
  }
  
  if(gRecord.header) {
    if(gRecord.header.run) {
      window.document.title = "Argo "+ gRecord.header.run + "|"+gRecord.header.subrun+"|"+gRecord.header.event;
    }
  }
  // Do initial data indexing and bookmarking.
  DoInitialBookmarking();
  
  // Attempt to guess event configuration and set controls accordingly.
  AutoFitHitTrackOffsets();
  
  
  
  // Trigger the automatic routines - stuff not yet pulled out of this routine.
  gTimeStats_RecordChange = performance.now();
  
  MakeTiledImages(); // This works better here - get those image requests in soon!

  gStateMachine.Trigger('recordChange');
  $("#status").text("Done!");
  $('#status').attr('class', 'status-ok');

  console.log("     /.\\\                           ");
  console.log("    // \\\\                          ");
  console.log("   //...\\\\    '||''| .|''|, .|''|, ");
  console.log("  //     \\\\    ||    ||  || ||  || ");
  console.log(".//       \\\\. .||.   `|..|| `|..|' ");
  console.log("                         ||          ");
  console.log("                      `..|'          ");
  console.log("Cool, you know how to open the console. You should definitely work on Argo with us. --Nathaniel");
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


function DoPerformanceStats()
{
  if(!gRecord.backend_monitor) return;
  var nserved = gRecord.backend_monitor.events_served;
  var walltime = gRecord.backend_monitor.WallClockTime;

  if(walltime> (60*60*24)) {
    wallstring = Math.round(walltime/(60*60*24)) + " days";
  } else if (walltime > 60*60) {
    wallstring = Math.round(walltime/(60*60)) + " hours";    
  } else if (walltime > 60) {
    wallstring = Math.round(walltime/(60)) + " min";    
  } else {
    wallstring = walltime + " sec";
  }
  
  var t_backend = gRecord.ElapsedServerTime;
  var t_get = (gServerResponseTime - gServerRequestTime - t_backend);
  var t_parse = (gClientParseTime - gServerResponseTime);
  var t_draw = ( gFinishedDrawTime - gClientParseTime);
  
  $("#debuginfo").html(
      "Time for backend to build JSON from disk: " + t_backend + "ms<br/>" +
      "Time to gzip JSON and transfer over network: " + t_get + " ms<br/>" +
      "Time to parse JSON on client: " + t_parse + " ms<br/>" +
      "Time to build and draw event: " +  t_draw + " ms<br/>" +
      "Backend: " + nserved + " events served, running unstopped for " + wallstring
   );
  var h = $('#debugbench').html();
  h+= gEntry +
      "   size: " + (gjqXHR?(gjqXHR.responseText.length):"unknown") + " bytes   " + // gHits.length + " hits" +
      "   backend: " + t_backend + " ms" +
      "   get:" + t_get + " ms " +
      "   parse:" + t_parse+ " ms " +
      "   draw: " + t_draw + " ms <br/>";
  $('#debugbench').html(h);
  
}

function UpdateHeartbeatStatus()
{
  if(!gServing) return;
  var elem = $('#heartbeat-status');

  if(gServing.heartbeat) {
    if(gServing.heartbeat.error) {
      elem.text(gServing.heartbeat.error);
      return;
    }
  }
  if(gServing.heartbeat) {
    if(gServing.heartbeat.server_restart) {
      elem.text("Please wait; server restarted " + CreateTimeAgoElement(gServing.heartbeat.server_restart*1000));
    }
  }

  if(gServing.heartbeat_time) {
    $(elem).addClass("TimeAgo");
    $(elem).html(CreateTimeAgoElement(gServing.heartbeat_time*1000));
  }  
  
}

