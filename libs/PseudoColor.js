//
// Spline interpolation code
// and a spline color interpreter.
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

};

PseudoColor.prototype.interpolate = function(x) {
  return  {x: x,
           r: this.splineRed  .interpolate(x),
           g: this.splineGreen.interpolate(x),
           b: this.splineBlue .interpolate(x),
           a: this.splineAlpha.interpolate(x),
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

PseudoColor.prototype.HSVtoRGB = function(h, s, v, x) 
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
        x: x, 
        r: (r * 255),
        g: (g * 255),
        b: (b * 255)
      };
};



// Subclass.
PsTest.prototype = new PseudoColor();
function PsTest(  )
{
  var points = [];
  var nctl = 256;
  for(var i=0;i<nctl;i++) {
    var x = (Math.atan(((i/nctl)-0.5)/200.)/3.14159) * 8196;
    var xx =i/nctl;
    var h = (xx*0.8 + 1.2)%1.0;
    // console.log(x,xx,h);
    var s = 0.9;
    var v = 1;
    var pt = this.HSVtoRGB(h,s,v,x);
    pt.a=255;    // console.log(pt);
    points.push(pt);
  }
  PseudoColor.call(this,points); // Give settings to PS contructor.
}


// Test code
// var ps = new PseudoColor (  [
//     {x:-4096, r: 255, g: 46,  b:53,  a:255},
//     {x:-2730, r: 255, g: 178, b:17,  a:255},
//     {x:-1366, r: 233, g: 255, b:0,   a:255},
//     {x: 1366, r: 21,  g: 255, b:57,  a:255},
//     {x: 2730, r: 66 , g: 178, b:255, a:255},
//     {x: 4096, r: 104, g: 93,  b:255, a:255}
//   ] );


