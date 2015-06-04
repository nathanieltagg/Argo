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

var gEventsLoadedThisSession = 0;


$(function(){
});


function ChangeEvent( )
{
  var par = $.deparam.fragment(true);
  console.log("ChangeEvent",par);
  // Clear all selection targets.
  $("input").blur();

  // User feedback that we are querying
  $.blockUI.defaults.themedCSS.top = '25%'; 
  $.blockUI({ 
            theme:     true, 
            title:    'Please wait', 
            message:    $('#MOTD')
        });
  
  if     ( par.localFile ) ReadLocalFile(par);
  else if( par.serverfile) QueryServer(par,par.serverfile);
  else if( par.filename  ) QueryServer(par,  "server/serve_event.cgi");
  else if( gPageName == 'live' || par.live ) QueryServer(par, "server/serve_live.cgi");
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


function QueryServer( par, myurl )
{
    gTimeStats_StartQuery = performance.now();
    console.log("QueryServer",par);
    $("input").blur();
    
    var data = {};
    // Used for next/prev increment buttons.
    // if(querytype == 'last_query_type') querytype = gLastQueryType;
    // console.log("QueryServer("+querytype+")");
    var opts = "_NoPreSpill_NoPostSpill_";

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
    


    // Default: do file-and-entry read from parameters. Should check for other options first.
    data = $.extend({},par)
    if(data.filename) data.filename = encodeURIComponent(par.filename);
    if(!data.options) data.options = opts;
        
    
    // if(querytype === "fe") {
    //   var file = $('#inFilename').val();
    //   var entry = $('#inFeEntry').val();
    //   var selection = encodeURIComponent($('#inFeSelection').val());
    //   data = { filename: file, 
    //               selection: selection,
    //               entry: entry,
    //               options: opts };
    // } else {
    //   $('#status').attr('class', 'status-error');
    //   $("#status").text("Unknown request type "+ querytype);
    //   return;      
    // }
    var param = $.param(data);
    
    $('#status').attr('class', 'status-transition');
    $("#status").text("Querying server for event data...");
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
              onprogress : function(evt){ console.warn('progress',evt, evt.loaded,evt.total); }
              
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
  if(gServing.heartbeat) UpdateHeartbeatStatus(gServing.heartbeat);
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
  $(".inEntry").each(function(i){
    $(this).val(gEntry);
    });
  $('#inFilename').val(gFile);
  
  
  // Do initial data indexing and bookmarking.
  DoInitialBookmarking();
  
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
  console.log("                         ||        ");
  console.log("                      `..|'        ");
  console.log("Cool, you know how to open the console. You should definately work on Argo with us. --Nathaniel");
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

function UpdateHeartbeatStatus(heartbeat)
{
  var elem = $('#heartbeat-status');
  if(heartbeat.error) {
    elem.text(heartbeat.error);
    return;
  }
  if(heartbeat.server_restart) {
    var d = new Date(heartbeat.server_restart*1000);
    elem.text("Please wait; server restarted " + d.toString);
  }
  
}

