

$(function(){
  gGLMapperRaw = new GLMapper('raw');
  //$('body').append(gGLMapperRaw.canvas)
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



GLMapper.prototype.SetupGLAndCanvas = function(width, height)
{
  // Create openGL engine.
  this.canvas = document.createElement('canvas');
  this.canvas.width = width;
  this.canvas.height = height;

  console.time("GLEngine::create gl context");
   try {
    this.gl = this.canvas.getContext('webgl',{ alpha: false, antialias: false,  depth: false })
              || this.canvas.getContext('webgl')
              || this.canvas.getContext('experimental-webgl');
  } catch(e)  {
    console.error("Cannot crate WebGL context: "  + e.toString());
    return;
  };

  console.timeEnd("GLEngine::create gl context");
  if(!this.gl) {
    console.error("Lost GL context somewhere.");
    window.alert("WebGL not enabled?  If using Safari, you can turn it on in Preferences / Security");
    return;
  }

  // Add debugging.
  // function logGLCall(functionName, args) {
  //    console.log("gl." + functionName + "(" +
  //       WebGLDebugUtils.glFunctionArgsToString(functionName, args) + ")");
  // }
  //
  // Uncomment this line for debugging.
  //this.gl = WebGLDebugUtils.makeDebugContext(this.gl, undefined, logGLCall);
    
   // This line is required if we change canvas size
  // after creating GL context
  // this.gl.viewport(0,0,outcanvas.width,outcanvas.height);
  
  // setup GLSL this.program
  var vertexShader = this.create_shader( "2d-vertex-shader");
  var LUTShader    = this.create_shader( "lutshade");
  var stupid       = this.create_shader( "stupidfill");

  this.program = this.gl.createProgram();
  this.gl.attachShader(this.program,vertexShader);
  this.gl.attachShader(this.program,LUTShader);
  // this.gl.attachShader(this.program,stupid);
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


  //provide texture coordinates for the rectangle we're drawing FROM
  var texCoordBuffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      0.0,  0.0,
      1.0,  0.0,
      0.0,  1.0,
      0.0,  1.0,
      1.0,  0.0,
      1.0,  1.0]), this.gl.STATIC_DRAW);

  var texCoordLocation = this.gl.getAttribLocation(this.program, "a_texCoord");
  this.gl.enableVertexAttribArray(texCoordLocation);
  this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);
  
}

GLMapper.prototype.NewRecord = function()
{
  console.log("GLMapper",this.typ," NewRecord()");
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
  
  console.time("GLMapper.StartLoad");
  var self = this;
  
  this.loaded = false;
  this.total_width = 0;
  this.total_height = 0;

  // Compute size needed.
  for(var irow=0;irow<this.tile_urls.length;irow++) {
    var row_width = 0;
    var row_height = 0;
    var row = this.tile_urls[irow];
    for(var icol=0;icol<row.length;icol++) {
      var elem = this.tile_urls[irow][icol];
      row_height = Math.max(elem.height,row_height);
      row_width  += elem.width;
    }
    this.total_height += row_height;
    this.total_width  = Math.max(row_width,this.total_width);
  }

  // Only now can we set up the GL context. Why? Because for
  // some stupid reason, this doesn't work:
  // - set canvas size to w1,h1
  // - create gl context
  // - change canvas size w2,h2 (different from above)
  // - gl.viewport(0,0,w2,h2)
  // I have no idea why, but I'm pissed off about it.  July 2015
  this.SetupGLAndCanvas(this.total_width,this.total_height);
  
  this.num_images_needed = 0;  
  this.num_images_loaded = 0;
  
  for(var irow=0;irow<this.tile_urls.length;irow++) {
    var row = this.tile_urls[irow];
    var imagerow = [];
    var texturerow = [];
    for(var icol=0;icol<row.length;icol++) {
      this.num_images_needed++
      
      var elem = this.tile_urls[irow][icol];
      var image_url = elem.url;
      var img = new Image();
      
      imagerow.push(img);
      texturerow.push(this.gl.createTexture());
      (function(){  // Make a closure to copy the values of irow and icol
        var jrow = irow;
        var jcol = icol;
        console.log("setting callback for",jrow,jcol);        
        img.onload= function() { self.ImageLoaded(jrow,jcol); }
      })();
      img.src = image_url; // Set SRC after setting callback, in case of race condition      
    }
    this.tile_images.push(imagerow);
    this.tile_textures.push(texturerow);
  }
  
}

GLMapper.prototype.ImageLoaded = function(jrow,jcol)
{
  console.log("GLMapper::ImageLoaded",jrow,jcol);
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

  // Next line ensures that Render() only called once; many images can register complete before they fire this event.
  if(this.num_images_loaded < this.num_images_needed) return;
    
  // See if we have them all...
  var loaded = true;
  for(var irow=0;irow<this.tile_images.length;irow++) {
    for(var icol=0;icol<this.tile_images[irow].length;icol++) {
      var elem = this.tile_urls[irow][icol];
      var img = this.tile_images[irow][icol];
      var tex = this.tile_textures[irow][icol];
      if(!tex) loaded = false;
      if( !(img.complete) ) loaded = false;
    }
  }
  this.loaded = loaded;
  if(!this.loaded) return;
  console.timeEnd("GLMapper.StartLoad");

  console.log("GLMapper finished loading, going on to render ",this.typ,this.num_images_loaded);
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
  // if(this.LUT_texture)  this.gl.deleteTexture(this.LUT_texture);
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
  if(!this.loaded) return;
  console.log('GLMapper::Render');
  console.time('GLMapper::Render');

  // copy the output canvas to the gRecord so others can get at it.
  var utyp = '_' + this.typ;
  if(!gRecord[utyp]) gRecord[utyp] = {};
  if(!gRecord[utyp].colored_wire_canvas) gRecord[utyp].colored_wire_canvas = this.canvas;

  console.time('Build LUT');  
  var mapTextureLocation = this.gl.getUniformLocation(this.program, "maptexture");
  this.build_LUT_texture();
  this.gl.uniform1i(mapTextureLocation, 7);
  this.gl.bindTexture(this.gl.TEXTURE_2D, this.LUT_texture);
  console.timeEnd('Build LUT');

  var positionLocation = this.gl.getAttribLocation(this.program, "a_position");  // Get a pointer to the a_position input given to the vertex shader fragment in the this.program.
  
  var inputTextureLocation = this.gl.getUniformLocation(this.program, "inputtexture");      
  this.gl.uniform1i(inputTextureLocation, 1); // use TEXTURE1 as your input!
  
  var resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution");
  this.gl.uniform2f(resolutionLocation, this.canvas.width,this.canvas.height);
  console.log("resolution", this.canvas.width,this.canvas.height);

  // var tex = this.tile_textures[0][0];
  // this.gl.activeTexture(this.gl.TEXTURE1);
  // this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
  // this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
  // this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
  // this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
  // this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

  var buffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);  // This is current buffer
  this.gl.enableVertexAttribArray(positionLocation); // Use the current buffer for position location array
  this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0); // It's an array of floats.

  // var x,y,w,h;
  // x = 500.;
  // y = 800.;
  // w = 500.;
  // h = 200.;
  // console.log("Drawing",x,y,w,h);
  // this.SetRect(x,y,w,h);
  //
  // // Draw the rectangle.
  // this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  
  // loop textures.
  for(var irow=0;irow<this.tile_textures.length;irow++) {
    for(var icol=0;icol<this.tile_textures[irow].length;icol++) {
  // for(var irow=0;irow<1;irow++) {
  //   for(var icol=0;icol<1;icol++) {
  //
      var elem = this.tile_urls[irow][icol];
      console.log("rendering ",irow,icol,elem.x,elem.y,elem.width,elem.height);
      var tex = this.tile_textures[irow][icol];

      this.gl.activeTexture(this.gl.TEXTURE1);
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.SetRect(elem.x,elem.y,elem.width,elem.height);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }
  }
  
  console.timeEnd('GLMapper::Render');
  console.log("Time to finish drawing via full-canvas:", performance.now() - gTimeStats_RecordChange);
  console.log("Time from start of query:", performance.now() - gTimeStats_StartQuery);
  gStateMachine.Trigger('colorWireMapsChanged');
}


GLMapper.prototype.SetRect = function( x, y, w, h ) 
{
  // Set a rectangle the same size as the image.
  console.warn("SetRect",x,y,w,h);
  var x1 = x;
  var x2 = x + w;
  var y1 = y;
  var y2 = y + h;
  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
     x1, y1,
     x2, y1,
     x1, y2,
     x1, y2,
     x2, y1,
     x2, y2]), this.gl.STATIC_DRAW);

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


