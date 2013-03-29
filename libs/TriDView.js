//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

//
// Objects and functions to build a 3-d display using custom Pad3d.
//

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-TriDView').each(function(){
    var o = new TriDView(this);
  });  
});

var gTriDView = null;

// Subclass of Pad.
TriDView.prototype = new Pad3d;           

function TriDView( element, options ){
  // console.log('TriDView ctor');
  if(!element) {
    // console.log("TriDView: NULL element supplied.");
    return;
  }
  if($(element).length<1) { 
    // console.log()
    return;   
  }
  gTriDView = this;
  
  var settings = {
    default_look_at:    [128.175,
                         0  ,
                         518.4  ],
    default_camera_distance: 1300,
    camera_distance_max: 8000,
    camera_distance_min: 50,
    default_theta: -0.224,
    default_phi: 5.72,
  }
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  Pad3d.call(this, element, settings); // Give settings to Pad contructor.


  // Data model state.
  gStateMachine.BindObj('recordChange',this,"Rebuild");

  var self = this;
  $(this.element) .bind('click',  function(ev)     { return self.Click(); });
 
 
  this.ctl_show_spoints =  GetBestControl(this.element,".show-spoints");
  this.ctl_show_tracks  =  GetBestControl(this.element,".show-tracks");
  this.ctl_show_mc      =  GetBestControl(this.element,".show-mc");

  $(this.ctl_show_spoints).change(function(ev) { return self.Rebuild(); });
  $(this.ctl_show_tracks) .change(function(ev) { return self.Rebuild(); });
  $(this.ctl_show_mc     ).change(function(ev) { return self.Rebuild(); });
 
 
  this.ResetView();
}



TriDView.prototype.Rebuild = function ()
{
  // console.debug('TriD::Rebuild()');

  this.objects = [];
  
  this.CreateFrame();
  if(!gRecord) return;

  if ($(this.ctl_show_spoints).is(":checked")) this.CreateSpacepoints();
  if ($(this.ctl_show_tracks ).is(":checked")) this.CreateTracks();
  if ($(this.ctl_show_mc     ).is(":checked")) this.CreateMC();
  
  this.Draw();
}


TriDView.prototype.CreateFrame = function()
{
  // console.log("TriDView CreateFrame.");
  
  /// Simple frame.
  // console.log("Creating frame");
  
  var dx = 128.175*2;
  var dz = 518.4  *2;

  var dy = 116.5; // half-length
  
  // All coords are in cm.
  var curColor = "rgba(50, 50, 255, 1)";
  this.AddLine( 0, -dy, 0,  dx,-dy, 0,   3, curColor);
  this.AddLine( dx,-dy, 0,  dx, dy, 0,   3, curColor);
  this.AddLine( dx, dy,0,  0 ,  dy, 0,   3, curColor);
  this.AddLine( 0 ,-dy, 0,  0 , dy, 0,   3, curColor);
                                         3
  this.AddLine( 0, -dy, dz,  dx,-dy, dz, 3, curColor);
  this.AddLine( dx,-dy, dz,  dx, dy, dz, 3, curColor);
  this.AddLine( dx, dy,dz,   0 , dy, dz, 3, curColor);
  this.AddLine( 0 ,-dy, dz,  0 , dy, dz, 3, curColor);
                                         3
  this.AddLine( 0,-dy, 0 ,  0 ,-dy, dz,  3, curColor);
  this.AddLine(dx,-dy, 0 , dx ,-dy, dz,  3, curColor);
  this.AddLine( 0, dy, 0 ,  0 , dy, dz,  3, curColor);
  this.AddLine(dx, dy, 0 ,  dx, dy, dz,  3, curColor);

  // Optical detectors.
  var dets = gGeo.opDets.opticalDetectors;
  this.ctx.strokeStyle = "black";
  for(var i=0;i<dets.length;i++){
    var det = dets[i];
    this.AddArcYZ(det.x,det.y,det.z,15.2,10,0,Math.PI*2,1,curColor,det);
  }
  
  
  
}

TriDView.prototype.CreateTracks = function()
{
  for(itrk in gTracks) {
    var trk = gTracks[itrk];
    var points = trk.points;
    for(var i=0;i<points.length-1;i++) {

      var curColor = "rgba(0, 0, 0, 1)";
      var p1 = points[i];
      var p2 = points[i+1];
      this.AddLine(p1.x,p1.y,p1.z, p2.x,p2.y,p2.z, 2, curColor, trk);
    }
  }
}

TriDView.prototype.CreateSpacepoints = function()
{  
  if(!gRecord.spacepoints) return;
  for(var i=0;i<gRecord.spacepoints.length;i++) {
    var sp = gRecord.spacepoints[i];
    var curColor = "rgba(0, 100, 50, 1)";
    this.AddLine(sp.xyz[0], sp.xyz[1], sp.xyz[2],sp.xyz[0], sp.xyz[1], sp.xyz[2]+0.3, 2, curColor, sp);
  }
}

TriDView.prototype.CreateMC = function()
{
 
}
  


TriDView.prototype.should_highlight = function(obj)
{
  if(!obj.source) return false;
  if(obj.source.nodeName == "trk") return ShouldIHighlightThisTrack(obj.source);
  if(obj.source.nodeName == "vtx") return (obj.source == gHoverVertex || obj.source == gSelectedVertex);
}

TriDView.prototype.should_outline = function(obj)
{
  if(!obj.source) return false;
  return (obj.source == gSelectedTrack);
}

TriDView.prototype.HoverObject = function(selected)
{
  gHoverTrack = null;
  gHoverVertex = null;
  if(selected) {
    if(selected.nodeName == "trk") gHoverTrack = selected;    
    if(selected.nodeName == "vtx") gHoverVertex = selected;    
  }
  this.Draw();
}



TriDView.prototype.Click = function()
{
  // gSelectedVertex = gHoverVertex;
  // gSelectedTrack = gHoverTrack; 
  // gStateMachine.Trigger('selectedHitChange');
}

