'use strict';

var gLiveControl = null;

// Automatic runtime configuration.
$(function(){
  $('div.A-LiveControl').first().each(function(){
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

  this.refresh_time = 20;
  this.refresh_time

  this.live_visual_clock = $('#live-visual-clock')[0];


  var slowest_refresh_speed = 60;
  var initial_refesh_speed = parseFloat(Cookies.get("save--live-event-update-slider")); // initial from cookie.
  var handle = $( "#live-event-update-slider-handle" );

  function slidertext(val)
  {
     var txt = val+" s";
     if(val >= slowest_refresh_speed) txt ="Never";
     if(val <= 0) txt="ALL";
     handle.text( txt );
  }

  $("#live-event-update-slider").slider({
      min: 0,
      max: slowest_refresh_speed+1,
      value: initial_refesh_speed,
      create: function( event, ui) {  slidertext(initial_refesh_speed); },
      slide: function( event, ui ) {  slidertext(ui.value); },
      change: function(event, ui) {
        slidertext(ui.value);
        Cookies.set("save--live-event-update-slider", ui.value); // Autosave control.
        var readback = Cookies.get("save--live-event-update-slider");
       self.ChangeRefreshSpeed(ui.value, (ui.value >= slowest_refresh_speed));
      }
  });
  // initial change.
  this.ChangeRefreshSpeed(initial_refesh_speed, initial_refesh_speed >= slowest_refresh_speed);



  $('.go_livedata').click(this.Refresh.bind(this,true));
  
  gStateMachine.BindObj("newPiece",this,"NewPiece");

  // keep-up list:
  this.recent_live_update = {};

  // Open the socket.
  this.Reconnect();

  $('.recentEvents').on('click','span',this.RecentClicked.bind(this));    
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
  var elem = $('.heartbeat-status');
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
    if($('.ctl-live-keep-up').is(":checked")) {      
      if(data.current_live_event != this.recent_cache_file) {
        this.time_last_refresh = Date.now();
        location.reload(); // start again all over...?
      }
    }
  }
}

LiveControl.prototype.ChangeRefreshSpeed = function(newspeed,never)
{
  // if newspeed = 0, do every incoming event.
  // if never = true, never update.

  if(this.clockInterval) clearInterval(this.clockInterval);
  this.clockInterval = null;

  if(newspeed<=0) {
    this.refreshing = false; this.keeping_up=true;
    this.SetPie(0);
  } else if(never) {
    this.refreshing = false; this.keeping_up=false;    
    this.SetPie(0);
  } else {
    this.time_last_refresh = Date.now();
    this.refreshing = true; this.keeping_up=false; this.refresh_period = newspeed*1000; //ms
    this.clockInterval = setInterval(this.DoClock.bind(this),100);
  }
} 






LiveControl.prototype.Refresh = function(force_newest) 
{
  // Go get the next event.

  // If there's new data we haven't seen yet, we should go look at that.  
  // However, it's possible the data is stale: we're shut down, or the backend is crashed. In that case, look through historical stuff.
// If we're already seen the most recent event
  console.warn("LivecControl::Refresh()",this);
  this.time_last_refresh = Date.now();

  var latest_event_seen = Cookies.get("save--latest_event");
  if(!(force_newest) && this.current_event && this.recent_events && this.recent_events.length>0 && latest_event_seen) {
    var latest_events = [...this.recent_events].sort().reverse();
    var latest_event =  latest_events[0];
    if(latest_event <= latest_event_seen) {
      // There's nothing new.  Try going through list
      for(var i=0;i<latest_events.length;i++) {
        if(this.current_event > latest_events[i] ) {
          $.bbq.pushState( {what:"json", filename:"live_event_cache/"+latest_events[i]+"/event.json"}, 2 );
          return;
        }
      }
      // Hmm. nothing, so just continue and pull the most recent again.
    }
  }
  // We either don't know or there's new data. Just pull.

  // Push a new state into the hash. dummy changes just to force.
  var newstate = {
    what: 'live',
    dummy: this.time_last_refresh,
  }
  $.bbq.pushState( newstate, 2 );
}


LiveControl.prototype.NewPiece = function()
{
  if(gRecord.event_descriptor != this.curr_event_descriptor) {
    this.curr_event_descriptor = gRecord.event_descriptor

    this.current_event = null;

    var reg = /r(\d*)_s(\d*)_e(\d*)\.event/;
    var matches = reg.exec(gRecord.event_descriptor || "");
    if(matches) {
       this.current_event = matches[0];
       console.warn("current event ",matches[0]);
       if(!Cookies.get("save--latest_event")) Cookies.set("save--latest_event",this.current_event); 
       if(this.current_event > Cookies.get("save--latest_event")) Cookies.set("save--latest_event",this.current_event); 
    }
    console.error("NewPiece/NewEvent");
    this.HighlightCurrentInRecent();  
  }
}



LiveControl.prototype.ShowRecent = function() 
{
  console.log("ShowRecent",this.recent_events.length);
  
  var h = "";
  var reg = /r(\d*)_s(\d*)_e(\d*)/
  for(var item of this.recent_events) {
    var matches = reg.exec(item);
    if(matches) {
      var ev = parseInt(matches[1]) + "|" + parseInt(matches[2]) + "|" + parseInt(matches[3]);
      var link = "#what=json&filename=live_event_cache/"+item+"/event.json";
      h+= '<a '
        + 'href="'+link+'"'
        + ' data-event="'+ item + '">' + ev + '</a> ';  
    } else {
      console.error("What the hell is this directory? ",item);
    }
  }
  $('.recentEvents').html(h);
  console.error("ShowRecent");
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
  var recentbox = $('.recentEvents');
  $('.current-event-highlight',recentbox).removeClass('current-event-highlight');
  var cur = $('a[data-event="'+this.current_event +'"]',recentbox);
  cur.addClass('current-event-highlight');
  if(cur.length<0) console.error("nothing yet");
  recentbox.scrollTo( cur, 1000, {
       interrupt:true, 
      offset:-recentbox.width()/2, 
      //limit:false
      } 
    );  // https://github.com/flesler/jquery.scrollTo
  // if(cur.length>0){
  //   cur.addClass('current-event-highlight');
  //   // is it in the scroll area?
  //   var pos = cur.offset().left;
  //   var outer = recentbox.offset().left;
  //   var prev = recentbox[0].scrollLeft;
  //   // console.error(cur[0],"offsetLeft",abox,"scrollLeft",$(".recentEvents")[0].scrollLeft);
  //   recentbox[0].scrollLeft += (pos - outer) - recentbox.width()/2;

  // } else {
  //   console.error("no current event in list.")
  // }

}


LiveControl.prototype.SetPie = function(frac) {
  // CSS trickery. Don't even attempt to understand it; it just works to make my pie chart move.
  $('.filler',this.live_visual_clock).css("opacity",(frac>0.5)?1:0);
  $('.mask',this.live_visual_clock).css("opacity",(frac>.5)?0:1);
  $('.spinner',this.live_visual_clock).css("transform","rotate("+frac*360+"deg)");  
}

LiveControl.prototype.DoClock = function()
{
  if(this.refreshing) {
    var time_spent = Date.now() - this.time_last_refresh;
    var frac =time_spent / this.refresh_period;    
    if(frac>1) {
      this.Refresh();
      frac=0;
    }
    this.SetPie(frac);
  } else {
    this.SetPie(0);
  }
}

