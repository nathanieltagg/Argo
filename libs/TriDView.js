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
TriDView.prototype = new Pad3d();           

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
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  Pad3d.call(this, element, settings); // Give settings to Pad contructor.


  // Data model state.
  gStateMachine.Bind('recordChange',this.Rebuild.bind(this));
  gStateMachine.Bind('hoverChange',this.HoverChange.bind(this));
  gStateMachine.Bind('changeMRIslice',this.Rebuild.bind(this));

  var self = this;
 
 
  this.ctl_show_hits    =  GetBestControl(this.element,".show-hits");
  this.ctl_show_trid_hits    =  GetBestControl(this.element,".show-trid-hits");
  this.ctl_show_clus    =  GetBestControl(this.element,".show-clus");
  this.ctl_show_spoints =  GetBestControl(this.element,".show-spoints");
  this.ctl_show_tracks  =  GetBestControl(this.element,".show-tracks");
  this.ctl_show_mc      =  GetBestControl(this.element,".show-mc");
  this.ctl_show_mc_neutrals =  GetBestControl(this.element,".show-mc-neutrals");  
  this.ctl_mc_move_tzero    =  GetBestControl(this.element,".ctl-mc-move-tzero");

  $(this.ctl_show_hits).change(function(ev) { return self.Rebuild(); });
  $(this.ctl_show_trid_hits).change(function(ev) { return self.Rebuild(); });
  $(this.ctl_show_clus).change(function(ev) { return self.Rebuild(); });
  $(this.ctl_show_spoints).change(function(ev) { return self.Rebuild(); });
  $(this.ctl_show_tracks) .change(function(ev) { return self.Rebuild(); });
  $(this.ctl_show_mc     ).change(function(ev) { return self.Rebuild(); });
  $(this.ctl_show_mc_neutrals).change(function(ev) { return self.Rebuild(); });
  $(this.ctl_mc_move_tzero ).change(function(ev) { return self.Rebuild(); });

  $('#ctl-TrackLists') .change(function(ev) { return self.Rebuild(); });
  $('#ctl-SpacepointLists').change(function(ev) { return self.Rebuild(); });
 
 
  $(this.element).children().on("focus",function(ev){this.blur();});
 
  this.ResetView();
}

TriDView.prototype.HoverChange = function()
{
  // Only need a redraw if the over change affected something we care about.
  switch(gHoverState.type) {
    case "hit": 
    case "cluster":
    case "spacepoint":
    case "track":
    case "mcparticles":
      this.Draw(); break;
    default: break;
  }
  switch(gLastHoverState.type) {
    case "hit": 
    case "cluster":
    case "spacepoint":
    case "track":
    case "mcparticles":
      this.Draw(); break;
    default: break;  
  }
};


TriDView.prototype.Rebuild = function ()
{
  // console.debug('TriD::Rebuild()');

  this.objects = [];
  
  this.CreateFrame();
  if(!gRecord) return;

  if ($(this.ctl_show_hits).is(":checked") &&
      $(this.ctl_show_trid_hits).is(":checked") ) this.CreateHits();
  if ($(this.ctl_show_clus).is(":checked"))    this.CreateClusters();
  if ($(this.ctl_show_spoints).is(":checked")) this.CreateSpacepoints();
  if ($(this.ctl_show_tracks ).is(":checked")) this.CreateTracks();
  if ($(this.ctl_show_mc     ).is(":checked")) this.CreateMC();
  
  this.CreateAuxDets();
  
  this.Draw();
};



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

  this.AddLine( 0, -dy, dz,  dx,-dy, dz, 3, curColor);
  this.AddLine( dx,-dy, dz,  dx, dy, dz, 3, curColor);
  this.AddLine( dx, dy,dz,   0 , dy, dz, 3, curColor);
  this.AddLine( 0 ,-dy, dz,  0 , dy, dz, 3, curColor);

  this.AddLine( 0,-dy, 0 ,  0 ,-dy, dz,  3, curColor);
  this.AddLine(dx,-dy, 0 , dx ,-dy, dz,  3, curColor);
  this.AddLine( 0, dy, 0 ,  0 , dy, dz,  3, curColor);
  this.AddLine(dx, dy, 0 ,  dx, dy, dz,  3, curColor);

  // MRI slice
  if(gMRI){
    var mri_t = gMRI.t[0];
    var mri_x = gGeo.getXofTDC(0,mri_t);
    this.AddLine( mri_x,-dy,  0 ,  mri_x ,-dy, dz,  3, "rgba(255,50,50,0.5)");
    this.AddLine( mri_x, dy,  0 ,  mri_x , dy, dz,  3, "rgba(255,50,50,0.5)");
    this.AddLine( mri_x ,-dy, 0,   mri_x , dy, 0,   3, "rgba(255,50,50,0.5)");
    this.AddLine( mri_x ,-dy, dz,  mri_x , dy, dz,  3, "rgba(255,50,50,0.5)");
    
    mri_t = gMRI.t[1];
    mri_x = gGeo.getXofTDC(0,mri_t);
    this.AddLine( mri_x,-dy,  0 ,  mri_x ,-dy, dz,  3, "rgba(255,50,50,0.5)");
    this.AddLine( mri_x, dy,  0 ,  mri_x , dy, dz,  3, "rgba(255,50,50,0.5)");
    this.AddLine( mri_x ,-dy, 0,   mri_x , dy, 0,   3, "rgba(255,50,50,0.5)");
    this.AddLine( mri_x ,-dy, dz,  mri_x , dy, dz,  3, "rgba(255,50,50,0.5)");
  
  }
  
  // Optical detectors.
  var dets = gGeo.opDets.opticalDetectors;
  this.ctx.strokeStyle = "black";
  for(var i=0;i<dets.length;i++){
    var det = dets[i];
    var hov = {obj: det, type: "opdet", collection: gGeo.opDets.opticalDetectors};

    this.AddArcYZ(det.x,det.y,det.z,15.2,20,0,Math.PI*2,1,curColor,hov);
  }
  
  
  
};

TriDView.prototype.CreateHits = function()
{
  gHitsListName = $("#ctl-HitLists").val();
  if(!gHitsListName) return;
  var hits = gRecord.hits[gHitsListName];

  var cs = new ColorScaler();  
  cs.max = 2000;

  for(var i=0;i<hits.length;i++) {
    var h = hits[i];    
    var hovobj = {obj:h, type:"hit", collection: hits};    

    if(h.t1 > gZoomRegion.tdc[1]) continue;
    if(h.t2 < gZoomRegion.tdc[0]) continue;
    var gwire = gGeo.getWire(h.plane,h.wire);
    var c = cs.GetColor(h.q);
    var color = "rgba(" + c + ",0.2)";
    var x = gGeo.getXofTDC(h.plane,h.t);
    // if(h.view<2) continue;
    this.AddLine(x, gwire.y1, gwire.z1, x, gwire.y2, gwire.z2, 2, color, hovobj);    
  }
};

TriDView.prototype.CreateClusters = function()
{
  
};


TriDView.prototype.CreateTracks = function()
{
  if(!$("#ctl-TrackLists").val()) return;
  var tracks = gRecord.tracks[$("#ctl-TrackLists").val()];
  console.warn(tracks,gRecord.tracks,$("#ctl-TrackLists").val());
  for(var itrk=0;itrk<tracks.length;itrk++) {
    var trk = tracks[itrk];
    console.log(trk);
    var hovobj = {obj:trk, type:"track", collection: tracks};    
    var points = trk.points;
    for(var i=0;i<points.length-1;i++) {

      var curColor = "rgba(89, 169, 28, 1)";
      var p1 = points[i];
      var p2 = points[i+1];
      this.AddLine(p1.x,p1.y,p1.z, p2.x,p2.y,p2.z, 3, curColor, hovobj);
    }
  }
};

TriDView.prototype.CreateSpacepoints = function()
{  
  if(!$("#ctl-SpacepointLists").val()) return;
  var spacepoints = gRecord.spacepoints[$("#ctl-SpacepointLists").val()];
  for(var i=0;i<spacepoints.length;i++) {
    var sp = spacepoints[i];
    var hovobj = {obj:sp, type:"spacepoint", collection: spacepoints};    
    
    var curColor = "rgba(0, 150, 150, 1)";
    this.AddLine(sp.xyz[0], sp.xyz[1], sp.xyz[2],sp.xyz[0], sp.xyz[1], sp.xyz[2]+0.3, 2, curColor, hovobj);
  }
};

TriDView.prototype.CreateMC = function()
{
  if(!gRecord) return;
  if(!gRecord.mc) return;
  if(!gMCParticlesListName) return;
  var particles = gRecord.mc.particles[gMCParticlesListName];
  if(!particles) return;
  var show_neutrals = $(this.ctl_show_mc_neutrals).is(":checked");
  var move_t0 =  $(this.ctl_mc_move_tzero).is(":checked");

  for(var i=0;i<particles.length;i++)
  {
    var p= particles[i];
    var t0 = p.trajectory[0].t;
    // if(t>1.6e6 || t<-1000) continue; // Ignore out-of-time particles
    var dx_from_t0 = 0;
    if(move_t0) dx_from_t0 =  gGeo.getXofTDC(0,t0/500.0);
    
    // console.log("TriDView::CreateMC particle at time ",t0, p.trajectory.length);
    var hovobj = {obj:p, type:"mcparticle", collection: particles};
    if(!p.trajectory || p.trajectory.length===0) continue;
    
    var lineWidth = 1;
    var curColor = "rgba(0,0,255,0.5)";


    // is it an annoying neutral particle?
    var pdg = Math.abs(p.fpdgCode);
    if(pdg == 22 || pdg == 2112 || pdg == 12 || pdg == 14 || pdg == 16) {
      // Make them grey
      if(show_neutrals) curColor ="rgba(200,200,200,0.5)";    
      else continue;  // Or skip 'em.
    }
    
    // for(var k=0;k<gSelectedTrajectories.length;k++) {
    //   if(p.ftrackId == gSelectedTrajectories[k]) {
    //     lineWidth = 2;
    //     curColor = "rgba(255,255,20,1)";        
    //   }
    // }
    
    for(var j=1;j<p.trajectory.length;j++) {
      var p1 = p.trajectory[j-1];
      var p2 = p.trajectory[j];
      this.AddLine(p1.x + dx_from_t0, p1.y, p1.z, 
                   p2.x + dx_from_t0, p2.y, p2.z, 
                   2, curColor, hovobj);
    }
  }
 
};
  
TriDView.prototype.CreateAuxDets = function()
{
  if(!gRecord.auxdets) return;
  if(gRecord.auxdets.length===0) return; // No auxdet info available.
  console.warn("CREATEAUXDETS");
  var detpos = [
  { name:"posAuxDet0"  ,    x:"3628.91180974" ,y:"-1420.26501873" ,z:"-7445.5670412"},
  { name:"posAuxDet1"  ,    x:"4134.65180974" ,y:"-1420.26501873" ,z:"-7122.7670412"},
  { name:"posAuxDet2"  ,    x:"3800.58180974" ,y:"-1420.26501873" ,z:"-7342.7670412"},
  { name:"posAuxDet3"  ,    x:"3969.23070974" ,y:"-1420.26501873" ,z:"-7235.1670412"},
  { name:"posAuxDet4"  ,    x:"3454.37180974" ,y:"-1420.26501873" ,z:"-7543.3670412"},
  { name:"posAuxDet5"  ,    x:"3277.10180974" ,y:"-1420.26501873" ,z:"-7635.3670412"},
  { name:"posAuxDet6"  ,    x:"3097.25180974" ,y:"-1420.26501873" ,z:"-7723.3670412"},
  { name:"posAuxDet7"  ,    x:"2915.05180974" ,y:"-1420.26501873" ,z:"-7805.3670412"},
  { name:"posAuxDet8"  ,    x:"2730.45180974" ,y:"-1420.26501873" ,z:"-7883.3670412"},
  { name:"posAuxDet9"  ,    x:"2543.75180974" ,y:"-1420.26501873" ,z:"-7954.3670412"},
  { name:"posAuxDet10" ,    x:"2355.05180974" ,y:"-1420.26501873" ,z:"-8021.3670412"},
  { name:"posAuxDet11" ,    x:"2164.55180974" ,y:"-1420.26501873" ,z:"-8082.3670412"},
  { name:"posAuxDet12" ,    x:"1972.35180974" ,y:"-1420.26501873" ,z:"-8138.3670412"},
  { name:"posAuxDet13" ,    x:"1778.65180974" ,y:"-1420.26501873" ,z:"-8188.3670412"},
  { name:"posAuxDet14" ,    x:"1583.55180974" ,y:"-1420.26501873" ,z:"-8232.3670412"},
  { name:"posAuxDet15" ,    x:"1387.35180974" ,y:"-1420.26501873" ,z:"-8271.3670412"},
  { name:"posAuxDet16" ,    x:"1190.05180974" ,y:"-1420.26501873" ,z:"-8304.3670412"},
  { name:"posAuxDet17" ,    x:"991.951809738" ,y:"-1420.26501873" ,z:"-8332.3670412"},
  { name:"posAuxDet18" ,    x:"793.051809738" ,y:"-1420.26501873" ,z:"-8354.3670412"},
  { name:"posAuxDet19" ,    x:"593.651809738" ,y:"-1420.26501873" ,z:"-8370.3670412"},
  { name:"posAuxDet20" ,    x:"393.851809738" ,y:"-1420.26501873" ,z:"-8381.3670412"},
  { name:"posAuxDet21" ,    x:"193.851809738" ,y:"-1420.26501873" ,z:"-8385.3670412"},
  { name:"posAuxDet22" ,    x:"-6.24819026217" ,y:"-1420.26501873" ,z:"-8384.3670412"},
  { name:"posAuxDet23" ,    x:"-206.148190262" ,y:"-1420.26501873" ,z:"-8378.3670412"},
  { name:"posAuxDet24" ,    x:"-405.848190262" ,y:"-1420.26501873" ,z:"-8365.3670412"},
  { name:"posAuxDet25" ,    x:"-605.048190262" ,y:"-1420.26501873" ,z:"-8347.3670412"},
  { name:"posAuxDet26" ,    x:"-803.748190262" ,y:"-1420.26501873" ,z:"-8324.3670412"},
  { name:"posAuxDet27" ,    x:"-1001.64819026" ,y:"-1420.26501873" ,z:"-8294.3670412"},
  { name:"posAuxDet28" ,    x:"-1198.54819026" ,y:"-1420.26501873" ,z:"-8259.3670412"},
  { name:"posAuxDet29" ,    x:"-1394.44819026" ,y:"-1420.26501873" ,z:"-8218.3670412"},
  { name:"posAuxDet30" ,    x:"-1589.04819026" ,y:"-1420.26501873" ,z:"-8172.3670412"},
  { name:"posAuxDet31" ,    x:"-1782.24819026" ,y:"-1420.26501873" ,z:"-8120.3670412"},
  { name:"posAuxDet32" ,    x:"-1973.94819026" ,y:"-1420.26501873" ,z:"-8062.3670412"},
  { name:"posAuxDet33" ,    x:"-2163.84819026" ,y:"-1420.26501873" ,z:"-8000.3670412"},
  { name:"posAuxDet34" ,    x:"-2351.94819026" ,y:"-1420.26501873" ,z:"-7931.3670412"},
  { name:"posAuxDet35" ,    x:"-2537.94819026" ,y:"-1420.26501873" ,z:"-7858.3670412"},
  { name:"posAuxDet36" ,    x:"-2721.74819026" ,y:"-1420.26501873" ,z:"-7779.3670412"},
  { name:"posAuxDet37" ,    x:"-2903.24819026" ,y:"-1420.26501873" ,z:"-7695.3670412"},
  { name:"posAuxDet38" ,    x:"-3082.24819026" ,y:"-1420.26501873" ,z:"-7605.3670412"},
  { name:"posAuxDet39" ,    x:"-3258.64819026" ,y:"-1420.26501873" ,z:"-7511.3670412"},
  { name:"posAuxDet40" ,    x:"-3432.24819026" ,y:"-1420.26501873" ,z:"-7412.1670412"},
  { name:"posAuxDet41" ,    x:"-3602.94819026" ,y:"-1420.26501873" ,z:"-7307.7670412"},
  { name:"posAuxDet42" ,    x:"-3770.54819026" ,y:"-1420.26501873" ,z:"-7198.5670412"},
  { name:"posAuxDet43" ,    x:"-3935.04819026" ,y:"-1420.26501873" ,z:"-7084.6670412"},
  { name:"posAuxDet44" ,    x:"-4096.14819026" ,y:"-1420.26501873" ,z:"-6966.0670412"},
  { name:"posAuxDet45" ,    x:"4083.15180974" ,y:"-40.3250187266" ,z:"-7226.3670412"},
  { name:"posAuxDet46" ,    x:"3914.73180974" ,y:"-40.3250187266" ,z:"-7337.2670412"},
  { name:"posAuxDet47" ,    x:"3743.18180974" ,y:"-40.3250187266" ,z:"-7443.2670412"},
  { name:"posAuxDet48" ,    x:"3568.66180974" ,y:"-40.3250187266" ,z:"-7543.3670412"},
  { name:"posAuxDet49" ,    x:"3391.32180974" ,y:"-40.3250187266" ,z:"-7640.3670412"},
  { name:"posAuxDet50" ,    x:"3211.30180974" ,y:"-40.3250187266" ,z:"-7730.3670412"},
  { name:"posAuxDet51" ,    x:"3028.75180974" ,y:"-40.3250187266" ,z:"-7816.3670412"},
  { name:"posAuxDet52" ,    x:"2843.85180974" ,y:"-40.3250187266" ,z:"-7897.3670412"},
  { name:"posAuxDet53" ,    x:"2656.75180974" ,y:"-40.3250187266" ,z:"-7972.3670412"},
  { name:"posAuxDet54" ,    x:"2467.45180974" ,y:"-40.3250187266" ,z:"-8041.3670412"},
  { name:"posAuxDet55" ,    x:"2276.35180974" ,y:"-40.3250187266" ,z:"-8106.3670412"},
  { name:"posAuxDet56" ,    x:"2083.45180974" ,y:"-40.3250187266" ,z:"-8165.3670412"},
  { name:"posAuxDet57" ,    x:"1888.95180974" ,y:"-40.3250187266" ,z:"-8218.3670412"},
  { name:"posAuxDet58" ,    x:"1692.95180974" ,y:"-40.3250187266" ,z:"-8265.3670412"},
  { name:"posAuxDet59" ,    x:"1495.75180974" ,y:"-40.3250187266" ,z:"-8307.3670412"},
  { name:"posAuxDet60" ,    x:"1297.35180974" ,y:"-40.3250187266" ,z:"-8344.3670412"},
  { name:"posAuxDet61" ,    x:"1098.05180974" ,y:"-40.3250187266" ,z:"-8374.3670412"},
  { name:"posAuxDet62" ,    x:"897.951809738" ,y:"-40.3250187266" ,z:"-8399.3670412"},
  { name:"posAuxDet63" ,    x:"697.151809738" ,y:"-40.3250187266" ,z:"-8419.3670412"},
  { name:"posAuxDet64" ,    x:"495.951809738" ,y:"-40.3250187266" ,z:"-8432.3670412"},
  { name:"posAuxDet65" ,    x:"294.451809738" ,y:"-40.3250187266" ,z:"-8440.3670412"},
  { name:"posAuxDet66" ,    x:"92.7518097378" ,y:"-40.3250187266" ,z:"-8442.3670412"},
  { name:"posAuxDet67" ,    x:"-108.848190262" ,y:"-40.3250187266" ,z:"-8438.3670412"},
  { name:"posAuxDet68" ,    x:"-310.348190262" ,y:"-40.3250187266" ,z:"-8428.3670412"},
  { name:"posAuxDet69" ,    x:"-511.348190262" ,y:"-40.3250187266" ,z:"-8413.3670412"},
  { name:"posAuxDet70" ,    x:"-711.948190262" ,y:"-40.3250187266" ,z:"-8392.3670412"},
  { name:"posAuxDet71" ,    x:"-911.848190262" ,y:"-40.3250187266" ,z:"-8365.3670412"},
  { name:"posAuxDet72" ,    x:"-1110.84819026" ,y:"-40.3250187266" ,z:"-8332.3670412"},
  { name:"posAuxDet73" ,    x:"-1308.84819026" ,y:"-40.3250187266" ,z:"-8294.3670412"},
  { name:"posAuxDet74" ,    x:"-1505.64819026" ,y:"-40.3250187266" ,z:"-8250.3670412"},
  { name:"posAuxDet75" ,    x:"-1701.14819026" ,y:"-40.3250187266" ,z:"-8200.3670412"},
  { name:"posAuxDet76" ,    x:"-1895.14819026" ,y:"-40.3250187266" ,z:"-8145.3670412"},
  { name:"posAuxDet77" ,    x:"-2087.44819026" ,y:"-40.3250187266" ,z:"-8085.3670412"},
  { name:"posAuxDet78" ,    x:"-2277.94819026" ,y:"-40.3250187266" ,z:"-8018.3670412"},
  { name:"posAuxDet79" ,    x:"-2466.54819026" ,y:"-40.3250187266" ,z:"-7947.3670412"},
  { name:"posAuxDet80" ,    x:"-2652.94819026" ,y:"-40.3250187266" ,z:"-7870.3670412"},
  { name:"posAuxDet81" ,    x:"-2837.04819026" ,y:"-40.3250187266" ,z:"-7788.3670412"},
  { name:"posAuxDet82" ,    x:"-3018.74819026" ,y:"-40.3250187266" ,z:"-7700.3670412"},
  { name:"posAuxDet83" ,    x:"-3197.94819026" ,y:"-40.3250187266" ,z:"-7608.3670412"},
  { name:"posAuxDet84" ,    x:"2355.05180974" ,y:"44.6749812734" ,z:"-8021.3670412"},
  { name:"posAuxDet85" ,    x:"-3374.34819026" ,y:"-40.3250187266" ,z:"-7510.3670412"},
  { name:"posAuxDet86" ,    x:"-3547.84819026" ,y:"-40.3250187266" ,z:"-7407.9670412"},
  { name:"posAuxDet87" ,    x:"-3718.34819026" ,y:"-40.3250187266" ,z:"-7300.2670412"},
  { name:"posAuxDet88" ,    x:"-3885.74819026" ,y:"-40.3250187266" ,z:"-7187.7670412"},
  { name:"posAuxDet89" ,    x:"-4049.84819026" ,y:"-40.3250187266" ,z:"-7070.5670412"},
  { name:"posAuxDet90" ,    x:"4083.15180974" ,y:"-1505.26501873" ,z:"-7226.3670412"},
  { name:"posAuxDet91" ,    x:"3914.73180974" ,y:"-1505.26501873" ,z:"-7337.2670412"},
  { name:"posAuxDet92" ,    x:"3743.18180974" ,y:"-1505.26501873" ,z:"-7443.2670412"},
  { name:"posAuxDet93" ,    x:"3568.66180974" ,y:"-1505.26501873" ,z:"-7543.3670412"},
  { name:"posAuxDet94" ,    x:"3391.32180974" ,y:"-1505.26501873" ,z:"-7640.3670412"},
  { name:"posAuxDet95" ,    x:"3211.30180974" ,y:"-1505.26501873" ,z:"-7730.3670412"},
  { name:"posAuxDet96" ,    x:"3028.75180974" ,y:"-1505.26501873" ,z:"-7816.3670412"},
  { name:"posAuxDet97" ,    x:"2843.85180974" ,y:"-1505.26501873" ,z:"-7897.3670412"},
  { name:"posAuxDet98" ,    x:"2656.75180974" ,y:"-1505.26501873" ,z:"-7972.3670412"},
  { name:"posAuxDet99" ,    x:"2467.45180974" ,y:"-1505.26501873" ,z:"-8041.3670412"},
  { name:"posAuxDet100",    x:"2276.35180974" ,y:"-1505.26501873" ,z:"-8106.3670412"},
  { name:"posAuxDet101",    x:"2083.45180974" ,y:"-1505.26501873" ,z:"-8165.3670412"},
  { name:"posAuxDet102",    x:"1888.95180974" ,y:"-1505.26501873" ,z:"-8218.3670412"},
  { name:"posAuxDet103",    x:"1692.95180974" ,y:"-1505.26501873" ,z:"-8265.3670412"},
  { name:"posAuxDet104",    x:"1495.75180974" ,y:"-1505.26501873" ,z:"-8307.3670412"},
  { name:"posAuxDet105",    x:"1297.35180974" ,y:"-1505.26501873" ,z:"-8344.3670412"},
  { name:"posAuxDet106",    x:"1098.05180974" ,y:"-1505.26501873" ,z:"-8374.3670412"},
  { name:"posAuxDet107",    x:"897.951809738" ,y:"-1505.26501873" ,z:"-8399.3670412"},
  { name:"posAuxDet108",    x:"697.151809738" ,y:"-1505.26501873" ,z:"-8419.3670412"},
  { name:"posAuxDet109",    x:"495.951809738" ,y:"-1505.26501873" ,z:"-8432.3670412"},
  { name:"posAuxDet110",    x:"294.451809738" ,y:"-1505.26501873" ,z:"-8440.3670412"},
  { name:"posAuxDet111",    x:"92.7518097378" ,y:"-1505.26501873" ,z:"-8442.3670412"},
  { name:"posAuxDet112",    x:"-108.848190262" ,y:"-1505.26501873" ,z:"-8438.3670412"},
  { name:"posAuxDet113",    x:"-310.348190262" ,y:"-1505.26501873" ,z:"-8428.3670412"},
  { name:"posAuxDet114",    x:"-511.348190262" ,y:"-1505.26501873" ,z:"-8413.3670412"},
  { name:"posAuxDet115",    x:"-711.948190262" ,y:"-1505.26501873" ,z:"-8392.3670412"},
  { name:"posAuxDet116",    x:"-911.848190262" ,y:"-1505.26501873" ,z:"-8365.3670412"},
  { name:"posAuxDet117",    x:"-1110.84819026" ,y:"-1505.26501873" ,z:"-8332.3670412"},
  { name:"posAuxDet118",    x:"-1308.84819026" ,y:"-1505.26501873" ,z:"-8294.3670412"},
  { name:"posAuxDet119",    x:"-1505.64819026" ,y:"-1505.26501873" ,z:"-8250.3670412"},
  { name:"posAuxDet120",    x:"-1701.14819026" ,y:"-1505.26501873" ,z:"-8200.3670412"},
  { name:"posAuxDet121",    x:"-1895.14819026" ,y:"-1505.26501873" ,z:"-8145.3670412"},
  { name:"posAuxDet122",    x:"-2087.44819026" ,y:"-1505.26501873" ,z:"-8085.3670412"},
  { name:"posAuxDet123",    x:"-2277.94819026" ,y:"-1505.26501873" ,z:"-8018.3670412"},
  { name:"posAuxDet124",    x:"-2466.54819026" ,y:"-1505.26501873" ,z:"-7947.3670412"},
  { name:"posAuxDet125",    x:"-2652.94819026" ,y:"-1505.26501873" ,z:"-7870.3670412"},
  { name:"posAuxDet126",    x:"-2837.04819026" ,y:"-1505.26501873" ,z:"-7788.3670412"},
  { name:"posAuxDet127",    x:"-3018.74819026" ,y:"-1505.26501873" ,z:"-7700.3670412"},
  { name:"posAuxDet128",    x:"-3197.94819026" ,y:"-1505.26501873" ,z:"-7608.3670412"},
  { name:"posAuxDet129",    x:"-3374.34819026" ,y:"-1505.26501873" ,z:"-7510.3670412"},
  { name:"posAuxDet130",    x:"-3547.84819026" ,y:"-1505.26501873" ,z:"-7407.9670412"},
  { name:"posAuxDet131",    x:"-3718.34819026" ,y:"-1505.26501873" ,z:"-7300.2670412"},
  { name:"posAuxDet132",    x:"-3885.74819026" ,y:"-1505.26501873" ,z:"-7187.7670412"},
  { name:"posAuxDet133",    x:"-4049.84819026" ,y:"-1505.26501873" ,z:"-7070.5670412"},
  { name:"posAuxDet134",    x:"-4096.14819026" ,y:"44.6749812734" ,z:"-6966.0670412"},
  { name:"posAuxDet135",    x:"-3935.04819026" ,y:"44.6749812734" ,z:"-7084.6670412"},
  { name:"posAuxDet136",    x:"-3770.54819026" ,y:"44.6749812734" ,z:"-7198.5670412"},
  { name:"posAuxDet137",    x:"-3602.94819026" ,y:"44.6749812734" ,z:"-7307.7670412"},
  { name:"posAuxDet138",    x:"-3432.24819026" ,y:"44.6749812734" ,z:"-7412.1670412"},
  { name:"posAuxDet139",    x:"-3258.64819026" ,y:"44.6749812734" ,z:"-7511.3670412"},
  { name:"posAuxDet140",    x:"-3082.24819026" ,y:"44.6749812734" ,z:"-7605.3670412"},
  { name:"posAuxDet141",    x:"-2903.24819026" ,y:"44.6749812734" ,z:"-7695.3670412"},
  { name:"posAuxDet142",    x:"-2721.74819026" ,y:"44.6749812734" ,z:"-7779.3670412"},
  { name:"posAuxDet143",    x:"-2537.94819026" ,y:"44.6749812734" ,z:"-7858.3670412"},
  { name:"posAuxDet144",    x:"-2351.94819026" ,y:"44.6749812734" ,z:"-7931.3670412"},
  { name:"posAuxDet145",    x:"-2163.84819026" ,y:"44.6749812734" ,z:"-8000.3670412"},
  { name:"posAuxDet146",    x:"-1973.94819026" ,y:"44.6749812734" ,z:"-8062.3670412"},
  { name:"posAuxDet147",    x:"-1782.24819026" ,y:"44.6749812734" ,z:"-8120.3670412"},
  { name:"posAuxDet148",    x:"-1589.04819026" ,y:"44.6749812734" ,z:"-8172.3670412"},
  { name:"posAuxDet149",    x:"-1394.44819026" ,y:"44.6749812734" ,z:"-8218.3670412"},
  { name:"posAuxDet150",    x:"-1198.54819026" ,y:"44.6749812734" ,z:"-8259.3670412"},
  { name:"posAuxDet151",    x:"-1001.64819026" ,y:"44.6749812734" ,z:"-8294.3670412"},
  { name:"posAuxDet152",    x:"-803.748190262" ,y:"44.6749812734" ,z:"-8324.3670412"},
  { name:"posAuxDet153",    x:"-605.048190262" ,y:"44.6749812734" ,z:"-8347.3670412"},
  { name:"posAuxDet154",    x:"-405.848190262" ,y:"44.6749812734" ,z:"-8365.3670412"},
  { name:"posAuxDet155",    x:"-206.148190262" ,y:"44.6749812734" ,z:"-8378.3670412"},
  { name:"posAuxDet156",    x:"-6.24819026217" ,y:"44.6749812734" ,z:"-8384.3670412"},
  { name:"posAuxDet157",    x:"193.851809738" ,y:"44.6749812734" ,z:"-8385.3670412"},
  { name:"posAuxDet158",    x:"393.851809738" ,y:"44.6749812734" ,z:"-8381.3670412"},
  { name:"posAuxDet159",    x:"593.651809738" ,y:"44.6749812734" ,z:"-8370.3670412"},
  { name:"posAuxDet160",    x:"793.051809738" ,y:"44.6749812734" ,z:"-8354.3670412"},
  { name:"posAuxDet161",    x:"991.951809738" ,y:"44.6749812734" ,z:"-8332.3670412"},
  { name:"posAuxDet162",    x:"1190.05180974" ,y:"44.6749812734" ,z:"-8304.3670412"},
  { name:"posAuxDet163",    x:"1387.35180974" ,y:"44.6749812734" ,z:"-8271.3670412"},
  { name:"posAuxDet164",    x:"1583.55180974" ,y:"44.6749812734" ,z:"-8232.3670412"},
  { name:"posAuxDet165",    x:"1778.65180974" ,y:"44.6749812734" ,z:"-8188.3670412"},
  { name:"posAuxDet166",    x:"1972.35180974" ,y:"44.6749812734" ,z:"-8138.3670412"},
  { name:"posAuxDet167",    x:"2164.55180974" ,y:"44.6749812734" ,z:"-8082.3670412"},
  { name:"posAuxDet168",    x:"2543.75180974" ,y:"44.6749812734" ,z:"-7954.3670412"},
  { name:"posAuxDet169",    x:"2730.45180974" ,y:"44.6749812734" ,z:"-7883.3670412"},
  { name:"posAuxDet170",    x:"2915.05180974" ,y:"44.6749812734" ,z:"-7805.3670412"},
  { name:"posAuxDet171",    x:"3097.25180974" ,y:"44.6749812734" ,z:"-7723.3670412"},
  { name:"posAuxDet172",    x:"3277.10180974" ,y:"44.6749812734" ,z:"-7635.3670412"},
  { name:"posAuxDet173",    x:"3454.37180974" ,y:"44.6749812734" ,z:"-7543.3670412"},
  { name:"posAuxDet174",    x:"3628.91180974" ,y:"44.6749812734" ,z:"-7445.5670412"},
  { name:"posAuxDet175",    x:"3800.58180974" ,y:"44.6749812734" ,z:"-7342.7670412"},
  { name:"posAuxDet176",    x:"3969.23070974" ,y:"44.6749812734" ,z:"-7235.1670412"},
  { name:"posAuxDet177",    x:"4134.65180974" ,y:"44.6749812734" ,z:"-7122.7670412"},
  { name:"posAuxDet178",    x:"-3694.64819026" ,y:"1459.63498127" ,z:"-7448.5670412"},
  { name:"posAuxDet179",    x:"-4199.54819026" ,y:"1459.63498127" ,z:"-7098.3670412"},
  { name:"posAuxDet180",    x:"-4034.64819026" ,y:"1459.63498127" ,z:"-7219.9670412"},
  { name:"posAuxDet181",    x:"-3866.24819026" ,y:"1459.63498127" ,z:"-7336.6670412"},
  { name:"posAuxDet182",    x:"-3519.84819026" ,y:"1459.63498127" ,z:"-7555.3670412"},
  { name:"posAuxDet183",    x:"-3342.14819026" ,y:"1459.63498127" ,z:"-7657.3670412"},
  { name:"posAuxDet184",    x:"-3161.54819026" ,y:"1459.63498127" ,z:"-7753.3670412"},
  { name:"posAuxDet185",    x:"-2978.24819026" ,y:"1459.63498127" ,z:"-7845.3670412"},
  { name:"posAuxDet186",    x:"-2792.44819026" ,y:"1459.63498127" ,z:"-7931.3670412"},
  { name:"posAuxDet187",    x:"-2604.24819026" ,y:"1459.63498127" ,z:"-8012.3670412"},
  { name:"posAuxDet188",    x:"-2413.74819026" ,y:"1459.63498127" ,z:"-8087.3670412"},
  { name:"posAuxDet189",    x:"-2221.14819026" ,y:"1459.63498127" ,z:"-8157.3670412"},
  { name:"posAuxDet190",    x:"-2026.74819026" ,y:"1459.63498127" ,z:"-8222.3670412"},
  { name:"posAuxDet191",    x:"-1830.44819026" ,y:"1459.63498127" ,z:"-8281.3670412"},
  { name:"posAuxDet192",    x:"-1632.64819026" ,y:"1459.63498127" ,z:"-8334.3670412"},
  { name:"posAuxDet193",    x:"-1433.34819026" ,y:"1459.63498127" ,z:"-8382.3670412"},
  { name:"posAuxDet194",    x:"-1232.74819026" ,y:"1459.63498127" ,z:"-8423.3670412"},
  { name:"posAuxDet195",    x:"-1031.14819026" ,y:"1459.63498127" ,z:"-8459.3670412"},
  { name:"posAuxDet196",    x:"-828.448190262" ,y:"1459.63498127" ,z:"-8490.3670412"},
  { name:"posAuxDet197",    x:"-625.048190262" ,y:"1459.63498127" ,z:"-8514.3670412"},
  { name:"posAuxDet198",    x:"-421.048190262" ,y:"1459.63498127" ,z:"-8533.3670412"},
  { name:"posAuxDet199",    x:"-216.548190262" ,y:"1459.63498127" ,z:"-8545.3670412"},
  { name:"posAuxDet200",    x:"-11.8481902622" ,y:"1459.63498127" ,z:"-8552.3670412"},
  { name:"posAuxDet201",    x:"193.051809738" ,y:"1459.63498127" ,z:"-8553.3670412"},
  { name:"posAuxDet202",    x:"397.851809738" ,y:"1459.63498127" ,z:"-8549.3670412"},
  { name:"posAuxDet203",    x:"602.451809738" ,y:"1459.63498127" ,z:"-8538.3670412"},
  { name:"posAuxDet204",    x:"806.651809738" ,y:"1459.63498127" ,z:"-8521.3670412"},
  { name:"posAuxDet205",    x:"1010.35180974" ,y:"1459.63498127" ,z:"-8499.3670412"},
  { name:"posAuxDet206",    x:"1213.25180974" ,y:"1459.63498127" ,z:"-8471.3670412"},
  { name:"posAuxDet207",    x:"1415.25180974" ,y:"1459.63498127" ,z:"-8437.3670412"},
  { name:"posAuxDet208",    x:"1616.25180974" ,y:"1459.63498127" ,z:"-8397.3670412"},
  { name:"posAuxDet209",    x:"1816.05180974" ,y:"1459.63498127" ,z:"-8351.3670412"},
  { name:"posAuxDet210",    x:"2014.35180974" ,y:"1459.63498127" ,z:"-8300.3670412"},
  { name:"posAuxDet211",    x:"2211.25180974" ,y:"1459.63498127" ,z:"-8243.3670412"},
  { name:"posAuxDet212",    x:"2406.35180974" ,y:"1459.63498127" ,z:"-8181.3670412"},
  { name:"posAuxDet213",    x:"2599.55180974" ,y:"1459.63498127" ,z:"-8113.3670412"},
  { name:"posAuxDet214",    x:"2790.85180974" ,y:"1459.63498127" ,z:"-8039.3670412"},
  { name:"posAuxDet215",    x:"2979.79180974" ,y:"1459.63498127" ,z:"-7960.3670412"},
  { name:"posAuxDet216",    x:"3166.49180974" ,y:"1459.63498127" ,z:"-7876.3670412"},
  { name:"posAuxDet217",    x:"3350.69180974" ,y:"1459.63498127" ,z:"-7786.3670412"},
  { name:"posAuxDet218",    x:"3532.25180974" ,y:"1459.63498127" ,z:"-7691.3670412"},
  { name:"posAuxDet219",    x:"3711.02180974" ,y:"1459.63498127" ,z:"-7591.3670412"},
  { name:"posAuxDet220",    x:"3886.85080974" ,y:"1459.63498127" ,z:"-7486.3670412"},
  { name:"posAuxDet221",    x:"4059.59180974" ,y:"1459.63498127" ,z:"-7376.8670412"},
  { name:"posAuxDet222",    x:"4229.05180974" ,y:"1459.63498127" ,z:"-7261.7670412"},
  { name:"posAuxDet223",    x:"-4151.34819026" ,y:"1459.63498127" ,z:"-7204.3670412"},
  { name:"posAuxDet224",    x:"-3983.44819026" ,y:"1459.63498127" ,z:"-7324.4670412"},
  { name:"posAuxDet225",    x:"-3812.04819026" ,y:"1459.63498127" ,z:"-7439.7670412"},
  { name:"posAuxDet226",    x:"-3637.54819026" ,y:"1459.63498127" ,z:"-7549.3670412"},
  { name:"posAuxDet227",    x:"-3459.94819026" ,y:"1459.63498127" ,z:"-7654.3670412"},
  { name:"posAuxDet228",    x:"-3279.34819026" ,y:"1459.63498127" ,z:"-7755.3670412"},
  { name:"posAuxDet229",    x:"-3095.94819026" ,y:"1459.63498127" ,z:"-7849.3670412"},
  { name:"posAuxDet230",    x:"-2909.94819026" ,y:"1459.63498127" ,z:"-7939.3670412"},
  { name:"posAuxDet231",    x:"-2721.44819026" ,y:"1459.63498127" ,z:"-8023.3670412"},
  { name:"posAuxDet232",    x:"-2530.64819026" ,y:"1459.63498127" ,z:"-8102.3670412"},
  { name:"posAuxDet233",    x:"-2337.54819026" ,y:"1459.63498127" ,z:"-8176.3670412"},
  { name:"posAuxDet234",    x:"-2142.54819026" ,y:"1459.63498127" ,z:"-8243.3670412"},
  { name:"posAuxDet235",    x:"-1945.64819026" ,y:"1459.63498127" ,z:"-8305.3670412"},
  { name:"posAuxDet236",    x:"-1747.04819026" ,y:"1459.63498127" ,z:"-8362.3670412"},
  { name:"posAuxDet237",    x:"-1546.94819026" ,y:"1459.63498127" ,z:"-8413.3670412"},
  { name:"posAuxDet238",    x:"-1345.44819026" ,y:"1459.63498127" ,z:"-8458.3670412"},
  { name:"posAuxDet239",    x:"-1142.74819026" ,y:"1459.63498127" ,z:"-8497.3670412"},
  { name:"posAuxDet240",    x:"-938.948190262" ,y:"1459.63498127" ,z:"-8531.3670412"},
  { name:"posAuxDet241",    x:"-734.348190262" ,y:"1459.63498127" ,z:"-8558.3670412"},
  { name:"posAuxDet242",    x:"-528.948190262" ,y:"1459.63498127" ,z:"-8580.3670412"},
  { name:"posAuxDet243",    x:"-323.148190262" ,y:"1459.63498127" ,z:"-8596.3670412"},
  { name:"posAuxDet244",    x:"-116.848190262" ,y:"1459.63498127" ,z:"-8606.3670412"},
  { name:"posAuxDet245",    x:"89.5518097378" ,y:"1459.63498127" ,z:"-8610.3670412"},
  { name:"posAuxDet246",    x:"296.051809738" ,y:"1459.63498127" ,z:"-8608.3670412"},
  { name:"posAuxDet247",    x:"502.351809738" ,y:"1459.63498127" ,z:"-8600.3670412"},
  { name:"posAuxDet248",    x:"708.351809738" ,y:"1459.63498127" ,z:"-8586.3670412"},
  { name:"posAuxDet249",    x:"913.951809738" ,y:"1459.63498127" ,z:"-8567.3670412"},
  { name:"posAuxDet250",    x:"1118.85180974" ,y:"1459.63498127" ,z:"-8541.3670412"},
  { name:"posAuxDet251",    x:"1322.95180974" ,y:"1459.63498127" ,z:"-8510.3670412"},
  { name:"posAuxDet252",    x:"1526.05180974" ,y:"1459.63498127" ,z:"-8473.3670412"},
  { name:"posAuxDet253",    x:"1727.95180974" ,y:"1459.63498127" ,z:"-8430.3670412"},
  { name:"posAuxDet254",    x:"1928.65180974" ,y:"1459.63498127" ,z:"-8381.3670412"},
  { name:"posAuxDet255",    x:"2127.85180974" ,y:"1459.63498127" ,z:"-8327.3670412"},
  { name:"posAuxDet256",    x:"2325.35180974" ,y:"1459.63498127" ,z:"-8266.3670412"},
  { name:"posAuxDet257",    x:"2521.05180974" ,y:"1459.63498127" ,z:"-8201.3670412"},
  { name:"posAuxDet258",    x:"2714.85180974" ,y:"1459.63498127" ,z:"-8129.3670412"},
  { name:"posAuxDet259",    x:"2906.45180974" ,y:"1459.63498127" ,z:"-8052.3670412"},
  { name:"posAuxDet260",    x:"3095.79180974" ,y:"1459.63498127" ,z:"-7970.3670412"},
  { name:"posAuxDet261",    x:"3282.72180974" ,y:"1459.63498127" ,z:"-7882.3670412"},
  { name:"posAuxDet262",    x:"3467.06180974" ,y:"1459.63498127" ,z:"-7789.3670412"},
  { name:"posAuxDet263",    x:"3648.67180974" ,y:"1459.63498127" ,z:"-7691.3670412"},
  { name:"posAuxDet264",    x:"3827.38180974" ,y:"1459.63498127" ,z:"-7588.3670412"},
  { name:"posAuxDet265",    x:"4003.06180974" ,y:"1459.63498127" ,z:"-7479.3670412"},
  { name:"posAuxDet266",    x:"4175.55180974" ,y:"1459.63498127" ,z:"-7366.6670412"}
  ];
  
  // Tia: coordinates above are relative to detector center:
  var cx = 128.175;
  var cz = 518.4  ;
  var cy = 116.5/2; // half-length
  
  // Thin paddles arranged vertically, flat side to the beam.
  var wx=  19.0; // 19 cm
  var wz=   0.6;  
  var wy= 141.0; 
  
  for(var iaux=0;iaux<=266;iaux++) {
    if(iaux>=178) dz = 151.0;
    var curColor = "rgba(0, 0, 0, 0.3)";
    var det = detpos[iaux];
    this.AddLine(cx+det.x/10 -wx/2,
                 cy+det.y/10 + wy/2,
                 cz+det.z/10,
                 
                 cx+det.x/10 -wx/2,
                 cy+det.y/10 - wy/2,
                 cz+det.z/10,
                 2,
                 curColor
                );

    this.AddLine(cx+det.x/10 +wx/2,
                 cy+det.y/10 + wy/2,
                 cz+det.z/10,
     
                 cx+det.x/10 +wx/2,
                 cy+det.y/10 - wy/2,
                 cz+det.z/10,
                 2,
                 curColor
                );

                this.AddLine(cx+det.x/10 -wx/2,
                             cy+det.y/10 + wy/2,
                             cz+det.z/10,
                 
                             cx+det.x/10 +wx/2,
                             cy+det.y/10 + wy/2,
                             cz+det.z/10,
                             2,
                             curColor
                            );

                this.AddLine(cx+det.x/10 +wx/2,
                             cy+det.y/10 - wy/2,
                             cz+det.z/10,
     
                             cx+det.x/10 -wx/2,
                             cy+det.y/10 - wy/2,
                             cz+det.z/10,
                             2,
                             curColor
                            );

  }
};


TriDView.prototype.should_highlight = function(obj)
{
  if(!obj.source) return false;
  if(!obj.source.obj) return false;
  if(! gHoverState.obj) return false;
  if((obj.source.obj == gHoverState.obj) ||
    ((obj.source.obj.ftrackId)&&(obj.source.obj.ftrackId == gHoverState.obj.ftrackId))) 
    return true;
  return false;
};

TriDView.prototype.should_outline = function(obj)
{
  if(!obj.source) return false;
  if(!obj.source.obj) return false;
  if(! gSelectState.obj) return false;
  if((obj.source.obj == gSelectState.obj) ||
    ((obj.source.obj.ftrackId)&&(obj.source.obj.ftrackId == gSelectState.obj.ftrackId))) {
      return true;      
    }
  return false;
};

TriDView.prototype.DrawFinish = function()
{
  if(this.fMouseInContentArea) {
    if(this.final_highlight_point){      
      var offset = getAbsolutePosition(this.canvas);
      var pt = this.final_highlight_point;
      // Pick rightmost alternative.
      if(pt[0] < this.begin_highlight_point[0]) pt = this.begin_highlight_point;
      SetOverlayPosition(offset.x + pt[0], offset.y + pt[1]);  
    }
  }
};

TriDView.prototype.HoverObject = function(selected)
{
  ClearHover();
  if(selected) {
    ChangeHover(selected);
  }
  //this.Draw();
};

TriDView.prototype.ClickObject = function(selected)
{
  console.warn("trid click");
  if(selected) ChangeSelection(selected);
  else ClearSelection();
  //this.Draw();
};

