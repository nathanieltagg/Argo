
//
// Code to handle 2d openGL manipulations.
//

function GLEngine( canvas )
{
  // If a canvas is provided, use it.
  // Otherwise, create an offscreen canvas.
  if(canvas) { 
    this.canvas = canvas;
  } else {
    this.canvas = document.createElement( 'canvas' );
    this.canvas.width = 256;  // Fixme?
    this.canvas.height = 256;
  }

  try {
    this.gl = this.canvas.getContext('experimental-webgl');    
  } catch(e) 
  {
    console.error("Cannot crate WebGL context: "  + e.toString());
  }
   
}


GLEngine.prototype.create_shader = function( scriptId  )
{
  var shaderSource = "";
  var shaderType;
  var shaderScript = document.getElementById(scriptId);
  if (!shaderScript) {
    throw("*** Error: unknown script element" + scriptId);
  }

  shaderSource = shaderScript.text;
  if (shaderScript.type == "x-shader/x-vertex") {
    shaderType = this.gl.VERTEX_SHADER;
  } else if (shaderScript.type == "x-shader/x-fragment") {
    shaderType = this.gl.FRAGMENT_SHADER;
  } else if (shaderType != this.gl.VERTEX_SHADER && shaderType != this.gl.FRAGMENT_SHADER) {
    throw("*** Error: unknown shader type");
    return null;
  }

   // Create the shader object
   var shader = this.gl.createShader(shaderType);

   // Load the shader source
   this.gl.shaderSource(shader, shaderSource);

   // Compile the shader
   this.gl.compileShader(shader);

   // Check the compile status
   var compiled = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);

   if (!compiled) {
     // Something went wrong during compilation; get the error
     lastError = this.gl.getShaderInfoLog(shader);
     console.error("*** Error compiling shader ",shader, ":" ,lastError);
     this.gl.deleteShader(shader);
     return null;
   }

   return shader;
} 



GLEngine.prototype.build_LUT_canvas = function( pseudocolor, start_x, stop_x ) 
{     
  // Creates an OpenGl texture, returns the texture ID.
  // This version builds a 2d 256x256 texture.
  // Colors go top-to-bottom (most sigificant changes) and left-to-right (least significant)
  // This forms a full 256x256 lookup table usable by the shader.
  // I _think_ that this would work with smaller resolution, but color changes at small ADC value wont' be visable.
  var canvas = document.createElement("canvas");
  canvas.width  = 256;
  canvas.height = 256;
  var pixels = canvas.width*canvas.height;
  var ctx = canvas.getContext('2d');
  var imgData=ctx.createImageData(canvas.width,canvas.height);
  var len = imgData.data.length;
  for (var i=0;i<len;i+=4) {
    var x = start_x + (i/4.)*(stop_x-start_x)/pixels; 
    var color = pseudocolor.interpolate(x);      
    imgData.data[i+0]= color.r;
    imgData.data[i+1]= color.g;
    imgData.data[i+2]= color.b;
    imgData.data[i+3]= color.a;
  }
  ctx.putImageData(imgData,0,0);
  return canvas;
}

GLEngine.prototype.texture_from_canvas  = function(canvas, is_power_of_two) 
{
  var gl = this.gl; 
  // Creates an OpenGl texture, returns the texture ID.
  var id = gl.createTexture();
  this.gl.bindTexture(this.gl.TEXTURE_2D, id);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  if(is_power_of_two !== true) { 
    // Don't think I need this since it's a square texture at a power-of-two
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
  return id;
}

GLEngine.prototype.build_LUT_texture = function( pseudocolor, start_x, stop_x ) 
{ 
  return this.texture_from_canvas( 
    this.build_LUT_canvas( pseudocolor, start_x, stop_x ) ,true
  );
}


GLEngine.prototype.draw_to_rect = function( x, y, width, height, positionLocation ) 
{
  // Create a buffer for the position of the rectangle corners we're drawing INTO.
  var buffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
  this.gl.enableVertexAttribArray(positionLocation);
  this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
  // Set a rectangle the same size as the image.
  // setRectangle(gl, 0, 0, image.width, image.height);
  var x1 = x;
  var x2 = x + width;
  var y1 = y;
  var y2 = y + height;
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
     x1, y1,
     x2, y1,
     x1, y2,
     x1, y2,
     x2, y1,
     x2, y2]), this.gl.STATIC_DRAW);

  // Draw the rectangle.
  this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  
}


GLEngine.prototype.draw_falsecolor_lookup = function(incanvas, pseudocolor, tilesize) 
{
  console.time('GLEngine::draw_falsecolor_lookup');

  // For simplicity
  var gl = this.gl;
  
  // setup GLSL this.program
  var vertexShader = this.create_shader( "2d-vertex-shader");
  var LUTShader    = this.create_shader( "lutshade");

  this.program = gl.createProgram();
  gl.attachShader(this.program,vertexShader);
  gl.attachShader(this.program,LUTShader);
  gl.linkProgram(this.program);

  // Check the link status
  var linked = gl.getProgramParameter(this.program, gl.LINK_STATUS);
  if (!linked) {
       // something went wrong with the link
       lastError = gl.getProgramInfoLog (this.program);
       console.error("Error in this.program linking:" + lastError);

       gl.deleteProgram(this.program);
       return null;
   }


  gl.useProgram(this.program);

  // look up where the vertex data needs to go.
  this.positionLocation = gl.getAttribLocation(this.program, "a_position");  // Get a pointer to the a_position input given to the vertex shader fragment in the this.program.
  this.texCoordLocation = gl.getAttribLocation(this.program, "a_texCoord");  // Ditto a_texCoord

  // provide texture coordinates for the rectangle we're drawing FROM
  this.texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0.0,  0.0,
      1.0,  0.0,
      0.0,  1.0,
      0.0,  1.0,
      1.0,  0.0,
      1.0,  1.0]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(this.texCoordLocation);
  gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);



  console.time('Build LUT');  
  var mapTextureLocation = gl.getUniformLocation(this.program, "maptexture");
  gl.uniform1i(mapTextureLocation, 7);
  gl.activeTexture(gl.TEXTURE7);

  var lutTextureId = this.build_LUT_texture(pseudocolor,-4095,4096);
  gl.bindTexture(gl.TEXTURE_2D, lutTextureId);
  console.timeEnd('Build LUT');

  // lookup uniforms
  this.resolutionLocation = gl.getUniformLocation(this.program, "u_resolution");
  gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
  console.log("setting resolution to ",this.canvas.width, this.canvas.height);

  // Create an input texture id.
  

  // Now time to draw some tiles.
  var tileCanvas = document.createElement('canvas');
  
  // Figure out how many tiles we want to use:
  var nx = Math.ceil(incanvas.width / tilesize);
  var ny = Math.ceil(incanvas.height / tilesize);
  for(ix = 0; ix<nx; ix++) {
    for (iy =0; iy< ny; iy++) {
      console.time('Build tile');
      
      // Copy rect coordinates:
      var x = ix*tilesize;
      var y = iy*tilesize;
      var w = Math.min(tilesize, incanvas.width-x);
      var h = Math.min(tilesize, incanvas.height-y);
      
      var inputTextureLocation = gl.getUniformLocation(this.program, "texture");      
      gl.uniform1i(inputTextureLocation, 1); // use TEXTURE1 as your input!
      
      // Create an input texture from the wire readout
      var textureId = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);  // or gl.TEXTURE0 + 7
      gl.bindTexture(gl.TEXTURE_2D, textureId);
      // Set the parameters so we can render any size image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      
      tileCanvas.width = w;
      tileCanvas.height = h;

      var ctx = tileCanvas.getContext('2d');
      ctx.drawImage(incanvas, x, y, w, h, 0,0,w,h);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tileCanvas);  

      console.timeEnd('Build tile');
      console.time('draw tile');
      this.draw_to_rect(x,y,w,h,this.positionLocation);
      console.timeEnd('draw tile');
      
    }
  }
  console.timeEnd('GLEngine::draw_falsecolor_lookup');
  
}


GLEngine.prototype.draw_falsecolor_from_images = function(urlarray, pseudocolor) 
{
  this.tile_urls = urlarray;
  
  console.time('GLEngine::draw_falsecolor_from_images');

  // For simplicity
  var gl = this.gl;
  
  // Get the images. 
  this.tile_images = []; 
  var self = this;
  
  var total_width = 0;
  var total_height = 0;

  for(var irow=0;irow<this.tile_urls.length;irow++) {
    var row_width = 0;
    var row_height = 0;
    var row = this.tile_urls[irow];
    var imagerow = [];      
    for(var icol=0;icol<row.length;icol++) {
      var elem = this.tile_urls[irow][icol];
      var image_url = elem.url;
      var img = new Image();
      img.src = image_url;
      imagerow.push(img);
      (function(){  // Make a closure to copy the values of irow and icol
        var jrow = irow;
        var jcol = icol;
        console.log("setting callback for",jrow,jcol);        
        img.onload= function() { self.draw_one_tile(jrow,jcol); }
      })();
      row_height = Math.max(elem.height,row_height);
      row_width  += elem.width;
    }
    total_height += row_height;
    total_width  = Math.max(row_width,total_width);
    this.tile_images.push(imagerow);
  }    

  this.canvas.width = total_width;
  this.canvas.height = total_height;
  // I don't THINK there could be a race condition: I don't think those callbacks activate until after this function has returned 
  // and we get back to the event loop.
    
  // setup GLSL this.program
  var vertexShader = this.create_shader( "2d-vertex-shader");
  var LUTShader    = this.create_shader( "lutshade");

  this.program = gl.createProgram();
  gl.attachShader(this.program,vertexShader);
  gl.attachShader(this.program,LUTShader);
  gl.linkProgram(this.program);

  // Check the link status
  var linked = gl.getProgramParameter(this.program, gl.LINK_STATUS);
  if (!linked) {
       // something went wrong with the link
       lastError = gl.getProgramInfoLog (this.program);
       console.error("Error in this.program linking:" + lastError);

       gl.deleteProgram(this.program);
       return null;
   }


  gl.useProgram(this.program);

  // look up where the vertex data needs to go.
  this.positionLocation = gl.getAttribLocation(this.program, "a_position");  // Get a pointer to the a_position input given to the vertex shader fragment in the this.program.
  this.texCoordLocation = gl.getAttribLocation(this.program, "a_texCoord");  // Ditto a_texCoord

  // provide texture coordinates for the rectangle we're drawing FROM
  this.texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0.0,  0.0,
      1.0,  0.0,
      0.0,  1.0,
      0.0,  1.0,
      1.0,  0.0,
      1.0,  1.0]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(this.texCoordLocation);
  gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);



  console.time('Build LUT');  
  var mapTextureLocation = gl.getUniformLocation(this.program, "maptexture");
  gl.uniform1i(mapTextureLocation, 7);
  gl.activeTexture(gl.TEXTURE7);

  var lutTextureId = this.build_LUT_texture(pseudocolor,-4095,4096);
  gl.bindTexture(gl.TEXTURE_2D, lutTextureId);
  console.timeEnd('Build LUT');

  // lookup uniforms
  this.resolutionLocation = gl.getUniformLocation(this.program, "u_resolution");
  gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);

  $(this.canvas).css("border","solid black 1px");
  $('body').prepend(this.canvas);
}

GLEngine.prototype.draw_one_tile = function(irow, icol) 
{
  var gl = this.gl;
  console.time('draw_one_tile');
  
  var elem = this.tile_urls[irow][icol];
  var img = this.tile_images[irow][icol];
      
  var inputTextureLocation = gl.getUniformLocation(this.program, "texture");      
  gl.uniform1i(inputTextureLocation, 1); // use TEXTURE1 as your input!
      
  // Create an input texture from the wire readout
  var textureId = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);  // or gl.TEXTURE0 + 7
  gl.bindTexture(gl.TEXTURE_2D, textureId);
  // Set the parameters so we can render any size image.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);  

  this.positionLocation = gl.getAttribLocation(this.program, "a_position");  // Get a pointer to the a_position input given to the vertex shader fragment in the this.program.

  console.time('draw tile');
  console.log("drawing tile ",elem);
  this.draw_to_rect(elem.x,elem.y,elem.width,elem.height,this.positionLocation);
  console.timeEnd('draw tile');
  console.timeEnd('draw_one_tile');
  
}

$(function(){
  // gStateMachine.Bind('recordChange',go_gl);
});

function go_gl_stitch()
{
  console.warn("go_gl");
  ps = new PsTest();
  var incanvas = gRecord._raw_tiled_canvas.offscreenCanvas;
  gle = new GLEngine ;
  gle.canvas.height = incanvas.height; gle.canvas.width = incanvas.width;
  gle.draw_falsecolor_lookup(incanvas, ps, gle.gl.getParameter(gle.gl.MAX_TEXTURE_SIZE)/4);
}


function go_gl()
{
  console.warn("go_gl");
  
  ps = new PsTest();
  
  gle = new GLEngine ;
  gle.draw_falsecolor_from_images(gRecord.raw.DAQ.wireimg_encoded_tiles, ps);
}


// function go_gl()
// {
//   ps = new PsTest();
//   // var incanvas = gRecord._raw_tiled_canvas.offscreenCanvas;
//   gle = new GLEngine ;
//   gle.canvas.height = incanvas.height; gle.canvas.width = incanvas.width;
//   gle.draw_falsecolor_lookup(incanvas, ps, gle.gl.getParameter(gle.gl.MAX_TEXTURE_SIZE)/2);
// }
  

