// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-ArgoDreamyScan').each(function(){
    gScan = new ArgoDreamyScan(this);
  });  
});


ArgoDreamyScan.prototype = new DreamyScan(null);           

function ArgoDreamyScan(element, options)
{
  if(!element) return;

  // Options - defaults. Sensible for a wide range of stuff.  
  var defaults = {
    dreamy_url: "scan/dreamy.cgi"
    ,experiment: 'uboone'
    ,project:    'tscans'
    ,password:   null
    ,user_name:  "Anonymous Coward"
  };
  // override defaults with options.
  $.extend(true,defaults,options);

  // Override with configuration from the element
  DreamyScan.call(this, element, defaults); // Give settings to ABoundObject contructor.  
}

