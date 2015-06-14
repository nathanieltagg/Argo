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
/// Base class: Pad3d.
/// This forms a 3-d drawing canvas
///


function Pad3d( element, options )
{
  ///
  /// Constructor.
  ///
  // console.log('Pad3d ctor');
  if(!element) { 
    // console.log()
    return; 
  }

  if($(element).length<1) { 
    // console.log()
    return;
  }
  this.element = $(element).get(0); 

  this.width  = 1;
  this.height = 1;


  // Options - defaults. Sensible for a wide range of stuff.
  this.proj_dist = 500;
  this.clip_z = 10;
  this.objects = [ ];
  this.bg_color = "white";
  this.dragging = false;

  this.default_look_at = [0,0,0];
  this.default_camera_distance = 800;
  this.default_theta =0 ;
  this.default_phi = 0;

  this.look_at         = this.default_look_at;
  this.camera_distance = this.default_camera_distance;
  this.theta           = this.default_theta;
  this.phi             = this.default_phi;

  this.camera_distance_max = 8000;
  this.camera_distance_min = 0;
  
  this.mouse_highlight_range = 5; //pixels
  this.pan_increment = 4;
  this.autorotate_speed = 0.005; // rad/incrment
  this.mouse_mode = "rotate";
  
  this.view_mode = "3D"; // Can also be XZ, YZ, or XY (all orthographic)
  
  // Merge in the options.
  $.extend(true,this,options);

  // Merge in options from element
  var element_settings = $(element).attr('settings');
  var element_settings_obj={};
  if(element_settings) {
    eval( "var element_settings_obj = { " + element_settings + '};'); // override from 'settings' attribute of html object.
    // console.log(element_settings, element_settings_obj);
    $.extend(true,this,element_settings_obj); // Change default settings by provided overrides.
  }

  // Look for an existing canvas, and build one if it's not there.
  if($('canvas',this.element).length<1) {
    this.canvas = document.createElement("canvas");
    this.element.appendChild(this.canvas);

    if (typeof FlashCanvas != "undefined") {
        FlashCanvas.initElement(this.canvas);
    }

  } else {
    this.canvas = $('canvas',this.element).get(0);    
  }

  // Build the drawing context.
  this.ctx = this.canvas.getContext('2d');
  if(initCanvas) this.ctx = initCanvas(this.canvas).getContext('2d');
  if(!this.ctx) console.log("Problem getting context!");
  
  // Resize the canvas to the coordinates specified, either in html, the css, or options provided.
  this.Resize();
   
  // Bind resizing to a sensible closure.
  var self = this;
  $(this.element).resize(function(ev){
                         self.Resize(); 
                         self.Draw();
                         }); 
  $(this.element).bind('PrintHQ',function(ev){
                       self.PrintHQ(); 
                       });                                               
                                                                       

   // user support:
  $(this.element)   .bind('mouseenter', function(ev)   { self.fMouseInContentArea = true; });
  $(this.element)   .bind('mouseout',   function(ev)   { self.fMouseInContentArea = false; });

  $(this.element)   .bind('mousedown',  function(ev)   { return self.startDragging(ev); });
  $(window)         .bind('mouseup',    function(ev)   { return self.stopDragging(ev); });
  $(window)         .bind('mousemove',  function(ev)   { return self.drag(ev); });
  $(this.element)   .bind('mousemove',  function(ev)   { return self.mouseMove(ev); });
  $(this.element)   .bind('click',      function(ev)   { return self.click(ev); });
  
  // note: iOS events get sent to start element, even if your finger leaves the boundaries of the element. Not doing this right leads to delays!
  $(this.element)   .bind('touchstart',  function(ev)   { return self.startDragging(ev); });
  $(this.element)   .bind('touchmove',  function(ev)   { return self.drag(ev); });
  $(this.element)   .bind('touchend',    function(ev)   { return self.stopDragging(ev); });
    

  $(this.element) .bind('mousewheel',  function(ev,d) {
    if(ev.ctrlKey) return self.scrollMe(ev,-d); 
    else return true; // bubble.
   });
   
  // $(this.element) .bind('dblclick',  function(ev)     { return self.fullScreen(); });
  
  $(this.element) .bind('contextmenu', function(ev){ return false;} );
  
  var parent = $(this.element).parent();

  $(".trid-zoom-in"   ,parent)
    .button({icons: {primary: 'ui-icon-zoomin'},text: false})            
    .mousehold(function(ev){self.scrollMe(ev,-1);});

  $(".trid-zoom-out"  ,parent)
    .button({icons: {primary: 'ui-icon-zoomout'},text: false})
    .mousehold(function(ev){self.scrollMe(ev,+1);});
   
  $(".trid-pan-left"  ,parent)
    .button({icons: {primary: 'ui-icon-arrowthick-1-w'},text: false})
    .mousehold(function(ev){self.panMe(ev,-self.pan_increment,0,0);});
  
  $(".trid-pan-right" ,parent)
    .button({icons: {primary: 'ui-icon-arrowthick-1-e'},text: false})
    .mousehold(function(ev){self.panMe(ev,+self.pan_increment,0,0);});
  
  $(".trid-pan-up"    ,parent)
    .button({icons: {primary: 'ui-icon-arrowthick-1-n'},text: false})           
    .mousehold(function(ev){self.panMe(ev,0,-self.pan_increment,0);});

  $(".trid-pan-down"  ,parent)
    .button({icons: {primary: 'ui-icon-arrowthick-1-s'},text: false})           
    .mousehold(function(ev){self.panMe(ev,0,+self.pan_increment,0);});

  $(".trid-pan-upstream"  ,parent)
      .button({icons: {primary: 'ui-icon-arrowthick-1-ne'},text: false})           
      .mousehold(function(ev){self.panMe(ev,0,0,+self.pan_increment);});

  $(".trid-pan-downstream"  ,parent)
      .button({icons: {primary: 'ui-icon-arrowthick-1-sw'},text: false})           
      .mousehold(function(ev){self.panMe(ev,0,0,-self.pan_increment);});


  $(".trid-autorotate" ,parent)
    .button({icons: {primary: 'ui-icon-arrowrefresh-1-s'},text: false})
    .change(function(ev){self.autoRotate($(this).is(':checked'));});

  $(".trid-reset"     ,parent)
    .button({icons: {primary: 'ui-icon-seek-first'},text: false})          
    .click(function(ev){self.ResetView();self.Draw();});

  $(".trid-ctl-mouse-set"     ,parent)
      .buttonset({icons: {primary: 'ui-icon-seek-first'},text: false});
      
  $(".trid-ctl-mouse-pan"     ,parent)
      .button({icons: {primary: 'ui-icon-transferthick-e-w'},text: false})
      .change(function(ev){
          self.mouse_mode= $(":checked",$(this).parent()).val();
          console.log("mouse mode",self.mouse_mode);
          });

  $(".trid-ctl-mouse-rotate"     ,parent)
      .button({icons: {primary: 'ui-icon-arrow-4'},text: false})
      .change(function(ev){
        self.mouse_mode= $(":checked",$(this).parent()).val();
        console.log("mouse mode",self.mouse_mode);
        });
  
  $(".trid-ctl-view-set"     ,parent)
      .buttonset({icons: {primary: 'ui-icon-seek-first'},text: false});

  $(".trid-ctl-view-set input[type='radio']"     ,parent)
      .button()
      .change(function(ev){
          self.ChangeViewMode($(":checked",$(this).parent()).val());
        });


  $(".trid-create-animation"     ,parent)
    .button({icons: {primary: 'ui-icon-note'},text: false})          
    .click(function(ev){self.CreateAnimation();});


   this.Draw();
}

Pad3d.prototype.panMe = function(ev,dx,dy,dz)
{
  // console.log("Pan3d.panMe",ev,dx,dy,dz);
  this.look_at[0] += dx;
  this.look_at[1] += dy;
  this.look_at[2] += dz;
  this.Draw();
};

Pad3d.prototype.rotateMe = function(theta,phi)
{
  // console.log("Pan3d.rotateMe",theta,phi);
  this.theta += theta;
  this.phi += phi;
  if(this.theta>Math.PI/2) this.theta = Math.PI/2;
  if(this.theta<-Math.PI/2) this.theta = -Math.PI/2;  
};


Pad3d.prototype.ResetView = function()
{
  if(this.view_mode == "3D") {
    this.look_at[0]      = this.default_look_at[0];
    this.look_at[1]      = this.default_look_at[1];
    this.look_at[2]      = this.default_look_at[2];
    this.camera_distance = this.default_camera_distance;
    this.theta           = this.default_theta;
    this.phi             = this.default_phi;
    this.proj_dist       = 500;
    // console.log("ResetView 3D.");
    return;
  }

  // No, we're othographic.
  this.camera_distance = 80000;
  this.proj_dist = this.camera_distance;
  
  switch(this.view_mode)
  {
    case "XZ":
      this.theta = Math.PI/2;
      this.phi = -Math.PI/2;
      console.log("ResetView XZ.");
      break;

    case "YZ":
      this.theta = 0;
      this.phi = -Math.PI/2;
      console.log("ResetView YZ.");
      break;

    case "XY":
      this.theta = 0;
      this.phi = 0;
      console.log("ResetView XY.");
      
      break;
  }
  
  
};

Pad3d.prototype.ChangeViewMode = function(mode)
{
  this.view_mode = mode;
  this.ResetView();
  this.Draw();
};

Pad3d.prototype.Translate = function( mat, x,y,z)
{
  // Translate a matrix.
  var trans = Matrix.create( [
    [ 1, 0, 0,   x],
    [ 0, 1, 0,   y],
    [ 0, 0, 1,   z],
    [ 0, 0, 0,   1],
    ]);  
  mat = trans.x(mat);
  return mat;
};

Pad3d.prototype.RotateX = function( mat, angle )
{
  // Rotate a matrix about the x-axis
  c = Math.cos(angle);
  s = Math.sin(angle);
  var rot = Matrix.create([
    [ 1, 0, 0, 0],
    [ 0, c,-s, 0],
    [ 0, s, c, 0],
    [ 0, 0, 0, 1]
  ]);
  mat = rot.x(mat);
  return mat;
};

Pad3d.prototype.RotateY = function( mat, angle )
{
  // Rotate a matrix about the x-axis
  c = Math.cos(angle);
  s = Math.sin(angle);
  var rot = Matrix.create([
    [ c, 0, s, 0],
    [ 0, 1, 0, 0],
    [-s, 0, c, 0],
    [ 0, 0, 0, 1]
  ]);
  mat = rot.x(mat);
  return mat;
};


Pad3d.prototype.AddLine = function(x1,y1,z1,x2,y2,z2,width,color,source)
{
  var line = {
    type: "l",
    a: Vector.create([x1,y1,z1,1]),
    b: Vector.create([x2,y2,z2,1]),
    linewidth: width,
    stroke: color,
    source: source
  };
  this.objects.push(line);
};

Pad3d.prototype.AddPoint = function(x1,y1,z1,size,fill,highlightfill,source)
{
  var obj = {
    type: "p",
    a: Vector.create([x1,y1,z1,1]),
    b: Vector.create([x1,y1,z1,1]),
    size: size,
    fill: fill,
    fillhighlight: highlightfill,
    linewidth: null,
    stroke: null,
    source: source
  };
  this.objects.push(obj);
};

// Circle in the YZ plane
Pad3d.prototype.AddArcYZ = function(x,y,z,r,nstep,theta_start,theta_end,width,color,source)
{
  var dtheta = (theta_end-theta_start)/nstep;
  for(var i=0;i<nstep;i++) {
    var x1 = x;
    var x2 = x;
    var theta1 = theta_start + i*dtheta;
    var theta2 = theta1+dtheta;
    var y1 = y + r*Math.cos(theta1);
    var y2 = y + r*Math.cos(theta2);
    var z1 = z + r*Math.sin(theta1);
    var z2 = z + r*Math.sin(theta2);
    this.AddLine(x1,y1,z1,x2,y2,z2,width,color,source);    
  }
};

Pad3d.prototype.AddArrow = function(x,y,z,x2,y2,z2,head_size,width,color,obj)
{
  function NormalizeVector(n) {
    var l = Math.sqrt(n.x*n.x + n.y*n.y + n.z*n.z);
    if(l>0){ n.x /= l; n.y /= l;  n.z /=l; }
  }
  var n = {x: x2-x, y: y2-y, z: z2-z};
  NormalizeVector(n);
  this.AddLine(x,y,z,x2,y2,z2,width,color,obj);
  // Vector direction

  // find a perpendicular vector. This is a cheat.
  var u = {x: n.y, y:n.x, z:0};
  if(n.z>0.9) u = {x:0, y:n.z, z:n.y};
  var v = {x: (n.y*u.z - n.z*u.y),
           y: (n.z*u.x - n.x*u.z),
           z: (n.x*u.y - n.y*u.x)
  };

  this.AddLine(x2,y2,z2,
              x2 - 2*n.x*head_size + v.x*head_size,
              y2 - 2*n.y*head_size + v.y*head_size,
              z2 - 2*n.z*head_size + v.z*head_size,
              width, color, obj);
  this.AddLine(x2,y2,z2,
              x2 - 2*n.x*head_size - v.x*head_size,
              y2 - 2*n.y*head_size - v.y*head_size,
              z2 - 2*n.z*head_size - v.z*head_size,
              width, color, obj);


}


Pad3d.prototype.Resize = function()
{
  // Set this object and canvas properties.
  var width = this.width;
  var height = this.height;
  if(!$(this.element).is(":hidden")) {
    width = $(this.element).width();
    height = $(this.element).height(); 
  }
  // console.log("Resize",$(this.element),width,height);
  if((this.width  == width) &&
     (this.height == height) ) return;
  this.canvas.width = this.width = width;
  this.canvas.height = this.height = height;

 this.padPixelScaling = 1;
  if(window.devicePixelRatio > 1) {
    // Retina display! Cool!
    this.padPixelScaling = window.devicePixelRatio;
  }
  // this.canvas.width = width * window.devicePixelRatio;
  // this.canvas.height = height * window.devicePixelRatio;
  this.canvas.setAttribute('width', width *  this.padPixelScaling);
  this.canvas.setAttribute('height', height *  this.padPixelScaling);
  $(this.canvas).css('width', width );
  $(this.canvas).css('height', height );
  this.ctx.scale(this.padPixelScaling,this.padPixelScaling);

};


Pad3d.prototype.Clear = function()
{
  //console.log("Pad.Clear()");
  if (!this.ctx) return;
  this.ctx.fillStyle = this.bg_color;
  this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
};


Pad3d.prototype.Draw = function()
{
  if($(this.element).is(":hidden")) return;
  this.Clear();
  this.DrawLines();
  this.DrawFinish(); // usercallback.
};

Pad3d.prototype.DrawFinish = function()
{};

Pad3d.prototype.Linesort = function(l1,l2)
{
  // figure out which line is in front and which is behind.
  // Step 1: is zmax of 1 < zmin of 2?
  if(l1.bz < l2.az) return 1;
  // Step 2: is zmax of 2 < zmin of 1?
  if(l2.bz < l1.az) return -1;

  // Guess: take the mean z.
  return (l2.meanz)-(l1.meanz);
  
  // step 3: find the 2d location where the two lines overlap.
  
  
  // Do we care? That is, do the lines overlap in screen space?  

};

Pad3d.prototype.DrawLines = function()
{
  // Viewport should center on screen.
  this.ctx.save();
  this.begin_highlight_point = null;
  this.final_highlight_point = null;

  // this.ctx.translate(this.width/2,this.height/2);
  // this.ctx.rotate(3.14159);
  // Lines.
  
  // var trans = this.transform_matrix;
  
  var trans = Matrix.I(4);
  // console.log("Pad3d Draw ",this.camera_distance,this.theta,this.phi,this.look_at);
  trans = this.Translate(trans,-this.look_at[0],-this.look_at[1],-this.look_at[2]);
  trans = this.RotateY(trans,this.phi);
  trans = this.RotateX(trans,this.theta);
  trans = this.Translate(trans,0,0,this.camera_distance);
  var i;
  
  for(i=0;i<this.objects.length;i++)
  {
    var line = this.objects[i];
    // Rotate each point by the current matrix.
    var p1 = trans.x(line.a);
    var p2 = trans.x(line.b);

    // Sort: point a will be have smallest z
    // point b will have largest z
    var a,b;
    if(p1.e(3)>p2.e(3)) {
      a = p2;
      b = p1;
    } else {
      a = p1;
      b = p2;
    }

    // Projection in z.
    line.az = a.e(3);
    line.bz = b.e(3);
    line.meanz = (line.az+line.bz)/2;

    if(line.az<this.clip_z){ line.draw=false; continue; } // line is behind us.
    line.draw = true;
    
    // Find projection onto screen.
    line.au =  a.e(1)/a.e(3)*this.proj_dist;
    line.av =  a.e(2)/a.e(3)*this.proj_dist;
    line.bu =  b.e(1)/b.e(3)*this.proj_dist;
    line.bv =  b.e(2)/b.e(3)*this.proj_dist;

    if(line.bz<this.clip_z) {
      // We need to clip the line.
      var lambda = (this.clip_z - line.az)/(line.bz-line.az);
      var c = a.add( b.subtract(a).multiply(lambda)  );
      line.bu =  c.e(1)/c.e(3)*this.proj_dist;
      line.bv =  c.e(2)/c.e(3)*this.proj_dist;
      
    }

  }

  this.objects.sort(this.Linesort);
  
  // FIXME: do z-projection sort here.
  
  var cu = this.width/2;
  var cv = this.height/2;
  for(i=0;i<this.objects.length;i++)
  {
    var obj = this.objects[i];
    // draw it.
    if(obj.draw) {
      if(obj.type=='l') {
        // Line
        // adjust line thickness for relative z.      
        var linewidth = obj.linewidth/obj.meanz*this.proj_dist;
        var x1 = cu-obj.au;
        var x2 = cu-obj.bu;
        var y1 = cv-obj.av;
        var y2 = cv-obj.bv;
        if(Math.abs(x2-x1)<1 && Math.abs(y2-y1<1)) x2+=1;
        if(this.should_outline(obj)) {
          if(x1>0 && x1<this.width && y1>0 && y1<this.height && !this.begin_highlight_point) {
            this.begin_highlight_point = [x1,y1];
          }
          
          if(x2>0 && x2<this.width && y2>0 && y2<this.height) {
            this.final_highlight_point = [x2,y2];
          }


          // Draw underlay for a selected track.
          this.ctx.lineWidth = linewidth*2;
          this.ctx.strokeStyle = "rgba(0,0,0,0.8)";
          this.ctx.beginPath();
          this.ctx.moveTo(x1,y1);
          this.ctx.lineTo(x2,y2);
          this.ctx.stroke();
          this.ctx.lineWidth = linewidth;          
        }
        
        if(this.should_highlight(obj)) {
          this.ctx.strokeStyle = "rgba(250,0,0,0.9)";
        } else {
          this.ctx.strokeStyle = obj.stroke;
        }
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1,y1);
        this.ctx.lineTo(x2,y2);
        this.ctx.stroke();
        
         
      }
      if(obj.type=='p') {
        // Point
        this.ctx.save();
        this.ctx.translate(cu-obj.au, cv-obj.av);
        this.ctx.scale(this.proj_dist/obj.meanz,this.proj_dist/obj.meanz);
        this.ctx.beginPath();
        this.ctx.arc(0,0,obj.size,0,Math.PI*2,true);
        if(this.should_highlight(obj)) this.ctx.fillStyle = obj.fillhighlight;
        else this.ctx.fillStyle = obj.fill;
        this.ctx.fill();
        this.ctx.closePath();
        this.ctx.restore();

        if(this.should_outline) {
            this.final_highlight_point = [cu-obj.au,cv-obj.av];
        }

      }
    }
  }
  this.ctx.restore();
};

Pad3d.prototype.should_highlight = function(obj)
{
  return false;
};

Pad3d.prototype.should_outline = function(obj)
{
  return false;
};

Pad3d.prototype.startDragging = function(ev)
{
  ev.originalEvent.preventDefault();
  
  this.startDragWalltime = $.now();
  // this.startDragTransform = this.transform_matrix.dup();
  this.startDragX = ev.pageX;
  this.startDragY = ev.pageY;
  if(ev.originalEvent.touches) {
    if (ev.originalEvent.touches.length > 1) {this.dragging = false;return; } // don't allow multi-touch
    this.startDragX = ev.originalEvent.touches[0].pageX;
    this.startDragY = ev.originalEvent.touches[0].pageY;       
    this.startDragTouch = true;
    ev.originalEvent.preventDefault();       
  }
  
  // console.log("start drag "+this.startDragX+" "+this.startDragY);
  this.dragging = true;
  this.drag_button = ev.which;
  $(this.element).css("cursor","move !important");
  return true;
  
};

Pad3d.prototype.stopDragging = function(ev)
{
  $(this.element).css("cursor","auto");
  
  this.dragging = false;
};

Pad3d.prototype.drag = function(ev)
{
  // Called for any movement in page.
  if(!this.dragging)  return;  
   var x = ev.pageX;
   var y = ev.pageY;
   // console.log("dragging....."+ev.type+" "+x+" "+y);
   if(ev.originalEvent.touches) {
     if(ev.originalEvent.touches) console.log("Touches avalable");
     if (ev.originalEvent.touches.length > 1) {this.dragging = false; return; } // don't allow multi-touch
     x = ev.originalEvent.touches[0].pageX;
     y = ev.originalEvent.touches[0].pageY;       
     ev.originalEvent.preventDefault();       
     console.log("Touch: " + x + " " + y);
   } else {
     if(this.startDragTouch) return; // Avoid processing a fake mousemove event when running ios.
   }
   var dx = (x - this.startDragX);
   var dy = (y - this.startDragY);
   // console.log("Rotate: " + dx+" "+dy);
   
   var sx =  dx / $(this.element).width();
   var sy =  dy / $(this.element).height();
   // console.log("Rotate: " + sx+" "+sy);
   
   this.startDragX = x;
   this.startDragY = y;

   if((this.mouse_mode == "pan" && this.drag_button != 3)||(this.mouse_mode == "rotate" && this.drag_button == 3)) {
     // panning

     // Need to find 'up' and 'right' vectors to find how to shift look-at point.
     var trans = Matrix.I(4);
     trans = this.RotateX(trans,-this.theta);
     trans = this.RotateY(trans,-this.phi);
     var u = dx;
     var v = dy;
     var inv = Vector.create([u,v,0,1]);
     var outv = trans.x(inv);
     this.panMe(null,outv.e(1),outv.e(2),outv.e(3));
     
   } else {
     // rotating
     sx = Math.asin(sx);
     sy = -Math.asin(sy);
     if(!ev.originalEvent.touches) {
       sx=5*sx;
       sy=5*sy;
     }
     // console.log("Rotate: " + sx+" "+sy);
     this.rotateMe(sy,sx);
   }
   this.Draw();
};

Pad3d.prototype.findObjectUnderMouse = function(event) 
{
  // Called for any movement in pad.  
  // find highlighed object.
  // go through object list from back to front, so that the frontmost object will highlight.
  var offset = getAbsolutePosition(this.canvas);
  var x = event.pageX - offset.x;
  var y = event.pageY - offset.y;    
  var u = this.width/2 -x;  // Translate and flip inverse to screen coords
  var v = this.height/2-y;

  var selected = null;
  for(var i=0;i<this.objects.length;i++)
  {
    var obj = this.objects[i];
    // Only compute if object is selectable: i.e. it has a reference source (is not scenery)
    if(obj.source){
      if(obj.type=='l') {
        // if(sample++%100==0) console.log(obj.source,
        //                                 u,v,obj.au,obj.av,obj.bu,obj.bv,
        //                                 GeoUtils.line_to_point(u,v,obj.au,obj.av,obj.bu,obj.bv));
        if( GeoUtils.line_is_close_to_point(u,v,obj.au,obj.av,obj.bu,obj.bv,
          this.mouse_highlight_range*this.proj_dist/obj.meanz) )
          selected = obj.source; 
        }
      }
      if(obj.type=='p') {
        var du = u - obj.au;
        var dv = v - obj.av;
        var d = Math.sqrt(du*du+dv*dv);
        if( d < this.mouse_highlight_range*this.proj_dist/obj.meanz ) selected = obj.source;
      }
  }
  return selected;
};

// var sample =0;
Pad3d.prototype.mouseMove = function(ev)
{
  if(this.dragging) return;
  ev.originalEvent.preventDefault();
   
  var thing = this.findObjectUnderMouse(ev);
  
  this.HoverObject(thing);  
};

Pad3d.prototype.click = function(ev)
{
  var now = $.now();
  if((now - this.startDragWalltime) < 500) { // half-second
    var selected = this.findObjectUnderMouse(ev);  
    this.ClickObject(selected);  
  }
};


Pad3d.prototype.HoverObject = function(selected)
{  
  console.log("Pad3d.HoverObject selected=",selected);
};

Pad3d.prototype.ClickObject = function(selected)
{
  console.log("Pad3d.ClickObject selected=",selected);
};

Pad3d.prototype.scrollMe = function(ev,delta)
{
  var zoom = delta*50;

  if(this.view_mode=="3D") {
    this.camera_distance += zoom;
    if(this.camera_distance > this.camera_distance_max) this.camera_distance = this.camera_distance_max;
    if(this.camera_distance < this.camera_distance_min) this.camera_distance = this.camera_distance_min;
  }
  else {
    // Orthographic view.
    this.camera_distance += zoom*1000;
  }
  
  this.Draw();
  return false; // Capture the mouse event.
  
};


Pad3d.prototype.autoRotate = function(on)
{
  if(on) {
    var self = this;
    this.autoRotateTimer = setInterval(function(){
      //self.rotateMe(0,self.autorotate_speed);
      self.AnimateNextFrame();
      self.Draw();
    },
    100 // ms
    );
  }
  if(!on) clearInterval(this.autoRotateTimer);
};


Pad3d.prototype.Print = function()
{
  if (!this.canvas) {
    console.log("Pad::Print() Invalid context.");
    return null;
  }
  if (!this.canvas.toDataURL){
    console.log("Pad::Print() toDataURL not supported");
    return null;
  }
  var url = this.canvas.toDataURL("image/png");
  console.log("Pad::Print() ",url);
  return url;
};


/* @author Remy Sharp (leftlogic.com)
 * @date 2006-12-15
 * @example $("img").mousehold(200, function(i){  })
 * @desc Repeats firing the passed function while the mouse is clicked down
 *
 * @name mousehold
 * @type jQuery
 * @param Number timeout The frequency to repeat the event in milliseconds
 * @param Function fn A function to execute
 * @cat Plugin
 */

jQuery.fn.mousehold = function(timeout, f) {
	if (timeout && typeof timeout == 'function') {
		f = timeout;
		timeout = 100;
	}
	if (f && typeof f == 'function') {
		var timer = 0;
		var fireStep = 0;
		return this.each(function() {
			jQuery(this).mousedown(function() {
				fireStep = 1;
				var ctr = 0;
				var t = this;
				timer = setInterval(function() {
					ctr++;
					f.call(t, ctr);
					fireStep = 2;
				}, timeout);
			});

			clearMousehold = function() {
				clearInterval(timer);
				if (fireStep == 1) f.call(this, 1);
				fireStep = 0;
			};
			
			jQuery(this).mouseout(clearMousehold);
			jQuery(this).mouseup(clearMousehold);
		});
	}
};

Pad3d.prototype.PrintHQ = function()
{
  // First, save our current state.
  var saveCanvas = this.canvas;
  var saveCtx    = this.ctx;
  var saveWidth  = this.width;
  var saveHeight = this.height;
  
  // Second, create an offscreen drawing context.   
  var canvas = document.createElement("canvas");
  this.canvas = canvas;
  canvas.width = saveWidth * gPrintScale;
  canvas.height = saveHeight * gPrintScale;
  // this.width  = saveWidth * gPrintScale;
  // this.height = saveHeight * gPrintScale;
  this.ctx = this.canvas.getContext("2d",{alpha:false});
  if(initCanvas) this.ctx = initCanvas(this.canvas).getContext('2d');

  // Now do the actual draw
  // this.Resize();
  this.ctx.scale(gPrintScale,gPrintScale);
  this.Draw();
  
  // Save the print result
  gPrintBuffer = this.canvas.toDataURL('image/png');

  
  // Restore defaults.
  this.canvas = saveCanvas;
  this.ctx    = saveCtx;  
  
  
  // nuke buffer.
  // document.removeChild(canvas);
};

Pad3d.prototype.AnimateNextFrame = function(restart)
{
  if(this.ani_station === undefined) {
    console.log("Restarting animation");
    this.ani_station = 0;
    this.ani_frame = 0;
    this.ani_frames_per_station = 10;
    this.ani_stations = [
       [0,-Math.PI/2] ,
       [0,-Math.PI/2] ,
       [0,-Math.PI/2] ,
       [0,0] ,
       [0,0] ,
       [-Math.PI/2,0] ,
       [-Math.PI/2,0] ,
       [0,-Math.PI/2] ,
       [0,-Math.PI/2] ,
       [0,Math.PI] ,
       [0,Math.PI] ,
       [0,Math.PI*1.5] ,
       [-Math.PI/6,Math.PI*2] ,
       [0,Math.PI*2.5] ,
       [0,Math.PI*3] ,
       [0,Math.PI*3.5]
      ];    
  } 
  if(restart) {
    this.ani_station = 0;
    this.ani_frame = 0;
  } else {
    this.ani_frame ++;
    if(this.ani_frame>= this.ani_frames_per_station) {
      this.ani_frame = 0;
      this.ani_station++;
      if(this.ani_station >= this.ani_stations.length-1) this.ani_station = 0;
    }
  }
  console.log("Animating station ",this.ani_station," frame ", this.ani_frame);
  var i = this.ani_station;
  var f = this.ani_frame / this.ani_frames_per_station;
  var theta = this.ani_stations[i][0] + f * (this.ani_stations[i+1][0]-this.ani_stations[i][0]);
  var phi   = this.ani_stations[i][1] + f * (this.ani_stations[i+1][1]-this.ani_stations[i][1]);
  var change = (theta!=this.theta) || (phi!=this.phi);
  console.log("Animating to theta,phi=",theta,phi);
  this.theta = theta;
  this.phi = phi;
  return change;
  
};


Pad3d.prototype.CreateAnimation = function()
{
  //
  // Code up an animated GIF.
  //
  // Using libraries from https://github.com/antimatter15/jsgif/
  //
  
  var encoder = new GIFEncoder();
  encoder.setRepeat(0); //0 -> loop forever //1+ -> loop n times then stop 
  encoder.setDelay(10); //go to next frame every n milliseconds
  encoder.start();

  this.AnimateNextFrame(true);
  this.Draw(); encoder.addFrame(this.ctx);
  var done = false;
  while(!done) {
    this.AnimateNextFrame(false);
    this.Draw(); encoder.addFrame(this.ctx);
    if((this.ani_frame ===0)&&(this.ani_station===0)) done = true;    
  }
  encoder.finish();

  newWin= window.open("");
  outDoc = newWin.document;
  outDoc.open();
  
  outDoc.write( "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\">" );
  outDoc.write( "<html>" );
  outDoc.write( "<body>" );
  outDoc.write( "<head>" );
  outDoc.write( "<title>Animated 3D Gif</title>" );
  outDoc.write( "</head>" );
  outDoc.write( "<body>" );
  outDoc.write( "<img src='" + 'data:image/gif;base64,'+encode64(encoder.stream().getData()) + "' />");
  outDoc.write( "</body>" );
  outDoc.write( "</html>" );
  outDoc.close();
  
};
