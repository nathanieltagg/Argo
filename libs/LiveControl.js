gLiveControl = null;

// Automatic runtime configuration.
$(function(){
  $('div.A-LiveControl').each(function(){
    gLiveControl = new LiveControl(this);
  });  
});



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
  
  $('#refresh-clock').circleProgress({
      value: 0,
      size: 50,
      fill: {
          gradient: ["green", "orange"]
      }
  });

  gStateMachine.BindObj("recordChange",this,"NewRecord");

}

LiveControl.prototype.Refresh = function() 
{
  console.warn("LivecControl::Refresh()",this);
  var par = {live: 1};
  if(this.recent_cache_file) { 
    par.latest_cache = this.latest_cache_file; 
    par.recent_cache = this.recent_cache_file; 
  }
  this.time_last_refresh = Date.now();
  QueryServer(par,"server/serve_live.cgi");
}

LiveControl.prototype.refresh_live = function( force ) {
  console.log("refresh_live","force=",force,"checkbox=",$('#ctl-refresh-auto').is(":checked"));

  // if(this.refreshTimeout) clearTimeout(this.refreshTimeout);

  if($('#ctl-refresh-auto').is(":checked")) {
    // restart timer.
    // var delay = parseFloat($('#ctl-refresh-period').val())*1000;
    //this.refreshTimeout = setTimeout(this.refresh_live.bind(this),delay);
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



LiveControl.prototype.NewRecord = function()
{
  if(!gServing.live_cache_file) return;
  this.recent_cache_file = gServing.live_cache_file;
  if(gServing.live_cache_file  > this.latest_cache_file) this.latest_cache_file = gServing.live_cache_file;
}


function do_clock()
{
  var time_spent = Date.now() - gLiveControl.time_last_refresh;
  var frac =time_spent / (parseFloat($('#ctl-refresh-period').val())*1000);
  if(frac > 1 ) gLiveControl.refresh_live(false);
  $('#refresh-clock').circleProgress('value', frac);

  // clockface('#refresh-clock',frac);
}


function clockface(elem,frac) {
  // CSS cleverness.  Take 'elem' as object or as jquery specifyier.  Take 'frac' as fraction filled.
  // Element must have width,height set (as equal usually). You can change color by setting background-color and color on the object by css or style.
  var e = $(elem);
  var color1 = e.css('background-color');
  var color2 = e.css('color');
  // var color2 = "black";
  $(elem).css('border-radius','50%');
  // $(elem).css('border','1px solid '+color2);
  if(frac<0.5) {
    var angle2 = (frac*360 + 90);
    angle2 += 'deg';
    console.log('less',angle2);
    e.css('background-image',
    'linear-gradient(90deg,'+color1+'50%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0)),linear-gradient('+angle2+','+color2+' 50% ,'+color1+' 50%, '+color1+')');
  } else {
    var angle1 = Math.round((frac-0.5)*360 - 90);
    angle1 += 'deg';
    console.log('more',angle1);
    e.css('background-image','linear-gradient('+angle1+','+color2+' 50%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0)),linear-gradient(270deg,'+color2+' 50% ,'+color1+' 50%, '+color1+')');
   }
  
}

