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
function QueryServer( querytype, newmsg )
{
    // Clear all selection targets.
    $("input").blur();
    
    var data = {};
    var myurl = "server/serve_event.cgi"; // Note relative url.
    // Used for next/prev increment buttons.
    if(querytype == 'last_query_type') querytype = gLastQueryType;
    console.log("QueryServer("+querytype+")");
    var opts = "_NoPreSpill_NoPostSpill_";
    // Are we looking at wires? If not, don't request them.
    if (!$(".show-wireimg").is(":checked")) {
      opts += "_NORAW__NOCAL_";
    }
    
    if(querytype === "fe") {
      var file = $('#inFilename').val();
      var entry = $('#inFeEntry').val();
      var selection = encodeURIComponent($('#inFeSelection').val());
      data = { filename: file, 
                  selection: selection,
                  entry: entry,
                  options: opts };
    } else {
      $('#status').attr('class', 'status-error');
      $("#status").text("Unknown request type "+ querytype);
      return;      
    }
    var param = $.param(data);
    
    $('#status').attr('class', 'status-transition');
    $("#status").text("Querying server for event data...");
    console.log("requesting "+myurl+param);
    $("#debuglinks").html(
      "Link to json data: <a href=\""+myurl+"?"+param+"\">"+myurl+"?"+param+"</a>"
    );
    // Modify the "URL to an XML file" link with the actual query.
    $('#inXmlUrl').val(myurl+"?"+param);

    gLastQueryType = querytype;

    gServerRequestTime = (new Date).getTime();

    // Modify the cursor to show we're fetching.
    document.body.style.cursor='wait';

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
            success:  QuerySuccess
          });
    // QueryRecievedData is called via callback when this is done.
    
    // Issue a google analytics request
    // if(typeof _gat !== 'undefined'){
    //   var pageTracker = _gat._getTracker("UA-32019205-1");
    //   pageTracker._trackPageview("/Arachne"+myurl+"?"+param);
    // }

    // User feedback that we are querying
    $.blockUI.defaults.themedCSS.top = '25%'; 
    $.blockUI({ 
              theme:     true, 
              title:    'Please wait', 
              message:    $('#MOTD')
              
              // ,timeout:   2000 
          });
    
    return false;
}


function QueryFilter(data, type)
{
  // This function is called before processing, I think: it might be used to do timing.
  gServerResponseTime = (new Date).getTime();
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
}

function QuerySuccess(data,textStatus,jqxhr)
{
  document.body.style.cursor='auto';
  $.unblockUI();
  gClientParseTime = (new Date).getTime();
  
  gjqXHR = jqxhr;
  gServing = null;
  gRecord = null;
  
  gServing = data;
  if(gServing.error) { 
    $('#status').attr('class', 'status-error');
    $("#status").text('serve-event error: '+gServing.error);
    return;
  }
  
  console.log( "serve-event log:", gServing.serve_event_log );
  $("#debuglog").html(gServing.serve_event_log );

  if(gServing.record) {
    gRecord = gServing.record;
    StartEvent();
    gFinishedDrawTime = (new Date).getTime();
    DoPerformanceStats();
  } 
}

function StartEvent()
{
  if(!gRecord.source) {
    $('#status').attr('class', 'status-error');
    $("#status").text("Problem with data: " + gRecord.error);
    return;
  }
  $("#status").text("Drawing...");
  console.log(gRecord);
  gEventsLoadedThisSession +=1;

  // Get some basic info.  Notes here show some basic jQuery magic.
  gFile   = gRecord.source.file;
  gEntry  = gRecord.source.entry;
  
  // Populate data from header, when that's available.

  // Update the input forms with up-to-date data.
  $(".inEntry").each(function(i){
    $(this).val(gEntry);
    });
  $('#inFilename').val(gFile);
  
  
  // Do initial data indexing and bookmarking.
  DoInitialBookmarking();
  
  // Trigger the automatic routines - stuff not yet pulled out of this routine.
  gStateMachine.Trigger('recordChange');
  $("#status").text("Done!");
  $('#status').attr('class', 'status-ok');
}

function DoPerformanceStats()
{
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
      "Time for backend to build JSON from disk: " + t_backend + "ms<br/>"
    + "Time to transfer JSON over network: " + t_get + " ms<br/>"
    + "Time to parse JSON on client: " + t_parse + " ms<br/>"
    + "Time to build and draw event: " +  t_draw + " ms<br/>"
    + "Backend: " + nserved + " events served, running unstopped for " + wallstring
   );
  var h = $('#debugbench').html();
  h+= gEntry
  + "   size: " + (gjqXHR.responseText.length) + " bytes   " //+ gHits.length + " hits"
  + "   backend: " + t_backend + " ms"
  + "   get:" + t_get + " ms "
  + "   parse:" + t_parse+ " ms "
  + "   draw: " + t_draw + " ms <br/>";
  $('#debugbench').html(h);
  
}

