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
function QueryServer( querytype )
{
    // Clear all selection targets.
    $("input").blur();
    
    var data = {};
    var myurl = "server/serve_event.cgi"; // Note relative url.
    // Used for next/prev increment buttons.
    if(querytype == 'last_query_type') querytype = gLastQueryType;
    console.log("QueryServer("+querytype+")");
    
    
    if(querytype === "fe") {
      var file = $('#inFilename').val();
      var entry = $('#inFeEntry').val();
      var selection = encodeURIComponent($('#inFeSelection').val());
      data = { filename: file, 
                  selection: selection,
                  entry: entry,
                  options: "_WIRES_" };
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
    var msg = '<p><img src="images/busy.gif" /> &nbsp;&nbsp;Querying server for event data...</p>'+gMOTD;
    $.blockUI({ 
              theme:     true, 
              title:    'Please wait', 
              message:   msg
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
  
  // Set global hit structures.
  //FindImportantXmlHandles(); // Put this into a function for better profiling.
  //gHoverTrack = gSelectedTrack = null;
  

  //  var sel = $('#ctl-color-scale option:selected').val();
  //gPhColorScaler.SetScale(sel);
  // gPhColorScaler.min=0;
  // gPhColorScaler.max=30;


  // Find detector configuration, load correct geometry.

  // OK, time to impliment some sort of data limiter
  //gThereAreTooManyHits = (gHits.length > kTooManyHits);
  // if(gThereAreTooManyHits) {
  //     $('#num-hits-untruncated').text(gHits.length);
  //     $.blockUI({  theme:     true,
  //                   title: "Too Many Hits!",
  //                 message: $('#too-many-hits-confirmation'), css: { width: '275px' } }); 
  // 
  // 
  //   } else {
  

  // Trigger the automatic routines - stuff not yet pulled out of this routine.
  gStateMachine.Trigger('recordChange');
  $("#status").text("Done!");
  $('#status').attr('class', 'status-ok');
  // if(gThereAreTooManyHits) {
  //     // Boom! Too much data!
  //     $("#status").text("Warning. More than " +kTooManyHits+ " hits.");
  //     $('#status').attr('class', 'status-warning');
  // }
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

  // if (gXhttpData.responseXML.documentElement.nodeName === "parsererror")
  // {
  //     errStr = gXhttpData.responseXML.documentElement.childNodes[0].nodeValue;
  //     errStr = errStr.replace(/</g, "&lt;");
  //     console.log(errStr);
  //     $('#status').attr('class', 'status-error');
  //     $("#status").text("XML is invalid");
  //     xhttpdata = null;
  //     return false;
  // } else {
  //   $("#status").text("XML is valid");
  // }
  // 
  // if( $('error',xhttpdata.responseXML).size() !== 0) {
  //   $("#status").attr('class','status-error');
  //   $("#status").text("Error fetching data.");
  //   $('error',xhttpdata.responseXML).each(function(i) {
  //     var txt = String($(this).text());
  //     $("#status").text("Error:" + txt);
  //     console.log( $('serve_event_logging',xhttpdata.responseXML).text()  );
  //     var txt = String($('serve_event_logging',xhttpdata.responseXML).text());
  //     $("#debuglog").html(txt );
  //     
  //   });
  //   return false;
  // }
  // 
  // // if(! $.browser.msie) {
  // //   $("#status").text("Cleaning...");
  // //   cleanWhitespace(xmlDoc.documentElement);
  // // }
  // 
  // // xmlDoc = $("<data></data>");
  // // var i = xhttpdata.responseText.indexOf("<gate>");
  // // xmlDoc.append(xhttpdata.responseText.substr(i));
  // xmlDoc = xhttpdata.responseXML; // put it into a global variable.
  // 
  // if($('gate ev',xmlDoc).length==0) {
  //   console.log("Can't find ev element.");
  //   $('#status').text("No data returned.");
  //   $('#status').attr('class', 'status-error');
  //   xmlDoc = null;
  //   return false;
  // }
  // 
  // 
  // DoEvent();
  // // console.profileEnd();

//  if(!ok) {
//    gStateMachine.Trigger('gateChange'); // Wipe all the displays to show it's not loaded.
//  }
// }

/*

function DoEvent()
{
  $("#status").text("Drawing...");
  
  console.log('DoEvent');
  var el;

  // ev_detector types (I think)
  // PMTTestStand           = 0x01,
  // TrackingPrototype      = 0x02,
  // TestBeam               = 0x04,
  // FrozenDetector         = 0x08,
  // UpstreamDetector       = 0x10,
  // FullMinerva            = 0x20,
  // DTReserved7            = 0x40,
  // DTReserved8            = 0x80'


  // Get some basic info.  Notes here show some basic jQuery magic.
  gFile   = $('file',xmlDoc).text();         // Gets text of xml node 'file'
  gDet    = "TP";                           // Fixme for new detector versions.
  if(parseInt($('ev detector',xmlDoc).text()) >= 8 ) gDet = "MN";
  if(parseInt($('ev detector',xmlDoc).text()) == 0 ) gDet = "MV";
  if(parseInt($('ev detector',xmlDoc).text()) >= 32 ) gDet = "MV";
  if(parseInt($('ev detector',xmlDoc).text()) == 4 ) gDet = "TB"; // Testbeam
  
  // Override by filename, if it makes sense.
  
  var lastslash = gFile.lastIndexOf('/');
  var firstunder = gFile.indexOf('_',lastslash);
  var secondunder = gFile.indexOf('_',firstunder+1);
  var detcode = gFile.substring(lastslash+1,firstunder);

  if(detcode=='TP')  gDet = detcode;
  if(detcode=='MV')  gDet = detcode;
  if(detcode=='MN')  gDet = detcode;
  if(detcode=='TB') gDet = detcode;
  if(detcode=='SIM') {
    detcode = gFile.substring(lastslash+1,secondunder);    
    gDet = detcode;
  }

  gRecoVer= $('reco_version',xmlDoc).text(); 
  gRun    = parseInt($('ev run',xmlDoc).text());       // Gets text of xml node 'run' that sits under 'ev'.
  gSubrun = parseInt($('ev sub_run',xmlDoc).text());    // Gets text of xml node 'run' that sits under 'ev'.
  gGate   = parseInt($('ev gate',xmlDoc).text());      // Gets text of xml node 'run' that sits under 'ev'.
  gEntry  = parseInt($('entry',xmlDoc).text());      // Gets text of xml node 'run' 

  // Update the input forms with up-to-date data.
  $("#inRsgDet").val(gDet);
  $("#inRsgRecoVer").val(gRecoVer);
  $("#inRsgRun").val(gRun);
  $("#inRsgSubrun").val(gSubrun);
  $(".inGate").each(function(i){
    $(this).val(gGate);
    });
  $(".inEntry").each(function(i){
    $(this).val(gEntry);
    });
  $('#inFilenameMenu').val(gFile);
  $('#inFilename').val(gFile);
  $('#inXmlText').val(xhttpdata.responseText);
  
  // Load cache data if it's a live request.
  var live_cache = $('live_cache_file',xmlDoc);
  if(live_cache.size()>0) {
    gRecentCache = live_cache.text();  //#timestamp of the event they were just looking at.
    if(gLatestCache == null || gRecentCache > gLatestCache) 
      gLatestCache = gRecentCache;    //filename of the latest event yet seen by that client
  } 

  ResetScannerForm();

  gNumSlices = parseInt($('n_slices',xmlDoc).text());
  gWhichSliceOnNextLoad = parseInt(gWhichSliceOnNextLoad); // Just to be sure.
  // Set current slice number.
  console.log("Loading first slice as ",gWhichSliceOnNextLoad," Total slices:",gNumSlices);
  gCurrentSlice = gWhichSliceOnNextLoad; // if(gWhichSliceOnNextLoad === 'all') gCurrentSlice = -1;
  if(gCurrentSlice > gNumSlices) gCurrentSlice = gNumSlices;
  if(gNumSlices <= 0) gCurrentSlice = -1;
  console.log("Set slice to",gCurrentSlice);

  // Set global hit structures.
  FindImportantXmlHandles(); // Put this into a function for better profiling.
  gHoverTrack = gSelectedTrack = null;
  

  var sel = $('#ctl-color-scale option:selected').val();
  gPhColorScaler.SetScale(sel);
  // gPhColorScaler.min=0;
  // gPhColorScaler.max=30;


  // Set up the correct configuration for the detector:
  if (gDet == "TB" ) {  // testbeam
    if(gRun<238) gGeo = new TBGeometry_20ECAL20HCAL;
    else         gGeo = new TBGeometry_20Tracker20ECAL;
  }
  else if(gDet=="TP" || gDet=="SIM_prototype") {
    // TP:
    gGeo = new TPGeometry;
  }
  else if(gDet=="MN" || gDet=="SIM_frozen") { 
    gGeo = new MNGeometry;
  } else {

    // Fallback: full detector.
    gGeo = new MVGeometry;
  }
  

  // OK, time to impliment some sort of data limiter
  gThereAreTooManyHits = (gHits.length > kTooManyHits);
  if(gThereAreTooManyHits) {
    $('#num-hits-untruncated').text(gHits.length);
    $.blockUI({  theme:     true,
                  title: "Too Many Hits!",
                message: $('#too-many-hits-confirmation'), css: { width: '275px' } }); 


  } else {
    DoEvent_Part2();
  }
}

$(function(){
  $('#too-many-hits-continue').click(function() { 
              $.unblockUI();
              DoEvent_Part2();
          });
  $('#too-many-hits-truncate').click(function() { 
              $.unblockUI();
              gHits.splice(kTooManyHits);
              gIdHits.splice(kTooManyHits);
              gOdHits.splice(kTooManyHits);
              DoEvent_Part2();
            });
  $('#too-many-hits-stop') .click(function() { 
              $.unblockUI();
              gHits = [];
              gIdHits = [];
              gOdHits = [];
              DoEvent_Part2();
              
            });
  
})


function DoEvent_Part2()
{
  // Build any once-per-record data indices.
  BuildHitToTrackMap();

  gEventsLoadedThisSession +=1;

  // Trigger the automatic routines - stuff not yet pulled out of this routine.
  gStateMachine.Trigger('gateChange');
  $("#status").text("Done!");
  $('#status').attr('class', 'status-ok');
  if(gThereAreTooManyHits) {
    // Boom! Too much data!
    $("#status").text("Warning. More than " +kTooManyHits+ " hits.");
    $('#status').attr('class', 'status-warning');
  }
  gFinishedDrawTime= (new Date).getTime();

  var nserved  = $('ntuple_server_monitor events_served',xmlDoc).text();
  var usertime = $('ntuple_server_monitor CpuTimeUser',xmlDoc).text();
  var systime = $('ntuple_server_monitor CpuTimeSys',xmlDoc).text();
  var memres = $('ntuple_server_monitor MemResident',xmlDoc).text();
  var memvirt = $('ntuple_server_monitor MemVirtual',xmlDoc).text();
  var walltime = parseFloat($('ntuple_server_monitor WallClockTime',xmlDoc).text());
  if(walltime> (60*60*24)) {
    wallstring = Math.round(walltime/(60*60*24)) + " days";
  } else if (walltime > 60*60) {
    wallstring = Math.round(walltime/(60*60)) + " hours";    
  } else if (walltime > 60) {
    wallstring = Math.round(walltime/(60)) + " min";    
  } else {
    wallstring = walltime + " sec";
  }
  
  var elapsedServerTime = parseFloat($('ElapsedServerTime',xmlDoc).text());
  
  
  $("#debuginfo").html(
    "Time to get and parse XML from server: " + (gServerResponseTime - gServerRequestTime) + " ms<br/>"
    + "Time to build and draw event: " +  ( gFinishedDrawTime - gServerResponseTime) + " ms<br/>"
    + "Backend: " + nserved + " events served, running unstopped for " + wallstring
   );
  var h = $('#debugbench').html();
  h+= gRun + "/" + gSubrun + "/" + gGate
  + "   size: " + (xhttpdata.responseText.length) + " bytes   " + gHits.length + " hits"
  + "   ntuple-server: " + elapsedServerTime + " ms"
  + "   xml:" + (gServerResponseTime - gServerRequestTime - elapsedServerTime) + " ms   draw: " 
  + ( gFinishedDrawTime - gServerResponseTime)
  + " ms<br/>";
  $('#debugbench').html(h);
};

function DoSlice(slice)
{
  stop_auto_refresh();
  ResetScannerForm();
  if(xmlDoc === null){
    gCurrentSlice = -1;
    return false;
  }
  if(slice <= gNumSlices) gCurrentSlice=slice;
  gStateMachine.Trigger('sliceChange');
  return false;
}

function DoSliceNext(dont_stop_refresh)
{
  if(!dont_stop_refresh) stop_auto_refresh();
  ResetScannerForm();
  
  if(xmlDoc === null){
    gCurrentSlice = -1;
    return false;
  } 
  if(gCurrentSlice < 1) gCurrentSlice = 1;
  gCurrentSlice++;
  if(gCurrentSlice > gNumSlices) { gCurrentSlice = 1;};
  if(gNumSlices<=0) gCurrentSlice = -1;
  
  gStateMachine.Trigger('sliceChange');
  
  return false;
}

function DoSlicePrev()
{
  stop_auto_refresh();
  ResetScannerForm();
  if(xmlDoc === null){
    gCurrentSlice = -1;
    return false;
  } 
  gCurrentSlice--;
  if(gCurrentSlice < 1) { gCurrentSlice = gNumSlices;  }
  gStateMachine.Trigger('sliceChange');
  return false;  
}

function DoSliceZero(event)
{
  stop_auto_refresh();
  ResetScannerForm();
  if(xmlDoc === null){
     gCurrentSlice = -1;
     gStateMachine.Trigger('sliceChange');
     return false;
   }
   gCurrentSlice = 0;
   gStateMachine.Trigger('sliceChange');
   return false;
}

function DoSliceAll(event)
{
  stop_auto_refresh();
  ResetScannerForm();
  gCurrentSlice = -1;
  gStateMachine.Trigger('sliceChange');
  return false;
}

function DoNextSliceAndGate(event)
{
  stop_auto_refresh();
  ResetScannerForm();
  if(gCurrentSlice<1) gCurrentSlice=1;
  else{
    gCurrentSlice++;
    if(gCurrentSlice > gNumSlices) {
      gWhichSliceOnNextLoad=1;
      DoNextEvent();
      return false;
    }
  }
  gStateMachine.Trigger('sliceChange');
  return false;
}

function DoPrevSliceAndGate(event)
{
  stop_auto_refresh();
  ResetScannerForm();
  gCurrentSlice--;
  if(gCurrentSlice<1) {
    gWhichSliceOnNextLoad=99999;
    DoPrevEvent();
    return false;    
  }
  gStateMachine.Trigger('sliceChange');
  return false;
}

function DoNextEvent()
{
  // Check bounds - are we about to hit end of file?
  var n = parseInt($("source numEntriesInFile",xmlDoc).text());
  if(gEntry+1 >= n) {
    $('#warning-dialog-message').html("You are at the last entry of the file/subrun. Can't advance.");
    $( "#warning-dialog" ).dialog({
          modal: true,
          buttons: {
            Ok: function() {$( this ).dialog( "close" );}
          }
    });
  } else {

      if(gLastQueryType=='rsg') {
        gGate = gGate+1;
        $('.inGate').val(gGate);
      } else if(gLastQueryType=='fe') {
        gEntry = gEntry+1;
        $('.inEntry').val(gEntry)
      }
      gWhichSliceOnNextLoad=-1;
      QueryServer('last_query_type');
  }
}

function DoPrevEvent()
{
  stop_auto_refresh();
  
  if(gEntry <= 0) {
    $('#warning-dialog-message').html("You are at the first entry of the file/subrun. Can't move back.");
    $( "#warning-dialog" ).dialog({
          modal: true,
          buttons: {
            Ok: function() {$( this ).dialog( "close" );}
          }
    });
  } else {
  
  
    if(gLastQueryType=='rsg') {
      gGate = gGate-1;
      $('.inGate').val(gGate);
    } else if(gLastQueryType=='fe') {
      gEntry = gEntry-1;
      $('.inEntry').val(gEntry)
    }
    gWhichSliceOnNextLoad=-1;
    QueryServer('last_query_type');
  }
}

function DoJumpToEvent(next_det, next_ver, next_run, next_subrun, next_gate, next_slice)
{
  var cur_ver     = gRecoVer;
  var cur_run     = gRun;
  var cur_subrun  = gSubrun;
  var cur_gate    = gGate
  var cur_slice   = gCurrentSlice;

  if(next_ver==null) { next_ver = gRecoVer; }
  if(next_det==null) { next_ver = gDet; }

  if((next_ver == gRecoVer) && (next_run == gRun) && (next_subrun==gSubrun) && (next_gate==gGate)) {
    // Just the slice needs changing.
    DoSlice(next_slice);
    return;
  }

  // Otherwise, we need a new event loaded. Set the input form.
  $('#inRsgRecoVer').val(next_ver);
  $('#inRsgDet').val(next_det);
  $('.inRun').val(next_run);
  $('.inSubrun').val(next_subrun);
  $('.inGate').val(next_gate);
  gWhichSliceOnNextLoad=next_slice;
  QueryServer('rsg');
}



function QueryRecievedData(data, textStatus )
{
  // Nuke all the current data.
  gNumSlices=0;
  gHits = [];
  gIdHits = [];
  gOdHits = [];
  gIdClusters = [];
  gOdClusters = [];
  gTracks = [];
  gIdClusters = [];
  gThereAreTooManyHits = false;

  gHoverHits = [];
  gSelectedHits = [];
  gHoverTrack = null;
  gSelectedTrack = null;
  
  xmlDoc = null; // Clean up previous event.
  xhttpdata = null;

  var ok = ProcessXml(data, textStatus);
  if(!ok) {
    gStateMachine.Trigger('gateChange'); // Wipe all the displays to show it's not loaded.
  }
}

function ProcessXml(data, textStatus )
{
  $.unblockUI();
  gServerResponseTime = (new Date).getTime();
  $("#status").text("Response received.");

  document.body.style.cursor='progress';
  
  if(data.status!==null) {
    // console.log(data.status);
    if(data.status !== 200) {
      $('#status').attr('class', 'status-error');
      $("#status").text("Server gave error "+data.status+": \""+data.statusText+"\" "+textStatus);
      // console.log("tried to get: "+this.url);
      // console.log(data);
      return false;
    } else {
      $("#status").text("Server returned data "+data.status+": \""+data.statusText+"\"");
    }
  }

  xhttpdata = data;
  if (xhttpdata.responseXML.documentElement.nodeName === "parsererror")
  {
      errStr = xhttpdata.responseXML.documentElement.childNodes[0].nodeValue;
      errStr = errStr.replace(/</g, "&lt;");
      console.log(errStr);
      $('#status').attr('class', 'status-error');
      $("#status").text("XML is invalid");
      xhttpdata = null;
      return false;
  } else {
    $("#status").text("XML is valid");
  }
  
  if( $('error',xhttpdata.responseXML).size() !== 0) {
    $("#status").attr('class','status-error');
    $("#status").text("Error fetching data.");
    $('error',xhttpdata.responseXML).each(function(i) {
      var txt = String($(this).text());
      $("#status").text("Error:" + txt);
      console.log( $('serve_event_logging',xhttpdata.responseXML).text()  );
      var txt = String($('serve_event_logging',xhttpdata.responseXML).text());
      $("#debuglog").html(txt );
      
    });
    return false;
  }

  // if(! $.browser.msie) {
  //   $("#status").text("Cleaning...");
  //   cleanWhitespace(xmlDoc.documentElement);
  // }
  
  // xmlDoc = $("<data></data>");
  // var i = xhttpdata.responseText.indexOf("<gate>");
  // xmlDoc.append(xhttpdata.responseText.substr(i));
  xmlDoc = xhttpdata.responseXML; // put it into a global variable.
  
  if($('gate ev',xmlDoc).length==0) {
    console.log("Can't find ev element.");
    $('#status').text("No data returned.");
    $('#status').attr('class', 'status-error');
    xmlDoc = null;
    return false;
  }
  
  
  DoEvent();
  // console.profileEnd();
  document.body.style.cursor='auto';
  return true;  
}


// Function for auto-refresh
gRefreshTimeout = null;
function refresh_live(ev) {
  // console.log("refresh_live");
  if(gRefreshTimeout) clearTimeout(gRefreshTimeout);
  // console.log('refresh',$('#ctl-refresh-auto'),$('#ctl-refresh-auto').is(":checked"));
  if($('#ctl-refresh-auto').is(":checked")) {
    QueryServer('livedata');
    // restart timer.
    var delay = parseFloat($('#ctl-refresh-period').val())*1000;
    gRefreshTimeout = setTimeout(refresh_live,delay);
    // console.log('Starting refresh timer',gRefreshTimeout,delay);
  }
}

function stop_auto_refresh()
{
  // Highlight to user that we have flipped the switch off.
  $('#ctl-refresh-auto').parents("div:first").effect("highlight", {}, 5000);
  
  $('#ctl-refresh-auto').attr('checked', false);
}

// Function for slice-sycling
gSliceCycleTimeout = null;
function advance_slice()
{
  // console.log("advance_slice()");
  if(gSliceCycleTimeout) clearTimeout(gSliceCycleTimeout);
  if($('#ctl-slices-auto').is(":checked")) {
    DoSliceNext(true);
    var delay = 2000;
    gSliceCycleTimeout = setTimeout(advance_slice,delay);
  }
}
*/
