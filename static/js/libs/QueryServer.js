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

var gLastHashState = {default: true};
function objectdiff(a,b,ignore) 
{
  var ks = [].concat(Object.keys(a)).concat(Object.keys(b));
  for(var k of ks) {
    if(ignore.includes(k)) continue;
    if( (k in a) && (k in b) ) {
      if( JSON.stringify(a[k])!==JSON.stringify(b[k]) ) return true;
    } else {
      return true;
    }
  }
  return false;
}

function HashChanged(  )
{
  // This function is called when the hash is changed. This sometimes results in a change of event.
  var par = $.deparam.fragment(true);

  // This call tells it to look for differences from the last state, but IGNORING the zoom or other local variables:
  var changed = objectdiff(par,gLastHashState,['zoom']);
  console.log("HashChange new state",par," old state ",gLastHashState," changed: ",changed);
  if(!changed) return;
  gLastHashState = $.extend(true, {}, par);
  console.log("HashChanged",par);
  
  if(par.reload) {  window.location.reload(); return; };// Force a reload! 
  
  if(!par.what) { $.bbq.pushState({what: 'file'}, 0);     }
  
  // Clear all selection targets.
  $("input").blur();
  // close all modals.
  $("div.modal").hide();
  
  if(par.ajax) QueryServer(par);
  else         QueryServerStream(par);
  // if     ( par.localFile ) ReadLocalFile(par);
  // else if( par.serverfile) QueryServer(par,par.serverfile);
  // else if( par.filename  ) QueryServerStream(par,  "/server/serve_event.cgi");
  // else if( par.what      ) QueryServer(par,  "/server/serve_event.cgi");
  // else if( gPageName == 'live' || par.live ) QueryServer(par,"server/serve_live.cgi");
  // else QueryServer(par,"server/default_event.json");
}


function QueryServerStream( par )
{
  gTimeStats_StartQuery = performance.now();
  console.log("QueryServerStream",par);
  $("input").blur();
  
  var request = $.extend({},par)
  
  // Add hidden options.
  var tilesize = 2400;
  if(kMaxTileSize < tilesize) tilesize = kMaxTileSize;
  request.tilesize = 2400;

  // Default: do file-and-entry read from parameters. Should check for other options first.
  request.pieces = request.pieces || [ 
    "/hits/recob::Hits_gaushit__DataApr2016GausFilterRecoStage1",

    // Useful defaults for masterclass using MCC 9 data
    "/hits/recob::Hits_gaushit__DataRecoStage1Test",
    "/tracks/recob::Tracks_pandoraKalmanTrack__DataRecoStage2",
    "/tracks/recob::Tracks_pandoraAllOutcomesTrack__DataRecoStage2",
  ];
      
  $('#status').attr('class', 'status-transition');
  $("#status").text("Connecting to server...");
  $('.progress-status').text();
  
  
  gServerRequestTime = (new Date()).getTime();
  gStateMachine.Trigger("newRecord");
  
  if(!gSocket) {
    // Open the socket.
    var wsurl = 'ws://'+window.location.host+'/ws/stream-event';
    if(window.location.protocol=="https:") wsurl = 'wss://'+window.location.host+'/wss/stream-event';
    console.log("Starting socket calls:",wsurl);

    gSocket = new WebSocket(wsurl);    
    gSocket.onopen =  function (event) {
      if (gSocket.readyState !== 1) {console.error("Websocket Not ready! THIS IS STUPID"); return;}
      console.log("opened websocket");
      $('#status').attr('class', 'status-ok');
      $("#status").text("Connected to server");
      // Start the request
      gSocket.send(JSON.stringify(request));    
    };
    gSocket.onmessage = function(event) {
      // console.log("onmessage",event.timeStamp,event.data.length);
      try {
        var o = JSON.parse(event.data);
      } catch {
        console.error("onmessage Caught socket issue",event);
        QueryError(o,"BAD",event);
      }
      RecieveData(o);
    };  
    gSocket.onerror = function(event) {
      console.error("onerror",event);
      $('#status').attr('class', 'status-error');
      $("#status").text('Connection broken');
    };
    gSocket.onclose = function(event) {
      console.error("onclose",event);
      $('#status').attr('class', 'status-error');
      $("#status").text('Connection broken');
    };
  } else {
    // Socket already read
    if (gSocket.readyState !== 1) gSocket.onopen =  ()=>{gSocket.send(JSON.stringify(request));}
    else gSocket.send(JSON.stringify(request));  // Send the request along straight away    
  } 
  
  
}



function RequestPiece( _type, _name ) // call with piece address, or type,name
{
  console.warn("RequestPiece",_type,_name);
  var piece = "/"+_type+"/"+_name;
  
  var request = {
                event_descriptor:gRecord.event_descriptor,
                pieces: [piece]};

  // Some things shouldn't be loaded alone. For example:
  if(_type == "clusters") {
    request.pieces.push("/associations/clusters/hits/"+_name);
    if(!gRecord.hits) request.pieces.push("/hits/*");
  }

  if(_type == "hits" ) {
    request.pieces.push("/associations/hits/tracks/"+_name+"/*");
  }
  // if(_type == "tracks" ) {
  //   request.pieces.push("/associations/tracks/hits/"+_name+"/*");
  // }
  
  if(_type.startsWith("mc")) {
    request.pieces.push("/associations/mctruth/mcparticles/"+_name);
    request.pieces.push("/associations/mctruth/gtruth/"+_name);
    if(!gRecord.mctruth) request.pieces.push("/mctruth/*");
    if(!gRecord.mcparticles) request.pieces.push("/mcparticles/*");
    if(!gRecord.gtruth)      request.pieces.push("/gtruth/*");
  }


  console.warn("actual pieces requested:",request.pieces);
                
  if(gSocket.readyState != WebSocket.OPEN) {
    console.warn("Socket not open. Attempting reconnect to server");
    $('#status').attr('class', 'status-warn');
    $("#status").text('Attempting reconnect to server');
    var par = $.deparam.fragment(true);
    par.pieces = [piece];
    QueryServerStream(par);
  }
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
    $('#status').attr('class', 'status-warn');
    $("#status").text('Attempting reconnect to server');
    var par = $.deparam.fragment(true);
    par.pieces = [piece];    
    QueryServerStream(par);
    
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

