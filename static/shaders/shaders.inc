<!-- vertex shader -->
<script id="2d-vertex-shader" type="x-shader/x-vertex">
attribute vec2 a_position;
attribute vec2 a_texCoord;

uniform vec2 u_resolution;
varying vec2 v_texCoord;

void main() {

   // convert the rectangle from pixels to 0.0 to 1.0
   vec2 zeroToOne = a_position / u_resolution;

   // convert from 0->1 to 0->2
   vec2 zeroToTwo = zeroToOne * 2.0;

   // convert from 0->2 to -1->+1 (clipspace)
   vec2 clipSpace = zeroToTwo - 1.0;

   gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1); // Flips vertically?

   // pass the texCoord to the fragment shader
   // The GPU will interpolate this value between points.
    v_texCoord = a_texCoord;
}
</script>


<script id="three-vertex-shader" type="x-shader/x-fragment">
  varying vec2 vUv;
  varying vec3 vPosition;

   void main() {
       vUv = uv;
       vPosition = (modelMatrix *
           vec4(position,1.0)).xyz;
       gl_Position = projectionMatrix *
           modelViewMatrix *
           vec4(position,1.0);
   }
</script>



<script id="three-fragment-shader-time-range" type="x-shader/x-fragment">
// This variant allows multiple time-domain textures, which are used to scroll through tdc count

precision mediump float;

// set of textures in tdc dimention, consecutive.  The y-coordinate of all of these should be identical.

uniform float     texture_start_chan;
uniform float     texture_size_chan;

uniform sampler2D texture0;
uniform float     texture0_start_tdc;
uniform float     texture0_size_tdc;
uniform sampler2D texture1;
uniform float     texture1_start_tdc;
uniform float     texture1_size_tdc;
uniform sampler2D texture2;
uniform float     texture2_start_tdc;
uniform float     texture2_size_tdc;
uniform sampler2D texture3;
uniform float     texture3_start_tdc;
uniform float     texture3_size_tdc;
uniform sampler2D texture4;
uniform float     texture4_start_tdc;
uniform float     texture4_size_tdc;
// uniform sampler2D texture5;
// uniform float     texture5_start_tdc;
// uniform float     texture5_size_tdc;

uniform sampler2D maptexture;
uniform int   do_noise_reject;
uniform int   do_bad_channel_flag;

// the stuff I want to draw:
uniform float chan_start;
uniform float chan_end;
uniform float tdc_start;
uniform float tdc_end;

uniform float trans_low_cut;
uniform float trans_high_cut;
uniform float trans_fade_width;

uniform int    flip;

// uniform vec2 crop_start; // x,y of start crop region in (wire,tdc) i.e. rotated
// uniform vec2 crop_end;   // x,y of stop crop region in (wire,tdc) i.e. rotated

varying vec2  vUv;
varying vec3  vPosition;

void main() {
  // vUv is the normalized U,V coordinate in the object which nominally
  // maps to inputtexture(u,v).  However, we're going to manipulate it:

  // invert the UV texture coordinates so that time is vertical.
  vec2 uv_final;

  // wire coordinate (x in source texture, y in UV coordinate system used by the polygon)
  float wire = mix(chan_start,chan_end,vUv.x); //(vUv.x*(chan_end-chan_start) + chan_start);   // x*end (1-x)*start
  uv_final.y = 1.-(wire-texture_start_chan)/texture_size_chan;

  // tdc coordinate for this pixel
  float v = vUv.y;
  if(flip>0) v=1.-vUv.y;
  float tdc = v*(tdc_end-tdc_start)+tdc_start;

  // find which texture
  vec4 inc;
  if(tdc < texture0_start_tdc) {
    // Scrolling the t0 past the limits of the data
    gl_FragColor = vec4(0.0, 1.0, 0.0, 0.0);
    return;

  } else if(tdc< (texture0_start_tdc + texture0_size_tdc)) {
    uv_final.x = (tdc-texture0_start_tdc) / texture0_size_tdc ;
    inc = texture2D(texture0, uv_final);
  
  } else if(tdc< (texture1_start_tdc + texture1_size_tdc)) {
    uv_final.x = (tdc-texture1_start_tdc) / texture1_size_tdc ;
    inc = texture2D(texture1, uv_final);

  } else if(tdc< (texture2_start_tdc + texture2_size_tdc)) {
    uv_final.x = (tdc-texture2_start_tdc) / texture2_size_tdc ;
    inc = texture2D(texture2, uv_final);

  } else if(tdc< (texture3_start_tdc + texture3_size_tdc)) {
    uv_final.x = (tdc-texture3_start_tdc) / texture3_size_tdc ;
    inc = texture2D(texture3, uv_final);

  } else if(tdc< (texture4_start_tdc + texture4_size_tdc)) {
    uv_final.x = (tdc-texture4_start_tdc) / texture4_size_tdc ;
    inc = texture2D(texture4, uv_final);

  // } else if(tdc< (texture5_start_tdc + texture5_size_tdc)) {
  //   uv_final.x = (tdc-texture5_start_tdc) / texture5_size_tdc ;
  //   inc = texture2D(texture5, uv_final);

  } else {
    // Scroll past limits of data

    gl_FragColor = vec4(0,0,0,0);
    //gl_FragColor = vec4(1,0,0,1);
    return;
  }

  // Now I want to see if I'm in a 'fade-out' region.
  // smoothstep is a builtin that makes a nice transition from 0 to 1
  float fade = smoothstep(trans_low_cut-trans_fade_width, trans_low_cut+trans_fade_width, vPosition.x)
              * (1.-smoothstep(trans_high_cut-trans_fade_width, trans_high_cut+trans_fade_width, vPosition.x));




  // vec2 uv_texture;
  // uv_texture = vec2(vUv.y,vUv.x);

  // rescale to our clip coordinates.
  // uv_texture = (vUv * (crop_end-crop_start) + crop_start)/texture_size;

  // vec2 uv_final;
  // uv_final = vec2(uv_texture.y,1.0-uv_texture.x);
  
  // vec4 inc = texture2D(inputtexture, uv_final);
  // inc is now the RGBA color of the input pixel, with each color encoded as a float from 0 to 1.
  
  


  
  // Note that full-value is 1.0, so need to multiply to 255 to get a proper integer address.
  int g = int(inc.g*255.0);
  int r = int(inc.r*255.0);
  int b = int(inc.b*255.0);

  // if(g==256) {
  //    // Shouldn't happen!
  //    gl_FragColor = vec4(1,0,0,0);
  //    return;
  // }
  
  // Subtract the noise which is stored in the blue channel.
  if(do_noise_reject>0 && b<0xff) {
    g = g - b + 128;
    if(g<0)   { r-=1; g+=256;}
    if(g>255) { r+=1; g-=256;}
  }

  // Dead channels.
  if(b>=0xff && do_bad_channel_flag==0) { g=0x80; r=0x80; } // dead channel - zero it out.

  // Ok, we have our final value of the ADC for this pixel coded as GR; look that shit up in the lookup table.
  vec2 lookup_coords = vec2( (float(g)+0.5)/256.0 , (float(256-r)+0.5)/256.0 );
  
  gl_FragColor = texture2D(maptexture, lookup_coords);
  gl_FragColor.a *= fade;  // make edges transparent
  // gl_FragColor = mix( vec4(1,0,0,1), vec4(0,1,0,1) , fade ); // Red instead of transparent


  if(b>=0xff && do_bad_channel_flag==2) { gl_FragColor.r = 0.; gl_FragColor.g = 0.; gl_FragColor.b=0.; gl_FragColor.a=1.;} // dead channel - black, no opacity.

 
} 

</script>


<script id="three-fragment-shader" type="x-shader/x-fragment">
precision mediump float;

uniform sampler2D inputtexture;
uniform sampler2D maptexture;
uniform int   do_noise_reject;
uniform int   do_bad_channel_flag;
uniform int   do_smear;
uniform int   do_edge_finder;
uniform float pixel_width_x;
uniform float pixel_width_y;


uniform vec2 texture_size;  // height, width of image in pixels (note reversed!)
uniform vec2 crop_start; // x,y of start crop region in (wire,tdc) i.e. rotated
uniform vec2 crop_end;   // x,y of stop crop region in (wire,tdc) i.e. rotated

varying vec2  vUv;

void main() {
  // vUv is the normalized U,V coordinate in the object which nominally
  // maps to inputtexture(u,v).  However, we're going to manipulate it:
  
  // invert the UV texture coordinates so that time is vertical.
  vec2 uv_texture;
  uv_texture = vec2(vUv.y,vUv.x);
  
  // rescale to our clip coordinates.
  uv_texture = (vUv * (crop_end-crop_start) + crop_start)/texture_size;

  vec2 uv_final;
  uv_final = vec2(uv_texture.y,1.0-uv_texture.x);
  
  vec4 inc = texture2D(inputtexture, uv_final);
  // inc is now the RGBA color of the input pixel, with each color encoded as a float from 0 to 1.
  
  
  if(do_smear>0){
    inc = inc*0.;
    vec2 coord;

    coord = vec2(uv_final.x,uv_final.y+1./texture_size.y);
    inc += 0.25*texture2D(inputtexture, coord);
    coord = vec2(uv_final.x,uv_final.y-1./texture_size.y);
    inc += 0.25*texture2D(inputtexture, coord);
    coord = vec2(uv_final.x+1./texture_size.x,uv_final.y);
    inc += 0.25*texture2D(inputtexture, coord);
    coord = vec2(uv_final.x-1./texture_size.x,uv_final.y);
    inc += 0.25*texture2D(inputtexture, coord);
  }


  
  // // This DOES work and should give the correct ADC value in integers
  int g = int(inc.g*255.0);
  int r = int(inc.r*255.0);
  int b = int(inc.b*255.0);
  
  // Subtract the noise which is stored in the blue channel.
  if(do_noise_reject>0 && b<0xff) {
    g = g - b + 128;
    if(g<0)   { r-=1; g+=256;}
    if(g>255) { r+=1; g-=256;}
  }

  if(do_edge_finder>0) {
    vec4 inc2 = texture2D(inputtexture,  vec2(uv_final.x+(pixel_width_x),uv_final.y));
    int g2 = int(inc2.g*255.0);
    int r2 = int(inc2.r*255.0);
    int b2 = int(inc2.b*255.0);
    if(do_noise_reject>0 && b2<0xff) {
      g2 = g2 - b2 + 128;
      if(g2<0)   { r2-=1; g2+=256;}
      if(g2>255) { r2+=1; g2-=256;}
    }

    g = (g - g2) + 0x80;
    r = (r - r2) + 0x80;
    if(g<0)   { r-=1; g+=256;}
    if(g>255) { r+=1; g-=256;}
    if(g<0)   { r-=1; g+=256;}
    if(g>255) { r+=1; g-=256;}
    if(g<0)   { r-=1; g+=256;}
    if(g>255) { r+=1; g-=256;}
  }

  if(b==0xff && do_bad_channel_flag==0) { g=0x80; r=0x80; } // dead channel - zero it out.

  vec2 lookup_coords = vec2( (float(g)-0.5)/255.0 , (float(r)-0.5)/255.0 );
  gl_FragColor = texture2D(maptexture, lookup_coords);
  

  if(b==0xff && do_bad_channel_flag==2) { gl_FragColor.r = 0.; gl_FragColor.g = 0.; gl_FragColor.b=0.; gl_FragColor.a=0.;} // dead channel - black, no opacity.
  

    
}

</script>



