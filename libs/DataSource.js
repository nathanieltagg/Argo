
gLocalFileSeqno = 1;

$(function(){
  new DataSource();
});


function DataSource()
{
  /// Object to track things in the DataSource portlet and environs


  function PushFEHash()
  {
    $.bbq.pushState({
      filename: $('#inFilename').val(),
      entry: $('#inFeEntry').val(),
      selection: $('#inFeSelection').val()
    },2);
  }
  
  function PushLocalFileHash()
  {
    console.log("PushLocalFileHash",$('#inLocalFile'),$('#inLocalFile').get(0).files);
    $.bbq.pushState({      
      localFile: ++gLocalFileSeqno
    },2);
  }
  
  // Tabs.
  $("div#data-source-tabs").tabs();
  
  //
  // Bindings for DataSource controls.
  
  $('#inFilename')  .keydown(function(e){if (e.keyCode == 13) { PushFEHash(); }});
  $('#inFeEntry')   .keydown(function(e){if (e.keyCode == 13) { PushFEHash(); }});
  $('#go_fe').button().click(function(){PushFEHash(); return false;});

  var self=this;
  $('#inLocalFile').change(function(){
    $('#go_localfile').button( "enable" );
    PushLocalFileHash();
  });
  $('#go_localfile').button().click(function(){PushLocalFileHash(); return false;}).button( "disable" );

  $('button.next-event').button().click(DoNextEvent);
  $('button.prev-event').button().click(DoPrevEvent);
  
  gStateMachine.BindObj('recordChange',this,"NewRecord");  
}



DataSource.prototype.NewRecord = function()
{
  
  
  if(gUrlToThisEvent) gUrlToLastEvent = gUrlToThisEvent;
  var baseurl = location.href.split('?')[0];
  baseurl = baseurl.replace("live\.html","arachne.html");

  gUrlToThisEvent = window.location;
   // baseurl + "?"
   //                  +"filename="+gFile
   //                  +"&entry="+gEntry
   //                  // +"&slice="+gCurrentSlice
   //                  ;    
  $('#link-to-this-event').html('<a href="'+gUrlToThisEvent+'">Link to this event</a>');
  $('#email-this-event').html('<a href="mailto:ntagg@otterbein.edu?subject=Arachne Bug&body='+escape(gUrlToThisEvent)+'">Email this event (Bug Report)</a>');
  
}                                         


function DoNextEvent()
{
  console.log("DoNextEvent");
  // Check bounds - are we about to hit end of file?
  var n = gRecord.source.numEntriesInFile;
  if(n && gEntry+1 >= n) {
    $('#warning-dialog-message').html("You are at the last entry of the file/subrun. Can't advance.");
    $( "#warning-dialog" ).dialog({
          modal: true,
          buttons: {
            Ok: function() {$( this ).dialog( "close" );}
          }
    });
  } else {
    $.bbq.pushState({entry: gEntry+1}, 0); // merge into current hash.
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
    $.bbq.pushState({entry: gEntry-1}, 0); // merge into current hash.
  }
}

