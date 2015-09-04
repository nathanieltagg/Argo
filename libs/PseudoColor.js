//
// Spline interpolation code
// and a spline color interpreter.
//


// For the GL engine, it must satisfy interpolate(x), which gives an rgba color
// for any value of ADC x (between -4096 and 4096)

// For the control scheme, it uses the values below which get manipulated by FalseColorScheme.js
// The ColorDial is a metaphor: colors should change smoothly from -1 to 1 across the
// 'dial'.  This is the perceptual map (possibly circular) which gets changed into 
// color. The ADC scale is NOT linear with perceptual map, but goes through a 
// tangent curve to map nonlinearly, so that very large and very small ADC values
// are de-exaggerated.

function PseudoColor()
{
  this.adcScale = 20; // Rollover point - below this, color is pretty linear with ADC
  this.dialScale = 1;
  this.dialOffset = 0;
  this.saturation = 0.9;
  this.cutoffLow = 0;
  this.cutoffHigh = 0;
  this.color_table = []
} 

// Utility function.
PseudoColor.prototype.HSVtoRGB = function(h, s, v) 
{
      var r, g, b, i, f, p, q, t;
      if (h && s === undefined && v === undefined) {
          s = h.s, v = h.v, h = h.h;
      }
      i = Math.floor(h * 6);
      f = h * 6 - i;
      p = v * (1 - s);
      q = v * (1 - f * s);
      t = v * (1 - (1 - f) * s);
      switch (i % 6) {
          case 0: r = v, g = t, b = p; break;
          case 1: r = q, g = v, b = p; break;
          case 2: r = p, g = v, b = t; break;
          case 3: r = p, g = q, b = v; break;
          case 4: r = t, g = p, b = v; break;
          case 5: r = v, g = p, b = q; break;
      }
      return {
        r: (r * 255),
        g: (g * 255),
        b: (b * 255)
      };
};


PseudoColor.prototype.ColorDialToAdc = function( colorDial )
{
  // colorDial is a number -1 to 1, where 0 is the mid point (0adc)
  // colors change evenly from 0-1 on colordial.
  // adc can legally be -4096 to 4096.
  var adc = Math.tan((colorDial)*Math.PI/2.)*this.adcScale;
  if(adc > this.cutoffLow && adc < this.cutoffHigh) return 0;
  return adc;
}

PseudoColor.prototype.AdcToColorDial = function( adc, no_truncate)
{
  // adc can legally be -4096 to 4096.
  // colorDial is a -1 to +1 number, where 0.5 is the mid point (0adc)
  if(adc > this.cutoffLow && adc < this.cutoffHigh) { 
    if(no_truncate) {} else return 0; // truncate
  }
  return Math.atan((adc)/this.adcScale) / (Math.PI/2.);
}


PseudoColor.prototype.ColorDialToColor = function( colorDial )
{
  var hue = (((colorDial+this.dialOffset)*(-this.dialScale))%1 + 1.0)%1.0;
  return this.HSVtoRGB(hue,this.saturation,1.0);  
}

PseudoColor.prototype.ColorDialToCtxColor = function( colorDial )
{
  var c = this.ColorDialToColor(colorDial);
  return "rgb("+
                        parseInt(c.r)+","+
                        parseInt(c.g)+","+
                        parseInt(c.b)+")";
}

PseudoColor.prototype.interpolate = function(x) {
  var dial = this.AdcToColorDial(x);
  var c = this.ColorDialToColor(dial);
  c.x = x;
  c.a = 255.0;
  return c;
};


///////////////////////////////////////////
// Rainbow. A hue-rotation color scheme.
///////////////////////////////////////////

PsuedoRainbow.prototype = new PseudoColor();
function PsuedoRainbow( )
{
//   this.adcScale = 200;
  this.adcScale = 20; // Rollover point - below this, color is pretty linear with ADC
  this.dialScale = 1;
  this.dialOffset = 0;
  this.hueOffset= 0.2;
  this.saturation = 0.9;
  this.cutoffLow = 0;
  this.cutoffHigh = 0;
}

PsuedoRainbow.prototype.ColorDialToColor = function( colorDial )
{
  var hue = (((colorDial+this.dialOffset)*(-this.dialScale))%1 + (this.hueOffset%1) + 1.0)%1.0;
  return this.HSVtoRGB(hue,this.saturation,1.0);  
}

///////////////////////////////////////////
// Grayscale
///////////////////////////////////////////

PsuedoGrayscale.prototype = new PseudoColor();
function PsuedoGrayscale( )
{
  PseudoColor.call(this);
}
PsuedoGrayscale.prototype.ColorDialToColor = function( colorDial )
{
  var norm = (((colorDial+this.dialOffset)*(-this.dialScale))%1  + 1.5)%1.0;
  
  return { 
    r: norm*255,
    g: norm*255,
    b: norm*255
  }
}

///////////////////////////////////////////
// Linearized Optimal Color Scale. 
// Levkowitz and Herman, IEEE Computer Graphics and Applications, 1992
// 10.1109/MCG.2007.323435 
// http://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=135886
///////////////////////////////////////////


PsuedoLOCS.prototype = new PseudoColor();
function PsuedoLOCS( )
{
  PseudoColor.call(this);
  this.color_table =
  [[0,0,0],[0,0,0],[0,0,0],[1,0,0],[2,0,0],[2,0,0],[3,0,0],[3,0,0],[4,0,0],[5,0,0],[5,0,0],[6,0,0],[7,0,0],[7,0,0],[8,0,0],[9,0,0],[9,0,0],[10,0,0],[11,0,0],[12,0,0],[13,0,0],[14,0,0],[15,0,0],[16,0,0],[17,0,0],[18,0,0],[19,0,0],[20,0,0],[21,0,0],[22,0,0],[23,0,0],[25,0,0],[26,0,0],[27,0,0],[28,0,0],[30,0,0],[31,0,0],[33,0,0],[34,0,0],[35,0,0],[37,0,0],[39,0,0],[40,0,0],[43,0,0],[45,0,0],[46,0,0],[49,0,0],[51,0,0],[53,0,0],[54,0,0],[56,0,0],[58,0,0],[60,0,0],[62,0,0],[64,0,0],[67,0,0],[69,0,0],[71,0,0],[74,0,0],[76,0,0],[80,0,0],[81,0,0],[84,0,0],[86,0,0],[89,0,0],[92,0,0],[94,0,0],[97,0,0],[100,0,0],[103,0,0],[106,0,0],[109,0,0],[112,0,0],[115,0,0],[117,0,0],[122,0,0],[126,0,0],[128,0,0],[131,0,0],[135,0,0],[135,0,0],[135,1,0],[135,2,0],[135,3,0],[135,4,0],[135,6,0],[135,6,0],[135,8,0],[135,9,0],[135,10,0],[135,11,0],[135,13,0],[135,13,0],[135,15,0],[135,17,0],[135,17,0],[135,19,0],[135,21,0],[135,22,0],[135,23,0],[135,25,0],[135,26,0],[135,27,0],[135,29,0],[135,31,0],[135,32,0],[135,33,0],[135,35,0],[135,36,0],[135,38,0],[135,40,0],[135,42,0],[135,44,0],[135,46,0],[135,47,0],[135,49,0],[135,51,0],[135,52,0],[135,54,0],[135,56,0],[135,57,0],[135,59,0],[135,62,0],[135,63,0],[135,65,0],[135,67,0],[135,69,0],[135,72,0],[135,73,0],[135,76,0],[135,78,0],[135,80,0],[135,82,0],[135,84,0],[135,87,0],[135,88,0],[135,90,0],[135,93,0],[135,95,0],[135,98,0],[135,101,0],[135,103,0],[135,106,0],[135,107,0],[135,110,0],[135,113,0],[135,115,0],[135,118,0],[135,121,0],[135,124,0],[135,127,0],[135,129,0],[135,133,0],[135,135,0],[135,138,0],[135,141,0],[135,144,0],[135,148,0],[135,150,0],[135,155,0],[135,157,0],[135,160,0],[135,163,0],[135,166,0],[135,170,0],[135,174,0],[135,177,0],[135,180,0],[135,184,0],[135,188,0],[135,192,0],[135,195,0],[135,200,0],[135,203,0],[135,205,0],[135,210,0],[135,214,0],[135,218,0],[135,222,0],[135,226,0],[135,231,0],[135,236,0],[135,239,0],[135,244,0],[135,249,0],[135,254,0],[135,255,1],[135,255,5],[135,255,10],[135,255,15],[135,255,20],[135,255,23],[135,255,28],[135,255,33],[135,255,38],[135,255,43],[135,255,45],[135,255,49],[135,255,54],[135,255,59],[135,255,65],[135,255,70],[135,255,74],[135,255,80],[135,255,84],[135,255,90],[135,255,95],[135,255,98],[135,255,104],[135,255,110],[135,255,116],[135,255,120],[135,255,125],[135,255,131],[135,255,137],[135,255,144],[135,255,149],[135,255,154],[135,255,158],[135,255,165],[135,255,172],[135,255,179],[135,255,186],[135,255,191],[135,255,198],[135,255,203],[135,255,211],[135,255,216],[135,255,224],[135,255,232],[135,255,240],[135,255,248],[135,255,254],[135,255,255],[140,255,255],[146,255,255],[153,255,255],[156,255,255],[161,255,255],[168,255,255],[172,255,255],[177,255,255],[182,255,255],[189,255,255],[192,255,255],[199,255,255],[204,255,255],[210,255,255],[215,255,255],[220,255,255],[225,255,255],[232,255,255],[236,255,255],[240,255,255],[248,255,255],[255,255,255]];
}

PsuedoLOCS.prototype.ColorDialToColor = function( colorDial )
{
  var norm = (((colorDial+this.dialOffset)*(-this.dialScale))%1  + 1.5)%1.0;
  var entry = Math.floor(norm*255);
  
  return { 
    r: this.color_table[entry][0],
    g: this.color_table[entry][1],
    b: this.color_table[entry][2]
  }
}

///////////////////////////////////////////
// Brightness
// Single color through 'Brightness' value of HSV
///////////////////////////////////////////


PsuedoBrightness.prototype = new PseudoColor();
function PsuedoBrightness( )
{
  PseudoColor.call(this);
}

PsuedoBrightness.prototype.ColorDialToColor = function( colorDial )
{
  var norm = (((colorDial+this.dialOffset)*(-this.dialScale))%1  + 1.5)%1.0;
  return this.HSVtoRGB(this.saturation, // actually hue
                        0.9, // stay fully saturated
                        Math.sqrt(norm));
}


///////////////////////////////////////////
// Blackbody
// http://www.vendian.org/mncharity/dir3/blackbody/
///////////////////////////////////////////


PsuedoBlackbody.prototype = new PseudoColor();
function PsuedoBlackbody( )
{
  PseudoColor.call(this);
  this.color_table = [ 
[255, 51,  0],[255, 69,  0],[255, 82,  0],[255, 93,  0],[255,102,  0],[255,111,  0],[255,118,  0],[255,124,  0],[255,130,  0],[255,135,  0],[255,141, 11],[255,146, 29],[255,152, 41],[255,157, 51],[255,162, 60],[255,166, 69],[255,170, 77],[255,174, 84],[255,178, 91],[255,182, 98],[255,185,105],[255,189,111],[255,192,118],[255,195,124],[255,198,130],[255,201,135],[255,203,141],[255,206,146],[255,208,151],[255,211,156],[255,213,161],[255,215,166],[255,217,171],[255,219,175],[255,221,180],[255,223,184],[255,225,188],[255,226,192],[255,228,196],[255,229,200],[255,231,204],[255,232,208],[255,234,211],[255,235,215],[255,237,218],[255,238,222],[255,239,225],[255,240,228],[255,241,231],[255,243,234],[255,244,237],[255,245,240],[255,246,243],[255,247,245],[255,248,248],[255,249,251],[255,249,253],[254,250,255],[252,248,255],[250,247,255],[247,245,255],[245,244,255],[243,243,255],[241,241,255],[239,240,255],[238,239,255],[236,238,255],[234,237,255],[233,236,255],[231,234,255],[229,233,255],[228,233,255],[227,232,255],[225,231,255],[224,230,255],[223,229,255],[221,228,255],[220,227,255],[219,226,255],[218,226,255],[217,225,255],[216,224,255],[215,223,255],[214,223,255],[213,222,255],[212,221,255],[211,221,255],[210,220,255],[209,220,255],[208,219,255],[207,218,255],[206,217,255],[205,217,255],[204,216,255],[203,215,255],[202,215,255],[202,214,255],[201,214,255],[200,213,255],[199,212,255],[198,212,255],[197,211,255],[196,210,255],[195,210,255],[195,209,255],[194,209,255],[194,208,255],[193,208,255],[192,207,255],[191,207,255],[191,206,255],[190,206,255],[189,205,255],[188,205,255],[188,204,255],[187,204,255],[187,203,255],[186,203,255],[185,202,255],[184,202,255],[184,201,255],[183,201,255],[183,200,255],[182,200,255],[181,199,255],[180,199,255],[180,198,255],[179,198,255],[179,197,255],[178,197,255],[178,196,255],[177,196,255],[176,195,255],[175,194,255],[173,193,255],[172,192,255],[171,191,255],[170,191,255],[170,190,255],[169,190,255],[168,189,255],[166,188,255],[166,187,255],[165,187,255],[165,186,255],[164,186,255],[164,185,255],[163,185,255],[162,184,255],[161,184,255],[161,183,255],[155,188,255]
    ];
}

PsuedoBlackbody.prototype.ColorDialToColor = function( colorDial )
{
  var norm = (((colorDial+this.dialOffset)*(-this.dialScale))%1  + 1.5)%1.0;
  var entry = Math.floor(norm*this.color_table.length);
  
  return { 
    r: this.color_table[entry][0],
    g: this.color_table[entry][1],
    b: this.color_table[entry][2]
  }
}



///////////////////////////////////////////
// Interpolator
///////////////////////////////////////////


PsuedoInterpolator.prototype = new PseudoColor();
function PsuedoInterpolator( n )
{
  PseudoColor.call(this);
  this.color_table = [
    {r:255,g:255,b:255},
    {r:255,g:0,b:0},
    {r:0,g:0,b:255},
    {r:0,g:0,b:0},
    {r:255,g:0,b:0},
    {r:0,g:0,b:255},
    {r:0,g:0,b:0},
    {r:255,g:0,b:0},
    {r:0,g:0,b:255},
    {r:0,g:0,b:0}
  ];
  this.color_table = this.color_table.slice(0,n);
  
  while(n>this.color_table.length) color_table.push( {r:0,g:255,b:0} );

}

PsuedoInterpolator.prototype.ColorDialToColor = function( colorDial )
{
  var norm = (((colorDial+this.dialOffset)*(-this.dialScale))%1  + 1.5)%1.0;
  var x = norm*(this.color_table.length);
  var i1 = Math.floor(x);
  var i2 = i1+1;
  if(i2>= this.color_table.length) i2=0;
  var dx = x-i1;
  return {
    r: this.color_table[i1].r *(1-dx) + this.color_table[i2].r *dx,
    g: this.color_table[i1].g *(1-dx) + this.color_table[i2].g *dx,
    b: this.color_table[i1].b *(1-dx) + this.color_table[i2].b *dx
  };
  
}

/*
//
// Code for using a control point scheme for mapping.
// Works, but control points are awkward compared to
// an algorithmic version. 
//
// Changed code since using this, so renaming would be required.
//
function PseudoColor( control_points ) 
{
  if(control_points === undefined) return;
  // control points is an array of {x: ,r: b: g: a:} values: x, red, blue, green.
  this.control_points = control_points;
  
  
  // Ensure they are sorted in x
  this.control_points.sort(function(a, b) {
      return a.x - b.x;
  });
  
  var xs = [];
  var rs = [];
  var gs = [];
  var bs = [];
  var as = [];
  for(var i=0;i<this.control_points.length;i++) {
    xs.push(this.control_points[i].x);
    rs.push(this.control_points[i].r);
    gs.push(this.control_points[i].g);
    bs.push(this.control_points[i].b);
    as.push(this.control_points[i].a)
    ;
  }
  
  // SplineInterpolator is in GeoUtils.js
  
  this.splineRed   = new SplineInterpolator(xs,rs);
  this.splineGreen = new SplineInterpolator(xs,gs);
  this.splineBlue  = new SplineInterpolator(xs,bs);
  this.splineAlpha = new SplineInterpolator(xs,as);

  this.offset = 0;
};

// Treat as ColorScaler
PseudoColor.prototype.GetColor = function(x) {
  var c = this.interpolate(x);
  if(c.r>255) c.r=255;
  if(c.g>255) c.g=255;
  if(c.b>255) c.b=255;
  var r =  parseInt(c.r)+","+parseInt(c.g)+","+parseInt(c.b);
  return r;  
};

PseudoColor.prototype.interpolate = function(x) {
  var ox = x - this.offset;
  return  {x: x,
          ox: ox,
           r: this.splineRed  .interpolate(ox),
           g: this.splineGreen.interpolate(ox),
           b: this.splineBlue .interpolate(ox),
           a: this.splineAlpha.interpolate(ox),
        };  
};

PseudoColor.prototype.buildTexture = function(gl, pixels, start_x, stop_x) 
{ 
    // Creates an OpenGl texture, returns the texture ID.
    var id = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, id);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var width = pixels;
    var height = 1;
    var array = [];
    for (var i = 0; i < pixels; i++) {
      var x = start_x + (i)*(stop_x-start_x)/pixels; 
      var color = this.interpolate(x);      
      array.splice(array.length, 0, color.r, color.g, color.b, color.a);
    }
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(array));
    return id;
}
  
PseudoColor.prototype.buildCanvas = function(pixels, start_x, stop_x) 
{ 
    // Creates an (offscreen) canvas, returns the canvas.
    var buffer = document.createElement('canvas');
    buffer.width = pixels;
    buffer.height = 1;
    var ctx = buffer.getContext('2d');
    var imgData=ctx.createImageData(pixels,1);
    for (var i=0;i<imgData.data.length;i+=4)
    {
      var x = start_x + (i/4)*(stop_x-start_x)/pixels;
      var color = this.interpolate(x);
      imgData.data[i+0]= color.r;
      imgData.data[i+1]= color.g;
      imgData.data[i+2]= color.b;
      imgData.data[i+3]= color.a;
    }
    ctx.putImageData(imgData,0,0);
    return buffer;
}
  
PseudoColor.prototype.buildImage  = function(pixels, start_x, stop_x) 
{ 
    // creates an image in the form of a base64 string. Inefficient, but useful for debugging
    var buffer = this.buildCanvas(pixels,start_x,stop_x);    
    var dataURL = buffer.toDataURL();
    delete buffer;
    return dataURL;
}

PseudoColor.prototype.HSVtoRGB = function(h, s, v) 
{
      var r, g, b, i, f, p, q, t;
      if (h && s === undefined && v === undefined) {
          s = h.s, v = h.v, h = h.h;
      }
      i = Math.floor(h * 6);
      f = h * 6 - i;
      p = v * (1 - s);
      q = v * (1 - f * s);
      t = v * (1 - (1 - f) * s);
      switch (i % 6) {
          case 0: r = v, g = t, b = p; break;
          case 1: r = q, g = v, b = p; break;
          case 2: r = p, g = v, b = t; break;
          case 3: r = p, g = q, b = v; break;
          case 4: r = t, g = p, b = v; break;
          case 5: r = v, g = p, b = q; break;
      }
      return {
        r: (r * 255),
        g: (g * 255),
        b: (b * 255)
      };
};


PsTest2.prototype = new PseudoColor();
function PsTest2( hue )
{
  if(hue === undefined) hue = 0;
  var points = [];
  var nctl = 256;
  for(var i=0;i<nctl;i++) {
    var x = (Math.atan(((i/nctl)-0.5)/200.)/3.14159) * 8196;
    var xx =i/nctl;
    var h = (xx*0.8 + 1.2 + hue)%1.0;
    // console.log(x,xx,h);
    var s = 0.9;
    var v = 1;
    var pt = this.HSVtoRGB(h,s,v);
    pt.a=255;  pt.x = x;  
    // console.log(pt);
    points.push(pt);
  }
  PseudoColor.call(this,points); // Give settings to PS contructor.
}

*/