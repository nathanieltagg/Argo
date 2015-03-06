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
  $('#ctl-refresh-auto').click(self.refresh_live.bind(self));
  

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
  QueryServer(par,"server/serve_live.cgi");
}

LiveControl.prototype.refresh_live = function( force ) {
  console.log("refresh_live","force=",force,"checkbox=",$('#ctl-refresh-auto').is(":checked"));
  if(this.refreshTimeout) clearTimeout(this.refreshTimeout);

  if($('#ctl-refresh-auto').is(":checked") || force) this.Refresh();

  if($('#ctl-refresh-auto').is(":checked")) {
    // restart timer.
    var delay = parseFloat($('#ctl-refresh-period').val())*1000;
    this.refreshTimeout = setTimeout(this.refresh_live.bind(this),delay);
  }
}


LiveControl.prototype.stop_auto_refresh = function()
{
  // Highlight to user that we have flipped the switch off.
  $('#ctl-refresh-auto').parents("div:first").effect("highlight", {}, 5000);

  $('#ctl-refresh-auto').attr('checked', false);
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
