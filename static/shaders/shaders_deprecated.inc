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
  #extension GL_OES_standard_derivatives:enable

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
