//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

///
/// Boilerplate:  Javascript utilities for MINERvA event display, codenamed "Arachne"
/// Nathaniel Tagg  - NTagg@otterbein.edu - June 2009
///

///
/// Base class: ButtressedPad.
/// Just like a pad, but it uses ReSize intelligently to make sure that
/// a minimum area is always maintained. That minimum area is called a 'buttress'
///
///
///                                  +-------------------+
/// +---------------------------+    |                   |
/// |    HHHHHHHHHHHHHHHHHHH    |    |HHHHHHHHHHHHHHHHHHH|
/// |    HHHHHHHHHHHHHHHHHHH    |    |HHHHHHHHHHHHHHHHHHH|
/// |    HHHHH buttressed HH    |    |HHHHH buttressed HH|
/// |    HHHHHHH area  HHHHH    |    |HHHHHHH area  HHHHH|
/// |    HHHHHHHHHHHHHHHHHHH    |    |HHHHHHHHHHHHHHHHHHH|
/// +---------------------------+    |                   |
///                                  +-------------------+


// Subclass of Pad.
ButtressedPad.prototype = new Pad(null);           

function ButtressedPad( element, options )
{
  ///
  /// Constructor.
  ///
  if(!element) { return; }
  var settings = {
    buttress_min_u :  -1,    // In whatever units user likes.
    buttress_max_u :   1,    // These are the bounds of the buttressed area.
    buttress_min_v :  -1,
    buttress_max_v :   1,
    min_u :    -1,    // Will be overridden on first resize call.
    max_u :     1,
    min_v :    -1,
    max_v :     1,
  };
  
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  
}

ButtressedPad.prototype.Resize = function()
{
  // This pad is a special case: we want to preseve x/y proportionality after a resize.

  // First, call the standard function.
  Pad.prototype.Resize.call(this)

  // Our ideal aspect ratio (height/width) is
  var ideal_aspect_ratio = (this.buttress_max_v - this.buttress_min_v) 
                         / (this.buttress_max_u - this.buttress_min_u);
  // Now insist that the smaller dimention conform. 
  var aspect_ratio = this.span_y/this.span_x;
  
  
  if(aspect_ratio > ideal_aspect_ratio) {
    // More constrained in x  
    this.min_u = this.buttress_min_u;
    this.max_u = this.buttress_max_u;
    var span = (this.buttress_max_u-this.buttress_min_u)*aspect_ratio;
    var padding = (span-(this.buttress_max_v-this.buttress_min_v))/2.
    this.min_v = this.buttress_min_v - padding; 
    this.max_v = this.buttress_max_v + padding; 
  } else {
    // More constrained in y    
    this.min_v = this.buttress_min_v;
    this.max_v = this.buttress_max_v;
    var span = (this.buttress_max_v-this.buttress_min_v)/aspect_ratio;
    var padding = (span-(this.buttress_max_u-this.buttress_min_u))/2.
    this.min_u = this.buttress_min_u - padding; 
    this.max_u = this.buttress_max_u + padding; 
  }
  // console.log("ButtressedPad.Resize",aspect_ratio,this.min_u,this.max_u,this.min_v,this.max_v);
}

