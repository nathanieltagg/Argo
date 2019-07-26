var gLiveControl = null;

// Automatic runtime configuration.
$(function(){
  $('div.A-LiveControl').each(function(){
    gLiveControl = new LiveControl(this);
  });  
});

var gLiveSocket = null;

function LiveControl( element )
{
  this.element = element;
  var settings = {
  };
  $.extend(true,this,settings);
  
  // Merge in options from element
  var element_settings = $(element).attr('settings');
  var element_settings_obj={};
  if(element_settings) {
    eval( "var element_settings_obj = { " + element_settings + '};'); // override from 'settings' attribute of html object.
    // console.log(element_settings, element_settings_obj);
    $.extend(true,this,element_settings_obj); // Change default settings by provided overrides.
  }

  var self=this;
  this.latest_cache_file = "";

  
  $('#go_livedata',this.element).click(function(){
    console.log("go_livedata");
    self.refresh_live(true);
  });
  $('#ctl-refresh-auto').click(function(){
    $(this).parents("div:first").effect("highlight", {}, 5000);
    self.refresh_live.bind(self)
  });
  
  $('#ctl-refresh-period').change(function() {
    self.refresh_period = parseFloat($(this).val())*1000;
  });
  self.refresh_period = parseFloat($('#ctl-refresh-period').val())*1000;
  

  // Turn off auto-refresh if we're in keep-up mode, and vice versa.
  $('#ctl-live-keep-up').click(function(){
    if($(this).is(":checked")) {
      $('#ctl-refresh-auto').prop('checked', false);
      $('#refresh-clock').circleProgress('value', 0);      
    }
  });
  $('#ctl-refresh-auto').click(function(){
    if($(this).is(":checked")) {
      $('#ctl-live-keep-up').prop('checked', false);
    } else {
      $('#refresh-clock').circleProgress('value', 0);
    }
  });
  
  
  $('#refresh-clock').circleProgress({
      value: 0,
      thickness: 8,
      size: $('#refresh-clock').width(),
      fill: {
          gradient: ["green"]
      }
  });

  gStateMachine.BindObj("newPiece",this,"NewPiece");


  // keep-up list:
  this.recent_live_update = {};
  // Open the socket.
  this.Reconnect();
    
  $('#recentEvents').on('click','span',this.RecentClicked.bind(this));
  
  // Start the clock
  this.time_last_refresh = Date.now();
  if($('#ctl-refresh-auto').is(":checked")) {
    this.clockInterval = setInterval(do_clock,1000);    
  }
  
}
LiveControl.prototype.Reconnect = function()
{
  var wsurl = 'ws://'+window.location.host+'/ws/notify-live';
  if(window.location.protocol=="https:") wsurl = 'wss://'+window.location.host+'/wss/notify-live';
  console.log("Starting socket calls:",wsurl);
  
  gLiveSocket = new WebSocket(wsurl);    
  gLiveSocket.onopen =  function (event) {
      if (gLiveSocket.readyState !== 1) {console.error("Websocket Not ready! THIS IS STUPID"); return;}
      console.log("opened notify-live websocket");
  };

  var self = this;
  gLiveSocket.onclose = function(e) {
    console.log("notify-live socket closed. Restarting in a second.");
    setTimeout(self.Reconnect.bind(self), 1000);
  }

  gLiveSocket.onerror = function(err){
    console.log("notify-live socket encountered error",err.message,". Closing socket.");
    gLiveSocket.close();
  };

  gLiveSocket.onmessage = this.OnMessage.bind(this);
} 

LiveControl.prototype.OnMessage = function(event) 
{
  var data = {};
  try {
    data = JSON.parse(event.data);
  } catch {
    console.error("can't parse message data",event);
  }
  console.log("notify-live update",data);

  // Update things.
  var elem = $('#heartbeat-status');
  if(data.heartbeat) {
    if(data.heartbeat.error) {
      elem.text(data.heartbeat.error);    
    } else {
      if(data.heartbeat_time) {
        if(data.heartbeat_time == 0) {
          $(elem).html("Event builder not reporting");
        } else {      
          $(elem).addClass("TimeAgo");
          $(elem).html(CreateTimeAgoElement(data.heartbeat_time));
        }
      }
    }

  }  
  this.recent_live_update = data;
  if(data.recent_live_events) {
    this.recent_events = data.recent_live_events;
    this.ShowRecent();  
  }
  if(data.current_live_event) {
    // keep-up mode:
    if($('#ctl-live-keep-up').is(":checked")) {      
      if(data.current_live_event != this.recent_cache_file) {
        this.time_last_refresh = Date.now();
        location.reload(); // start again all over...?
      }
    }
  }
}

LiveControl.prototype.Refresh = function() 
{
  console.warn("LivecControl::Refresh()",this);
  var par = {live: 1, reload: 1};
  if(this.recent_cache_file) { 
    par.latest_cache = this.latest_cache_file; 
    par.recent_cache = this.recent_cache_file; 
  }
  this.time_last_refresh = Date.now();

  // window.location.hash = '#' + $.param(par);  // old
  location.reload();
}

LiveControl.prototype.refresh_live = function( force ) {
  console.log("refresh_live","force=",force,"checkbox=",$('#ctl-refresh-auto').is(":checked"));

  // if(this.refreshTimeout) clearTimeout(this.refreshTimeout);

  if($('#ctl-refresh-auto').is(":checked")) {
    this.clockInterval = setInterval(do_clock,1000);    
  } else {
    if(this.clockInterval) {
      clearInterval(this.clockInterval);
      $('#refresh-clock').circleProgress('value', 0);
    }
  }
  
  if($('#ctl-refresh-auto').is(":checked") || force) this.Refresh();
}


LiveControl.prototype.stop_auto_refresh = function()
{
  // Highlight to user that we have flipped the switch off.
  $('#ctl-refresh-auto').parents("div:first").effect("highlight", {}, 5000);
  $('#ctl-refresh-auto').attr('checked', false);
}



LiveControl.prototype.NewPiece = function()
{

  if(!gServing.live_cache_file) return;
  
  this.recent_cache_file = gServing.live_cache_file;
  if(gServing.live_cache_file  > this.latest_cache_file) this.latest_cache_file = gServing.live_cache_file;
  this.HighlightCurrentInRecent();
  
}



LiveControl.prototype.ShowRecent = function() 
{
  console.log("ShowRecent",this.recent_events.length);
  
  var h = "";
  var reg = /r(\d*)_s(\d*)_e(\d*)/
  for(var i=this.recent_events.length-1;i>=0;i--) {
    var matches = reg.exec(this.recent_events[i]);
    if(matches) {
      var ev = parseInt(matches[1]) + "|" + parseInt(matches[2]) + "|" + parseInt(matches[3]);
      h+= '<span data-event="'+ this.recent_events[i] + '">' + ev + '</span> ';      
    } else {
      console.error("What the hell is this directory? ",this.recent_events[i]);
    }
  }
  $('#recentEvents').html(h);
  this.HighlightCurrentInRecent();
  
}

LiveControl.prototype.RecentClicked = function(ev) 
{
  console.log("RecentClicked",ev);
  var spantarget = ev.target;
  var eventstr = $(ev.target).data('event');

  this.time_last_refresh = Date.now();
  var par = { live:1, request_cache: eventstr };
  window.location.hash = '#' + $.param(par);
  // QueryServer(par,"server/serve_live.cgi");

  console.log(eventstr);
}

LiveControl.prototype.HighlightCurrentInRecent = function()
{
  $('#recentEvents span').removeClass('current-event-highlight');
  if(gServing)
    $('#recentEvents span[data-event="'+ gServing.live_cache_file +'"]').addClass('current-event-highlight');
  
  
}



function do_clock()
{
  if($('#ctl-refresh-auto').is(":checked")) {
    var time_spent = Date.now() - gLiveControl.time_last_refresh;
    var frac =time_spent / gLiveControl.refresh_period;
    if(frac > 1 ) gLiveControl.refresh_live(false);
    $('#refresh-clock').circleProgress('value', frac);    
  }

  // clockface('#refresh-clock',frac);
}


// function clockface(elem,frac) {
//   // CSS cleverness.  Take 'elem' as object or as jquery specifyier.  Take 'frac' as fraction filled.
//   // Element must have width,height set (as equal usually). You can change color by setting background-color and color on the object by css or style.
//   var e = $(elem);
//   var color1 = e.css('background-color');
//   var color2 = e.css('color');
//   // var color2 = "black";
//   $(elem).css('border-radius','50%');
//   // $(elem).css('border','1px solid '+color2);
//   if(frac<0.5) {
//     var angle2 = (frac*360 + 90);
//     angle2 += 'deg';
//     console.log('less',angle2);
//     e.css('background-image',
//     'linear-gradient(90deg,'+color1+'50%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0)),linear-gradient('+angle2+','+color2+' 50% ,'+color1+' 50%, '+color1+')');
//   } else {
//     var angle1 = Math.round((frac-0.5)*360 - 90);
//     angle1 += 'deg';
//     console.log('more',angle1);
//     e.css('background-image','linear-gradient('+angle1+','+color2+' 50%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0)),linear-gradient(270deg,'+color2+' 50% ,'+color1+' 50%, '+color1+')');
//    }
//
// }

