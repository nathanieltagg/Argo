// Subclass of Pad.

HitMap.prototype = new Pad;           
HitMap.prototype.constructor = HitMap;


function HitMap( element, options )
{
  // console.log('HitMap ctor');
  if(!element) {
    // console.log("HitMap: NULL element supplied.");
    return;
  }
  if($(element).length<1) { 
    // console.log("HitMap: Zero-length jquery selector provided."); 
    return;
  }
  
  var settings = {
    view: 1,              // ID hits in the X-view.
    u_selector : "module",
    v_selector : "strip",
    draw_axes : false,
    xlabel: null,
    ylabel: null,
    margin_left : 30,
    margin_bottom : 20,
    num_u: 10,          // Number of columns | Used only for finding the width and height of one box.
    num_v: 10,          // number of rows.   |
    tick_pixels_x: 20,
    tick_pixels_y: 30,
    can_do_triangles: true,
    paint_regions: true
    // ,margin_right: 50,
    // paint_colorscale: true
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  
  // NB X and Y are screen coordinates
  // U and V are 'natural' coordinates, like plane/strip or x,z positions
  this.fMousing = false;
  this.fData=[];
  this.fSelectedData=[];
  this.fTracks=[];
  this.fSelectedTracks = [];
  this.fVertices=[];
  this.fSelectedVertices=[];
  this.fClusters = [];
  this.fSelectedClusters = [];
  this.fTrajectories = [];
  
  var self = this;
  $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('click'    ,function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('mouseout' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('touchmove' ,function(ev) {  return self.DoMouse(ev); });
  $(this.element).bind('touchend' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('resize' ,function(ev) { if(self.fData.length==0) self.Select(); });
  
  gStateMachine.BindObj('recordChange',this,"Select");
  gStateMachine.BindObj('phCutChange',this,"ReSelect");
  gStateMachine.BindObj('timeCutChange',this,"ReSelect");
  gStateMachine.BindObj('phColorChange',this,"Draw");
