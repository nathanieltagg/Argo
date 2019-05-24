"use strict";

// Create the mapper objects.
$(function(){
  // gGLMapperRawLowres = new GLMapper('raw_lowres');
  // gGLMapperCalLowres = new GLMapper('cal_lowres');
  //
  // gGLMapperRaw = new GLMapper('raw');
  // gGLMapperCal = new GLMapper('cal');
  //
  // gGLMappers = {
  //   'raw': gGLMapperRaw,
  //   'cal': gGLMapperCal,
  //   'raw_lowres': gGLMapperRawLowres,
  //   'cal_lowres': gGLMapperCalLowres,
  // }
  //
  gStateMachine.Bind('newPiece',CreateGLMappers);
  
});

/// Do this even before the start-of-document functions.
// Get optimal tilesize.
// Create openGL engine.
var kMaxTileSize = 3048;
var testGLcanvas = document.createElement('canvas');
var testGL = testGLcanvas.getContext('webgl');
if(testGL) kMaxTileSize = testGL.getParameter(testGL.MAX_TEXTURE_SIZE);
testGL = null; // release
testGLcanvas = null;  //release
  

// Debugging functionality for gl contexts
function logGLCall(functionName, args) {   
   console.log("gl." + functionName + "(" + 
      WebGLDebugUtils.glFunctionArgsToString(functionName, args) + ")");   
} 



function CreateGLMappers()
{
  if(!gRecord) return;
  // Create the tiled images. Do only for full images (not lowres)
  for(var _type of ["wireimg-lowres", "wireimg"]) {
    if(gRecord[_type]) 
      for(var _name in gRecord[_type]) {
        if(_name.startsWith('_')) continue; // skip my index properites.
        if(! gRecord[_type][_name]._glmapper) {
          console.warn("Create GL mapper on ",_type,_name);
          gRecord[_type][_name]._glmapper = new GLMapper(_type,_name);
        
        }
      }
  }
}



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


function GLMapper(_type,_name) // "raw" or "cal"
{
  this._type = _type; 
  this._name = _name; 
  
  // Space to hold image tiles.
  this.tile_images = [];
  this.loaded = false;
  this.total_width = 0;
  this.total_height = 0;
  this.num_images_loaded = 0;
  this.num_images_needed = 0;
  
  // Space to hold textures.
  this.tile_textures = [];
  this.tile_3textures = [];

  
  // Start loading.
  this.src = gRecord[this._type][this._name];
  if(this.src) {
    this.tile_urls= this.src.wireimg_encoded_tiles;
    this.scale_x  = this.src.wireimg_scale_x || 1;
    this.scale_y  = this.src.wireimg_scale_y || 1;
    if(this.tile_urls) this.StartLoad();
  }    
  
}



GLMapper.prototype.StartLoad = function()
{
  // FIXME Could explicitly delete images and textures - might improve GPU memory, but not required.
  this.tile_images = [];
  this.tile_3textures = [];
  this.tile_rawdata = [];
  this.tile_canvases = [];
  
  console.time("GLMapper.StartLoad",this._type,this._name);
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
    var threetexturerow =[];
    var datarow = [];
    var canvasrow  = [];
    for(var icol=0;icol<row.length;icol++) {
      this.num_images_needed++
      
      var elem = this.tile_urls[irow][icol];
      var image_url = elem.url;
      var img = new Image();

      console.log('creating texture');

      var threetex = new THREE.Texture(img);
      threetex.magFilter = THREE.NearestFilter;
      threetex.minFilter = THREE.NearestFilter;
      threetex.wrapS     = THREE.ClampToEdgeWrapping;
      threetex.wrapT     = THREE.ClampToEdgeWrapping;
      threetexturerow.push(threetex);
      console.log('finished texture');
      datarow.push(null);
      canvasrow.push(document.createElement('canvas'));
      
      imagerow.push(img);
      (function(){  // Make a closure to copy the values of irow and icol
        var jrow = irow;
        var jcol = icol;
        // console.log("setting callback for",jrow,jcol);
        img.onload= function() { self.ImageLoaded(jrow,jcol); }
        img.onprogress= function(e) { self.ImageProgress(jrow,jcol,e); }
        
      })();
      img.load(image_url);
      // img.src = image_url; // Set SRC after setting callback, in case of race condition
    }
    this.tile_images.push(imagerow);
    this.tile_3textures.push(threetexturerow);
    this.tile_rawdata.push(datarow);
    this.tile_canvases.push(canvasrow);
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
  this.ImageProgress(jrow,jcol);
  //Draw in this particular item.
  var elem = this.tile_urls[jrow][jcol];
  var img = this.tile_images[jrow][jcol];
  var canvas = this.tile_canvases[jrow][jcol];
    
  // This is all we need in three.js, which is cool:
  var tex = (this.tile_3textures[jrow][jcol]);
  if(tex) tex.needsUpdate = true;

  // This code pre-loads all raw binary waveform data into arrays. Not sure this is worth it.

  canvas.width = elem.width;
  canvas.height = elem.height;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(img,0,0);
  // this.tile_rawdata[jrow][jcol] = ctx.getImageData(0,0,elem.width,elem.height);
  // this.tile_canvases[jrow][jcol] = null; // delete canvas after done.
  
  this.num_images_loaded++;

  // Next line ensures that Render() only called once; many images can register complete before they fire this event.
  if(this.num_images_loaded < this.num_images_needed) return;
    
  // See if we have them all...
  var loaded = true;
  for(var irow=0;irow<this.tile_images.length;irow++) {
    for(var icol=0;icol<this.tile_images[irow].length;icol++) {
      var elem = this.tile_urls[irow][icol];
      var img = this.tile_images[irow][icol];
      var tex = this.tile_3textures[irow][icol];
      if(!tex) loaded = false
      if( !(img.complete) ) loaded = false;
    }
  }
  this.loaded = loaded;
  if(!this.loaded) return;
  $('.wireimg-encoded-progressbar-text').text("Loaded!");
  

  gStateMachine.Trigger('colorWireMapsChanged');    
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
  // console.log('GLMapper::RequestRendering');
  
}

