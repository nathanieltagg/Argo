kcos60 = Math.cos(Math.PI/3);
ksin60 = Math.sin(Math.PI/3);


gGeo = new Geometry();

function OpDetGeo ()
{
  // This code generated by geometry looter. Run geoloot.fcl, and copy geo_opdet.json here.
  this.opticalDetectors = 
  [{"opdet":0,"chan":0,"x":-5.75,"y":3.22,"z":990.50},{"opdet":1,"chan":1,"x":-5.75,"y":59.10,"z":938.50},{"opdet":2,"chan":2,"x":-5.71,"y":-52.66,"z":938.50},{"opdet":3,"chan":3,"x":-5.75,"y":59.10,"z":898.50},{"opdet":4,"chan":4,"x":-5.71,"y":-52.66,"z":898.50},{"opdet":5,"chan":5,"x":-5.75,"y":3.22,"z":846.50},{"opdet":6,"chan":6,"x":-5.75,"y":3.22,"z":790.50},{"opdet":7,"chan":7,"x":-5.75,"y":59.10,"z":738.50},{"opdet":8,"chan":8,"x":-5.71,"y":-52.66,"z":738.50},{"opdet":9,"chan":9,"x":-5.75,"y":59.10,"z":698.50},{"opdet":10,"chan":10,"x":-5.71,"y":-52.66,"z":698.50},{"opdet":11,"chan":11,"x":-5.75,"y":3.22,"z":646.50},{"opdet":12,"chan":12,"x":-5.75,"y":3.22,"z":590.50},{"opdet":13,"chan":13,"x":-5.75,"y":59.10,"z":538.50},{"opdet":14,"chan":14,"x":-5.71,"y":-52.66,"z":538.50},{"opdet":15,"chan":15,"x":-5.75,"y":59.10,"z":498.50},{"opdet":16,"chan":16,"x":-5.71,"y":-52.66,"z":498.50},{"opdet":17,"chan":17,"x":-5.75,"y":3.22,"z":446.50},{"opdet":18,"chan":18,"x":-5.75,"y":3.22,"z":390.50},{"opdet":19,"chan":19,"x":-5.75,"y":59.10,"z":338.50},{"opdet":20,"chan":20,"x":-5.71,"y":-52.66,"z":338.50},{"opdet":21,"chan":21,"x":-5.75,"y":59.10,"z":298.50},{"opdet":22,"chan":22,"x":-5.71,"y":-52.66,"z":298.50},{"opdet":23,"chan":23,"x":-5.75,"y":3.22,"z":246.50},{"opdet":24,"chan":24,"x":-5.75,"y":3.22,"z":190.50},{"opdet":25,"chan":25,"x":-5.75,"y":59.10,"z":138.50},{"opdet":26,"chan":26,"x":-5.71,"y":-52.66,"z":138.50},{"opdet":27,"chan":27,"x":-5.75,"y":59.10,"z":98.50},{"opdet":28,"chan":28,"x":-5.71,"y":-52.66,"z":98.50},{"opdet":29,"chan":29,"x":-5.75,"y":3.22,"z":46.50}]


  this.opDetByChan = [];
  for(var i=0; i<this.opticalDetectors.length;i++) {
    // this.opticalDetectors[i].z-=30.;
    this.opDetByChan[this.opticalDetectors[i].chan] = this.opticalDetectors[i];
  }
  
  // function OpDetByChannel(chan){ return this.opDetByChan[chan]; } 
  
}

OpDetGeo.prototype.OpDetByChannel = function(chan)
{ return this.opDetByChan[chan]; }


function Geometry()
{
  this.kU = [kcos60, -ksin60];
  this.kV = [kcos60,  ksin60];

  this.opDets = new OpDetGeo();

  // (0.3 cm/wire) / (0.081 cm/tdc)
  this.fTdcWirePitch = 0.3/ 0.0818566; // tdc per wire.

  
  // generated by Looter_module.cc from the offline code.
  // Good for beam trigger, but not other things.
  // fXTicksOffsets[cryostat][tpc][plane]
  this.fXTicksOffsets = [[[
  {
  "cryostat":0,
  "tpc":0,
  "plane":0,
  "offset":0.0000000,
  "coeff":0.0818566
  },
  {
  "cryostat":0,
  "tpc":0,
  "plane":1,
  "offset":3.2958718,
  "coeff":0.0818566
  },
  {
  "cryostat":0,
  "tpc":0,
  "plane":2,
  "offset":6.3746003,
  "coeff":0.0818566
  }]]];
}

Geometry.prototype.viewOfPlane = function(plane)
{
  return 2-plane;
}

Geometry.prototype.planeOfView = function(view)
{
  return 2-view;
}


Geometry.prototype.channelOfWire = function(plane,wire)
{
  switch(plane) {
    case 0: return wire;
    case 1: return wire+2399; 
    case 2: return wire+4798
  }
};

Geometry.prototype.wireOfChannel = function(channel)
{
  if(channel < 2399) return {plane: 0, wire: channel};
  else if(channel <4798) return { plane: 1, wire: channel-2399};
  else return {plane:2, wire: channel-4798};
};


Geometry.prototype.numWires = function(plane)
{
  switch(plane) {
    case 0: return 2398;
    case 1: return 2398;
    case 2: return 3456;
  }
  return 3456;
} 

// Code from Looter_module.cc, inside framework.


Geometry.prototype.getXofTDC = function(plane,tdc)
{
  var calib = this.fXTicksOffsets[0][0][plane];
  if(!calib){
    calib = this.fXTicksOffsets[0][0][0];
    console.warn("getXofTDC failure. ",plane,tdc);
  } 
  return (tdc - calib.offset ) * calib.coeff;
}

Geometry.prototype.getTDCofX = function(plane,x)
{
  var calib = this.fXTicksOffsets[0][0][plane];
  return (x / calib.coeff +  calib.offset );
}

// Code automagically generated by fitgeo.C 
  // Code automagically generated by fitgeo.C 
Geometry.prototype.getWire = function(plane,wire) 
{ 
  var r={};
  switch(plane) {
    case 0:
      r.cx = 0.000;
      if(wire<671) {
        r.section = 0;
        r.cy = 117.277+wire*(-0.173);
        r.cz = 0.350+wire*(0.300);
        r.y1 = 117.194+wire*(-0.346);
        r.y2 = 117.360;
        r.z1 = 0.206;
        r.z2 = 0.494+wire*(0.600);
        r.halfl = 0.166+wire*(0.346);
        r.thetaz = 0.524;
      } else if(wire<1727) {
        r.section = 1;
        r.cy = 0.970;
        r.cz = -201.100+wire*(0.600);
        r.y1 = -115.523;
        r.y2 = 117.463;
        r.z1 = -402.871+wire*(0.600);
        r.z2 = 0.671+wire*(0.600);
        r.halfl = 232.985;
        r.thetaz = 0.524;
      } else {
        r.section = 2;
        r.cy = 300.182+wire*(-0.173);
        r.cz = 317.150+wire*(0.300);
        r.y1 = -115.420;
        r.y2 = 715.784+wire*(-0.346);
        r.z1 = -402.694+wire*(0.600);
        r.z2 = 1036.994;
        r.halfl = 831.204+wire*(-0.346);
        r.thetaz = 0.524;
      }
    break; 
    case 1:
      r.cx = -0.300;
      if(wire<671) {
        r.section = 0;
        r.cy = -115.337+wire*(0.173);
        r.cz = 0.150+wire*(0.300);
        r.y1 = -115.420;
        r.y2 = -115.254+wire*(0.346);
        r.z1 = 0.294+wire*(0.600);
        r.z2 = 0.006;
        r.halfl = 0.166+wire*(0.346);
        r.thetaz = 2.618;
      } else if(wire<1727) {
        r.section = 1;
        r.cy = 0.970;
        r.cz = -201.300+wire*(0.600);
        r.y1 = -115.523;
        r.y2 = 117.463;
        r.z1 = 0.471+wire*(0.600);
        r.z2 = -403.071+wire*(0.600);
        r.halfl = 232.985;
        r.thetaz = 2.618;
      } else {
        r.section = 2;
        r.cy = -298.242+wire*(0.173);
        r.cz = 316.950+wire*(0.300);
        r.y1 = -713.844+wire*(0.346);
        r.y2 = 117.360;
        r.z1 = 1036.793;
        r.z2 = -402.893+wire*(0.600);
        r.halfl = 831.204+wire*(-0.346);
        r.thetaz = 2.618;
      }
    break; 
    case 2:
      r.cx = -0.600;
        r.section = 0;
        r.cy = 0.970;
        r.cz = 0.150+wire*(0.300);
        r.y1 = -115.530;
        r.y2 = 117.470;
        r.z1 = 0.150+wire*(0.300);
        r.z2 = 0.150+wire*(0.300);
        r.halfl = 116.500;
        r.thetaz = 1.571;
    break; 
  }
  return r;
}


  // Code automagically generated by fitgeo.C 
Geometry.prototype.yzToWire = function(plane,y,z)
{
 switch(plane) {
   case 0:
      var trans= this.kU[0]*z + this.kU[1]*y;
      var wire = 337.50194+trans*(3.33332);
      break;
   case 1:
      var trans= this.kV[0]*z + this.kV[1]*y;
      var wire = 332.16920+trans*(3.33333);
      break;
   case 2:
      var wire = -1.16434+z*(3.33333);
      break;
 }
  return Math.round(wire);
}

