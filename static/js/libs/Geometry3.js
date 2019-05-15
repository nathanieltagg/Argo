

Geometry3 = function (data)
{
    // Initialize the geometry object
    this.data = data;

    // Other publicly-available variables:

    this.ntpc = this.data.tpcs.length;

    // optical stuff
    this.paddle_wx = 1/8*2.54;
    this.paddle_wy = 20*2.54;
    this.paddle_wz = (7.3333)*3.54;
    this.pmtRadius = 15.2; // Size of the TPB Coating, according to the root geometry file.

    this.temperature = 87; // Kelvin
    this.hv = 70; // kVolts total
    this.drift_cm_per_tick = this.find_drift_velocity_cm_per_tick(80);

    // Private variables
    opDetByChan = [];

    // Public functions
    OpDetGeo.prototype.OpDetByChannel = function(chan)
    { return opDetByChan[chan%100]; };
    
    // Longitudinal / drift direction stuff:

    // Quadratic fit that seems OK in the 40-90 kV region. Invertable.
    var hv_a = -3.17884e-06;
    var hv_b = 0.00097196;
    var hv_c = 0.00527371;

    this.find_drift_velocity_cm_per_tick(hv)
    {
      return hv_a*hv*hv + hv*hv_b + hv_c;
    }
 
    this.find_hv_for_velocity(drift_velocity_cm_per_tick)
    {
      var c = hv_c - drift_velocity_cm_per_tick;
      return (-hv_b + fabs(sqrt(hv_b*hv_b - 4*hv_a*c)))/(2*hv_a);
    }

    this.getXofTDC = function(tpc,view,tdc) {
      return tdc*this.drift_cm_per_tick - this.data.tpcs[tpc].views[view].x;
    };

    this.getTDCofX = function(tpc,view,tdc) {
       return (x + this.data.tpcs[tpc].views[view].x) / this.drift_cm_per_tick;
    };


    // In the YZ or transverse AB planes:


    this.wire_pitch = function(tpc,view) {
      return this.data.tpcs[tpc].views[view].wire_pitch;
    }


  

    this.wireToChannelRegions = function(view) 
    {
      // return a list of wire, trans coordinates for drawing the wireimgs
      var retval = [];
      for(var tpc of this.data.tpcs) {
        var viewdata = tpc.views[view];
        retval = retval.concat(viewdata.sections);
      }
    }
    
    this.wireToChannel = function(tpc,view,wire)
    {
      // return the channel number of this wire
      var tpcview = this.data.tpcs[tpc].views[view];
      // Look through the sections to find the one holding our wire.
      // Sections always have sequential planewire (i.e. wire in plane) and channel number
      for(s of tpcview.sections) {
        if(wire>=s[0].planewire && wire <s[1].planewire) {
          return s[0].channel + wire-s[0].planewire; 
        }
      }
    }
    this.channelToWires_tpcview = function(tpc,view,channel) 
    {
      // return a list of wires that this channel connects to.
      var retval = [];
      for(var s of this.data.tpcs[tpc].views[view].sections) {
        if(channel>=s[0].channel && channel<s[1].channel) {
          // console.log("channel to wires internal")
          var r = {
            channel: channel,
            tpc:   s[0].tpc,
            plane: s[0].plane,
            view:  s[0].view,
            wire:  s[0].planewire + (channel-s[0].channel),
            trans: s[0].trans + (s[1].trans-s[1].trans)*(channel-s[0].channel)/(s[1].channel-s[0].channel), // interpolate. MIGHT BE BACKWARDS                
          }
          retval.push(r);
        }
      }
      return retval;      
    }
    
    this.channelToWires = function(channel,tpc,view) 
    {
      // return a list of wires that this channel connects to.
      // tpc or view can be undefined.
      var retval = [];
      for(var itpc=0; itpc<this.data.tpcs.length; itpc++) {
        if((tpc !== undefined) && (itpc!==tpc)) continue; 

        for(var iview = 0; iview < this.data.tpcs[itpc].views.length; iview++) {
          if((view !== undefined) && (iview!==view)) continue; 
          retval = retval.concat(this.channelToWires_tpcview(itpc,iview,channel));          
        }
      }
      return retval;
    }
    

    this.wireToWires = function(tpc,view,wire)
    {
      // return other wires that are on the same channel, also channel number
      var chan = this.wireToChannel(tpc,view,wire);
      return this.channelToWires(chan);
    }

    this.wireToTransverse = function(tpc,view,wire)
    {
      // Get the transverse coordinate of the given wire.
      // CANNOT do lookup without tpc+view, because multiple wires in same view
      // look at the same space.  (i.e. tpc 0 and 1 in protodune are in front of each other in x)
      var view = this.data.tpcs[tpc].views[view];
      return view.trans_offset + view.trans_direction*view.wire_pitch*wire;
    }


    this.transverseToWire = function(tpc,view,transverse)
    {
      // find the tpc and wire number of a transverse coordinate
      // CANNOT do lookup without tpc+view, because multiple wires in same view
      // look at the same space.  (i.e. tpc 0 and 1 in protodune are in front of each other in x)
  
      var tpcview = this.data.tpcs[tpc].views[view];
      return Math.round((transverse - tpcview.trans_offset)/tpcview.wire_pitch*tpcview.trans_direction);
    }


    this.yzToTransverse = function(view,y,z){
      return this.data.transverse_vectors[view][1]*y + this.data.transverse_vectors[view][2]*z;
    }

    this.yzToWire = function(tpc,view,y,z)
    {
      return this.transverseToWire(tpc,view,this.yzToTransverse(view,y,z));
    }

    this.wireToLineSegment = function(tpc,view,wire) 
    {
      // return 2x 3vector of the endpoints of the wire
      var tpcdata = this.data.tpcs[tpc];
      var tpcview = tpcdata.views[view];
      
      var wiretrans = this.wireToTransverse(tpc,view,wire);
      var valong = this.data.basis.along_vectors[view];
      var vtrans = this.data.basis.transverse_vectors[view];
      
      // one point along the wire is given by trans vector * trans coordinate. 
      // However, we want to make sure that this point is taken relative to the center of the wire plane face,
      // so we subtract off the tpc transverse coordinate.
      // This puts a point that should be bounded by the box.
      
      // no wait that doesn't work, the point may not be inside.
      // need to rewrite clipping alg!
      
      var clipd = clipLineToRectangle(tpcdata.center[1] - tpcdata.halfwidths[1],
                                      tpcdata.center[1] + tpcdata.halfwidths[1],
                                      tpcdata.center[2] - tpcdata.halfwidths[2],
                                      tpcdata.center[2] + tpcdata.halfwidths[2],
                                      vtrans[1]*wiretrans,
                                      vtrans[2]*wiretrans,
                                      valong[1], valong[2]        
                                      );
      return {
        x1: tpcview.x,
        y1: clipd[0][0],
        z1: clipd[0][1],
        x2: tpcview.x,
        y2: clipd[1][0],
        z2: clipd[1][1]
      }
    }


    // Private functions;

     function clipLineToRectangle(left,right,top,bottom,x,y,dx,dy)
    {
     //  Adaptation of https://en.wikipedia.org/wiki/Liang%E2%80%93Barsky_algorithm
     // The algorithm uses a parametric line, with points x,y + lambda(dx,dy)
     // It looks for intersection points with each of the vertical and horizontals, then picks the best ones.
     // For the original algorithm, it picked the smallest positive and largest negative lambdas, corresponding to 
     // the first intersections with the box.
     
     // For me, though, the point is outside the box, guarenteed (??) to intersect with the box inside, and I just want the coordinates.
     // Interestingly, I think that if you find all 4 lambdas (or 2 if the line is perp to one side of the box) then the
     // two middle values are the correct lambdas!  
     // If the line doesn't intersect the box, then this gives a segment sitting off the corner.
     var lambdas = [];
     
     var p1 = -dx;
     var p2 = dx;
     var p3 = -dy;
     var p4 = dy;
     
     var q1 = x-left;
     var q2 = right - x;
     var q3 = y - bottom;
     var q4 = top - y;
     if(dx==0) { 
       // vertical lines are easy: intersect with left and right. assume contained.
       // lambdas =[q1/p1,q2/p2];
       return[ [x,bottom], [x,top] ];
     } else if (dy==0) { 
       // horizontal lines are easy: intersect with top and bottom. assume contained.
       //lambdas = [q3/p3,q4/p4 ];
       return[ [left,y], [right,y] ];
     } else {
       // Doh! Sorting functions work alphabetically by default. Stupid.
       lambdas = [q1/p1,q2/p2,q3/p3,q4/p4].sort((a,b)=>a-b).splice(1,2);
     }
     return [  [x+dx*lambdas[0], y+dy*lambdas[0]],
               [x+dx*lambdas[1], y+dy*lambdas[1]] ];
     
    }

}


var gGeo3 = new Geometry3(geodata_uboone);


////// Unit tests.
// var fs = require('fs');
// 
// global.allwires = JSON.parse(fs.readFileSync('all_wires.json'));
// geo = new Geometry(fs.readFileSync('all_wires.json'))
// function test_wire(index,quiet)
// {
//   var bad = false;
//   quiet = (quiet==="undefined") ? false : quiet;
//   var truth = allwires[index];
//   var tpc = truth.tpc;
//   var view = truth.view;
//   var wire = truth.wire;
//   var channel = truth.channel;

//   // Test 1: does wire match geography?
//   var geowire = geo.wireToLineSegment(truth.tpc,truth.view,truth.wire);
//   var flip = (truth.end1[1] > truth.end2[1]) != (geowire.y1 > geowire.y2);
//   var truth_x1 = (flip) ? truth.end2[0] : truth.end1[0];
//   var truth_y1 = (flip) ? truth.end2[1] : truth.end1[1];
//   var truth_z1 = (flip) ? truth.end2[2] : truth.end1[2];
//   var truth_x2 = (flip) ? truth.end1[0] : truth.end2[0];
//   var truth_y2 = (flip) ? truth.end1[1] : truth.end2[1];
//   var truth_z2 = (flip) ? truth.end1[2] : truth.end2[2];
//   var dx1 = (truth_x1-geowire.x1);
//   var dy1 = (truth_y1-geowire.y1);
//   var dz1 = (truth_z1-geowire.z1);
//   var d1 = Math.sqrt( dx1*dx1 + dy1*dy1 + dz1*dz1 );
//   var dx2 = (truth_x2-geowire.x2);
//   var dy2 = (truth_y2-geowire.y2);
//   var dz2 = (truth_z2-geowire.z2);
//   var d2 = Math.sqrt( dx2*dx2 + dy2*dy2 + dz2*dz2 );
//   if((d1>1.0) || (d2>1.0)) {
//     // Loose criteria here are OK.
//     bad = "endpoint geomtetry mismatch";
//   }
  
//   // test 2: channel lookup
//   var my_chan = geo.wireToChannel(tpc,view,wire);
//   if(my_chan != channel) {
//         bad = "wire to channel lookup";
//   }

//   // test 3: channel to wire
//   var wires_on_channel = geo.channelToWires(channel);
//   var match = false;
//   for(w of wires_on_channel) {
//     if((w.tpc == tpc) && (w.view==view) && (w.wire==wire)) match = true;
//   }
//   if(!match) bad = "channel to wire lookup";

//   // test 4: transverse and back
//   var true_transverse = truth.center[0]*truth.vtrans[0] + truth.center[1]*truth.vtrans[1] + truth.center[2]*truth.vtrans[2];
//   var transverse_of_wire = geo.wireToTransverse(tpc,view,wire);
//   var wire_of_transverse = geo.transverseToWire(tpc,view,transverse_of_wire);
//   if(wire_of_transverse != wire ) bad = "transverseToWire doesn't match wireToTransverse";

//   // test 5: direction correct.
//   var along = geo.data.basis.along_vectors[view];
//   var dirdot = (along[0]*truth.direction[0] + along[1]*truth.direction[1] + along[2]*truth.direction[2] );
//   if(Math.abs(dirdot)<0.99) bad = "direction vector doesn't agree";

//   if(!quiet || bad) {
//       console.log("-------------------",index);
//       console.log("Looking at tpc",tpc,"view",view,"wire",wire);
//       console.log("bad:",bad);
//       console.log(truth);
//       console.log("transverse coord:",transverse_of_wire, "true transverse:",true_transverse);

//       console.log("transverseToWire:",wire_of_transverse);
//       console.log("Wire to channel lookup:",my_chan," true channel:",channel);
//       console.log("Channel to wire lookup:",wires_on_channel);
//       console.log("direction vector dot",dirdot);
//       console.log("Endpoint error:",d1,d2);
//       console.log("x1",truth_x1,geowire.x1);
//       console.log("y1",truth_y1,geowire.y1);
//       console.log("z1",truth_z1,geowire.z1);
//       console.log("x2",truth_x2,geowire.x2);
//       console.log("y2",truth_y2,geowire.y2);
//       console.log("z2",truth_z2,geowire.z2);
//   }
//   return bad;
// }
// // test_wire(2500);

// var n = 0;
// for(var i=0; i<allwires.length; i++) {
//   var bad = test_wire(i,true);
//   if(bad) break;
//   n++;
// }

// console.log("checked ",n,"wires");
  
// // Code snippet to drop into an interpreter line.
// if (require.main === module){
//     (function() {
//         var _context = require('repl').start({prompt: '$> '}).context;
//         var scope = require('lexical-scope')(require('fs').readFileSync(__filename));
//         for (var name in scope.locals[''] )
//             _context[scope.locals[''][name]] = eval(scope.locals[''][name]);
//         for (name in scope.globals.exported)
//             _context[scope.globals.exported[name]] = eval(scope.globals.exported[name]);
//     })();
// }