"use strict";

$(function(){
  // If we turn on the aspect ratio lock, make sure zoomregion is updated.
  
  $(this.ctl_lock_aspect_ratio). change(function(ev) { 
      // Force the zoom system to acknowledge the change, by making a null zoom.
      // MOre trickery
      if($(this).is(":checked")) {
        gZoomRegion.wireview_aspect_ratio = (self.span_y)/(self.span_x);
        console.log("Setting new aspect ratio",gZoomRegion.wireview_aspect_ratio,"pixels");
        gZoomRegion.setLimits(2,gZoomRegion.plane[2][0],gZoomRegion.plane[2][1]);
        gStateMachine.Trigger("zoomChange");
      }
      $('.ctl-lock-aspect-ratio').not(this).attr("checked",false);
  });  
});
function ZoomRegion() {
  this.clone = function() {
    return $.extend(true,{},this);
  };

  // Use scoping to hide values intenally; this is like having private members.
  
  var _center = new THREE.Vector3(0,0,0); // xyz coordinates of current look-at in cm (world units)
  var _width  = 100.0;                    // Scale of horizontal look-at in cm (world units).  This applies to y,z, and transverse coords
  var _aspect = 1.0;                      // Warping of current aspect ratio from true. width/height, 
                                          // so height = _width/_aspect

  var _mode = "crop";
  var _selected_tpc = 0;

  this.setMode = function(mode) { _mode = mode; }
  this.setSelectedTpc =function(tpc) { _selected_tpc = tpc };
  this.getSelectedTpc = function() { return _selected_tpc; }
  this.cropMode = function() { return _mode=='crop'; }
  this.fullMode = function() { return _mode=='full'; }

  var _time_offset = 0;
  this.getTimeOffset = function()  { return _time_offset }
  this.setTimeOffset = function(t0) { _time_offset = t0; };
  // Getters
  this.getCenter = function() { return _center; }
  this.getCenterX = function() { return _center.x; }
  this.getAspect  = function() { return _aspect; }
  this.getWidth  = function()  { return _width; }
  this.get = function() { return { center: _center.clone(), width: _width, aspect: _aspect}; };
  
  // Center in view/transverse coordinates:
  this.getCenterTransverse = function(view) {
    return gGeo.yzToTransverse(view,_center.y,_center.z);
  };

  this.getTransverseRange = function(view) {
    var center = gGeo.yzToTransverse(view,_center.y,_center.z);
    return[ center-_width/2, center+_width/2];
  };
  
  // minwire, maxwire
  this.getWireRange = function(view) {
    var r  = this.getTransverseRange(view);
    return [ gGeo.transvserseToWire(view,r[0]), gGeo.transvserseToWire(view,r[1]) ];
  };
  
  // [[minwire0, maxwire0],[min1,max1],[min2,max2]]
  this.getWireRanges = function(view) {
    // 
    return [ this.getWireRange(0), this.getWireRange(1), this.getWireRange(2) ];
  };

  // Returns view center in wire numbers [plane0,plane1,plane2]
  this.getCenterWire = function(view) {
    gGeo.yzToWire(view,_center.y,_center.z);
  }

  // Returns view center in wire numbers [plane0,plane1,plane2]
  this.getCenterWires = function() {
    return [ gGeo.yzToWire(0,_center.y,_center.z),
             gGeo.yzToWire(1,_center.y,_center.z),
             gGeo.yzToWire(2,_center.y,_center.z)  ]
  }
  
  this.getCenterTdc = function(view) {
    return gGeo.getTDCofX(view||0,_center.x);
  }

  this.getTdcRange = function(view, window_aspect_ratio_y_over_x) {
    var halfheight = _width/_aspect*window_aspect_ratio_y_over_x/2;
    return [gGeo.getTDCofX(view,_center.x-halfheight),
            gGeo.getTDCofX(view,_center.x+halfheight)];
  }

  this.getXRange = function(window_aspect_ratio_y_over_x) {
    var halfheight = _width/_aspect*window_aspect_ratio_y_over_x/2;
    return [_center.x-halfheight,
            _center.x+halfheight];
  }



  // Setters

  // TDC / X / drift-direction coordinates.
  // These are harder.
  
  this.setCenter = function(x,y,z) {
    _center.set(x,y,z);
    if(isNaN(_center.x)) debugger;
    if(isNaN(_center.y)) debugger;
    if(isNaN(_center.z)) debugger;
  }
  this.setWidth = function(w) {
    _width = w;
  }
  
  // Change the center of the view in this coordinate. Views should change so they are centered on this.
  this.setTdcCenter = function(view, tdc_center) {
    _center.x = gGeo.getXofTDC(view,tdc_center);
  }

  this.setXCenter  = function(x) {
    _center.x = x;
  }


  // take values of the detector-space X coordinate (i.e. time, usually on vertical axis)
  // and use to set scale.
  this.setXRange  = function(low, high, window_aspect_ratio_y_over_x) {
    _center.x = (low+high)/2;
    if($('.ctl-lock-aspect-ratio:checked').length>0) {
          _width = (high-low)/_aspect/window_aspect_ratio_y_over_x;
    } else {
      // We're changing the aspect ratio.
      _aspect = _width/(high-low)*window_aspect_ratio_y_over_x;
    }
  }
  
  this.setXSpan  = function(span_x, window_aspect_ratio_y_over_x) {
    var height = span_x;
    if(height<0.5) height = 0.5; // Min 5mm.
    if($('.ctl-lock-aspect-ratio:checked').length>0) {
          _width = height*_aspect/window_aspect_ratio_y_over_x;
    } else {
      // We're changing the aspect ratio.
      _aspect = _width/height*window_aspect_ratio_y_over_x;
    }
  }
  
  
  this.setTdcRange  = function(view,low_tdc, high_tdc, window_aspect_ratio_y_over_x) {
    var x1 = gGeo.getXofTDC(view,low_tdc);
    var x2 = gGeo.getXofTDC(view,high_tdc);
    this.setXRange(x1,x2,window_aspect_ratio_y_over_x);
  }
  



  // YZ / transverse / wire-number coordinates.

  // These are all straightforward: every view is going to agree
  // about the current viewing range in the readout direction.
  this.setSpan = function(newwidth) {
    _width = newwidth;
  };

  // Move the view center along coord
  this.moveTransverseCenter = function(view,delta_trans) {
    // var dir = gGeo.transverse_vectors[view].clone();
    var dir = new THREE.Vector3();
    if(view==0) dir.copy(gGeo.u_vector);
    if(view==1) dir.copy(gGeo.v_vector);
    if(view==2) dir.set(0,0,1);
    dir.multiplyScalar(delta_trans);
    _center.add(dir);
    if(isNaN(_center.x)) debugger;
    if(isNaN(_center.y)) debugger;
    if(isNaN(_center.z)) debugger;
    
  }

  // Recenter on trans coordinate in plane/view; move center along that coordinate.
  this.setTransverseCenter = function(view,trans) {
    var cur = gGeo.yzToTransverse(view,_center.y,_center.z);
    this.moveTransverseCenter(view,trans-cur);
  }
  
  this.setTransverseRange = function(view,low,high) {
    this.setTransverseCenter(view,(low+high)/2);
    this.setWidth(high-low);
  }
  

  this.setWireCenter = function(view,wire_center) {
    var trans = gGeo.wireToTransverse(view,wire_center);
    var cur = gGeo.yzToTransverse(view,_center.y,_center.z);
    this.moveTransverseCenter(view,trans-cur);
  }
  

  this.setWireSpan = function(wire_width) {
    this.setSpan(wire_width*gGeo.wire_pitch);
  }
  
  this.setWireRange = function(view,low,high) {
    var center = (low+high)/2;
    var wire_w = high-low;
    this.setWireSpan(wire_w);
    this.setWireCenter(view,center);
  }
  
}


var gZoomRegion = new ZoomRegion();

