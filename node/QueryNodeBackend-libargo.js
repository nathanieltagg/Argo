
 var gArgoNodeBackend = require('./build/Release/argo-backend-node');
 
// This function overrides the default in QueryServer.js
// This function takes the role of both ChangeEvent() and QueryServer()
function ChangeEvent(  )
{
  var par = $.deparam.fragment(true);
  console.log("ChangeEvent",par);
  
  if(par.reload) {  window.location.reload(); return; };// Force a reload! 
  
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
  
  // Clear all selection targets.
  $("input").blur();
  $('#status').attr('class', 'status-transition');
  $("#status").text("Querying server for event data...");
  $('#main-circleprogress').circleProgress('value', 0);
  $('#main-circleprogress strong').text('Building');
  gServerRequestTime = (new Date()).getTime();
  document.body.style.cursor='wait';


  console.warn("blockUI");
  // User feedback that we are querying
  $.blockUI.defaults.themedCSS.top = '25%'; 
  $.blockUI({ 
            theme:     true, 
            title:    'Please wait', 
            message:    $('#MOTD')
        });


  gTimeStats_StartQuery = performance.now();


  var event = gArgoNodeBackend.compose_async(
                          {options:opts
                          ,filename:par.filename
                          ,selection:"1"
                          ,entrystart:par.entry
                          },
                          function(result){
                            var record = JSON.parse(result);
                            console.log("Got record",record);
                            QuerySuccess({record:record});
                          }
                        );
  console.log(event);
  
  
  // QuerySuccess({record: event});



}



