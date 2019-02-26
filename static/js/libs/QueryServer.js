//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

$(function(){
  console.log("     /.\\\                           ");
  console.log("    // \\\\                          ");
  console.log("   //...\\\\    '||''| .|''|, .|''|, ");
  console.log("  //     \\\\    ||    ||  || ||  || ");
  console.log(".//       \\\\. .||.   `|..|| `|..|' ");
  console.log("                         ||          ");
  console.log("                      `..|'          ");
  console.log("Cool, you know how to open the console. You should definitely work on Argo with us. --Nathaniel");  
});


gjqXHR = null;    
gServing = null;   // Data element from server, including wrapper with possible error messages.
gRecord = null;    // This is the core data element
var gUrlToThisEvent = null;
var gUrlToLastEvent = null;

// Profiling
var gSocket=0;


  
// Not doing this.
// $(function(){
//   $('#main-circleprogress').circleProgress({
//       value: 0,
//       thickness: 8,
//       size: $('#main-circleprogress').width(),
//       fill: {
//           gradient: ["white","orange","red"]
//         , gradientAngle: Math.PI / 2
//       }
//   });
// })
// $.circleProgress.defaults.setValue = function(newValue) {
//     if (this.animation) {
//         var canvas = $(this.canvas),
//             q = canvas.queue();
//
//         if (q[0] == 'inprogress') {
//             canvas.stop(true, true);
//         }
//
//         this.animationStartValue = this.lastFrameValue;
//     }
//
//     this.value = newValue;
//     this.draw();
// };


function ChangeEvent(  )
{
  var par = $.deparam.fragment(true);
  console.log("ChangeEvent",par);
  
  if(par.reload) {  window.location.reload(); return; };// Force a reload! 
  
  // Clear all selection targets.
  $("input").blur();

  // // User feedback that we are querying
  // $.blockUI.defaults.themedCSS.top = '25%';
  // $.blockUI({theme:     true,title:    'Please wait',message:    $('#MOTD')});
  
  if     ( par.localFile ) ReadLocalFile(par);
  else if( par.serverfile) QueryServer(par,par.serverfile);
  else if( par.filename  ) QueryServerStream(par,  "/server/serve_event.cgi");
  else if( par.what      ) QueryServer(par,  "/server/serve_event.cgi");
  else if( gPageName == 'live' || par.live ) QueryServer(par,"server/serve_live.cgi");
  else QueryServer(par,"server/default_event.json");
}

// Bleah local file
// gFileReader = null;
// function ReadLocalFile( par )
// {
//   console.log("ReadLocalFile",par);
//   var files = $('#inLocalFile').get(0).files;
//   if(files.length<1) {
//     console.warn("no local file");
//     $.unblockUI();
//     $('#status').attr('class', 'status-error').html("Need to re-select your input file.");
//     return;
//   }
//   var file = files[0];
//   console.log("reading local file ",file);
//   gFileReader = new FileReader();
//   gFileReader.onload = ReadLocalFileSuccess;
//   gFileReader.readAsText(file);
// }
//
// function ReadLocalFileSuccess()
// {
//   var obj;
//   try {
//     obj = JSON.parse(gFileReader.result);
//   } catch (e) {
//     $.unblockUI();
//     $('#status').attr('class', 'status-error').html("The file you loaded could not be parsed as json:</br>"+e);
//     return;
//   }
//   console.log("Got it:",obj);
//   QuerySuccess(obj,null,null);
// }


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
  data.pieces = [ "/hits/recob::Hits_gaushit__DataApr2016GausFilterRecoStage1",
    "/ophits/*",
    "/clusters/*",
    "/tracks/*",
    "/associations/*"
  ];
      
  var param = $.param(data);
  
  $('#status').attr('class', 'status-transition');
  $("#status").text("Querying server for event data...");
  $('.progress-status').text("Connecting to server...");
  
  // $('#main-circleprogress').circleProgress('value', 0);
  // $('#main-circleprogress strong').text('Building');
  
  
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
  // document.body.style.cursor='wait';

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
      console.error("onmessage Caught socket issue",event);
      QueryError(o,"BAD",event);
    }
    RecieveData(o);
  }  
  gSocket.onerror = function(event) {
    console.error("onerror",event);
    $('#status').attr('class', 'status-error');
    $("#status").text('Socket error.');
  }
}

function RequestPiece( piece )
{
  var request = {event_descriptor:gRecord.event_descriptor};
  if(Array.isArray(piece))
    request.pieces = piece
  else
    request.piece = piece
  try {
    console.log("RequestPiece",request);
    gSocket.send(JSON.stringify(request));
  } catch (err) {
    // FIXME: attempt reconnect and get a new Composer instance on the server.
    $('#status').attr('class', 'status-error');
    $("#status").text('WS Socket error: Server disconnected unexpectedly.');
    
    
    // FIXME;
    // Attempt reconnect
    console.error("Attempting reconnect to server");
  } 
}


//
// This is the old-fashioned single-file query
//
function QueryServer( par, myurl )
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
            error:    QueryError,
            success:  QuerySuccess,
            xhrFields: {
              onprogress : function(evt){
                // console.log("progress",parseFloat(evt.loaded)/parseFloat(evt.total));
                 var val = 0;
                 if(evt.loaded>0) val = (0.2+evt.loaded)/(0.2+evt.total);
                 // $('#main-circleprogress').circleProgress('value', val);
                 // $('#main-circleprogress strong').html("Network<br/>"+parseInt(evt.loaded/evt.total*100)+'%');
                 // $('#main-circleprogress').circleProgress();

               }

            }
          });
    // QueryRecievedData is called via callback when this is done.
    return false;
}

function QueryError(jqxhr, textStatus, errorThrown )
{ 
  gServing = null;
  gRecord = {};
  gjqXHR = jqxhr;

  console.error("QueryError! Result:",gjqXHR);
  $('#status').attr('class', 'status-error');

  if(textStatus == 'error') {
    $("#status").text("Server gave error "+textStatus+": \""+errorThrown+"\" ");      
  } else {
    $("#status").text("Problem with data: \""+textStatus+"\"");    
  }
}

function QuerySuccess(data,textStatus,jqxhr)
{
  console.log("QuerySuccess");
  document.body.style.cursor='auto';
  
  gjqXHR = jqxhr;
  gServing = data;
  gRecord = {};  
  UpdateHeartbeatStatus();
  if(gServing.error) { 
    $('#status').attr('class', 'status-error');
    $("#status").text('serve-event error: '+gServing.error);
    //window.document.title = "Argo (error)";
    return;
  }
  
  console.log( "serve-event log:", gServing.serve_event_log );
  $("#debuglog").html(gServing.serve_event_log );
  
  GotRecord(gServing);
}




// FIXME: REplace
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


// FIXME: replace.
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

