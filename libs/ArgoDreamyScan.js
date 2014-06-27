//
// Code for the ARgo Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

///
/// Boilerplate:  Javascript utilities for MINERvA event display, codenamed "Argo"
/// Nathaniel Tagg  - NTagg@otterbein.edu - June 2009
///


//
// 'Main' scripts for argo.html
// Used to be in 'head', but it was too unwieldly.
//
/*jshint laxcomma:true */

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

