
$(function(){
  new DataSource();
});

function DataSource()
{
  /// Object to track things in the DataSource portlet and environs
  
  //
  // Bindings for DataSource controls.
  
  $('#inFilename')  .keydown(function(e){if (e.keyCode == 13) { QueryServer('fe'); }});
  $('#inFeEntry')   .keydown(function(e){if (e.keyCode == 13) { QueryServer('fe'); }});
  $('#go_fe').click(function(){QueryServer('fe'); return false;});
  $('button.next-event').click(DoNextEvent);
  $('button.prev-event').click(DoPrevEvent);
  
  gStateMachine.BindObj('recordChange',this,"NewRecord");  
}

DataSource.prototype.NewRecord = function()
{
  
  
  if(gUrlToThisEvent) gUrlToLastEvent = gUrlToThisEvent;
  var baseurl = location.href.split('?')[0];
  baseurl = baseurl.replace("live\.html","arachne.html");

  gUrlToThisEvent = baseurl + "?"
                    +"filename="+gFile
                    +"&entry="+gEntry
                    // +"&slice="+gCurrentSlice
                    ;    
  $('#link-to-this-event').html('<a href="'+gUrlToThisEvent+'">Link to this event</a>');
  $('#email-this-event').html('<a href="mailto:ntagg@otterbein.edu?subject=Arachne Bug&body='+escape(gUrlToThisEvent)+'">Email this event (Bug Report)</a>');
  
}                                         


function DoNextEvent()
{
  console.log("DoNextEvent");
  // Check bounds - are we about to hit end of file?
  var n = gRecord.source.numEntriesInFile;
  if(gEntry+1 >= n) {
    $('#warning-dialog-message').html("You are at the last entry of the file/subrun. Can't advance.");
    $( "#warning-dialog" ).dialog({
          modal: true,
          buttons: {
            Ok: function() {$( this ).dialog( "close" );}
          }
    });
  } else {
      if(gLastQueryType=='fe') {
        gEntry = gEntry+1;
        $('.inEntry').val(gEntry)
      }
      QueryServer('last_query_type');
  }
}

function DoPrevEvent()
{  
  if(gEntry <= 0) {
    $('#warning-dialog-message').html("You are at the first entry of the file/subrun. Can't move back.");
    $( "#warning-dialog" ).dialog({
          modal: true,
          buttons: {
            Ok: function() {$( this ).dialog( "close" );}
          }
    });
  } else {
    if(gLastQueryType=='fe') {
      gEntry = gEntry-1;
      $('.inEntry').val(gEntry)
    }
    QueryServer('last_query_type');
  }
}

