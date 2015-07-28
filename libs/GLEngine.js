

$(function(){
  gGLMapperRaw = new GLMapper('raw');
  gGLMapperCal = new GLMapper('cal');

  // gStateMachine.Bind('ChangePsuedoColor',function(){
  //   this.show_image = $(this.ctl_wireimg_type).filter(":checked").val() || "raw";
  //   var objnm = '_' + this.show_image;
  //   UpdateColoredWireMap(objnm);
  // });
});

function GLMapper(typ) // "raw" or "cal"
{
  this.typ = typ; 
  
  // Create openGL engine.
  this.tilesize = 2048; // Will be overwritten later.
  this.renderCanvas = document.createElement('canvas');
  this.renderCanvas.width = this.tilesize;
  this.renderCanvas.height = this.tilesize;

  
  console.time("GLEngine::create gl context");
  try {
    this.gl = this.renderCanvas.getContext('webgl',{ alpha: false, antialias: false,  depth: false });    
  } catch(e) 
  {
    console.error("Cannot crate WebGL context: "  + e.toString());
    return;
  }
  console.timeEnd("GLEngine::create gl context");
  if(!this.gl) {
    console.error("Lost GL context somewhere.");
  }
    
   // This line is required if we change canvas size
  // after creating GL context
  // this.gl.viewport(0,0,outcanvas.width,outcanvas.height);
  
  // setup GLSL this.program
  var vertexShader = this.create_shader( "2d-vertex-shader");
  var LUTShader    = this.create_shader( "lutshade");

  this.program = this.gl.createProgram();
  this.gl.attachShader(this.program,vertexShader);
  this.gl.attachShader(this.program,LUTShader);
  this.gl.linkProgram(this.program);

  // Check the link status
  var linked = this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS);
  if (!linked) {
       // something went wrong with the link
       lastError = this.gl.getProgramInfoLog (this.program);
       console.error("Error in this.program linking:" + lastError);

       this.gl.deleteProgram(this.program);
       return null;
   }


  this.gl.useProgram(this.program);


  // provide texture coordinates for the rectangle we're drawing FROM
  var texCoordBuffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      0.0,  0.0,
      1.0,  0.0,
      0.0,  1.0,
      0.0,  1.0,
      1.0,  0.0,
      1.0,  1.0]), this.gl.STATIC_DRAW);
  var texCoordLocation = this.gl.getAttribLocation(this.program, "a_texCoord");  // Ditto a_texCoord
  this.gl.enableVertexAttribArray(texCoordLocation);
  this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

  // Space to hold image tiles.
  this.tile_images = [];
  this.loaded = false;
  var total_width = 0;
  var total_height = 0;
  this.num_images_loaded = 0;
  this.num_images_needed = 0;
  
  
  // Space to hold textures.
  this.tile_textures = [];

  gStateMachine.Bind('recordChange',this.NewRecord.bind(this));
  gStateMachine.Bind('ChangePsuedoColor',this.Render.bind(this));

}

GLMapper.prototype.NewRecord = function()
{
  if(!gRecord) return;
  
  
  for(product in gRecord[this.typ]) {
    // Create a tiled image to hold this raw data.
    if(gRecord[this.typ][product]) {
      this.tile_urls= gRecord[this.typ][product].wireimg_encoded_tiles;
      if(this.tile_urls) this.StartLoad();
    }    
  }
}

GLMapper.prototype.StartLoad = function()
{
  // FIXME Could explicitly delete images and textures - might improve GPU memory, but not required.
  this.tile_images = [];
  this.tile_textures = [];
  
  console.time("TiledImageCanvas.begin_loading");
  var self = this;
  
  this.total_width = 0;
  this.total_height = 0;
  this.num_images_loaded = 0;
  this.num_images_needed = 0;

  for(var irow=0;irow<this.tile_urls.length;irow++) {
    var row_width = 0;
    var row_height = 0;
    var row = this.tile_urls[irow];
    var imagerow = [];
    var texturerow = [];
    for(var icol=0;icol<row.length;icol++) {
      this.num_images_needed++
      var elem = this.tile_urls[irow][icol];
      var image_url = elem.url;
      var img = new Image();
      img.src = image_url;
      imagerow.push(img);
      texturerow.push(this.gl.createTexture());
      (function(){  // Make a closure to copy the values of irow and icol
        var jrow = irow;
        var jcol = icol;
        console.log("setting callback for",jrow,jcol);        
        img.onload= function() { self.ImageLoaded(jrow,jcol); }
      })();
      row_height = Math.max(elem.height,row_height);
      row_width  += elem.width;
    }
    this.total_height += row_height;
    this.total_width  = Math.max(row_width,this.total_width);
    this.tile_images.push(imagerow);
    this.tile_textures.push(texturerow);
  }
}

GLMapper.prototype.ImageLoaded = function(jrow,jcol)
{
  console.time("GLMapper::ImageLoaded: one image");
  //Draw in this particular item.
  var elem = this.tile_urls[jrow][jcol];
  var img = this.tile_images[jrow][jcol];
  var tex = this.tile_textures[jrow][jcol];

  // Load the texture...
  
  this.gl.activeTexture(this.gl.TEXTURE0); // Set active unit
  this.gl.bindTexture(this.gl.TEXTURE_2D,tex); // bind our texture to the unit.
  
  // Always use nearest pixel, NO INTERPOLATION:
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
  // Always use nearest pixe, EVEN IF OVER THE EDGE (also solves non-power-of-two)
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
  this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);

  console.timeEnd("GLMapper::ImageLoaded: one image");
  this.num_images_loaded++;
    
  // See if we have them all...
  var loaded = true;
  for(var irow=0;irow<this.tile_images.length;irow++) {
    for(var icol=0;icol<this.tile_images[irow].length;icol++) {
      var elem = this.tile_urls[irow][icol];
      var img = this.tile_images[irow][icol];
      if( !(img.complete) ) loaded = false;
    }
  }
  this.loaded = loaded;
  if(!loaded) return;

  console.log("TiledImageCanvas loaded",this.name);
  this.Render();
}

GLMapper.prototype.build_LUT_texture = function( ) 
{ 
  
  // Creates an OpenGl texture, returns the texture ID.
  // This version builds a 2d 256x256 texture.
  // Colors go top-to-bottom (most sigificant changes) and left-to-right (least significant)
  // This forms a full 256x256 lookup table usable by the shader.
  // Note that range of values accessible is only -4096 to 4096, (-0x1000 to 0x1000), so only needs 0x2000 values out of 0x10000 pixels
  // in a 256x256 image. So, only fills 1/8 of image space. Need to push it up 
  // I _think_ that this would work with smaller resolution, but color changes at small ADC value wont' be visable.
  var canvas = document.createElement("canvas");
  canvas.width  = 256;
  canvas.height = 256;
  var start_x = -0x1000;
  var stop_x =   0x1000
  var pixels = 0x2000; // Total pixels possible from -4096 to 4096
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0,0,256,256);
  var imgData=ctx.createImageData(256,32); // 256*16 = 8192 = 0x2000 possible values.
  var len = imgData.data.length;
  for (var i=0;i<len;i+=4) {
    var x = start_x + (i/4.)*(stop_x-start_x)/pixels; 
    var color = gWirePseudoColor.interpolate(x);      
    imgData.data[i+0]= color.r;
    imgData.data[i+1]= color.g;
    imgData.data[i+2]= color.b;
    imgData.data[i+3]= color.a;
  }
  ctx.putImageData(imgData,0,112); // Shift up 7/16ths to center it correctly.

    
  // Creates an OpenGl texture, returns the texture ID.
  if(this.LUT_texture)  this.gl.deleteTexture(this.LUT_texture);
  this.LUT_texture = this.gl.createTexture();
  this.gl.activeTexture(this.gl.TEXTURE7); // Set active unit to 1
  this.gl.bindTexture(this.gl.TEXTURE_2D, this.LUT_texture);

  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
  this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
  this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
}

GLMapper.prototype.Render = function()
{
  console.log('GLMapper::Render');
  console.time('GLMapper::Render');

  // copy the output canvas to the gRecord so others can get at it.
  var utyp = '_' + this.typ;
  if(!gRecord[utyp]) gRecord[utyp] = {};
  if(!gRecord[utyp].colored_wire_canvas) gRecord[utyp].colored_wire_canvas = this.renderCanvas;  

  this.renderCanvas.width  = this.total_width;
  this.renderCanvas.height = this.total_height;


  var gl = this.gl; // for convenience

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(this.program, "a_position");  // Get a pointer to the a_position input given to the vertex shader fragment in the this.program.

  console.time('Build LUT');  
  var mapTextureLocation = gl.getUniformLocation(this.program, "maptexture");
  this.build_LUT_texture();
  gl.uniform1i(mapTextureLocation, 7);
  gl.bindTexture(gl.TEXTURE_2D, this.LUT_texture);
  console.timeEnd('Build LUT');

  // lookup uniforms
  var resolutionLocation = gl.getUniformLocation(this.program, "u_resolution");
  
  var inputTextureLocation = gl.getUniformLocation(this.program, "texture");      
  gl.uniform1i(inputTextureLocation, 1); // use TEXTURE1 as your input!
  
  var resolutionLocation = gl.getUniformLocation(this.program, "u_resolution");
  
  // loop textures.
  for(var irow=0;irow<this.tile_textures.length;irow++) {
    for(var icol=0;icol<this.tile_textures[irow].length;icol++) {
      var elem = this.tile_urls[irow][icol];
      var tex = this.tile_textures[irow][icol];
      var x = elem.x;
      var y = elem.y;
      var w = elem.width;
      var h = elem.height;
      gl.uniform2f(resolutionLocation, elem.width, elem.height);  
      
      this.gl.viewport(elem.x, elem.y, elem.width, elem.height);
      gl.activeTexture(gl.TEXTURE1);        
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform2f(resolutionLocation, elem.width, elem.height);
      this.RenderToRect(0,0,elem.width,elem.height,positionLocation);
      
      
    }
  }
  
  console.timeEnd('GLMapper::Render');
  console.log("Time to finish drawing via full-canvas:", performance.now() - gTimeStats_RecordChange);
  console.log("Time from start of query:", performance.now() - gTimeStats_StartQuery);
  gStateMachine.Trigger('colorWireMapsChanged');
}


GLMapper.prototype.RenderToRect = function( x, y, width, height, positionLocation ) 
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

  // Clean up
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  this.gl.deleteBuffer(buffer);
}


GLMapper.prototype.create_shader = function( scriptId  )
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

//
// Code to handle 2d openGL manipulations.
//

// $(function(){
//   gGLEngine = new GLEngine();
//   gStateMachine.Bind('TiledImageLoaded_raw',function(){ UpdateColoredWireMap("_raw"); });
//   gStateMachine.Bind('TiledImageLoaded_cal',function(){ UpdateColoredWireMap("_cal"); });
//
//   gStateMachine.Bind('ChangePsuedoColor',function(){
//     this.show_image = $(this.ctl_wireimg_type).filter(":checked").val() || "raw";
//     var objnm = '_' + this.show_image;
//     UpdateColoredWireMap(objnm);
//   });
// });
//
// function UpdateColoredWireMap(typ)
// {
//
//   // console.log("UpdateColoredWireMap",typ);
//   // Create the LUT-translated colored wiremaps images.
//   if(!gRecord) return;
//   // FIXME: assumes only 1 type of raw or cal wires in any given loaded event.
//   if(gRecord[typ] && gRecord[typ].tiled_canvas) {
//     gRecord[typ].colored_wire_canvas = document.createElement('canvas');
//     gRecord[typ].colored_wire_canvas.width = gRecord[typ].tiled_canvas.canvas.width;
//     gRecord[typ].colored_wire_canvas.height = gRecord[typ].tiled_canvas.canvas.height;
//     // Does this help the aw snaps? No, no it doesn't.
//     // gGLEngine = null;
//     // gGLEngine = new GLEngine();
//     gGLEngine.draw_falsecolor_from_canvas(
//                        gRecord[typ].tiled_canvas.canvas,
//                        gRecord[typ].colored_wire_canvas,
//                        gWirePseudoColor
//       );
//   }
//   gStateMachine.Trigger('colorWireMapsChanged');
//
// };
//
//



function GLEngine( tilesize )
{
  // Create a workspace render canvas.
  this.tilesize = tilesize || 2048;
  this.renderCanvas = document.createElement('canvas');
  this.renderCanvas.width = this.tilesize;
  this.renderCanvas.height = this.tilesize;
 
  console.time("GLEngine::create gl context");
  try {
    this.gl = this.renderCanvas.getContext('webgl',{ alpha: false, antialias: false,  depth: false });    
  } catch(e) 
  {
    console.error("Cannot crate WebGL context: "  + e.toString());
    return;
  }
  console.timeEnd("GLEngine::create gl context");


  // For simplicity
  var gl = this.gl;
  
  if(!this.gl) {
    console.error("Lost GL context somewhere.");
  }
    
   // This line is required if we change canvas size
  // after creating GL context
  // this.gl.viewport(0,0,outcanvas.width,outcanvas.height);
  
  // setup GLSL this.program
  var vertexShader = this.create_shader( "2d-vertex-shader");
  var LUTShader    = this.create_shader( "lutshade");

  this.program = gl.createProgram();
  gl.attachShader(this.program,vertexShader);
  gl.attachShader(this.program,LUTShader);
  gl.linkProgram(this.program);

  // Check the link status
  var linked = gl.getProgramParameter(this.program, gl.LINK_STATUS);
  if (!linked) {kl
       // something went wrong with the link
       lastError = gl.getProgramInfoLog (this.program);
       console.error("Error in this.program linking:" + lastError);

       gl.deleteProgram(this.program);
       return null;
   }


  gl.useProgram(this.program);


  // provide texture coordinates for the rectangle we're drawing FROM
  var texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0.0,  0.0,
      1.0,  0.0,
      0.0,  1.0,
      0.0,  1.0,
      1.0,  0.0,
      1.0,  1.0]), gl.STATIC_DRAW);
  var texCoordLocation = gl.getAttribLocation(this.program, "a_texCoord");  // Ditto a_texCoord
  gl.enableVertexAttribArray(texCoordLocation);
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

   
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
  // Note that range of values accessible is only -4096 to 4096, (-0x1000 to 0x1000), so only needs 0x2000 values out of 0x10000 pixels
  // in a 256x256 image. So, only fills 1/8 of image space. Need to push it up 
  // I _think_ that this would work with smaller resolution, but color changes at small ADC value wont' be visable.
  var canvas = document.createElement("canvas");
  canvas.width  = 256;
  canvas.height = 256;
  var pixels = 0x2000; // Total pixels possible from -4096 to 4096
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0,0,256,256);
  var imgData=ctx.createImageData(256,32); // 256*16 = 8192 = 0x2000 possible values.
  var len = imgData.data.length;
  for (var i=0;i<len;i+=4) {
    var x = start_x + (i/4.)*(stop_x-start_x)/pixels; 
    var color = pseudocolor.interpolate(x);      
    imgData.data[i+0]= color.r;
    imgData.data[i+1]= color.g;
    imgData.data[i+2]= color.b;
    imgData.data[i+3]= color.a;
  }
  ctx.putImageData(imgData,0,112); // Shift up 7/16ths to center it correctly.
  return canvas;
}

GLEngine.prototype.texture_from_canvas  = function(canvas) 
{
  var gl = this.gl; 
  // Creates an OpenGl texture, returns the texture ID.
  var id = gl.createTexture();
  this.gl.bindTexture(this.gl.TEXTURE_2D, id);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

  function ispoweroftwo(x) { return (x & (x-1)) ==0; }
  
  if((canvas.width == canvas.height) && ispoweroftwo(canvas.width)) {
  } else {
    // Don't think I need this since it's a square texture at a power-of-two
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
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

  // Clean up
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  this.gl.deleteBuffer(buffer);
}


GLEngine.prototype.draw_falsecolor_from_canvas = function(incanvas, outcanvas, pseudocolor) 
{
  console.log('GLEngine::draw_falsecolor_from_canvas');
  
  console.time('GLEngine::draw_falsecolor_from_canvas');


  var gl = this.gl; // for convenience

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(this.program, "a_position");  // Get a pointer to the a_position input given to the vertex shader fragment in the this.program.

  console.time('Build LUT');  
  var mapTextureLocation = gl.getUniformLocation(this.program, "maptexture");
  gl.uniform1i(mapTextureLocation, 7);
  gl.activeTexture(gl.TEXTURE7);
  var lutTextureId = this.build_LUT_texture(pseudocolor,-4096,4096);
  gl.bindTexture(gl.TEXTURE_2D, lutTextureId);
  console.timeEnd('Build LUT');

  // lookup uniforms
  var resolutionLocation = gl.getUniformLocation(this.program, "u_resolution");
  gl.uniform2f(resolutionLocation, outcanvas.width, outcanvas.height);  

  // $('body').prepend($(incanvas).css('width','50%'));
  // $('body').prepend($(outcanvas).css('width','50%'));
  // Now time to draw some tiles.
  var tileCanvas = document.createElement('canvas');
  
  // Figure out how many tiles we want to use:
  var nx = Math.ceil(incanvas.width / this.tilesize);
  var ny = Math.ceil(incanvas.height / this.tilesize);
  for(var ix = 0; ix<nx; ix++) {
    for (var iy =0; iy< ny; iy++) {
      // if(ix!=iy) continue; // debugging
      console.time('Build tile '+ix+' '+iy);
      
      // Copy rect coordinates:
      var x = ix*this.tilesize;
      var y = iy*this.tilesize;
      var w = Math.min(this.tilesize, incanvas.width-x);
      var h = Math.min(this.tilesize, incanvas.height-y);
      console.log(ix,iy,"xy",x,y,"wh",w,h);
      
      tileCanvas.width = w;
      tileCanvas.height = h;
      var ctx = tileCanvas.getContext('2d');
      ctx.drawImage(incanvas, x,y, w, h, 0,0,w,h);

      // Create an input texture from the wire readout
      
      gl.activeTexture(gl.TEXTURE1);  // or gl.TEXTURE0 + 7
      var textureId = this.texture_from_canvas(tileCanvas);
      gl.bindTexture(gl.TEXTURE_2D, textureId);
      // gl.createTexture();
       // // Set the parameters so we can render any size image.
      // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      //
      // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tileCanvas);
       
      var inputTextureLocation = gl.getUniformLocation(this.program, "texture");      
      gl.uniform1i(inputTextureLocation, 1); // use TEXTURE1 as your input!

      var resolutionLocation = gl.getUniformLocation(this.program, "u_resolution");
 
      // Change viewport, draw into small viewport
      // gl.uniform2f(resolutionLocation, w,h);
      // gl.viewport(x,outcanvas.height-y-h,w,h);
      // this.draw_to_rect(0,0,w,h,positionLocation);

      // Use large viewport, draw into rect
      // gl.uniform2f(resolutionLocation, outcanvas.width, outcanvas.height);
      // gl.viewport(0,0,outcanvas.width,outcanvas.height);
      // this.draw_to_rect(x,y,w,h,positionLocation);

      // Use temporary renderCanvas.
      gl.uniform2f(resolutionLocation, this.renderCanvas.width, this.renderCanvas.height);
      // gl.viewport(0,0,outcanvas.width,outcanvas.height);
      this.draw_to_rect(0,0,w,h,positionLocation);
      outcanvas.getContext('2d').drawImage(this.renderCanvas,0,0,w,h, x,y,w,h);

      // this.draw_to_rect(x,y,w,h,positionLocation);
      console.timeEnd('Build tile '+ix+' '+iy);
      gl.deleteTexture(textureId);
    }
  }
  gl.deleteTexture(lutTextureId);
  console.timeEnd('GLEngine::draw_falsecolor_from_canvas');
  console.log("Time to finish drawing via full-canvas:", performance.now() - gTimeStats_RecordChange);
  console.log("Time from start of query:", performance.now() - gTimeStats_StartQuery);
  // gl.deleteProgram(this.program);
  // this.gl = null;
  
}


//
// These routines were
// an attempt to load the images into textures and draw them as we got them
// from the server.  However, this turned out to be slower than
// building the tiledImage and then converting that wholesale, so screw it.
//

// GLEngine.prototype.draw_falsecolor_from_images = function(urlarray, pseudocolor)
// {
//   this.tile_urls = urlarray;
//
//   console.time('GLEngine::draw_falsecolor_from_images');
//
//   // For simplicity
//   var gl = this.gl;
//
//   // Get the images.
//   this.tile_images = [];
//   var self = this;
//
//   var total_width = 0;
//   var total_height = 0;
//
//   for(var irow=0;irow<this.tile_urls.length;irow++) {
//     var row_width = 0;
//     var row_height = 0;
//     var row = this.tile_urls[irow];
//     var imagerow = [];
//     for(var icol=0;icol<row.length;icol++) {
//       var elem = this.tile_urls[irow][icol];
//       var image_url = elem.url;
//       var img = new Image();
//       img.src = image_url;
//       imagerow.push(img);
//       (function(){  // Make a closure to copy the values of irow and icol
//         var jrow = irow;
//         var jcol = icol;
//         console.log("setting callback for",jrow,jcol);
//         img.onload= function() { self.draw_one_image(jrow,jcol); }
//       })();
//       row_height = Math.max(elem.height,row_height);
//       row_width  += elem.width;
//     }
//     total_height += row_height;
//     total_width  = Math.max(row_width,total_width);
//     this.tile_images.push(imagerow);
//   }
//
//   outcanvas.width = total_width;
//   outcanvas.height = total_height;
//   this.gl.viewport(0,0,outcanvas.width,outcanvas.height); // This line is required if we change canvas size
//   // after creating GL context
//
//   // I don't THINK there could be a race condition: I don't think those callbacks activate until after this function has returned
//   // and we get back to the event loop.
//
//   // setup GLSL this.program
//   var vertexShader = this.create_shader( "2d-vertex-shader");
//   var LUTShader    = this.create_shader( "lutshade");
//
//   this.program = gl.createProgram();
//   gl.attachShader(this.program,vertexShader);
//   gl.attachShader(this.program,LUTShader);
//   gl.linkProgram(this.program);
//
//   // Check the link status
//   var linked = gl.getProgramParameter(this.program, gl.LINK_STATUS);
//   if (!linked) {
//        // something went wrong with the link
//        lastError = gl.getProgramInfoLog (this.program);
//        console.error("Error in this.program linking:" + lastError);
//
//        gl.deleteProgram(this.program);
//        return null;
//    }
//
//
//   gl.useProgram(this.program);
//
//   // look up where the vertex data needs to go.
//   var positionLocation = gl.getAttribLocation(this.program, "a_position");  // Get a pointer to the a_position input given to the vertex shader fragment in the this.program.
//   var texCoordLocation = gl.getAttribLocation(this.program, "a_texCoord");  // Ditto a_texCoord
//
//   // provide texture coordinates for the rectangle we're drawing FROM
//   var texCoordBuffer = gl.createBuffer();
//   gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
//   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
//       0.0,  0.0,
//       1.0,  0.0,
//       0.0,  1.0,
//       0.0,  1.0,
//       1.0,  0.0,
//       1.0,  1.0]), gl.STATIC_DRAW);
//   gl.enableVertexAttribArray(texCoordLocation);
//   gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
//
//
//
//   console.time('Build LUT');
//   var mapTextureLocation = gl.getUniformLocation(this.program, "maptexture");
//   gl.uniform1i(mapTextureLocation, 7);
//   gl.activeTexture(gl.TEXTURE7);
//
//   var lutTextureId = this.build_LUT_texture(pseudocolor,-4095,4096);
//   gl.bindTexture(gl.TEXTURE_2D, lutTextureId);
//   console.timeEnd('Build LUT');
//
//   // lookup uniforms
//   var resolutionLocation = gl.getUniformLocation(this.program, "u_resolution");
//   gl.uniform2f(resolutionLocation, outcanvas.width, outcanvas.height);
//
//
//
// }
//
// GLEngine.prototype.draw_one_image = function(irow, icol)
// {
//   console.time('draw_one_tile');
//   var gl = this.gl;
//
//   var img = this.tile_images[irow][icol];
//
//   // Loop down to see how much to skip;
//   var y = 0;
//   var x = 0;
//   for(var i=0;i<irow;i++) { y+= this.tile_urls[i][icol]; }
//   for(var j=0;j<icol;j++) { x+= this.tile_urls[irow][j]; }
//
//
//   var w = this.tile_urls[irow][icol].width;
//   var h = this.tile_urls[irow][icol].height;
//
//   var inputTextureLocation = gl.getUniformLocation(this.program, "texture");
//   gl.uniform1i(inputTextureLocation, 1); // use TEXTURE1 as your input!
//
//   // Create an input texture from the wire readout
//   var textureId = gl.createTexture();
//   gl.activeTexture(gl.TEXTURE1);  // or gl.TEXTURE0 + 7
//   gl.bindTexture(gl.TEXTURE_2D, textureId);
//   // Set the parameters so we can render any size image.
//   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
//   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
//   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
//   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
//
//   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
//
//   this.draw_to_rect(x,y,w,h,this.positionLocation);
//   console.timeEnd('draw tile');
//   console.timeEnd('draw_one_tile');
//   console.log("Time to finish drawing tile:", performance.now() - gTimeStats_RecordChange);
//
//
// }
//
// GLEngine.prototype.re_lut_images = function(pseudocolor)
// {
//   console.time('re_lut');
//
//   var gl = this.gl;
//   console.time('Build LUT');
//   var mapTextureLocation = gl.getUniformLocation(this.program, "maptexture");
//   gl.uniform1i(mapTextureLocation, 7);
//   gl.activeTexture(gl.TEXTURE7);
//
//   var lutTextureId = this.build_LUT_texture(pseudocolor,-4095,4096);
//   gl.bindTexture(gl.TEXTURE_2D, lutTextureId);
//   console.timeEnd('Build LUT');
//
//
//   for(var irow=0;irow<this.tile_urls.length;irow++) {
//     for(var icol=0;icol<this.tile_urls[irow].length;icol++) {
//       this.draw_one_image(irow,icol);
//     }
//   }
//   console.timeEnd('re_lut');
// }


// Functions used in testing.

// $(function(){
//   // gStateMachine.Bind('recordChange',go_gl);
// });
//
// function go_gl_stitch()
// {
//   console.warn("go_gl_stitch");
//   console.time("go_gl_stitch");
//   console.time("Get pseudo");
//   ps = new PsTest();
//   console.timeEnd("Get pseudo");
//   var incanvas = gRecord._raw_tiled_canvas.offscreenCanvas;
//   gle = new GLEngine ;
//   gle.canvas.height = incanvas.height; gle.canvas.width = incanvas.width;
//   gle.draw_falsecolor_from_canvas(gRecord._raw_tiled_canvas.offscreenCanvas, ps, gle.gl.getParameter(gle.gl.MAX_TEXTURE_SIZE)/2);
//   console.timeEnd("go_gl_stitch");
//   $('body').prepend(gle.canvas);
// }
//
//
// function go_gl()
// {
//   console.warn("go_gl");
//
//   ps = new PsTest();
//
//   gle = new GLEngine ;
//   gle.draw_falsecolor_from_images(gRecord.raw.DAQ.wireimg_encoded_tiles, ps);
// }


// function go_gl()
// {
//   ps = new PsTest();
//   // var incanvas = gRecord._raw_tiled_canvas.offscreenCanvas;
//   gle = new GLEngine ;
//   gle.canvas.height = incanvas.height; gle.canvas.width = incanvas.width;
//   gle.draw_falsecolor_lookup(incanvas, ps, gle.gl.getParameter(gle.gl.MAX_TEXTURE_SIZE)/2);
// }
  

