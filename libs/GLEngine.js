

// Create the mapper objects.
$(function(){
  gGLMapperRawLowres = new GLMapper('raw_lowres');
  gGLMapperCalLowres = new GLMapper('cal_lowres');

  gGLMapperRaw = new GLMapper('raw');
  gGLMapperCal = new GLMapper('cal');
  
  gGLMappers = {
    'raw': gGLMapperRaw,
    'cal': gGLMapperCal,
    'raw_lowres': gGLMapperRawLowres,
    'cal_lowres': gGLMapperCalLowres,
  }
});

//
// Add a function to the built-in Image object
// that peforms a load, but reports progress as it goes.
Image.prototype.load = function(url){
        var thisImg = this;
        var xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open('GET', url,true);
        xmlHTTP.responseType = 'arraybuffer';
        xmlHTTP.onload = function(e) {
            var blob = new Blob([this.response]);
            thisImg.src = window.URL.createObjectURL(blob);
        };
        xmlHTTP.onprogress = function(e) {
          thisImg.completedTotal = e.total;
          thisImg.completedLoaded = e.loaded;
          thisImg.completedFrac = e.loaded / e.total;
          if(thisImg.onprogress) thisImg.onprogress(e);
        };
        xmlHTTP.onloadstart = function() {
          thisImg.completedFrac = 0;
          thisImg.completedTotal = 1;
          thisImg.completedLoaded = 0;
        };
        xmlHTTP.send();
    };    
Image.prototype.completedFrac = 0;
Image.prototype.completedTotal = 1;
Image.prototype.completedLoaded = 0;
// Image.prototype.onprogress = function(e) { console.log("default onprogress",e); };


function GLMapper(typ) // "raw" or "cal"
{
  this.typ = typ; 
  
  // Space to hold image tiles.
  this.tile_images = [];
  this.loaded = false;
  this.total_width = 0;
  this.total_height = 0;
  this.num_images_loaded = 0;
  this.num_images_needed = 0;
  this.need_lut_rebuild = true;
  
  // Space to hold textures.
  this.tile_textures = [];

  var self = this;
  gStateMachine.Bind('recordChange',this.NewRecord.bind(this));
  // gStateMachine.Bind('ChangePsuedoColor',this.Render.bind(this));
  gStateMachine.Bind('ChangePsuedoColor',function(){self.need_lut_rebuild = true;});

  this.SetupGLAndCanvas(10,10);
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
  // var LUTShader    = this.create_shader( "lutshade");
  // var LUTShader    = this.create_shader( "lutshade-with-noise-removal");
  var LUTShader       = this.create_shader( "lutshade-with-noise-removal-and-smear" );

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
      this.scale_x  = gRecord[this.typ][product].wireimg_scale_x || 1;
      this.scale_y  = gRecord[this.typ][product].wireimg_scale_y || 1;
      if(this.tile_urls) this.StartLoad();
    }    
  }
}

GLMapper.prototype.StartLoad = function()
{
  // FIXME Could explicitly delete images and textures - might improve GPU memory, but not required.
  this.tile_images = [];
  this.tile_textures = [];
  
  console.time("GLMapper.StartLoad",this.typ);
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
  
  
  this.num_images_needed = 0;  
  this.num_images_loaded = 0;
  $('.wireimg-encoded-progressbar-text').text("Loading wire data...");  
  $("div.wireimg-encoded-progressbar").progressbar();
  $("div.wireimg-encoded-progressbar").progressbar("option",{value:false});
  
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
        img.onprogress= function(e) { self.ImageProgress(jrow,jcol,e); }
        
      })();
      img.load(image_url);
      // img.src = image_url; // Set SRC after setting callback, in case of race condition
    }
    this.tile_images.push(imagerow);
    this.tile_textures.push(texturerow);
  }
  
}

GLMapper.prototype.ImageProgress = function(jrow,jcol,e)
{
  // Add up total progress.
  // if(e) console.log("ImageProgress",jrow,jcol,e.loaded,e.total,e);
  var numerator = 0;
  var denominator = 0;
  for(var irow=0;irow<this.tile_images.length;irow++) {
    for(var icol=0;icol<this.tile_images[irow].length;icol++) {
      var elem = this.tile_urls[irow][icol];
      var img = this.tile_images[irow][icol];
      var done = img.completedLoaded;
      var bytes = img.completedTotal;
      if(bytes < 10) bytes = 3128138;
      denominator += bytes;
      // if(img.complete) done = bytes;
      numerator += done;      
      // console.log("  img",irow,icol,img.completedFrac,numerator,denominator);
    }
  }
  
  var percent = numerator/denominator*100;
  // console.log("Image progress:",numerator,denominator,percent);
  $('.wireimg-encoded-progressbar-text').text("Loading wire data... "+parseInt(percent)+"%");
  $("div.wireimg-encoded-progressbar").progressbar("option",{value:percent});
  
}

GLMapper.prototype.ImageLoaded = function(jrow,jcol)
{
  console.log("GLMapper::ImageLoaded",this.typ,jrow,jcol);
  console.time("GLMapper::ImageLoaded: one image");
  this.ImageProgress(jrow,jcol);
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
  // $("div.wireimg-encoded-progressbar").progressbar("destroy");
  $('.wireimg-encoded-progressbar-text').text("Loaded!");
  

  // Hack to see if this improves the control-room computer: instead of immediately rendering, instead include a 1s timeout.
  // setTimeout(this.Render.bind(this),500);
  gStateMachine.Trigger('colorWireMapsChanged');  

  console.log("Time to finish drawing via full-canvas:", performance.now() - gTimeStats_RecordChange);
  console.log("Time from start of query:", performance.now() - gTimeStats_StartQuery);
  
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
  var start_x = -0x1000-0x80;
  var stop_x =   0x1000-0x80;
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




GLMapper.prototype.SetRect = function( x, y, w, h ) 
{
  // Set a rectangle the same size as the image.
  //   console.warn("SetRect",x,y,w,h);
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


GLMapper.prototype.RequestRendering = function(
      x,
      y,
      w,
      h,
      dest_w,
      dest_h
      )
{
  // Do a limited rendering request.
  if(!this.loaded) return;
  console.log('GLMapper::RequestRendering');
  console.time('GLMapper::RequestRendering');

  if(this.canvas.width < dest_w || this.canvas.height < dest_h) {
    // FIXME
    console.warn("Need to rebuild the rendering context from ",this.canvas.width,this.canvas.height);
    this.canvas.width  = Math.max(dest_w,this.canvas.width);
    this.canvas.height = Math.max(dest_h,this.canvas.height);
    // $(this.canvas).css("width",this.canvas.width);
    // $(this.canvas).css("height",this.canvas.height);
    console.warn("                                        to ",this.canvas.width,this.canvas.height);    
    this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
  }
  // copy the output canvas to the gRecord so others can get at it.

  // Assume no rebuilding of texture is required - this should be done on some other call
  if(this.need_lut_rebuild) {
    console.time('Build LUT');
    var mapTextureLocation = this.gl.getUniformLocation(this.program, "maptexture");
    this.build_LUT_texture();
    this.gl.uniform1i(mapTextureLocation, 7);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.LUT_texture);
    console.timeEnd('Build LUT');
    this.need_lut_rebuild=false;
  }
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


  var positionLocation = this.gl.getAttribLocation(this.program, "a_position");  // Get a pointer to the a_position input given to the vertex shader fragment in the this.program.
  
  var inputTextureLocation = this.gl.getUniformLocation(this.program, "inputtexture");      
  this.gl.uniform1i(inputTextureLocation, 1); // use TEXTURE1 as your input!
  
  var resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution");
  this.gl.uniform2f(resolutionLocation, this.canvas.width,this.canvas.height);

  var filter = $('#ctl-coherent-noise-filter').is(":checked") ? 1:0;
  var do_noise_reject_location = this.gl.getUniformLocation(this.program, "do_noise_reject");
  this.gl.uniform1i(do_noise_reject_location, filter); // 1 = on 0 = off
  
  var bad_channel_flag = $('input:radio.ctl-bad-wire-filter:checked').val();
  var do_bad_channel_location = this.gl.getUniformLocation(this.program, "do_bad_channel_flag");
  this.gl.uniform1i(do_bad_channel_location, bad_channel_flag); // 1 = on 0 = off
  
  // Controls for doing a nearest-neighbor pixel smear.
  var do_smear = 0;
  var do_smear_location = this.gl.getUniformLocation(this.program, "do_smear");
  this.gl.uniform1i(do_smear_location, do_smear); // 1 = on 0 = off

  this.gl.uniform1f(this.gl.getUniformLocation(this.program, "pixel_width_x"), 0.5/this.total_width);
  this.gl.uniform1f(this.gl.getUniformLocation(this.program, "pixel_width_y"), 0.5/this.total_height);

  

  
  var buffer = this.gl.createBuffer();
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);  // This is current buffer
  this.gl.enableVertexAttribArray(positionLocation); // Use the current buffer for position location array
  this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0); // It's an array of floats.

  var stretch_x = dest_w/w;
  var stretch_y = dest_h/h;
  // loop textures.
  for(var irow=0;irow<this.tile_textures.length;irow++) {
    for(var icol=0;icol<this.tile_textures[irow].length;icol++) {
      // FIXME: skip elements that are certainly off-screen.
      
      var elem = this.tile_urls[irow][icol];
      // console.log("rendering ",irow,icol,elem.x,elem.y,elem.width,elem.height);
      var tex = this.tile_textures[irow][icol];

      this.gl.activeTexture(this.gl.TEXTURE1);
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      
      this.SetRect((elem.x-x)*stretch_x,(elem.y-y)*stretch_y,elem.width*stretch_x,elem.height*stretch_y);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }
  }
  console.timeEnd('GLMapper::RequestRendering');   
  return this.canvas;
  
}

