
gLocalFileSeqno = 1;

$(function(){
  new DataSource();
});


function DataSource()
{
  /// Object to track things in the DataSource portlet and environs


  function PushFEHash()
  {
    var newstate={
      what:       "file",
      filename:   $('#inFilename').val(),
      entry:      0
    };
    if($('#inEntryOrEvent').val()=="Entry") newstate.entry = $('#inFeEntry').val();
    else newstate.selection="EventAuxiliary.id_.event_=="+$('#inFeEntry').val();
    
    $.bbq.pushState( newstate, 2 );
  }


  function PushRunHash()
  {
    $.bbq.pushState({
      what: 'run',
      run:   $('#inRun').val(),
      event: $('#inRunEvent').val(),
      trig:  $('#inRunTrig').val(),
      tier:  $('#inRunTier').val(),
      selection: "EventAuxiliary.id_.event_=="+$('#inRunEvent').val()
    },2);
  }
    
    
  function PushSamDimHash()
  {
    var newstate = {
      what: 'samdim',
      samdim: $('#inSamDim').val(),
    }
    if($('#inSamEntryOrEvent').val()=="Entry") newstate.entry = $('#inSamEntry').val();
    else newstate.selection="EventAuxiliary.id_.event_=="+$('#inSamEntry').val();
    $.bbq.pushState( newstate, 2 );
    
  }
    
  // Tabs.
  $("div#data-source-tabs").tabs();
  
  //
  // Bindings for DataSource controls.
  
  $('#inFilename')  .keydown(function(e){if (e.keyCode == 13) { PushFEHash(); }});
  $('#inFeEntry')   .keydown(function(e){if (e.keyCode == 13) { PushFEHash(); }});
  $('#go_fe').click(function(){PushFEHash(); return false;});

  $('#inRun')    .keydown(function(e){if (e.keyCode == 13) { PushRunHash(); }});
  $('#inRunEvent')  .keydown(function(e){if (e.keyCode == 13) { PushRunHash(); }});
  $('#go_run').click(function(){PushRawRunHash(); return false;});

  $('#go_samdim').click(function(){PushSamDimHash(); return false;});


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
  var entry = ((gRecord || {}).source || {}).entry;
  var file = ((gRecord || {}).source || {}).file;
  $('.inEntryOrEvent').val("Entry");
  $('.inEntry').val(entry);

  $('#inFilename').val(file);
  
  $(".inRun").val(((gRecord || {}).source || {}).run);
  $(".inSubrun").val(((gRecord || {}).source || {}).subrun);
  $('.inEvent').val(((gRecord || {}).source || {}).event||-1);
  
  // Title of the window, also used for bookmarking
  if(gRecord.header) {
    if(gRecord.header.run) {
      window.document.title = "Argo "+ gRecord.header.run + "|"+gRecord.header.subrun+"|"+gRecord.header.event;
    }
  }
  
  if(gUrlToThisEvent) gUrlToLastEvent = gUrlToThisEvent;
  gUrlToThisEvent = window.location;

  var split1 = window.location.href.split('#');
  var hash = split1[1] || "";
  var split2 = split1[0].split('?');
  var par = split2[1] || "";
  var path = window.location.pathname;
  var fastpath = path+"fast";
  
  if(path && path.match(/fast/)) {
    // Aleady fast.
    fastpath = path;
    path.replace("fast.html","");
    path.replace("fast","");
  }
  
  // Sanitize the hash to prevent someone from putting a script in there.
  // hash = hash.replace(/(<([^>]+)>)/ig,"");
  // hash = hash.replace(/\"\'/ig,"");
  
  gUrlToThisEvent = window.location.protocol + "//" + window.location.hostname + path + par + "#" + hash;
  var fasturl     = window.location.protocol + "//" + window.location.hostname + fastpath + par +  "#" + hash;
   
  $('a.linktothis').attr('href',gUrlToThisEvent);
  $('#email-this-event').html('<a href="mailto:ntagg@otterbein.edu?subject=Argo Bug&body='+escape(gUrlToThisEvent)+'">Email this event (Bug Report)</a>');

};


function DoNextEvent()
{
  console.log("DoNextEvent");
  // Check bounds - are we about to hit end of file?
  var n = ((gRecord || {}).source || {}).numEntriesInFile;
  var entry = ((gRecord || {}).source || {}).entry;
  if(n && entry+1 >= n) {
    $('#warning-dialog-message').html("You are at the last entry of the file/subrun. Can't advance.");
    $( "#warning-dialog" ).dialog({
          modal: true,
          buttons: {
            Ok: function() {$( this ).dialog( "close" );}
          }
    });
  } else {
    console.log("advancing to ",entry+1);    
    $.bbq.pushState({entry: entry+1}, 0); // merge into current hash.    
  }
}

function DoPrevEvent()
{  
  var entry = ((gRecord || {}).source || {}).entry;
  if(entry <= 0) {
    $('#warning-dialog-message').html("You are at the first entry of the file/subrun. Can't move back.");
    $( "#warning-dialog" ).dialog({
          modal: true,
          buttons: {
            Ok: function() {$( this ).dialog( "close" );}
          }
    });
  } else {
    $.bbq.pushState({entry: entry-1}, 0); // merge into current hash.
  }
}

